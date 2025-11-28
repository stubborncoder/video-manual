"""WebSocket endpoint for video processing with streaming progress."""

import asyncio
import json
import threading
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Cookie

from ...core.runners import VideoManualRunner
from ...core.events import EventType

router = APIRouter()


@router.websocket("/ws/process")
async def websocket_process_video(
    websocket: WebSocket,
    session_user_id: str | None = Cookie(default=None),
    user_id: str | None = None,  # Query param fallback for cross-origin
):
    """
    WebSocket endpoint for processing videos with real-time progress.

    Client sends:
    {
        "action": "start",
        "video_path": "/path/to/video.mp4",
        "output_filename": "optional",
        "use_scene_detection": true,
        "output_language": "English",
        "project_id": "optional",
        "chapter_id": "optional",
        "tags": ["tag1", "tag2"]
    }

    Server sends events:
    {
        "event_type": "node_started|node_completed|error|complete",
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

    try:
        # Wait for start message
        message = await websocket.receive_json()

        if message.get("action") != "start":
            await websocket.send_json({
                "event_type": "error",
                "timestamp": 0,
                "data": {"error_message": "Expected 'start' action", "recoverable": False}
            })
            await websocket.close()
            return

        # Extract parameters
        video_path = Path(message.get("video_path", ""))
        if not video_path.exists():
            await websocket.send_json({
                "event_type": "error",
                "timestamp": 0,
                "data": {"error_message": f"Video not found: {video_path}", "recoverable": False}
            })
            await websocket.close()
            return

        output_filename = message.get("output_filename")
        use_scene_detection = message.get("use_scene_detection", True)
        output_language = message.get("output_language", "English")
        project_id = message.get("project_id")
        chapter_id = message.get("chapter_id")
        tags = message.get("tags", [])

        # Create runner and stream events
        runner = VideoManualRunner(auth_user_id)

        # Use async queue to bridge sync generator with async websocket
        event_queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def run_sync_generator():
            """Run the sync generator in a thread and push events to async queue."""
            try:
                for event in runner.run(
                    video_path=video_path,
                    output_filename=output_filename,
                    use_scene_detection=use_scene_detection,
                    output_language=output_language,
                ):
                    loop.call_soon_threadsafe(event_queue.put_nowait, event)
            finally:
                loop.call_soon_threadsafe(event_queue.put_nowait, None)

        # Start the sync generator in a background thread
        thread = threading.Thread(target=run_sync_generator, daemon=True)
        thread.start()

        # Process events as they arrive
        while True:
            event = await event_queue.get()
            if event is None:
                break

            # Convert event to JSON-serializable dict
            event_dict = asdict(event)
            event_type = event_dict.pop("event_type")

            await websocket.send_json({
                "event_type": event_type.value if hasattr(event_type, "value") else str(event_type),
                "timestamp": event_dict.pop("timestamp"),
                "data": event_dict,
            })

            # If complete, handle post-processing
            if event.event_type == EventType.COMPLETE and event.result:
                manual_id = event.result.get("manual_id")

                # Add tags if specified
                if tags and manual_id:
                    from ...storage.project_storage import ProjectStorage
                    project_storage = ProjectStorage(auth_user_id)
                    for tag in tags:
                        project_storage.add_tag_to_manual(manual_id, tag)

                # Add to project if specified
                if project_id and manual_id:
                    from ...storage.project_storage import ProjectStorage
                    project_storage = ProjectStorage(auth_user_id)
                    try:
                        project_storage.add_manual_to_project(project_id, manual_id, chapter_id)
                    except Exception:
                        pass  # Ignore project assignment errors

        thread.join(timeout=5)

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
