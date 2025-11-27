"""Metadata utilities for caching video analysis and keyframes.

Stores analysis results in metadata.json to avoid re-processing
when generating manuals in multiple languages.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

METADATA_FILENAME = "metadata.json"


def load_metadata(manual_dir: Path) -> Optional[Dict[str, Any]]:
    """Load metadata from a manual directory.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Metadata dictionary, or None if not found
    """
    metadata_path = manual_dir / METADATA_FILENAME
    if not metadata_path.exists():
        return None

    try:
        with open(metadata_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def save_metadata(manual_dir: Path, metadata: Dict[str, Any]) -> None:
    """Save metadata to a manual directory.

    Args:
        manual_dir: Path to the manual directory
        metadata: Metadata dictionary to save
    """
    metadata_path = manual_dir / METADATA_FILENAME

    # Update timestamp
    metadata["updated_at"] = datetime.now().isoformat()

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)


def create_metadata(
    video_path: str,
    video_metadata: Optional[Dict[str, Any]] = None,
    project_id: Optional[str] = None,
    chapter_id: Optional[str] = None,
    tags: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Create a new metadata dictionary.

    Args:
        video_path: Path to the original video file
        video_metadata: Video metadata (duration, fps, etc.)
        project_id: Optional project this manual belongs to
        chapter_id: Optional chapter within the project
        tags: Optional list of tags

    Returns:
        New metadata dictionary
    """
    return {
        "video_path": video_path,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "video_metadata": video_metadata,
        "video_analysis": None,
        "keyframes": None,
        "model_used": None,
        "optimized": False,
        "languages_generated": [],
        # Project organization fields
        "project_id": project_id,
        "chapter_id": chapter_id,
        "tags": tags or [],
        # Version tracking
        "version": {
            "number": "1.0.0",
            "history": [],
        },
    }


def has_analysis(manual_dir: Path) -> bool:
    """Check if video analysis is cached.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        True if analysis exists in metadata
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return False
    return metadata.get("video_analysis") is not None


def has_keyframes(manual_dir: Path) -> bool:
    """Check if keyframes are cached.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        True if keyframes exist in metadata
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return False
    keyframes = metadata.get("keyframes")
    return keyframes is not None and len(keyframes) > 0


def get_cached_analysis(manual_dir: Path) -> Optional[str]:
    """Get cached video analysis.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Analysis text, or None if not cached
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return None
    return metadata.get("video_analysis")


def get_cached_keyframes(manual_dir: Path) -> Optional[List[Dict[str, Any]]]:
    """Get cached keyframes.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        List of keyframe dictionaries, or None if not cached
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return None
    return metadata.get("keyframes")


def get_cached_video_metadata(manual_dir: Path) -> Optional[Dict[str, Any]]:
    """Get cached video metadata.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Video metadata dictionary, or None if not cached
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return None
    return metadata.get("video_metadata")


def update_analysis(
    manual_dir: Path,
    video_analysis: str,
    model_used: str,
    video_metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Update metadata with video analysis.

    Args:
        manual_dir: Path to the manual directory
        video_analysis: Analysis text from Gemini
        model_used: Model name used for analysis
        video_metadata: Optional video metadata to update
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    metadata["video_analysis"] = video_analysis
    metadata["model_used"] = model_used
    if video_metadata:
        metadata["video_metadata"] = video_metadata
    save_metadata(manual_dir, metadata)


def update_keyframes(manual_dir: Path, keyframes: List[Dict[str, Any]]) -> None:
    """Update metadata with keyframes.

    Args:
        manual_dir: Path to the manual directory
        keyframes: List of keyframe dictionaries
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    metadata["keyframes"] = keyframes
    save_metadata(manual_dir, metadata)


def update_optimized(manual_dir: Path, optimized: bool) -> None:
    """Update metadata to mark video as optimized.

    Args:
        manual_dir: Path to the manual directory
        optimized: Whether the video has been optimized
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    metadata["optimized"] = optimized
    save_metadata(manual_dir, metadata)


def add_language_generated(manual_dir: Path, language_code: str) -> None:
    """Add a language to the list of generated languages.

    Args:
        manual_dir: Path to the manual directory
        language_code: ISO language code (e.g., "en", "es")
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    languages = metadata.get("languages_generated", [])
    if language_code not in languages:
        languages.append(language_code)
    metadata["languages_generated"] = languages
    save_metadata(manual_dir, metadata)


