"""Manual generator node for creating user manual from analysis and keyframes."""

import os
from typing import Dict, Any, List
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

from ..config import DEFAULT_GEMINI_MODEL
from ..prompts.system import MANUAL_GENERATOR_PROMPT
from ..tools.video_tools import extract_screenshot_at_timestamp
from ..state import VideoManualState
from ....storage.user_storage import UserStorage


def generate_manual_node(state: VideoManualState) -> Dict[str, Any]:
    """Generate user manual from video analysis and keyframes.

    This is a LangGraph node that reads from state and returns a partial state update.
    Outputs are saved to the user's folder structure.

    Args:
        state: Current workflow state containing video_path, video_analysis, keyframes, user_id

    Returns:
        Partial state update with manual_content, manual_path, screenshots, output_directory, and status
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
    keyframes = state["keyframes"]
    user_id = state["user_id"]
    manual_id = state.get("manual_id")
    output_filename = state.get("output_filename")

    # Setup user storage and get manual directory
    user_storage = UserStorage(user_id)
    user_storage.ensure_user_folders()
    # Use output_filename if provided, otherwise derive from video name
    video_name = output_filename or Path(video_path).name
    manual_dir, manual_id = user_storage.get_manual_dir(manual_id, video_name=video_name)
    screenshots_dir = manual_dir / "screenshots"

    # Extract screenshots for each keyframe
    screenshot_paths = []

    for i, keyframe in enumerate(keyframes, 1):
        timestamp = keyframe['timestamp_seconds']
        screenshot_filename = f"figure_{i:02d}_t{int(timestamp)}s.png"
        screenshot_path = screenshots_dir / screenshot_filename

        try:
            extract_screenshot_at_timestamp(video_path, timestamp, str(screenshot_path))
            screenshot_paths.append({
                "figure_number": i,
                "path": str(screenshot_path),
                "relative_path": f"screenshots/{screenshot_filename}",
                "timestamp": timestamp,
                "description": keyframe.get('description', ''),
            })
        except Exception:
            pass  # Skip failed screenshots silently

    llm = ChatGoogleGenerativeAI(
        model=DEFAULT_GEMINI_MODEL,
        google_api_key=api_key,
    )

    # Prepare screenshot references for the prompt
    screenshot_refs = _format_screenshot_references(screenshot_paths)

    # Create generation prompt
    generation_prompt = f"""{MANUAL_GENERATOR_PROMPT}

VIDEO ANALYSIS:
{video_analysis}

AVAILABLE SCREENSHOTS:
{screenshot_refs}

Generate a comprehensive user manual in Markdown format based on the video analysis above.
Reference the screenshots appropriately throughout the manual.
"""

    try:
        # Generate manual
        response = llm.invoke(generation_prompt)
        manual_content = response.content
    except Exception as e:
        return {
            "status": "error",
            "error": f"Manual generation API error: {str(e)}",
        }

    # Ensure manual_content is a string (sometimes LangChain returns a list)
    if isinstance(manual_content, list):
        manual_content = '\n'.join(str(item) for item in manual_content)

    # Save manual to file
    video_name = Path(video_path).stem
    manual_filename = output_filename or f"manual_{video_name}"
    manual_path = manual_dir / "manual.md"

    try:
        with open(manual_path, 'w', encoding='utf-8') as f:
            f.write(manual_content)
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to save manual: {str(e)}",
        }

    # Return partial state update
    return {
        "manual_id": manual_id,
        "manual_content": manual_content,
        "manual_path": str(manual_path),
        "screenshots": screenshot_paths,
        "output_directory": str(manual_dir),
        "status": "completed",
    }


def _format_screenshot_references(screenshots: List[Dict[str, Any]]) -> str:
    """Format screenshot information for prompt."""
    if not screenshots:
        return "No screenshots available."

    formatted = []
    for screenshot in screenshots:
        formatted.append(
            f"Figure {screenshot['figure_number']}: "
            f"(at {screenshot['timestamp']}s) {screenshot['description']}\n"
            f"   File: {screenshot['relative_path']}"
        )

    return "\n".join(formatted)
