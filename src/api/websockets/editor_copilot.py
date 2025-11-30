"""WebSocket endpoint for manual editor copilot with AI assistance."""

import asyncio
import json
import logging
import time
from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Cookie, Query

from ...storage.user_storage import UserStorage
from ...core.runners import ManualEditorRunner
from ...core.events import EventType

logger = logging.getLogger(__name__)

router = APIRouter()


class EditorCopilotSession:
    """Manages a single editor copilot WebSocket session."""

    def __init__(
        self,
        websocket: WebSocket,
        user_id: str,
        manual_id: str,
        language: str,
    ):
        self.websocket = websocket
        self.user_id = user_id
        self.manual_id = manual_id
        self.language = language
        self.storage = UserStorage(user_id)
        self.is_generating = False
        self.should_cancel = False

        # Create the editor runner
        self.runner = ManualEditorRunner(user_id, manual_id, language)
        self.runner_initialized = False

        # Message history for context
        self.messages: list[dict] = []

        # Track pending changes
        self.pending_changes: dict[str, dict] = {}

    async def send_event(self, event_type: str, **data):
        """Send an event to the client."""
        await self.websocket.send_json({
            "type": event_type,
            "timestamp": time.time(),
            **data,
        })

    async def initialize_runner(self, document_content: str):
        """Initialize the runner with document content."""
        if self.runner_initialized:
            return

        loop = asyncio.get_running_loop()

        def run_start():
            return list(self.runner.start(document_content))

        events = await loop.run_in_executor(None, run_start)

        for event in events:
            if event.event_type == EventType.ERROR:
                await self.send_event("error", message=event.error_message)
                return

        self.runner_initialized = True
        logger.info(f"Editor runner initialized for manual {self.manual_id}")

    async def handle_chat_message(self, payload: dict):
        """Handle an incoming chat message from the user."""
        content = payload.get("content", "")
        selection = payload.get("selection")
        document_content = payload.get("document_content", "")
        image = payload.get("image")  # {url: str, name: str}

        if not content:
            await self.send_event("error", message="Empty message")
            return

        # Initialize runner if needed
        if not self.runner_initialized:
            await self.initialize_runner(document_content)

        # Store user message
        self.messages.append({
            "role": "user",
            "content": content,
            "selection": selection,
            "image": image,
        })

        self.is_generating = True
        self.should_cancel = False

        try:
            await self._stream_agent_response(content, selection, document_content, image)
        except Exception as e:
            logger.exception(f"Error generating response: {e}")
            await self.send_event("error", message=str(e))
        finally:
            self.is_generating = False

    async def _stream_agent_response(
        self,
        user_message: str,
        selection: Optional[dict],
        document_content: str,
        image: Optional[dict] = None,
    ):
        """Stream response from the LangGraph agent."""
        loop = asyncio.get_running_loop()
        event_queue: asyncio.Queue = asyncio.Queue()

        def run_sync_generator():
            """Run sync generator in thread and put events in queue."""
            try:
                for event in self.runner.send_message(
                    message=user_message,
                    selection=selection,
                    document_content=document_content,
                    image=image,
                ):
                    future = asyncio.run_coroutine_threadsafe(
                        event_queue.put(event), loop
                    )
                    future.result()  # Wait for put to complete
            finally:
                future = asyncio.run_coroutine_threadsafe(
                    event_queue.put(None), loop  # Signal end
                )
                future.result()

        # Start generator in thread
        thread_future = loop.run_in_executor(None, run_sync_generator)

        # Track accumulated response for storing in messages
        accumulated_response = ""
        is_streaming = False

        # Consume events from queue and send via websocket
        while True:
            if self.should_cancel:
                break

            try:
                event = await asyncio.wait_for(event_queue.get(), timeout=0.1)
            except asyncio.TimeoutError:
                continue

            if event is None:
                break

            event_dict = asdict(event)
            event_type = event_dict.pop("event_type")
            event_type_str = event_type.value if hasattr(event_type, "value") else str(event_type)

            # Handle different event types
            if event_type == EventType.LLM_TOKEN:
                token = event.token
                is_first = event.is_first
                is_last = event.is_last

                if is_first:
                    is_streaming = True
                    accumulated_response = token
                elif is_last:
                    # Send final complete response
                    await self.send_event(
                        "chat_response",
                        content=accumulated_response,
                        done=True,
                    )
                else:
                    accumulated_response += token
                    # Send streaming chunk
                    await self.send_event(
                        "chat_response",
                        content=accumulated_response,
                        done=False,
                    )

            elif event_type == EventType.TOOL_CALL:
                await self.send_event(
                    "tool_call",
                    tool=event.tool_name,
                    args=event.arguments,
                )

            elif event_type == EventType.PENDING_CHANGE:
                # Store the pending change
                self.pending_changes[event.change_id] = event.change_data

                await self.send_event(
                    "pending_change",
                    change={
                        "id": event.change_id,
                        "type": event.change_type,
                        **event.change_data,
                    },
                )

            elif event_type == EventType.ERROR:
                await self.send_event("error", message=event.error_message)

            elif event_type == EventType.COMPLETE:
                # If we were streaming, the response is already sent
                if not is_streaming and not accumulated_response:
                    # No response was generated, send empty completion
                    await self.send_event(
                        "chat_response",
                        content="",
                        done=True,
                    )

        await thread_future  # Wait for thread to finish

        # Store assistant message
        if accumulated_response:
            self.messages.append({
                "role": "assistant",
                "content": accumulated_response,
            })

    async def handle_accept_change(self, payload: dict):
        """Handle accepting a pending change."""
        change_id = payload.get("change_id")
        logger.info(f"Change accepted: {change_id}")

        if change_id in self.pending_changes:
            change = self.pending_changes.pop(change_id)
            # The frontend will apply the change to the document
            await self.send_event(
                "change_accepted",
                change_id=change_id,
                change=change,
            )

    async def handle_reject_change(self, payload: dict):
        """Handle rejecting a pending change."""
        change_id = payload.get("change_id")
        logger.info(f"Change rejected: {change_id}")

        if change_id in self.pending_changes:
            self.pending_changes.pop(change_id)
            await self.send_event(
                "change_rejected",
                change_id=change_id,
            )

    async def handle_cancel_generation(self):
        """Handle cancellation of current generation."""
        self.should_cancel = True
        self.is_generating = False
        logger.info("Generation cancelled")


