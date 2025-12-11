"""Agent runners that yield progress events for CLI and TUI consumption."""

import logging
from pathlib import Path
from typing import Iterator, Optional, Any
import threading
import queue
import time

logger = logging.getLogger(__name__)

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
        target_audience: Optional[str] = None,
        target_objective: Optional[str] = None,
        document_format: str = "step-manual",
    ) -> Iterator[ProgressEvent]:
        """
        Run the video manual agent and yield progress events.

        Args:
            video_path: Path to the video file
            output_filename: Optional custom filename
            use_scene_detection: Whether to use scene detection
            output_language: Target language for the manual
            target_audience: Target audience for the manual
            target_objective: Target objective of the manual
            document_format: Document format type (step-manual, quick-guide, etc.)

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
            "document_format": document_format,
            "target_audience": target_audience,
            "target_objective": target_objective,
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

                    # Only process streaming chunks, not final messages
                    # AIMessageChunk = streaming (delta), AIMessage = final (full, would duplicate)
                    if "chunk" not in msg_type and "ai" in msg_type:
                        continue

                    if "ai" in msg_type:
                        content = getattr(msg, "content", None)
                        if isinstance(content, str) and content:
                            # AIMessageChunk contains delta (new tokens only)
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
                                        # Only emit tool call when we have the input
                                        tool_input = block.get("input")
                                        if tool_input:
                                            yield ToolCallEvent(
                                                tool_name=block.get("name", ""),
                                                tool_id=block.get("id", ""),
                                                arguments=tool_input,
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
                message = "Compilation complete"
            else:
                message = "Response complete"

            yield CompleteEvent(result=result, message=message)

        except Exception as e:
            logger.exception(f"[RUNNER] Error: {e}")
            yield ErrorEvent(error_message=str(e), recoverable=False)

    @property
    def has_pending_interrupt(self) -> bool:
        """Check if there's a pending HITL interrupt."""
        return self._pending_interrupt is not None


