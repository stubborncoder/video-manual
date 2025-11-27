"""Utility modules for Video Manual Agent."""

from .language import get_language_code, get_language_name
from .metadata import (
    load_metadata,
    save_metadata,
    create_metadata,
    has_analysis,
    has_keyframes,
    get_cached_analysis,
    get_cached_keyframes,
    get_cached_video_metadata,
    update_analysis,
    update_keyframes,
    update_optimized,
    add_language_generated,
    has_optimized_video,
    has_screenshots,
    # Project organization
    get_project_id,
    get_chapter_id,
    update_project_info,
    # Tags
    get_tags,
    add_tag,
    remove_tag,
    set_tags,
    # Version tracking
    get_version,
    get_version_history,
    update_version,
    bump_version,
)

__all__ = [
    "get_language_code",
    "get_language_name",
    "load_metadata",
    "save_metadata",
    "create_metadata",
    "has_analysis",
    "has_keyframes",
    "get_cached_analysis",
    "get_cached_keyframes",
    "get_cached_video_metadata",
    "update_analysis",
    "update_keyframes",
    "update_optimized",
    "add_language_generated",
    "has_optimized_video",
    "has_screenshots",
    # Project organization
    "get_project_id",
    "get_chapter_id",
    "update_project_info",
    # Tags
    "get_tags",
    "add_tag",
    "remove_tag",
    "set_tags",
    # Version tracking
    "get_version",
    "get_version_history",
    "update_version",
    "bump_version",
]
