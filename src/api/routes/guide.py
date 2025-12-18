"""Guide agent chat routes using deepagents."""

import asyncio
import json
import logging
import queue
import threading
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..dependencies import CurrentUserInfo
from ...core.runners import GuideAgentRunner
from ...core.events import (
    LLMTokenEvent,
    ToolCallEvent,
    GuideActionEvent,
    CompleteEvent,
    ErrorEvent,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/guide", tags=["guide"])

# Store active guide sessions (in-memory, per-user)
# In production, consider using Redis or similar for multi-worker support
_guide_sessions: dict[str, GuideAgentRunner] = {}


class GuideChatRequest(BaseModel):
    """Request body for guide chat."""

    message: str
    page_context: dict | None = None
    thread_id: str | None = None
    language: str | None = None  # User's preferred language (e.g., "en", "es")


class GuideResponse(BaseModel):
    """Response from guide chat."""

    content: str
    thread_id: str | None = None


def _get_or_create_session(user_id: str, user_email: str | None = None) -> GuideAgentRunner:
    """Get existing session or create new one for user."""
    session_key = f"{user_id}_guide"
    if session_key not in _guide_sessions:
        runner = GuideAgentRunner(user_id, user_email=user_email)
        # Initialize the session
        list(runner.start({}))
        _guide_sessions[session_key] = runner
    return _guide_sessions[session_key]


async def generate_guide_response(
    request: GuideChatRequest, user_id: str, user_email: str | None = None
) -> AsyncGenerator[str, None]:
    """Generate streaming response from the guide agent.

    Uses a background thread to run the synchronous agent and a queue
    to stream events back to the async context.

    Args:
        request: The chat request with message and context
        user_id: The current user ID
        user_email: The current user's email

    Yields:
        Server-sent event formatted chunks with structured data
    """
    event_queue: queue.Queue = queue.Queue()

    def run_agent():
        """Run agent in background thread, pushing events to queue."""
        try:
            runner = _get_or_create_session(user_id, user_email=user_email)
            page_context = request.page_context or {
                "currentPage": "/dashboard",
                "pageTitle": "Dashboard",
            }

            import time
            start = time.time()
            for event in runner.send_message(request.message, page_context, request.language):
                elapsed = time.time() - start
                logger.info(f"[GUIDE] Event at {elapsed:.2f}s: {type(event).__name__}")
                event_queue.put(event)

            # Signal completion
            event_queue.put(None)
            logger.info(f"[GUIDE] Agent completed in {time.time() - start:.2f}s")
        except Exception as e:
            logger.error(f"Guide agent error: {e}", exc_info=True)
            event_queue.put(ErrorEvent(error_message=str(e)))
            event_queue.put(None)

    # Start agent in background thread
    thread = threading.Thread(target=run_agent, daemon=True)
    thread.start()

    import time as time_mod
    yield_start = time_mod.time()

    try:
        # Yield events as they arrive
        while True:
            try:
                # Use asyncio to avoid blocking - check queue with small timeout
                event = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: event_queue.get(timeout=0.05)
                )

                if event is None:
                    # Agent finished
                    break

                elapsed = time_mod.time() - yield_start
                if isinstance(event, LLMTokenEvent):
                    if event.token:
                        data = {"type": "token", "content": event.token}
                        logger.info(f"[GUIDE] Yielding token at {elapsed:.2f}s")
                        yield f"data: {json.dumps(data)}\n\n"

                elif isinstance(event, GuideActionEvent):
                    data = {
                        "type": "action",
                        "action": event.action_type,
                        **event.action_data,
                    }
                    yield f"data: {json.dumps(data)}\n\n"

                elif isinstance(event, ToolCallEvent):
                    logger.debug(f"Guide tool call: {event.tool_name}({event.arguments})")

                elif isinstance(event, ErrorEvent):
                    data = {"type": "error", "message": event.error_message}
                    yield f"data: {json.dumps(data)}\n\n"

                elif isinstance(event, CompleteEvent):
                    pass

            except queue.Empty:
                # No event yet, continue waiting
                continue

        # Send done signal
        yield "data: [DONE]\n\n"

    except Exception as e:
        logger.error(f"Error generating guide response: {e}", exc_info=True)
        error_data = {"type": "error", "message": "An error occurred. Please try again."}
        yield f"data: {json.dumps(error_data)}\n\n"
        yield "data: [DONE]\n\n"
    finally:
        # Wait for thread to finish (with timeout)
        thread.join(timeout=5)


@router.post("/chat")
async def guide_chat(
    request: GuideChatRequest,
    user_info: CurrentUserInfo,
) -> StreamingResponse:
    """Stream guide agent responses with actions.

    Args:
        request: The chat request
        user_info: Current user info (ID and email) from auth

    Returns:
        Streaming response with SSE format containing:
        - {"type": "token", "content": "..."} for text chunks
        - {"type": "action", "action": "highlight", "target": "...", "duration": ...}
        - {"type": "action", "action": "navigate", "to": "..."}
        - {"type": "error", "message": "..."}
        - [DONE] signal
    """
    return StreamingResponse(
        generate_guide_response(request, user_info.user_id, user_info.email),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/clear")
async def clear_guide_session(user_info: CurrentUserInfo) -> dict:
    """Clear the guide session for the current user.

    This resets the conversation context.
    """
    session_key = f"{user_info.user_id}_guide"
    if session_key in _guide_sessions:
        del _guide_sessions[session_key]
    return {"status": "cleared"}
