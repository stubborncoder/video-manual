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

from ..config import INLINE_SIZE_THRESHOLD, LLM_VIDEO_TIMEOUT
from ..prompts.system import get_video_analyzer_prompt
from ..tools.video_tools import get_video_metadata
from ....core.models import TaskType, get_model, ModelProvider
from ....db.admin_settings import AdminSettings
from ..tools.video_preprocessor import (
    needs_optimization,
    preprocess_video_for_analysis,
    format_size,
)
from ..tools.gemini_upload import upload_video_to_gemini
from ..state import VideoDocState
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
    update_source_languages,
    get_source_languages,
)

import re


def _parse_source_languages(response_text: str) -> Optional[Dict[str, Any]]:
    """Parse language detection from the Gemini response.

    Looks for the ## Languages section with:
    - Audio: <language_code or "none">
    - UI Text: <language_code>
    - Confidence: <high, medium, or low>

    Args:
        response_text: The full response from Gemini

    Returns:
        Dictionary with audio, ui_text, and confidence keys, or None if not found
    """
    # Find the Languages section
    languages_match = re.search(
        r'##\s*Languages\s*\n(.*?)(?=##|\Z)',
        response_text,
        re.IGNORECASE | re.DOTALL
    )

    if not languages_match:
        return None

    languages_section = languages_match.group(1)

    # Parse individual fields
    audio_match = re.search(r'Audio:\s*(\S+)', languages_section, re.IGNORECASE)
    ui_text_match = re.search(r'UI\s*Text:\s*(\S+)', languages_section, re.IGNORECASE)
    confidence_match = re.search(r'Confidence:\s*(\S+)', languages_section, re.IGNORECASE)

    if not ui_text_match:
        # UI Text is required
        return None

    audio = audio_match.group(1).lower() if audio_match else None
    ui_text = ui_text_match.group(1).lower()
    confidence = confidence_match.group(1).lower() if confidence_match else "medium"

    # Normalize "none" for audio
    if audio == "none":
        audio = None

    # Validate confidence
    if confidence not in ("high", "medium", "low"):
        confidence = "medium"

    return {
        "audio": audio,
        "ui_text": ui_text,
        "confidence": confidence,
    }


def _create_inline_message(
    video_path: str, metadata: Dict[str, Any], document_format: Optional[str] = None
) -> HumanMessage:
    """Create a message with inline base64-encoded video data."""
    with open(video_path, "rb") as video_file:
        video_data = base64.standard_b64encode(video_file.read()).decode("utf-8")

    # Get format-aware prompt
    prompt = get_video_analyzer_prompt(document_format)

    return HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {
                "type": "media",
                "mime_type": f"video/{metadata['filename'].split('.')[-1]}",
                "data": video_data,
            },
        ]
    )


def _create_file_uri_message(
    file_uri: str, mime_type: str, document_format: Optional[str] = None
) -> HumanMessage:
    """Create a message referencing a Gemini Files API URI."""
    # Get format-aware prompt
    prompt = get_video_analyzer_prompt(document_format)

    return HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {
                "type": "media",
                "mime_type": mime_type,
                "file_uri": file_uri,
            },
        ]
    )


