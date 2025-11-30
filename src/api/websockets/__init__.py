"""WebSocket handlers for real-time agent streaming."""

from .process_video import router as process_video_router
from .compile_project import router as compile_project_router
from .editor_copilot import router as editor_copilot_router

__all__ = ["process_video_router", "compile_project_router", "editor_copilot_router"]
