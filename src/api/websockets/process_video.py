"""WebSocket endpoint for video processing with streaming progress."""

import asyncio
import json
import logging
import threading
from dataclasses import asdict
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Cookie

from ...core.runners import VideoManualRunner
from ...core.events import EventType
from ...storage.project_storage import ProjectStorage, DEFAULT_PROJECT_ID, DEFAULT_CHAPTER_ID
from ...storage.user_storage import UserStorage

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/process")
async def websocket_process_video(
    websocket: WebSocket,
    session_user_id: str | None = Cookie(default=None),
    user_id: str | None = None,  # Query param fallback for cross-origin
):
    """
    WebSocket endpoint for processing videos with real-time progress.

    Client sends (from Videos page - new manual):
    {
        "action": "start",
        "video_path": "/path/to/video.mp4",
        "output_filename": "optional",
        "use_scene_detection": true,
        "output_language": "English",
        "project_id": "optional",
        "chapter_id": "optional",
        "tags": ["tag1", "tag2"],
        "target_audience": "optional",
        "target_objective": "optional"
    }

    Client sends (from Manuals page - add language to existing manual):
    {
        "action": "start",
        "manual_id": "existing-manual-id",
        "output_language": "Spanish"
    }

    Server sends events:
    {
        "event_type": "node_started|node_completed|error|complete",
        "timestamp": 1234567890.123,
        "data": { ... event-specific data ... }
    }

    Server sends duplicate error (when video already has manual in project):
    {
        "event_type": "error",
        "data": {
            "error_message": "Manual already exists for this video in the selected project",
            "error_type": "duplicate_manual",
            "existing_manual_id": "...",
            "recoverable": false
        }
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
        user_storage = UserStorage(auth_user_id)
        manual_id = message.get("manual_id")  # For add-language flow

        # Determine video path and output filename based on flow type
        if manual_id:
            # Add-language flow: get video path from existing manual's metadata
            metadata = user_storage.get_manual_metadata(manual_id)
            if not metadata:
                await websocket.send_json({
                    "event_type": "error",
                    "timestamp": 0,
                    "data": {"error_message": f"Manual not found: {manual_id}", "recoverable": False}
                })
                await websocket.close()
                return

            video_path = Path(metadata.get("video_path", ""))
            output_filename = manual_id  # Reuse same manual ID
            # For add-language flow, project is already set in manual
            project_id = metadata.get("project_id", DEFAULT_PROJECT_ID)
            chapter_id = metadata.get("chapter_id")
            tags = []  # Don't add new tags in add-language flow
        else:
            # Normal flow: process new video
            video_path = Path(message.get("video_path", ""))
            output_filename = message.get("output_filename")
            # Default to user's default project if not specified
            project_id = message.get("project_id") or DEFAULT_PROJECT_ID
            # Only use DEFAULT_CHAPTER_ID for the default project
            # For custom projects, pass None to let add_manual_to_project create/use "Uncategorized"
            chapter_id = message.get("chapter_id")
            if not chapter_id and project_id == DEFAULT_PROJECT_ID:
                chapter_id = DEFAULT_CHAPTER_ID
            tags = message.get("tags", [])

            # Check for duplicate: video already has manual in target project
            video_name = video_path.name
            existing_manuals = user_storage.get_manuals_by_video(video_name)
            for existing in existing_manuals:
                if existing.get("project_id") == project_id:
                    await websocket.send_json({
                        "event_type": "error",
                        "timestamp": 0,
                        "data": {
                            "error_message": "Manual already exists for this video in the selected project",
                            "error_type": "duplicate_manual",
                            "existing_manual_id": existing.get("manual_id"),
                            "recoverable": False
                        }
                    })
                    await websocket.close()
                    return

        if not video_path.exists():
            await websocket.send_json({
                "event_type": "error",
                "timestamp": 0,
                "data": {"error_message": f"Video not found: {video_path}", "recoverable": False}
            })
            await websocket.close()
            return

        use_scene_detection = message.get("use_scene_detection", True)
        output_language = message.get("output_language", "English")
        target_audience = message.get("target_audience")
        target_objective = message.get("target_objective")

        # Ensure default project exists
        project_storage = ProjectStorage(auth_user_id)
        project_storage.ensure_default_project()

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
                    target_audience=target_audience,
                    target_objective=target_objective,
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
                    for tag in tags:
                        project_storage.add_tag_to_manual(manual_id, tag)

                # Add to project (always - default project is used if none specified)
                if manual_id:
                    try:
                        project_storage.add_manual_to_project(project_id, manual_id, chapter_id)
                        logger.info(f"Manual {manual_id} added to project {project_id}")
                    except Exception as e:
                        logger.error(f"Failed to add manual {manual_id} to project {project_id}: {e}")

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
