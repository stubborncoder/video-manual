"""Agent runners that yield progress events for CLI and TUI consumption."""

from pathlib import Path
from typing import Iterator, Optional, Any
import threading
import queue
import time

from .events import (
    ProgressEvent,
    NodeStartedEvent,
    NodeCompletedEvent,
    LLMTokenEvent,
    ToolCallEvent,
    HITLRequiredEvent,
    ErrorEvent,
    CompleteEvent,
)


# Node order for video manual agent
VIDEO_MANUAL_NODES = ["analyze_video", "identify_keyframes", "generate_manual"]


def format_duration(seconds: float) -> str:
    """Format seconds into human-readable duration."""
    mins, secs = divmod(int(seconds), 60)
    return f"{mins}:{secs:02d}"


def extract_node_details(node_name: str, state_update: dict) -> dict[str, Any]:
    """Extract relevant details from state update for display."""
    details = {}

    if node_name == "analyze_video":
        if state_update.get("video_metadata"):
            meta = state_update["video_metadata"]
            if meta.get("duration"):
                details["duration"] = format_duration(meta["duration"])
                details["duration_seconds"] = meta["duration"]
            if meta.get("resolution"):
                details["resolution"] = meta["resolution"]
        if state_update.get("using_cached"):
            details["cached"] = True

    elif node_name == "identify_keyframes":
        if state_update.get("total_keyframes"):
            details["keyframes_count"] = state_update["total_keyframes"]

    elif node_name == "generate_manual":
        if state_update.get("screenshots"):
            details["screenshots_count"] = len(state_update["screenshots"])
        if state_update.get("manual_path"):
            details["manual_path"] = state_update["manual_path"]

    return details