@router.websocket("/ws/editor/{manual_id}")
async def websocket_editor_copilot(
    websocket: WebSocket,
    manual_id: str,
    language: str = Query(default="en"),
    session_user_id: str | None = Cookie(default=None),
    user_id: str | None = None,  # Query param fallback
):
    """
    WebSocket endpoint for the manual editor copilot.

    Client sends:
    - chat_message: { type: "chat_message", content: str, selection?: {...}, document_content: str }
    - accept_change: { type: "accept_change", change_id: str }
    - reject_change: { type: "reject_change", change_id: str }
    - cancel_generation: { type: "cancel_generation" }

    Server sends:
    - agent_thinking: { type: "agent_thinking", content: str }
    - tool_call: { type: "tool_call", tool: str, args: {...} }
    - pending_change: { type: "pending_change", change: {...} }
    - chat_response: { type: "chat_response", content: str, done: bool }
    - change_accepted: { type: "change_accepted", change_id: str }
    - change_rejected: { type: "change_rejected", change_id: str }
    - error: { type: "error", message: str }
    """
    await websocket.accept()

    # Check authentication
    auth_user_id = session_user_id or user_id
    if not auth_user_id:
        await websocket.send_json({
            "type": "error",
            "message": "Not authenticated",
        })
        await websocket.close(code=4001)
        return

    # Verify manual exists
    storage = UserStorage(auth_user_id)
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        await websocket.send_json({
            "type": "error",
            "message": f"Manual not found: {manual_id}",
        })
        await websocket.close(code=4004)
        return

    # Create session
    session = EditorCopilotSession(
        websocket=websocket,
        user_id=auth_user_id,
        manual_id=manual_id,
        language=language,
    )

    logger.info(f"Editor copilot session started: user={auth_user_id}, manual={manual_id}")

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "chat_message":
                await session.handle_chat_message(data)
            elif message_type == "accept_change":
                await session.handle_accept_change(data)
            elif message_type == "reject_change":
                await session.handle_reject_change(data)
            elif message_type == "cancel_generation":
                await session.handle_cancel_generation()
            else:
                await session.send_event("error", message=f"Unknown message type: {message_type}")

    except WebSocketDisconnect:
        logger.info(f"Editor copilot session disconnected: manual={manual_id}")
    except json.JSONDecodeError:
        await session.send_event("error", message="Invalid JSON")
    except Exception as e:
        logger.exception(f"Editor copilot error: {e}")
        await session.send_event("error", message=str(e))
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