class ManualEditorRunner:
    """Runner for manual editor agent that yields progress events for chat."""

    def __init__(self, user_id: str, manual_id: str, language: str = "en"):
        self.user_id = user_id
        self.manual_id = manual_id
        self.language = language
        self._agent = None
        self._config = None

    def start(self, document_content: str) -> Iterator[ProgressEvent]:
        """
        Start the editor agent session.

        Args:
            document_content: Current manual content

        Yields:
            Initial events (ready event)
        """
        import uuid
        from ..agents.manual_editor_agent import get_editor_agent
        from ..storage.user_storage import UserStorage

        # Create agent with unique session ID
        self._agent = get_editor_agent()
        session_id = uuid.uuid4().hex[:8]
        self._config = {"configurable": {"thread_id": f"editor_{self.manual_id}_{session_id}"}}

        # Store document context for the agent
        self._document_content = document_content

        yield CompleteEvent(result={"status": "ready"}, message="Editor session started")

    def _offset_to_line_number(self, content: str, offset: int) -> int:
        """Convert character offset to 1-indexed line number."""
        if offset <= 0:
            return 1
        # Count newlines before the offset
        text_before = content[:offset]
        line_number = text_before.count('\n') + 1
        return line_number

    def send_message(
        self,
        message: str,
        selection: Optional[dict] = None,
        document_content: Optional[str] = None,
        image: Optional[dict] = None,
    ) -> Iterator[ProgressEvent]:
        """
        Send a chat message to the editor agent.

        Args:
            message: User's message/request
            selection: Optional selected text info with keys:
                - text: The selected text
                - startOffset: Start position
                - endOffset: End position
                - context: Surrounding context
            document_content: Current document content (updated)
            image: Optional image context with keys:
                - url: Image URL (relative API path)
                - name: Image filename

        Yields:
            ProgressEvent objects for the response
        """
        import logging
        import base64
        import httpx
        logger = logging.getLogger(__name__)

        if not self._agent or not self._config:
            yield ErrorEvent(
                error_message="No agent session - start() must be called first",
                recoverable=False,
            )
            return

        # Update document content if provided
        if document_content:
            self._document_content = document_content
            logger.info(f"[EDITOR RUNNER] Document content updated, {len(document_content)} chars, {document_content.count(chr(10))+1} lines")
        else:
            logger.warning("[EDITOR RUNNER] No document_content provided, using cached version")

        # Build context message
        context_parts = []

        # Add document content with line numbers for reference
        # IMPORTANT: Make it clear this is the CURRENT document state - ignore any previous versions
        lines = self._document_content.split('\n')
        numbered_lines = [f"{i+1}: {line}" for i, line in enumerate(lines)]
        numbered_content = '\n'.join(numbered_lines)
        logger.info(f"[EDITOR RUNNER] Sending {len(lines)} lines to agent")
        context_parts.append(f"""## Current Document State (LATEST VERSION - ignore any document content from previous messages)

**Total lines: {len(lines)}**

IMPORTANT: Use ONLY these line numbers for any text operations. The line numbers shown here are the definitive, current state of the document.

```
{numbered_content}
```""")

        # Add selection context if present
        if selection:
            start_offset = selection.get('startOffset', 0)
            end_offset = selection.get('endOffset', 0)

            # Calculate line numbers from offsets
            start_line = self._offset_to_line_number(self._document_content, start_offset)
            end_line = self._offset_to_line_number(self._document_content, end_offset)

            # Get the actual lines being selected
            selected_lines = lines[start_line-1:end_line]
            selected_lines_preview = '\n'.join(f"{start_line+i}: {line}" for i, line in enumerate(selected_lines))

            context_parts.append(f"""## User Selection

**Selected Text**: "{selection.get('text', '')}"
**Lines {start_line} to {end_line}** (use these line numbers for replace_text or delete_text):
```
{selected_lines_preview}
```""")

        # Add image context if present
        if image:
            context_parts.append(f"""## Attached Image

The user has attached an image: **{image.get('name', 'Unknown')}**
Please analyze this image to help answer the user's question.""")

        context = "\n\n".join(context_parts)

        # Build the full message
        full_message = f"""{context}

## User Request

{message}"""

        # Build message content - either simple text or multimodal with image
        if image:
            # Fetch and encode image for Claude vision
            from langchain_core.messages import HumanMessage

            image_data = None
            media_type = "image/png"

            try:
                # The URL is a relative API path, we need to read from local storage
                from ..storage.user_storage import UserStorage
                storage = UserStorage(self.user_id)
                screenshot_path = storage.manuals_dir / self.manual_id / "screenshots" / image.get('name', '')

                if screenshot_path.exists():
                    with open(screenshot_path, 'rb') as f:
                        image_bytes = f.read()

                    # Check image size (5MB limit)
                    image_size_mb = len(image_bytes) / (1024 * 1024)
                    if image_size_mb > 5:
                        logger.error(f"[EDITOR RUNNER] Image too large: {image_size_mb:.2f}MB (max 5MB)")
                        yield ErrorEvent(
                            error_message=f"Image too large: {image_size_mb:.2f}MB. Maximum is 5MB.",
                            recoverable=True,
                        )
                        return

                    image_data = base64.standard_b64encode(image_bytes).decode('utf-8')

                    # Detect media type
                    name_lower = image.get('name', '').lower()
                    if name_lower.endswith('.jpg') or name_lower.endswith('.jpeg'):
                        media_type = "image/jpeg"
                    elif name_lower.endswith('.gif'):
                        media_type = "image/gif"
                    elif name_lower.endswith('.webp'):
                        media_type = "image/webp"

                    logger.info(f"[EDITOR RUNNER] Loaded image: {screenshot_path}, size={len(image_bytes)} bytes")
                else:
                    logger.warning(f"[EDITOR RUNNER] Image not found: {screenshot_path}")
            except Exception as e:
                logger.error(f"[EDITOR RUNNER] Failed to load image: {e}")

            if image_data:
                # Multimodal message with image using HumanMessage
                user_input = {
                    "messages": [
                        HumanMessage(
                            content=[
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": media_type,
                                        "data": image_data,
                                    }
                                },
                                {
                                    "type": "text",
                                    "text": full_message
                                }
                            ]
                        )
                    ]
                }
            else:
                # Fallback to text-only if image couldn't be loaded
                user_input = {"messages": [{"role": "user", "content": full_message}]}
        else:
            user_input = {"messages": [{"role": "user", "content": full_message}]}

        yield from self._stream_agent(user_input)

    def _stream_agent(self, stream_input: Any) -> Iterator[ProgressEvent]:
        """Stream agent execution and yield events."""
        import logging
        import json
        from .events import PendingChangeEvent

        logger = logging.getLogger(__name__)

        # Track emitted change IDs to avoid duplicates
        emitted_change_ids = set()

        try:
            is_first_token = True

            for chunk in self._agent.stream(
                stream_input,
                config=self._config,
                stream_mode=["messages", "updates"],
                subgraphs=True,
            ):
                namespace, mode, data = chunk
                logger.debug(f"[EDITOR RUNNER] Chunk: mode={mode}, namespace={namespace}")

                if mode == "messages":
                    msg, metadata = data
                    msg_type = getattr(msg, "type", "").lower()
                    logger.debug(f"[EDITOR RUNNER] Message type: {msg_type}")

                    # Only process streaming chunks, not final messages
                    # AIMessageChunk = streaming (delta), AIMessage = final (full, would duplicate)
                    if "chunk" not in msg_type and "ai" in msg_type:
                        logger.debug(f"[EDITOR RUNNER] Skipping final AIMessage (already streamed)")
                        continue

                    if "ai" in msg_type:
                        content = getattr(msg, "content", None)
                        if isinstance(content, str) and content:
                            # AIMessageChunk contains delta (new tokens only)
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
                                        # Only emit tool call when we have the input
                                        # During streaming, tool_use blocks may arrive
                                        # without input first, then with input
                                        tool_input = block.get("input")
                                        if tool_input:
                                            yield ToolCallEvent(
                                                tool_name=block.get("name", ""),
                                                tool_id=block.get("id", ""),
                                                arguments=tool_input,
                                            )

                    # Handle tool result messages - extract pending changes
                    elif "tool" in msg_type:
                        content = getattr(msg, "content", None)
                        tool_name = getattr(msg, "name", "")
                        logger.info(f"[EDITOR RUNNER] Tool message: name={tool_name}, content_type={type(content)}, content={content}")

                        # Parse tool result to extract pending change
                        if content and tool_name in (
                            "replace_text",
                            "insert_text",
                            "delete_text",
                            "update_image_caption",
                        ):
                            try:
                                if isinstance(content, str):
                                    result = json.loads(content)
                                elif isinstance(content, dict):
                                    result = content
                                else:
                                    result = {}

                                logger.info(f"[EDITOR RUNNER] Parsed tool result: {result}")

                                if result.get("change_id"):
                                    change_id = result["change_id"]
                                    if change_id not in emitted_change_ids:
                                        emitted_change_ids.add(change_id)
                                        logger.info(f"[EDITOR RUNNER] Emitting PendingChangeEvent: {change_id}")
                                        yield PendingChangeEvent(
                                            change_id=change_id,
                                            change_type=result.get("type", tool_name),
                                            change_data=result,
                                        )
                                    else:
                                        logger.debug(f"[EDITOR RUNNER] Skipping duplicate change_id: {change_id}")
                                else:
                                    logger.warning(f"[EDITOR RUNNER] No change_id in result: {result}")
                            except (json.JSONDecodeError, TypeError) as e:
                                logger.error(f"[EDITOR RUNNER] Failed to parse tool result: {e}")

                elif mode == "updates":
                    # Handle updates mode - tool results may come through here
                    logger.info(f"[EDITOR RUNNER] Updates: {data}")
                    if isinstance(data, dict):
                        # Check for tool node updates containing results
                        for node_name, node_data in data.items():
                            if node_name == "tools" and isinstance(node_data, dict):
                                messages = node_data.get("messages", [])
                                for msg in messages:
                                    tool_name = getattr(msg, "name", "") if hasattr(msg, "name") else ""
                                    content = getattr(msg, "content", None) if hasattr(msg, "content") else None

                                    logger.info(f"[EDITOR RUNNER] Tool update: name={tool_name}, content={content}")

                                    if content and tool_name in (
                                        "replace_text",
                                        "insert_text",
                                        "delete_text",
                                        "update_image_caption",
                                    ):
                                        try:
                                            if isinstance(content, str):
                                                result = json.loads(content)
                                            elif isinstance(content, dict):
                                                result = content
                                            else:
                                                result = {}

                                            if result.get("change_id"):
                                                change_id = result["change_id"]
                                                if change_id not in emitted_change_ids:
                                                    emitted_change_ids.add(change_id)
                                                    logger.info(f"[EDITOR RUNNER] Emitting PendingChangeEvent from updates: {change_id}")
                                                    yield PendingChangeEvent(
                                                        change_id=change_id,
                                                        change_type=result.get("type", tool_name),
                                                        change_data=result,
                                                    )
                                                else:
                                                    logger.debug(f"[EDITOR RUNNER] Skipping duplicate change_id from updates: {change_id}")
                                        except (json.JSONDecodeError, TypeError) as e:
                                            logger.error(f"[EDITOR RUNNER] Failed to parse tool update: {e}")

            # Signal end of response
            if not is_first_token:
                yield LLMTokenEvent(token="", is_first=False, is_last=True)

            yield CompleteEvent(result={}, message="Response complete")

        except Exception as e:
            logger.exception(f"[EDITOR RUNNER] Error: {e}")
            yield ErrorEvent(error_message=str(e), recoverable=False)