class VideoManualRunner:
    """Runner for video manual agent that yields progress events."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self._event_queue: queue.Queue[ProgressEvent | None] = queue.Queue()
        self._final_state: dict[str, Any] | None = None
        self._error: str | None = None

    def run(
        self,
        video_path: Path,
        output_filename: Optional[str] = None,
        use_scene_detection: bool = False,
        output_language: str = "English",
    ) -> Iterator[ProgressEvent]:
        """
        Run the video manual agent and yield progress events.

        Yields:
            ProgressEvent objects for each state change
        """
        from ..agents.video_manual_agent import VideoManualAgent
        from ..agents.video_manual_agent.state import VideoManualState
        from ..storage.user_storage import UserStorage

        # Create agent
        agent = VideoManualAgent(use_checkpointer=True)

        # Setup storage
        storage = UserStorage(self.user_id)
        storage.ensure_user_folders()
        video_name = output_filename or video_path.name

        # Check for existing manual (enables caching)
        existing_manual_id = storage.find_existing_manual(video_name)
        if existing_manual_id:
            manual_dir, manual_id = storage.get_manual_dir(manual_id=existing_manual_id)
        else:
            manual_dir, manual_id = storage.get_manual_dir(video_name=video_name)

        # Prepare initial state
        initial_state: VideoManualState = {
            "user_id": self.user_id,
            "manual_id": manual_id,
            "video_path": str(video_path),
            "output_filename": output_filename,
            "use_scene_detection": use_scene_detection,
            "output_language": output_language,
            "video_metadata": None,
            "video_analysis": None,
            "model_used": None,
            "optimized_video_path": None,
            "gemini_file_uri": None,
            "keyframes": None,
            "scene_changes": None,
            "total_keyframes": None,
            "manual_content": None,
            "manual_path": None,
            "screenshots": None,
            "output_directory": None,
            "status": "pending",
            "error": None,
            "using_cached": None,
        }

        config = {"configurable": {"thread_id": f"{self.user_id}_{video_path.stem}"}}

        # Emit start event for first node
        yield NodeStartedEvent(
            node_name=VIDEO_MANUAL_NODES[0],
            node_index=0,
            total_nodes=len(VIDEO_MANUAL_NODES),
        )

        def run_graph():
            """Run the graph in a background thread, pushing events to queue."""
            try:
                for event in agent.graph.stream(
                    initial_state, config=config, stream_mode="updates"
                ):
                    for node_name, state_update in event.items():
                        if node_name.startswith("__"):
                            continue

                        # Get node index
                        try:
                            node_index = VIDEO_MANUAL_NODES.index(node_name)
                        except ValueError:
                            continue

                        # Extract details and emit completion
                        details = extract_node_details(node_name, state_update)
                        self._event_queue.put(
                            NodeCompletedEvent(
                                node_name=node_name,
                                node_index=node_index,
                                total_nodes=len(VIDEO_MANUAL_NODES),
                                details=details,
                            )
                        )

                        # Emit start for next node if there is one
                        if node_index < len(VIDEO_MANUAL_NODES) - 1:
                            next_node = VIDEO_MANUAL_NODES[node_index + 1]
                            self._event_queue.put(
                                NodeStartedEvent(
                                    node_name=next_node,
                                    node_index=node_index + 1,
                                    total_nodes=len(VIDEO_MANUAL_NODES),
                                )
                            )

                        # Store state for final result
                        self._final_state = state_update

                # Emit completion
                result = {}
                if self._final_state:
                    result = {
                        "manual_id": self._final_state.get("manual_id"),
                        "manual_path": self._final_state.get("manual_path"),
                        "screenshots": self._final_state.get("screenshots", []),
                        "output_directory": self._final_state.get("output_directory"),
                    }
                self._event_queue.put(
                    CompleteEvent(result=result, message="Manual generated successfully")
                )

            except Exception as e:
                self._error = str(e)
                self._event_queue.put(
                    ErrorEvent(error_message=str(e), recoverable=False)
                )
            finally:
                # Signal end of events
                self._event_queue.put(None)

        # Start graph in background thread
        thread = threading.Thread(target=run_graph, daemon=True)
        thread.start()

        # Yield events as they come in
        while True:
            try:
                event = self._event_queue.get(timeout=0.1)
                if event is None:
                    break
                yield event
            except queue.Empty:
                continue

        thread.join(timeout=5)

    @property
    def final_state(self) -> dict[str, Any] | None:
        """Get the final state after completion."""
        return self._final_state

    @property
    def error(self) -> str | None:
        """Get the error message if an error occurred."""
        return self._error


class ProjectCompilerRunner:
    """Runner for project compiler agent that yields progress events."""

    def __init__(self, user_id: str):
        self.user_id = user_id
        self._event_queue: queue.Queue[ProgressEvent | None] = queue.Queue()
        self._pending_interrupt: dict[str, Any] | None = None
        self._agent = None
        self._config = None
        self._thread: threading.Thread | None = None

    def run(self, project_id: str, language: str = "en") -> Iterator[ProgressEvent]:
        """
        Run the project compiler agent and yield progress events.

        Args:
            project_id: Project identifier to compile
            language: Language code for manual content (default: 'en')

        Yields:
            ProgressEvent objects including HITL interrupts
        """
        from ..agents.project_compiler_agent import get_compiler_agent
        from ..storage.project_storage import ProjectStorage

        # Load project info
        storage = ProjectStorage(self.user_id)
        project = storage.get_project(project_id)
        if not project:
            yield ErrorEvent(
                error_message=f"Project not found: {project_id}", recoverable=False
            )
            return

        # Create agent with unique thread_id for each session
        import uuid
        self._agent = get_compiler_agent()
        session_id = uuid.uuid4().hex[:8]
        self._config = {"configurable": {"thread_id": f"compile_{project_id}_{session_id}"}}

        # Build context for the agent with all required info
        chapter_info = []
        for ch in project.get("chapters", []):
            chapter_info.append(f"  - {ch['title']}: {len(ch.get('manuals', []))} manual(s)")
        chapters_summary = "\n".join(chapter_info) if chapter_info else "  No chapters"

        # Initial message with full context
        initial_message = {
            "messages": [
                {
                    "role": "user",
                    "content": f"""Please compile the project '{project['name']}' (ID: {project_id}).

## Context
- **User ID**: {self.user_id}
- **Project ID**: {project_id}
- **Language**: {language}
- **Project Description**: {project.get('description', 'No description')}
- **Chapters**:
{chapters_summary}