def has_optimized_video(manual_dir: Path) -> bool:
    """Check if optimized video exists.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        True if video_optimized.mp4 exists
    """
    return (manual_dir / "video_optimized.mp4").exists()


def has_screenshots(manual_dir: Path) -> bool:
    """Check if screenshots have been extracted.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        True if screenshots directory exists and has files
    """
    screenshots_dir = manual_dir / "screenshots"
    if not screenshots_dir.exists():
        return False
    return len(list(screenshots_dir.glob("*.png"))) > 0


# ==================== Project Organization ====================


def get_project_id(manual_dir: Path) -> Optional[str]:
    """Get the project ID this manual belongs to.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Project ID or None if not in a project
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return None
    return metadata.get("project_id")


def get_chapter_id(manual_dir: Path) -> Optional[str]:
    """Get the chapter ID this manual belongs to.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Chapter ID or None if not in a chapter
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return None
    return metadata.get("chapter_id")


def update_project_info(
    manual_dir: Path,
    project_id: Optional[str],
    chapter_id: Optional[str] = None,
) -> None:
    """Update project and chapter information.

    Args:
        manual_dir: Path to the manual directory
        project_id: Project ID (None to remove from project)
        chapter_id: Chapter ID within project
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    metadata["project_id"] = project_id
    metadata["chapter_id"] = chapter_id
    save_metadata(manual_dir, metadata)


# ==================== Tags ====================


def get_tags(manual_dir: Path) -> List[str]:
    """Get tags for a manual.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        List of tags
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return []
    return metadata.get("tags", [])


def add_tag(manual_dir: Path, tag: str) -> None:
    """Add a tag to a manual.

    Args:
        manual_dir: Path to the manual directory
        tag: Tag to add
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    tags = metadata.get("tags", [])
    if tag not in tags:
        tags.append(tag)
    metadata["tags"] = tags
    save_metadata(manual_dir, metadata)


def remove_tag(manual_dir: Path, tag: str) -> None:
    """Remove a tag from a manual.

    Args:
        manual_dir: Path to the manual directory
        tag: Tag to remove
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return
    tags = metadata.get("tags", [])
    if tag in tags:
        tags.remove(tag)
    metadata["tags"] = tags
    save_metadata(manual_dir, metadata)


def set_tags(manual_dir: Path, tags: List[str]) -> None:
    """Set all tags for a manual.

    Args:
        manual_dir: Path to the manual directory
        tags: List of tags
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    metadata["tags"] = tags
    save_metadata(manual_dir, metadata)


# ==================== Version Tracking ====================


def get_version(manual_dir: Path) -> str:
    """Get current version number.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Version string (e.g., "1.0.0")
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return "1.0.0"
    version_info = metadata.get("version", {})
    return version_info.get("number", "1.0.0")


def get_version_history(manual_dir: Path) -> List[Dict[str, Any]]:
    """Get version history.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        List of version history entries
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return []
    version_info = metadata.get("version", {})
    return version_info.get("history", [])


def update_version(
    manual_dir: Path,
    new_version: str,
    notes: str = "",
    snapshot_dir: Optional[str] = None,
) -> None:
    """Update version number and add to history.

    Args:
        manual_dir: Path to the manual directory
        new_version: New version string
        notes: Version notes
        snapshot_dir: Path to version snapshot (relative to manual_dir)
    """
    metadata = load_metadata(manual_dir) or create_metadata("")

    version_info = metadata.get("version", {"number": "1.0.0", "history": []})
    old_version = version_info.get("number", "1.0.0")

    # Add current version to history before updating
    if old_version != new_version:
        history_entry = {
            "version": old_version,
            "created_at": metadata.get("updated_at", datetime.now().isoformat()),
            "snapshot_dir": snapshot_dir,
            "notes": notes,
        }
        version_info["history"].append(history_entry)

    version_info["number"] = new_version
    metadata["version"] = version_info
    save_metadata(manual_dir, metadata)


def bump_version(manual_dir: Path, bump_type: str = "patch") -> str:
    """Bump version number.

    Args:
        manual_dir: Path to the manual directory
        bump_type: Type of bump ("major", "minor", or "patch")

    Returns:
        New version string
    """
    current = get_version(manual_dir)
    parts = current.split(".")

    if len(parts) != 3:
        parts = ["1", "0", "0"]

    major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])

    if bump_type == "major":
        major += 1
        minor = 0
        patch = 0
    elif bump_type == "minor":
        minor += 1
        patch = 0
    else:  # patch
        patch += 1

    return f"{major}.{minor}.{patch}"
