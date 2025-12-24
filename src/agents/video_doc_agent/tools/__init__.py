"""Tools for Video Manual Agent."""

from .video_tools import (
    get_video_metadata,
    extract_screenshot_at_timestamp,
    detect_scene_changes,
)

__all__ = [
    "get_video_metadata",
    "extract_screenshot_at_timestamp",
    "detect_scene_changes",
]
