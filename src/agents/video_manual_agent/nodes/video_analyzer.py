"""Video analyzer node using Gemini for video understanding.

This node handles:
1. Video metadata extraction
2. Optional video optimization for efficient upload
3. Intelligent upload method selection (inline vs Files API)
4. Gemini-based video content analysis
5. Caching of analysis results in metadata.json
"""

import os
import base64
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from ..config import DEFAULT_GEMINI_MODEL, INLINE_SIZE_THRESHOLD, LLM_VIDEO_TIMEOUT
from ..prompts.system import VIDEO_ANALYZER_PROMPT
from ..tools.video_tools import get_video_metadata
from ..tools.video_preprocessor import (
    needs_optimization,
    preprocess_video_for_analysis,
    format_size,
)
from ..tools.gemini_upload import upload_video_to_gemini
from ..state import VideoManualState
from ..utils.metadata import (
    load_metadata,
    create_metadata,
    save_metadata,
    has_analysis,
    get_cached_analysis,
    get_cached_video_metadata,
    has_optimized_video,
    update_analysis,
    update_optimized,
)


def _create_inline_message(
    video_path: str, metadata: Dict[str, Any]
) -> HumanMessage:
    """Create a message with inline base64-encoded video data."""
    with open(video_path, "rb") as video_file:
        video_data = base64.standard_b64encode(video_file.read()).decode("utf-8")

    return HumanMessage(
        content=[
            {"type": "text", "text": VIDEO_ANALYZER_PROMPT},
            {
                "type": "media",
                "mime_type": f"video/{metadata['filename'].split('.')[-1]}",
                "data": video_data,
            },
        ]
    )


def _create_file_uri_message(file_uri: str, mime_type: str) -> HumanMessage:
    """Create a message referencing a Gemini Files API URI."""
    return HumanMessage(
        content=[
            {"type": "text", "text": VIDEO_ANALYZER_PROMPT},
            {
                "type": "media",
                "mime_type": mime_type,
                "file_uri": file_uri,
            },
        ]
    )


