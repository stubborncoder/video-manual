"""HTTP streaming endpoint for project compilation using assistant-stream protocol."""

import logging
from typing import Any, List, Optional

from fastapi import APIRouter, Request, Cookie
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from assistant_stream import create_run, RunController
from assistant_stream.serialization import DataStreamResponse
from assistant_stream.modules.langgraph import append_langgraph_event
from langchain_core.messages import HumanMessage

from ...storage.project_storage import ProjectStorage

logger = logging.getLogger(__name__)

router = APIRouter()


class MessagePart(BaseModel):
    type: str
    text: Optional[str] = None


class Message(BaseModel):
    role: str
    parts: List[MessagePart]


class AddMessageCommand(BaseModel):
    type: str = "add-message"
    message: Message


class AddToolResultCommand(BaseModel):
    type: str = "add-tool-result"
    toolCallId: str
    result: Any


class CompileRequest(BaseModel):
    """Request payload for compile endpoint."""
    project_id: str
    language: str = "en"
    user_id: Optional[str] = None  # Alternative to cookie auth
    state: Optional[dict] = None
    commands: List[dict] = []


@router.post("/compile")
async def compile_project_stream(
    request: CompileRequest,
    session_user_id: str | None = Cookie(default=None),
):
    """
    HTTP streaming endpoint for project compilation using assistant-stream protocol.

    This endpoint follows the assistant-stream protocol:
    - Accepts state and commands from the frontend
    - Streams state snapshots back using DataStreamResponse
    - Handles tool calls and HITL through the stream
    """
    # Try cookie first, then body parameter
    auth_user_id = session_user_id or request.user_id
    if not auth_user_id:
        return {"error": "Not authenticated"}, 401

    project_id = request.project_id
    language = request.language

    # Validate project exists
    storage = ProjectStorage(auth_user_id)
    project = storage.get_project(project_id)
    if not project:
        return {"error": f"Project not found: {project_id}"}, 404

    manuals = storage.get_project_manuals(project_id)
    if not manuals:
        return {"error": "Cannot compile empty project. Add manuals first."}, 400

    if len(manuals) < 2:
        return {"error": "Compilation requires at least 2 manuals. For a single manual, use the export feature instead."}, 400

    async def run_callback(controller: RunController):
        """Callback that runs the LangGraph agent and streams state updates."""
        from ...agents.project_compiler_agent import get_compiler_agent
        import uuid

        logger.info(f"[Compile] Starting run_callback for project {project_id}")

        # Initialize state
        if controller.state is None:
            controller.state = {"messages": []}
        if "messages" not in controller.state:
            controller.state["messages"] = []

        input_messages = []

        # Process commands from frontend
        for command in request.commands:
            cmd_type = command.get("type")

            if cmd_type == "add-message":
                # Extract text from message parts
                message_data = command.get("message", {})
                parts = message_data.get("parts", [])
                text_parts = [
                    part.get("text", "") for part in parts
                    if part.get("type") == "text" and part.get("text")
                ]
                if text_parts:
                    content = " ".join(text_parts)
                    input_messages.append(HumanMessage(content=content))

            elif cmd_type == "add-tool-result":
                # Handle HITL approval/rejection
                tool_call_id = command.get("toolCallId", "")
                result = command.get("result", {})
                approved = result.get("approved", False)
                logger.info(f"[Compile] Tool result for {tool_call_id}: approved={approved}")

                if not approved:
                    # User rejected - add a message explaining the rejection
                    # and return early without running compilation
                    rejection_msg = (
                        "I understand you've decided not to proceed with the compilation. "
                        "If you'd like to make changes to the merge plan, please let me know what adjustments you'd like."
                    )
                    # Update state with rejection message
                    if controller.state is None:
                        controller.state = {"messages": []}
                    controller.state["messages"].append({
                        "type": "ai",
                        "content": rejection_msg,
                    })
                    logger.info("[Compile] User rejected compilation, returning early")
                    return  # Exit without running the agent

        # If no explicit message, send the initial compilation request
        if not input_messages and not request.state:
            # Build context for the agent
            chapter_info = []
            for ch in project.get("chapters", []):
                chapter_info.append(f"  - {ch['title']}: {len(ch.get('manuals', []))} manual(s)")
            chapters_summary = "\n".join(chapter_info) if chapter_info else "  No chapters"

            initial_content = f"""Please compile the project '{project['name']}' (ID: {project_id}).

## Context
- **User ID**: {auth_user_id}
- **Project ID**: {project_id}
- **Language**: {language}
- **Project Description**: {project.get('description', 'No description')}
- **Chapters**:
{chapters_summary}

## Instructions
1. First, call `analyze_project("{project_id}", "{auth_user_id}", "{language}")` to load all manual contents
2. Review the content and create a merge plan
3. Present the plan for my review
4. After approval, call `compile_manuals` with the plan"""

            input_messages.append(HumanMessage(content=initial_content))

        # Create agent and stream
        agent = get_compiler_agent()
        session_id = uuid.uuid4().hex[:8]
        config = {"configurable": {"thread_id": f"compile_{project_id}_{session_id}"}}

        input_state = {"messages": input_messages}

        logger.info(f"[Compile] Starting LangGraph stream for project {project_id}")

        # Stream events from LangGraph using append_langgraph_event
        # Use only "messages" mode to avoid duplicate messages from "updates"
        async for event in agent.astream(
            input_state,
            config=config,
            stream_mode="messages",
            subgraphs=True,
        ):
            namespace, chunk = event
            append_langgraph_event(
                controller.state,
                namespace,
                "messages",
                chunk
            )

        logger.info(f"[Compile] Stream completed for project {project_id}")

    # Create and return the streaming response
    stream = create_run(run_callback, state=request.state)
    return DataStreamResponse(stream)
