"""WebSocket endpoint for project compilation with HITL support."""

import json
import logging
import asyncio
from dataclasses import asdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Cookie

logger = logging.getLogger(__name__)

from ...core.runners import ProjectCompilerRunner
from ...core.events import EventType
from ...storage.project_storage import ProjectStorage

router = APIRouter()


@router.websocket("/ws/compile")
async def websocket_compile_project(
    websocket: WebSocket,
    session_user_id: str | None = Cookie(default=None),
    user_id: str | None = None,  # Query param fallback for cross-origin
):
    """
    WebSocket endpoint for project compilation with HITL (Human-in-the-Loop).

    Client sends to start:
    {
        "action": "start",
        "project_id": "project-id",
        "language": "en",
        "model": "anthropic:claude-sonnet-4-5-20250929"  // optional
    }

    Client sends for HITL decision:
    {
        "action": "decision",
        "approved": true/false,
        "modified_args": { ... },  // optional, only if approved with changes
        "feedback": "reason"       // optional, if rejected
    }

    Client sends for follow-up message:
    {
        "action": "message",
        "content": "user message text"
    }

    Server sends events:
    {
        "event_type": "llm_token|tool_call|hitl_required|error|complete",
        "timestamp": 1234567890.123,
        "data": { ... event-specific data ... }
    }
    """
    await websocket.accept()

    # Check authentication (cookie or query param)
    auth_user_id = session_user_id or user_id
    if not auth_user_id:
        await websocket.send_json({
            "event_type": "error",
            "timestamp": 0,
            "data": {"error_message": "Not authenticated", "recoverable": False}
        })
        await websocket.close(code=4001)
        return

    runner: ProjectCompilerRunner | None = None

    try:
        while True:
            message = await websocket.receive_json()
            action = message.get("action")

            if action == "start":
                project_id = message.get("project_id")
                if not project_id:
                    await websocket.send_json({
                        "event_type": "error",
                        "timestamp": 0,
                        "data": {"error_message": "project_id required", "recoverable": False}
                    })
                    continue

                # Check if project exists and has manuals
                try:
                    storage = ProjectStorage(auth_user_id)
                    project = storage.get_project(project_id)
                    if not project:
                        await websocket.send_json({
                            "event_type": "error",
                            "timestamp": 0,
                            "data": {"error_message": f"Project not found: {project_id}", "recoverable": False}
                        })
                        continue

                    manuals = storage.get_project_docs(project_id)
                    if not manuals:
                        await websocket.send_json({
                            "event_type": "error",
                            "timestamp": 0,
                            "data": {"error_message": "Cannot compile empty project. Add manuals first.", "recoverable": False}
                        })
                        continue

                    if len(manuals) < 2:
                        await websocket.send_json({
                            "event_type": "error",
                            "timestamp": 0,
                            "data": {"error_message": "Compilation requires at least 2 manuals. For a single manual, use the export feature instead.", "recoverable": False}
                        })
                        continue
                except Exception as e:
                    await websocket.send_json({
                        "event_type": "error",
                        "timestamp": 0,
                        "data": {"error_message": f"Failed to load project: {e}", "recoverable": False}
                    })
                    continue

                # Create runner and start compilation
                runner = ProjectCompilerRunner(auth_user_id)
                language = message.get("language", "en")

                logger.info(f"[WS] Starting compilation for project {project_id}, language={language}")

                # Use queue to stream events from sync generator to async websocket
                event_queue: asyncio.Queue = asyncio.Queue()
                loop = asyncio.get_running_loop()

                def run_sync_generator():
                    """Run sync generator in thread and put events in queue."""
                    try:
                        for event in runner.run(project_id, language=language):
                            future = asyncio.run_coroutine_threadsafe(
                                event_queue.put(event), loop
                            )
                            future.result()  # Wait for put to complete
                            if event.event_type in (EventType.HITL_REQUIRED, EventType.COMPLETE, EventType.ERROR):
                                break
                    finally:
                        future = asyncio.run_coroutine_threadsafe(
                            event_queue.put(None), loop  # Signal end
                        )
                        future.result()

                # Start generator in thread
                thread_future = loop.run_in_executor(None, run_sync_generator)

                # Consume events from queue and send via websocket
                while True:
                    event = await event_queue.get()
                    if event is None:
                        break

                    event_dict = asdict(event)
                    event_type = event_dict.pop("event_type")
                    event_type_str = event_type.value if hasattr(event_type, "value") else str(event_type)

                    logger.info(f"[WS] Sending event: {event_type_str}")

                    await websocket.send_json({
                        "event_type": event_type_str,
                        "timestamp": event_dict.pop("timestamp"),
                        "data": event_dict,
                    })

                    # If HITL required, break to wait for decision
                    if event.event_type == EventType.HITL_REQUIRED:
                        logger.info("[WS] HITL required, waiting for decision")
                        break

                    # If complete or error, we're done
                    if event.event_type in (EventType.COMPLETE, EventType.ERROR):
                        logger.info(f"[WS] Compilation ended with {event_type_str}")
                        await websocket.close()
                        return

                await thread_future  # Wait for thread to finish

            elif action == "decision":
                if not runner:
                    await websocket.send_json({
                        "event_type": "error",
                        "timestamp": 0,
                        "data": {"error_message": "No active compilation session", "recoverable": False}
                    })
                    continue

                if not runner.has_pending_interrupt:
                    await websocket.send_json({
                        "event_type": "error",
                        "timestamp": 0,
                        "data": {"error_message": "No pending HITL decision", "recoverable": False}
                    })
                    continue

                # Resume with decision
                decision = {
                    "approved": message.get("approved", False),
                    "modified_args": message.get("modified_args"),
                    "feedback": message.get("feedback"),
                }

                for event in runner.resume(decision):
                    event_dict = asdict(event)
                    event_type = event_dict.pop("event_type")

                    await websocket.send_json({
                        "event_type": event_type.value if hasattr(event_type, "value") else str(event_type),
                        "timestamp": event_dict.pop("timestamp"),
                        "data": event_dict,
                    })

                    # If HITL required again, break to wait for decision
                    if event.event_type == EventType.HITL_REQUIRED:
                        break

                    # If complete or error, we're done
                    if event.event_type in (EventType.COMPLETE, EventType.ERROR):
                        await websocket.close()
                        return

            elif action == "message":
                if not runner:
                    await websocket.send_json({
                        "event_type": "error",
                        "timestamp": 0,
                        "data": {"error_message": "No active compilation session", "recoverable": False}
                    })
                    continue

                content = message.get("content", "")
                if not content:
                    continue

                for event in runner.send_message(content):
                    event_dict = asdict(event)
                    event_type = event_dict.pop("event_type")

                    await websocket.send_json({
                        "event_type": event_type.value if hasattr(event_type, "value") else str(event_type),
                        "timestamp": event_dict.pop("timestamp"),
                        "data": event_dict,
                    })

                    # If HITL required, break to wait for decision
                    if event.event_type == EventType.HITL_REQUIRED:
                        break

                    # If complete or error, we're done
                    if event.event_type in (EventType.COMPLETE, EventType.ERROR):
                        await websocket.close()
                        return

            else:
                await websocket.send_json({
                    "event_type": "error",
                    "timestamp": 0,
                    "data": {"error_message": f"Unknown action: {action}", "recoverable": True}
                })

    except WebSocketDisconnect:
        pass
    except json.JSONDecodeError:
        await websocket.send_json({
            "event_type": "error",
            "timestamp": 0,
            "data": {"error_message": "Invalid JSON", "recoverable": False}
        })
    except Exception as e:
        await websocket.send_json({
            "event_type": "error",
            "timestamp": 0,
            "data": {"error_message": str(e), "recoverable": False}
        })
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
