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
) -> Dict[str, Any]:
    """Create a new metadata dictionary.

    Args:
        video_path: Path to the original video file
        video_metadata: Video metadata (duration, fps, etc.)

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
