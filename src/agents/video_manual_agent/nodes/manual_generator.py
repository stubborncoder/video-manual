"""Manual generator node for creating user manual from analysis and keyframes."""

import os
from typing import Dict, Any, List
from pathlib import Path
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chat_models import init_chat_model
from langchain_anthropic import ChatAnthropic
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware

from ..config import LLM_TEXT_TIMEOUT
from ..prompts.system import MANUAL_GENERATOR_PROMPT
from ..prompts.document_formats import get_format_prompt, DEFAULT_FORMAT
from ....core.models import TaskType, get_model, ModelProvider
from ....db.admin_settings import AdminSettings
from ..tools.video_tools import extract_screenshot_at_timestamp
from ..state import VideoManualState
from ..utils.language import get_language_code, get_language_name
from ..utils.metadata import (
    has_screenshots,
    add_language_generated,
    get_target_audience,
    get_target_objective,
    load_metadata,
    save_metadata,
)
from ....storage.user_storage import UserStorage
from ....storage.version_storage import VersionStorage
from ....core.sanitization import sanitize_target_audience, sanitize_target_objective


def generate_manual_node(state: VideoManualState) -> Dict[str, Any]:
    """Generate user manual from video analysis and keyframes.

    This is a LangGraph node that reads from state and returns a partial state update.
    Screenshots are stored in a shared folder, manuals are language-specific.

    Structure:
        {manual}/
        ├── screenshots/           # Shared across languages
        │   ├── figure_01_t5s.png
        │   └── ...
        ├── en/
        │   └── manual.md          # References ../screenshots/
        └── es/
            └── manual.md

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
    # Use optimized video for screenshot extraction if available (better codec compatibility)
    optimized_video_path = state.get("optimized_video_path")

    # Get language settings
    language = state.get("output_language", "English")
    language_code = get_language_code(language)
    language_name = get_language_name(language)

    # Get document format
    document_format = state.get("document_format", DEFAULT_FORMAT)

    # Setup user storage and get manual directory
    user_storage = UserStorage(user_id)
    user_storage.ensure_user_folders()
    # Use output_filename if provided, otherwise derive from video name
    video_name = output_filename or Path(video_path).name
    manual_dir, manual_id = user_storage.get_manual_dir(manual_id, video_name=video_name)

    # Get or retrieve target audience and objective (immutable across languages)
    # Sanitize inputs to prevent prompt injection
    try:
        target_audience = sanitize_target_audience(state.get("target_audience"))
        target_objective = sanitize_target_objective(state.get("target_objective"))
    except ValueError as e:
        return {
            "status": "error",
            "error": str(e),
        }

    # If not in state, try to get from existing metadata (for add-language flow)
    # Note: metadata values were sanitized when originally saved
    if not target_audience or not target_objective:
        existing_target_audience = get_target_audience(manual_dir)
        existing_target_objective = get_target_objective(manual_dir)
        target_audience = target_audience or existing_target_audience
        target_objective = target_objective or existing_target_objective

    # Store in metadata if this is the first time (or update if provided)
    metadata = load_metadata(manual_dir)
    if metadata:
        if target_audience is not None:
            metadata["target_audience"] = target_audience
        if target_objective is not None:
            metadata["target_objective"] = target_objective
        # Store document format in metadata
        metadata["document_format"] = document_format
        save_metadata(manual_dir, metadata)

    # Create shared screenshots directory (at manual level, not language level)
    screenshots_dir = manual_dir / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    # Create language-specific directory for manual.md only
    lang_dir = manual_dir / language_code
    lang_dir.mkdir(parents=True, exist_ok=True)

    # Extract screenshots only if not already done
    screenshot_paths = []
    screenshots_exist = has_screenshots(manual_dir)

    # Determine which video to use for screenshot extraction
    # Prefer optimized video (MP4) as it has better codec compatibility than some formats (e.g., AV1 WebM)
    screenshot_source_video = video_path
    if optimized_video_path and Path(optimized_video_path).exists():
        screenshot_source_video = optimized_video_path
        print(f"Using optimized video for screenshots: {Path(optimized_video_path).name}")
    else:
        # Also check if optimized video exists in manual_dir (for cached runs)
        manual_optimized = manual_dir / "video_optimized.mp4"
        if manual_optimized.exists():
            screenshot_source_video = str(manual_optimized)
            print("Using cached optimized video for screenshots")

    if screenshots_exist:
        print(f"Using existing screenshots: {len(list(screenshots_dir.glob('*.png')))} found")
        # Build screenshot_paths from existing files
        for i, keyframe in enumerate(keyframes, 1):
            timestamp = keyframe['timestamp_seconds']
            screenshot_filename = f"figure_{i:02d}_t{int(timestamp)}s.png"
            screenshot_path = screenshots_dir / screenshot_filename

            if screenshot_path.exists():
                screenshot_paths.append({
                    "figure_number": i,
                    "path": str(screenshot_path),
                    "relative_path": f"../screenshots/{screenshot_filename}",
                    "timestamp": timestamp,
                    "description": keyframe.get('description', ''),
                })
    else:
        print(f"Extracting {len(keyframes)} screenshots...")
        for i, keyframe in enumerate(keyframes, 1):
            timestamp = keyframe['timestamp_seconds']
            screenshot_filename = f"figure_{i:02d}_t{int(timestamp)}s.png"
            screenshot_path = screenshots_dir / screenshot_filename

            try:
                extract_screenshot_at_timestamp(screenshot_source_video, timestamp, str(screenshot_path))
                screenshot_paths.append({
                    "figure_number": i,
                    "path": str(screenshot_path),
                    "relative_path": f"../screenshots/{screenshot_filename}",
                    "timestamp": timestamp,
                    "description": keyframe.get('description', ''),
                })
            except Exception as e:
                print(f"Warning: Failed to extract screenshot at {timestamp}s: {e}")

    # Get the configured model for manual generation
    model_id = AdminSettings.get_model_for_task(TaskType.MANUAL_GENERATION)
    model_info = get_model(model_id)
    print(f"Using model for manual generation: {model_id}")

    # Check for appropriate API key based on provider
    if model_info and model_info.provider == ModelProvider.ANTHROPIC:
        anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        if not anthropic_key:
            raise ValueError("ANTHROPIC_API_KEY not configured for Claude models")
        # Use ChatAnthropic with prompt caching middleware for cost savings
        llm = ChatAnthropic(
            model=model_id,
            api_key=anthropic_key,
            temperature=0.7,
        ).with_config(
            middleware=[AnthropicPromptCachingMiddleware(ttl="5m")]
        )
    else:
        # Use ChatGoogleGenerativeAI for Gemini (supports timeout)
        llm = ChatGoogleGenerativeAI(
            model=model_id,
            google_api_key=api_key,
            timeout=LLM_TEXT_TIMEOUT,
        )

    # Prepare screenshot references for the prompt
    screenshot_refs = _format_screenshot_references(screenshot_paths)

    # Build context section with target audience and objective
    context_section = ""
    if target_audience or target_objective:
        context_section = "\n\nMANUAL CONTEXT:"
        if target_audience:
            context_section += f"\nTarget Audience: {target_audience}"
        if target_objective:
            context_section += f"\nTarget Objective: {target_objective}"
        context_section += "\n\nPlease tailor the manual's tone, level of detail, and explanations to match the target audience and help achieve the stated objective."

    # Get format-specific prompt
    format_prompt = get_format_prompt(document_format)

    # Create generation prompt with language instruction
    generation_prompt = f"""{format_prompt}