def analyze_video_node(state: VideoManualState) -> Dict[str, Any]:
    """Analyze video content using Gemini via LangChain.

    This node intelligently handles video upload:
    1. Check for cached analysis in metadata.json
    2. Check for existing optimized video
    3. For small videos (<15MB, <2min): Send directly as base64
    4. For larger videos: Optimize first, then decide upload method
    5. For optimized videos >20MB: Use Gemini Files API
    6. Cache results in metadata.json for future runs

    Args:
        state: Current workflow state containing video_path

    Returns:
        Partial state update with video_metadata, video_analysis, model_used,
        optimized_video_path, gemini_file_uri, and status
    """
    load_dotenv()

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {
            "status": "error",
            "error": "GOOGLE_API_KEY not found in environment variables",
        }

    video_path = state["video_path"]
    user_id = state.get("user_id", "default")
    manual_id = state.get("manual_id")

    # Get manual directory for caching
    manual_dir: Optional[Path] = None
    if manual_id:
        from ....storage.user_storage import UserStorage
        storage = UserStorage(user_id)
        manual_dir = storage.get_manual_path(manual_id)

    # Check for cached analysis
    if manual_dir and has_analysis(manual_dir):
        cached_analysis = get_cached_analysis(manual_dir)
        cached_metadata = get_cached_video_metadata(manual_dir)

        print("Using cached video analysis")

        # Check for existing optimized video
        optimized_path = manual_dir / "video_optimized.mp4"
        optimized_video_path = str(optimized_path) if optimized_path.exists() else None
        if optimized_video_path:
            print(f"Using existing optimized video: video_optimized.mp4")

        return {
            "video_metadata": cached_metadata,
            "video_analysis": cached_analysis,
            "model_used": DEFAULT_GEMINI_MODEL,
            "optimized_video_path": optimized_video_path,
            "gemini_file_uri": None,
            "status": "analyzing_complete",
            "using_cached": True,
        }

    # Get video metadata
    try:
        metadata = get_video_metadata(video_path)
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to extract video metadata: {str(e)}",
        }

    # Initialize or load metadata
    if manual_dir:
        existing_metadata = load_metadata(manual_dir)
        if not existing_metadata:
            existing_metadata = create_metadata(video_path, metadata)
            save_metadata(manual_dir, existing_metadata)

    # Track optimization state
    optimized_video_path: Optional[str] = None
    gemini_file_uri: Optional[str] = None
    analysis_video_path = video_path  # Video to send for analysis

    # Check if optimization is needed
    if needs_optimization(metadata):
        # Check for existing optimized video first
        if manual_dir and has_optimized_video(manual_dir):
            optimized_video_path = str(manual_dir / "video_optimized.mp4")
            analysis_video_path = optimized_video_path
            print(f"Using existing optimized video: video_optimized.mp4")
        else:
            print(
                f"Video optimization needed: {format_size(metadata['size_bytes'])} "
                f"({metadata['duration_seconds']:.1f}s)"
            )

            # Determine output directory for optimized video
            if manual_dir:
                output_dir = str(manual_dir)
                print(f"Storing optimized video in: {user_id}/manuals/{manual_id}/")
            else:
                # Fallback to temp directory next to original video
                output_dir = os.path.join(os.path.dirname(video_path), ".optimized")
                print(f"Warning: No manual_id, using fallback path")

            try:
                optimization_result = preprocess_video_for_analysis(
                    video_path=video_path,
                    output_dir=output_dir,
                    video_metadata=metadata,
                )
                optimized_video_path = optimization_result["optimized_path"]
                analysis_video_path = optimized_video_path

                print(
                    f"Video optimized: {format_size(optimization_result['original_size'])} -> "
                    f"{format_size(optimization_result['optimized_size'])} "
                    f"({optimization_result['compression_ratio']}x compression)"
                )

                # Update metadata with optimization status and details
                if manual_dir:
                    update_optimized(
                        manual_dir,
                        True,
                        original_size=optimization_result['original_size'],
                        optimized_size=optimization_result['optimized_size'],
                        compression_ratio=optimization_result['compression_ratio'],
                    )

            except Exception as e:
                print(f"Warning: Video optimization failed: {e}")
                print("Falling back to original video...")
                # Continue with original video if optimization fails

    # Determine upload method based on analysis video size
    analysis_size = os.path.getsize(analysis_video_path)

    if analysis_size >= INLINE_SIZE_THRESHOLD:
        # Use Files API for large videos
        print(
            f"Using cloud upload for large video ({format_size(analysis_size)} > 20MB)"
        )

        try:
            upload_result = upload_video_to_gemini(
                video_path=analysis_video_path,
                display_name=f"manual_{manual_id or 'video'}",
                api_key=api_key,
            )
            gemini_file_uri = upload_result["uri"]
            mime_type = upload_result["mime_type"]

            print(f"Video uploaded successfully")

            # Create message with file URI
            message = _create_file_uri_message(gemini_file_uri, mime_type)

        except Exception as e:
            return {
                "status": "error",
                "error": f"Failed to upload video: {str(e)}",
                "video_metadata": metadata,
                "optimized_video_path": optimized_video_path,
            }
    else:
        # Use inline base64 for small videos
        print(f"Using inline upload ({format_size(analysis_size)})")

        try:
            # Create metadata for the analysis video (might be optimized)
            analysis_metadata = (
                get_video_metadata(analysis_video_path)
                if analysis_video_path != video_path
                else metadata
            )
            message = _create_inline_message(analysis_video_path, analysis_metadata)
        except Exception as e:
            return {
                "status": "error",
                "error": f"Failed to read video file: {str(e)}",
                "video_metadata": metadata,
                "optimized_video_path": optimized_video_path,
            }

    # Create LLM with timeout and invoke
    llm = ChatGoogleGenerativeAI(
        model=DEFAULT_GEMINI_MODEL,
        google_api_key=api_key,
        timeout=LLM_VIDEO_TIMEOUT,
    )

    try:
        print("Analyzing video content...")
        response = llm.invoke([message])
    except Exception as e:
        return {
            "status": "error",
            "error": f"Video analysis API error: {str(e)}",
            "video_metadata": metadata,
            "optimized_video_path": optimized_video_path,
            "gemini_file_uri": gemini_file_uri,
        }

    # Cache analysis in metadata
    if manual_dir:
        update_analysis(manual_dir, response.content, DEFAULT_GEMINI_MODEL, metadata)

    # Return partial state update
    return {
        "video_metadata": metadata,
        "video_analysis": response.content,
        "model_used": DEFAULT_GEMINI_MODEL,
        "optimized_video_path": optimized_video_path,
        "gemini_file_uri": gemini_file_uri,
        "status": "analyzing_complete",
        "using_cached": False,
    }