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
    target_audience: Optional[str] = None,
    target_objective: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new metadata dictionary.

    Args:
        video_path: Path to the original video file
        video_metadata: Video metadata (duration, fps, etc.)
        project_id: Optional project this manual belongs to
        chapter_id: Optional chapter within the project
        tags: Optional list of tags
        target_audience: Target audience for the manual
        target_objective: Target objective of the manual

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
        # Manual context (immutable across languages)
        "target_audience": target_audience,
        "target_objective": target_objective,
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


def update_optimized(
    manual_dir: Path,
    optimized: bool,
    original_size: Optional[int] = None,
    optimized_size: Optional[int] = None,
    compression_ratio: Optional[float] = None,
) -> None:
    """Update metadata to mark video as optimized with details.

    Args:
        manual_dir: Path to the manual directory
        optimized: Whether the video has been optimized
        original_size: Original video size in bytes
        optimized_size: Optimized video size in bytes
        compression_ratio: Compression ratio (original/optimized)
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    metadata["optimized"] = optimized

    # Save optimization details if provided
    if optimized and any([original_size, optimized_size, compression_ratio]):
        metadata["optimization_details"] = {
            "original_size": original_size,
            "optimized_size": optimized_size,
            "compression_ratio": compression_ratio,
        }

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


# ==================== Manual Context ====================


def get_target_audience(manual_dir: Path) -> Optional[str]:
    """Get the target audience for a manual.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Target audience string or None
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return None
    return metadata.get("target_audience")


def get_target_objective(manual_dir: Path) -> Optional[str]:
    """Get the target objective for a manual.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Target objective string or None
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return None
    return metadata.get("target_objective")


# ==================== Source Languages ====================


def get_source_languages(manual_dir: Path) -> Optional[Dict[str, Any]]:
    """Get the detected source languages for a manual's video.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        Dictionary with audio, ui_text, and confidence keys, or None if not detected
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return None
    return metadata.get("source_languages")


def update_source_languages(
    manual_dir: Path,
    source_languages: Dict[str, Any],
) -> None:
    """Update the source languages in metadata.

    Args:
        manual_dir: Path to the manual directory
        source_languages: Dictionary with audio, ui_text, and confidence keys
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    metadata["source_languages"] = source_languages
    save_metadata(manual_dir, metadata)


# ==================== Additional Videos ====================


def get_additional_videos(manual_dir: Path) -> List[Dict[str, Any]]:
    """Get list of additional videos for a manual.

    Args:
        manual_dir: Path to the manual directory

    Returns:
        List of additional video dictionaries, each containing:
        - id: Unique identifier
        - filename: Relative path in videos/ folder
        - label: User-friendly label
        - language: Optional ISO language code
        - added_at: ISO timestamp
        - duration_seconds: Video duration
        - size_bytes: File size
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return []
    return metadata.get("additional_videos", [])


def add_additional_video(
    manual_dir: Path,
    video_id: str,
    filename: str,
    label: str,
    language: Optional[str] = None,
    duration_seconds: float = 0,
    size_bytes: int = 0,
) -> None:
    """Add an additional video to metadata.

    Args:
        manual_dir: Path to the manual directory
        video_id: Unique identifier for this video
        filename: Filename in the videos/ subfolder
        label: User-friendly label (e.g., "English UI")
        language: Optional ISO language code (e.g., "en")
        duration_seconds: Video duration in seconds
        size_bytes: File size in bytes
    """
    metadata = load_metadata(manual_dir) or create_metadata("")
    additional_videos = metadata.get("additional_videos", [])

    # Check if video_id already exists
    for video in additional_videos:
        if video["id"] == video_id:
            raise ValueError(f"Video with id '{video_id}' already exists")

    additional_videos.append({
        "id": video_id,
        "filename": filename,
        "label": label,
        "language": language,
        "added_at": datetime.now().isoformat(),
        "duration_seconds": duration_seconds,
        "size_bytes": size_bytes,
    })

    metadata["additional_videos"] = additional_videos
    save_metadata(manual_dir, metadata)


def remove_additional_video(manual_dir: Path, video_id: str) -> bool:
    """Remove an additional video from metadata.

    Args:
        manual_dir: Path to the manual directory
        video_id: ID of the video to remove

    Returns:
        True if video was found and removed, False otherwise
    """
    metadata = load_metadata(manual_dir)
    if metadata is None:
        return False

    additional_videos = metadata.get("additional_videos", [])
    original_count = len(additional_videos)

    additional_videos = [v for v in additional_videos if v["id"] != video_id]

    if len(additional_videos) == original_count:
        return False  # Video not found

    metadata["additional_videos"] = additional_videos
    save_metadata(manual_dir, metadata)
    return True


def get_additional_video_by_id(
    manual_dir: Path, video_id: str
) -> Optional[Dict[str, Any]]:
    """Get a specific additional video by ID.

    Args:
        manual_dir: Path to the manual directory
        video_id: ID of the video to find

    Returns:
        Video dictionary if found, None otherwise
    """
    additional_videos = get_additional_videos(manual_dir)
    for video in additional_videos:
        if video["id"] == video_id:
            return video
    return None


def get_video_path_by_id(manual_dir: Path, video_id: str) -> Optional[Path]:
    """Get the file path for a video by ID.

    Handles both "primary" (the main video) and additional video IDs.

    Args:
        manual_dir: Path to the manual directory
        video_id: Video ID ("primary" or an additional video ID)

    Returns:
        Path to the video file, or None if not found
    """
    if video_id == "primary":
        # Primary video: prefer optimized, fall back to original
        optimized = manual_dir / "video_optimized.mp4"
        if optimized.exists():
            return optimized

        # Check metadata for original video path
        metadata = load_metadata(manual_dir)
        if metadata and metadata.get("video_path"):
            original = Path(metadata["video_path"])
            if original.exists():
                return original

        # Last resort: check for video.mp4 in manual dir
        default = manual_dir / "video.mp4"
        if default.exists():
            return default

        return None

    # Additional video
    video_info = get_additional_video_by_id(manual_dir, video_id)
    if video_info is None:
        return None

    video_path = manual_dir / "videos" / video_info["filename"]
    if video_path.exists():
        return video_path

    return None
