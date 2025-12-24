"""Keyframe identifier node for extracting key moments from video.

This node parses keyframes from the video analysis (no LLM call).
The video analyzer prompt now includes keyframe selection criteria,
so this node only validates and sanitizes the output.
"""

import re
from pathlib import Path
from typing import Dict, Any, List, Optional

from ..config import KEYFRAME_MIN_INTERVAL
from ..state import VideoDocState
from ..utils.metadata import has_keyframes, get_cached_keyframes, update_keyframes


def identify_keyframes_node(state: VideoDocState) -> Dict[str, Any]:
    """Parse and validate keyframes from video analysis.

    This is a LangGraph node that extracts keyframes from the video_analysis text.
    No LLM call is made - this is pure Python parsing and validation.

    Args:
        state: Current workflow state containing video_analysis and video_metadata

    Returns:
        Partial state update with keyframes, total_keyframes, and status
    """
    # Extract values from state
    video_analysis = state["video_analysis"]
    video_metadata = state.get("video_metadata", {})
    user_id = state.get("user_id", "default")
    doc_id = state.get("doc_id")
    video_duration = video_metadata.get("duration_seconds", float("inf"))

    # Get manual directory for caching
    doc_dir: Optional[Path] = None
    if doc_id:
        from ....storage.user_storage import UserStorage
        storage = UserStorage(user_id)
        doc_dir = storage.get_doc_path(doc_id)

    # Check for cached keyframes
    if doc_dir and has_keyframes(doc_dir):
        cached_keyframes = get_cached_keyframes(doc_dir)
        print(f"Using cached keyframes: {len(cached_keyframes)} keyframes found")

        return {
            "keyframes": cached_keyframes,
            "scene_changes": [],
            "total_keyframes": len(cached_keyframes),
            "status": "identifying_complete",
        }

    # Parse keyframes from video analysis text
    print("Parsing keyframes from video analysis...")
    keyframes = _parse_keyframes_from_response(video_analysis)

    # Validate keyframes
    keyframes = _validate_keyframes(keyframes, video_duration)

    # Filter keyframes to ensure minimum interval
    keyframes = _filter_keyframes(keyframes, KEYFRAME_MIN_INTERVAL)

    # Warn if keyframe count seems off
    if len(keyframes) == 0:
        print("Warning: No keyframes found in video analysis")
    elif len(keyframes) < 3:
        print(f"Warning: Only {len(keyframes)} keyframes found - may be too few")
    elif len(keyframes) > 50:
        print(f"Warning: {len(keyframes)} keyframes found - may be too many")

    # Cache keyframes in metadata
    if doc_dir:
        update_keyframes(doc_dir, keyframes)

    # Return partial state update
    return {
        "keyframes": keyframes,
        "scene_changes": [],
        "total_keyframes": len(keyframes),
        "status": "identifying_complete",
    }


def _validate_keyframes(
    keyframes: List[Dict[str, Any]],
    video_duration: float
) -> List[Dict[str, Any]]:
    """Validate keyframes and filter out invalid entries.

    Args:
        keyframes: List of parsed keyframes
        video_duration: Video duration in seconds

    Returns:
        List of valid keyframes
    """
    valid_keyframes = []

    for kf in keyframes:
        timestamp = kf.get("timestamp_seconds", -1)
        description = kf.get("description", "").strip()

        # Skip invalid entries
        if timestamp < 0:
            continue
        if timestamp > video_duration:
            print(f"Warning: Skipping keyframe at {timestamp}s (exceeds video duration {video_duration}s)")
            continue
        if not description:
            print(f"Warning: Skipping keyframe at {timestamp}s (no description)")
            continue

        valid_keyframes.append(kf)

    return valid_keyframes


def _parse_keyframes_from_response(response_text: str) -> List[Dict[str, Any]]:
    """Parse keyframes from Gemini response.

    Looks for timestamps in various formats:
    - 1:23 or 01:23 (minutes:seconds)
    - 45s or 45 seconds
    - 1m 30s
    - Explicit timestamp: 90 seconds
    - Timestamp: 00:05 format
    """
    keyframes = []

    # Split into lines and look for timestamps
    lines = response_text.split('\n')

    current_timestamp = None
    current_description = []

    for i, line in enumerate(lines):
        line = line.strip()

        # Look for "Timestamp:" or "**Timestamp:**" pattern
        timestamp_label_match = re.search(r'\*?\*?Timestamp:\*?\*?\s*(\d+):(\d+)', line, re.IGNORECASE)
        if timestamp_label_match:
            # Save previous keyframe if exists
            if current_timestamp is not None and current_description:
                desc = ' '.join(current_description).strip()
                if desc:
                    keyframes.append({
                        "timestamp_seconds": current_timestamp,
                        "timestamp_formatted": f"{current_timestamp // 60}:{current_timestamp % 60:02d}",
                        "description": desc,
                    })

            # Start new keyframe
            minutes = int(timestamp_label_match.group(1))
            seconds = int(timestamp_label_match.group(2))
            current_timestamp = minutes * 60 + seconds
            current_description = []
            continue

        # Look for **Description:** pattern
        desc_match = re.search(r'\*?\*?Description:\*?\*?\s*(.+)', line, re.IGNORECASE)
        if desc_match and current_timestamp is not None:
            current_description.append(desc_match.group(1))
            continue

        # Add other content if we're building a description
        if current_timestamp is not None and line and not line.startswith('**') and not line.startswith('---'):
            current_description.append(line)

    # Save last keyframe
    if current_timestamp is not None and current_description:
        desc = ' '.join(current_description).strip()
        if desc:
            keyframes.append({
                "timestamp_seconds": current_timestamp,
                "timestamp_formatted": f"{current_timestamp // 60}:{current_timestamp % 60:02d}",
                "description": desc,
            })

    return keyframes


def _filter_keyframes(
    keyframes: List[Dict[str, Any]],
    min_interval: float
) -> List[Dict[str, Any]]:
    """Filter keyframes to ensure minimum interval between them."""
    if not keyframes:
        return []

    # Sort by timestamp
    sorted_keyframes = sorted(keyframes, key=lambda x: x['timestamp_seconds'])

    # Filter to maintain minimum interval
    filtered = [sorted_keyframes[0]]

    for kf in sorted_keyframes[1:]:
        if kf['timestamp_seconds'] - filtered[-1]['timestamp_seconds'] >= min_interval:
            filtered.append(kf)

    return filtered