OUTPUT LANGUAGE: Write the entire document in {language_name}.
- Use {language_name} for all explanations, headings, and instructions
- Keep UI element names/labels exactly as shown in screenshots (do not translate UI text)
{context_section}

VIDEO ANALYSIS:
{video_analysis}

AVAILABLE SCREENSHOTS:
{screenshot_refs}

Generate the document based on the video analysis above.
Write in {language_name}. Use the semantic tags as instructed. Reference screenshots appropriately.
"""

    try:
        # Generate manual
        print(f"Generating manual in {language_name}...")
        response = llm.invoke(generation_prompt)
        manual_content = response.content

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
                    operation="manual_generation",
                    model=model_id,
                    input_tokens=usage.get("input_tokens", 0),
                    output_tokens=usage.get("output_tokens", 0),
                    cached_tokens=cached_tokens,
                    cache_read_tokens=cache_read_tokens,
                    cache_creation_tokens=cache_creation_tokens,
                    manual_id=manual_id,
                    job_id=job_id,
                )
        except Exception as usage_error:
            # Don't fail the whole operation if usage tracking fails
            print(f"Warning: Failed to log token usage: {usage_error}")

    except Exception as e:
        return {
            "status": "error",
            "error": f"Manual generation API error: {str(e)}",
        }

    # Ensure manual_content is a string (sometimes LangChain returns a list)
    # Anthropic/Claude returns content blocks like [{'type': 'text', 'text': '...'}]
    if isinstance(manual_content, list):
        texts = []
        for item in manual_content:
            if isinstance(item, dict) and 'text' in item:
                texts.append(item['text'])
            elif hasattr(item, 'text'):
                texts.append(item.text)
            else:
                texts.append(str(item))
        manual_content = '\n'.join(texts)

    # Auto-version before overwriting existing content
    version_storage = VersionStorage(user_id, manual_id)
    new_version = version_storage.auto_patch_before_overwrite()
    if new_version:
        print(f"Auto-saved previous version, now at v{new_version}")

    # Save manual to language-specific file
    manual_path = lang_dir / "manual.md"

    try:
        with open(manual_path, 'w', encoding='utf-8') as f:
            f.write(manual_content)
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to save manual: {str(e)}",
        }

    # Update metadata with generated language
    add_language_generated(manual_dir, language_code)

    # Return partial state update
    return {
        "manual_id": manual_id,
        "manual_content": manual_content,
        "manual_path": str(manual_path),
        "screenshots": screenshot_paths,
        "output_directory": str(lang_dir),
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