def analyze_video_node(state: VideoDocState) -> Dict[str, Any]:
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
    doc_id = state.get("doc_id")
    document_format = state.get("document_format")  # For format-aware prompts

    # Get the configured model for video analysis
    model_id = AdminSettings.get_model_for_task(TaskType.VIDEO_ANALYSIS)
    model_info = get_model(model_id)

    # Validate that video analysis uses a Gemini model (Claude cannot process video)
    if model_info and model_info.provider != ModelProvider.GOOGLE:
        raise ValueError(
            f"Video analysis requires a Gemini model. '{model_id}' is not supported. "
            "Only Google Gemini models can process video content."
        )

    print(f"Using model for video analysis: {model_id}")

    # Get manual directory for caching
    doc_dir: Optional[Path] = None
    if doc_id:
        from ....storage.user_storage import UserStorage
        storage = UserStorage(user_id)
        doc_dir = storage.get_doc_path(doc_id)

    # Check for cached analysis
    if doc_dir and has_analysis(doc_dir):
        cached_analysis = get_cached_analysis(doc_dir)
        cached_metadata = get_cached_video_metadata(doc_dir)
        cached_source_languages = get_source_languages(doc_dir)

        print("Using cached video analysis")

        # Check for existing optimized video
        optimized_path = doc_dir / "video_optimized.mp4"
        optimized_video_path = str(optimized_path) if optimized_path.exists() else None
        if optimized_video_path:
            print("Using existing optimized video: video_optimized.mp4")

        return {
            "video_metadata": cached_metadata,
            "video_analysis": cached_analysis,
            "model_used": model_id,
            "optimized_video_path": optimized_video_path,
            "gemini_file_uri": None,
            "status": "analyzing_complete",
            "using_cached": True,
            "source_languages": cached_source_languages,
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
    if doc_dir:
        existing_metadata = load_metadata(doc_dir)
        if not existing_metadata:
            existing_metadata = create_metadata(video_path, metadata)
            save_metadata(doc_dir, existing_metadata)

    # Track optimization state
    optimized_video_path: Optional[str] = None
    gemini_file_uri: Optional[str] = None
    analysis_video_path = video_path  # Video to send for analysis

    # Check if optimization is needed
    if needs_optimization(metadata):
        # Check for existing optimized video first
        if doc_dir and has_optimized_video(doc_dir):
            optimized_video_path = str(doc_dir / "video_optimized.mp4")
            analysis_video_path = optimized_video_path
            print("Using existing optimized video: video_optimized.mp4")
        else:
            print(
                f"Video optimization needed: {format_size(metadata['size_bytes'])} "
                f"({metadata['duration_seconds']:.1f}s)"
            )

            # Determine output directory for optimized video
            if doc_dir:
                output_dir = str(doc_dir)
                print(f"Storing optimized video in: {user_id}/manuals/{doc_id}/")
            else:
                # Fallback to temp directory next to original video
                output_dir = os.path.join(os.path.dirname(video_path), ".optimized")
                print("Warning: No doc_id, using fallback path")

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
                if doc_dir:
                    update_optimized(
                        doc_dir,
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
                display_name=f"manual_{doc_id or 'video'}",
                api_key=api_key,
            )
            gemini_file_uri = upload_result["uri"]
            mime_type = upload_result["mime_type"]

            print("Video uploaded successfully")

            # Create message with file URI (format-aware prompt)
            message = _create_file_uri_message(gemini_file_uri, mime_type, document_format)

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
            message = _create_inline_message(analysis_video_path, analysis_metadata, document_format)
        except Exception as e:
            return {
                "status": "error",
                "error": f"Failed to read video file: {str(e)}",
                "video_metadata": metadata,
                "optimized_video_path": optimized_video_path,
            }

    # Create LLM with timeout and invoke
    llm = ChatGoogleGenerativeAI(
        model=model_id,
        google_api_key=api_key,
        timeout=LLM_VIDEO_TIMEOUT,
    )

    try:
        print("Analyzing video content...")
        response = llm.invoke([message])

        # Log token usage
        try:
            from ....db.usage_tracking import UsageTracking
            usage = response.usage_metadata if hasattr(response, 'usage_metadata') else {}
            if usage:
                job_id = state.get("job_id")

                # Extract cache tokens based on provider format
                # Gemini uses: cached_content_token_count
                # Claude uses: input_token_details.cache_read, input_token_details.cache_creation
                cached_tokens = usage.get("cached_content_token_count", 0)  # Gemini
                cache_read_tokens = 0
                cache_creation_tokens = 0

                input_details = usage.get("input_token_details", {})
                if input_details:
                    cache_read_tokens = input_details.get("cache_read", 0)
                    cache_creation_tokens = input_details.get("cache_creation", 0)

                UsageTracking.log_request(
                    user_id=user_id,
                    operation="video_analysis",
                    model=model_id,
                    input_tokens=usage.get("input_tokens", 0),
                    output_tokens=usage.get("output_tokens", 0),
                    cached_tokens=cached_tokens,
                    cache_read_tokens=cache_read_tokens,
                    cache_creation_tokens=cache_creation_tokens,
                    doc_id=doc_id,
                    job_id=job_id,
                )
        except Exception as usage_error:
            # Don't fail the whole operation if usage tracking fails
            print(f"Warning: Failed to log token usage: {usage_error}")

    except Exception as e:
        return {
            "status": "error",
            "error": f"Video analysis API error: {str(e)}",
            "video_metadata": metadata,
            "optimized_video_path": optimized_video_path,
            "gemini_file_uri": gemini_file_uri,
        }

    # Parse and save source languages
    source_languages = _parse_source_languages(response.content)
    if source_languages:
        print(f"Detected languages - Audio: {source_languages.get('audio', 'none')}, UI: {source_languages['ui_text']}, Confidence: {source_languages['confidence']}")
    else:
        print("Warning: Could not parse language detection from response")

    # Cache analysis in metadata
    if doc_dir:
        update_analysis(doc_dir, response.content, model_id, metadata)
        if source_languages:
            update_source_languages(doc_dir, source_languages)

    # Return partial state update
    return {
        "video_metadata": metadata,
        "video_analysis": response.content,
        "model_used": model_id,
        "optimized_video_path": optimized_video_path,
        "gemini_file_uri": gemini_file_uri,
        "status": "analyzing_complete",
        "using_cached": False,
        "source_languages": source_languages,
    }