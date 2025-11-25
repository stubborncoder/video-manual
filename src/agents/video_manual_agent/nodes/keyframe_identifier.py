"""Keyframe identifier node for extracting key moments from video."""

import os
import re
from typing import Dict, Any, List
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

from ..config import DEFAULT_GEMINI_MODEL, KEYFRAME_MIN_INTERVAL
from ..prompts.system import KEYFRAME_IDENTIFIER_PROMPT
from ..tools.video_tools import detect_scene_changes
from ..state import VideoManualState


def identify_keyframes_node(state: VideoManualState) -> Dict[str, Any]:
    """Identify keyframes from video analysis.

    This is a LangGraph node that reads from state and returns a partial state update.

    Args:
        state: Current workflow state containing video_path, video_analysis, and use_scene_detection

    Returns:
        Partial state update with keyframes, scene_changes, total_keyframes, and status
    """
    # Load environment variables
    load_dotenv()

    # Get API key
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {
            "status": "error",
            "error": "GOOGLE_API_KEY not found in environment variables",
        }

    # Extract values from state
    video_path = state["video_path"]
    video_analysis = state["video_analysis"]
    use_scene_detection = state.get("use_scene_detection", True)

    print("\n=== Keyframe Identification Starting ===\n")

    # Optional: Use scene detection for initial suggestions
    scene_changes = []
    if use_scene_detection:
        print("Detecting scene changes...")
        try:
            scene_changes = detect_scene_changes(video_path)
            print(f"Found {len(scene_changes)} scene changes\n")
        except Exception as e:
            print(f"Scene detection failed (continuing without): {str(e)}\n")
            scene_changes = []

    # Use Gemini to identify keyframes based on analysis
    print("Using Gemini to identify key instructional moments...\n")

    llm = ChatGoogleGenerativeAI(
        model=DEFAULT_GEMINI_MODEL,
        google_api_key=api_key,
    )

    # Prepare enhanced prompt
    enhanced_prompt = f"""{KEYFRAME_IDENTIFIER_PROMPT}

VIDEO ANALYSIS:
{video_analysis}

{"DETECTED SCENE CHANGES:" if scene_changes else ""}
{_format_scene_changes(scene_changes) if scene_changes else ""}

Based on the video analysis above, identify the most important keyframes (with exact timestamps in seconds)
that should be captured as screenshots for the user manual.
"""

    try:
        # Get keyframe recommendations
        response = llm.invoke(enhanced_prompt)
    except Exception as e:
        return {
            "status": "error",
            "error": f"Gemini API error during keyframe identification: {str(e)}",
        }

    # Parse keyframes from response
    keyframes = _parse_keyframes_from_response(response.content)

    # Filter keyframes to ensure minimum interval
    keyframes = _filter_keyframes(keyframes, KEYFRAME_MIN_INTERVAL)

    print(f"Identified {len(keyframes)} keyframes\n")
    print("=== Keyframe Identification Complete ===\n")

    # Return partial state update
    return {
        "keyframes": keyframes,
        "scene_changes": scene_changes,
        "total_keyframes": len(keyframes),
        "status": "identifying_complete",
    }


def _format_scene_changes(scene_changes: List[Dict]) -> str:
    """Format scene changes for prompt."""
    if not scene_changes:
        return ""

    formatted = []
    for scene in scene_changes[:20]:  # Limit to first 20 scenes
        formatted.append(
            f"Scene {scene['scene_number']}: {scene['start_formatted']} - "
            f"{scene['end_formatted']} ({scene['duration_seconds']:.1f}s)"
        )

    return "\n".join(formatted)


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