## Instructions
1. First, call `analyze_project("{project_id}", "{self.user_id}", "{language}")` to load all manual contents
2. Review the content and create a merge plan
3. Present the plan for my review
4. After approval, call `compile_manuals` with the plan""",
                }
            ]
        }

        yield from self._stream_agent(initial_message)

    def resume(self, decision: dict[str, Any]) -> Iterator[ProgressEvent]:
        """
        Resume after HITL approval.

        Args:
            decision: Dict with 'approved' bool and optionally 'modified_args'

        Yields:
            ProgressEvent objects for remaining execution
        """
        from langgraph.types import Command

        if not self._agent or not self._config:
            yield ErrorEvent(
                error_message="No agent to resume - run() must be called first",
                recoverable=False,
            )
            return

        if not self._pending_interrupt:
            yield ErrorEvent(
                error_message="No pending interrupt to resume", recoverable=False
            )
            return

        # Build resume command based on decision
        # Format must match what the agent expects: {"decisions": [{"type": "approve|reject", ...}]}
        if decision.get("approved", False):
            resume_value = {"decisions": [{"type": "approve"}]}
        else:
            feedback = decision.get("feedback", "User rejected the action")
            resume_value = {"decisions": [{"type": "reject", "message": feedback}]}

        self._pending_interrupt = None
        resume_input = Command(resume=resume_value)

        yield from self._stream_agent(resume_input)

    def send_message(self, message: str) -> Iterator[ProgressEvent]:
        """
        Send a follow-up message to the agent.

        Args:
            message: User message to send

        Yields:
            ProgressEvent objects for the response
        """
        if not self._agent or not self._config:
            yield ErrorEvent(
                error_message="No agent session - run() must be called first",
                recoverable=False,
            )
            return

        user_input = {"messages": [{"role": "user", "content": message}]}
        yield from self._stream_agent(user_input)

    def _stream_agent(self, stream_input: Any) -> Iterator[ProgressEvent]:
        """Stream agent execution and yield events."""
        import logging
        logger = logging.getLogger(__name__)

        try:
            is_first_token = True
            compiled_content = None

            for chunk in self._agent.stream(
                stream_input,
                config=self._config,
                stream_mode=["messages", "updates"],
                subgraphs=True,
            ):
                namespace, mode, data = chunk

                if mode == "messages":
                    msg, metadata = data
                    msg_type = getattr(msg, "type", "").lower()

                    if "ai" in msg_type:
                        content = getattr(msg, "content", None)
                        if isinstance(content, str) and content:
                            yield LLMTokenEvent(
                                token=content, is_first=is_first_token, is_last=False
                            )
                            is_first_token = False
                        elif isinstance(content, list):
                            for block in content:
                                if isinstance(block, dict):
                                    if block.get("type") == "text":
                                        text = block.get("text", "")
                                        if text:
                                            yield LLMTokenEvent(
                                                token=text,
                                                is_first=is_first_token,
                                                is_last=False,
                                            )
                                            is_first_token = False
                                    elif block.get("type") == "tool_use":
                                        yield ToolCallEvent(
                                            tool_name=block.get("name", ""),
                                            tool_id=block.get("id", ""),
                                            arguments=block.get("input", {}),
                                        )

                    # Handle tool result messages
                    elif "tool" in msg_type:
                        content = getattr(msg, "content", None)
                        tool_name = getattr(msg, "name", "")

                        # Extract compiled content from compile_manuals result
                        if tool_name == "compile_manuals" and content:
                            try:
                                import json
                                if isinstance(content, str):
                                    result = json.loads(content)
                                elif isinstance(content, dict):
                                    result = content
                                else:
                                    result = {}

                                if "compiled_content" in result:
                                    compiled_content = result["compiled_content"]
                            except (json.JSONDecodeError, TypeError):
                                pass

                elif mode == "updates":
                    if not isinstance(data, dict):
                        continue

                    # Check for __interrupt__ key (standard LangGraph format)
                    if "__interrupt__" in data:
                        interrupts = data["__interrupt__"]
                        if interrupts:
                            interrupt = interrupts[0]
                            interrupt_id = getattr(interrupt, "id", "")
                            interrupt_value = getattr(interrupt, "value", {})

                            # Extract action requests from deepagents format
                            action_requests = interrupt_value.get("action_requests", [])
                            if action_requests:
                                action = action_requests[0]
                                tool_name = action.get("name", "")
                                tool_args = action.get("args", {})
                                logger.info(f"[RUNNER] HITL required for tool: {tool_name}")

                                self._pending_interrupt = {
                                    "id": interrupt_id,
                                    "tool_name": tool_name,
                                    "tool_args": tool_args,
                                }

                                yield HITLRequiredEvent(
                                    interrupt_id=interrupt_id,
                                    tool_name=tool_name,
                                    tool_args=tool_args,
                                    message=f"Approval required for {tool_name}",
                                )
                                return  # Stop streaming until resume

            # If we got here without HITL, we're done
            if not is_first_token:
                yield LLMTokenEvent(token="", is_first=False, is_last=True)

            result = {}
            if compiled_content:
                result["compiled_content"] = compiled_content

            yield CompleteEvent(result=result, message="Compilation complete")

        except Exception as e:
            logger.exception(f"[RUNNER] Error: {e}")
            yield ErrorEvent(error_message=str(e), recoverable=False)

    @property
    def has_pending_interrupt(self) -> bool:
        """Check if there's a pending HITL interrupt."""
        return self._pending_interrupt is not None
