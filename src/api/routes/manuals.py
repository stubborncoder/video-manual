"""Manual management routes."""

import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

import json
import tempfile
import shutil

from fastapi import APIRouter, HTTPException, File, UploadFile, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, field_validator

from ..schemas import (
    ManualSummary,
    ManualDetail,
    ManualListResponse,
    SourceVideoInfo,
    LanguageEvaluation,
    CloneManualRequest,
    AdditionalVideoInfo,
    ManualVideosResponse,
    AdditionalVideoUploadResponse,
)
from ..dependencies import CurrentUser, UserStorageDep, ProjectStorageDep, TrashStorageDep
from ...storage.version_storage import VersionStorage
from ...storage.screenshot_store import ScreenshotStore
from ...core.sanitization import sanitize_target_audience, sanitize_target_objective
from ...core.constants import (
    SUPPORTED_LANGUAGES,
    EVALUATION_SCORE_MIN,
    EVALUATION_SCORE_MAX,
    LLM_TIMEOUT_SECONDS,
    normalize_language_to_code,
)
from ...core.models import TaskType
from ...db.admin_settings import AdminSettings


class ManualProjectAssignment(BaseModel):
    """Request to assign manual to a project."""
    project_id: str
    chapter_id: Optional[str] = None


class ManualContentUpdate(BaseModel):
    """Request to update manual content."""
    content: str
    language: str = "en"


class ManualTitleUpdate(BaseModel):
    """Request to update manual title."""
    title: str = Field(..., min_length=1, max_length=200)


class ManualEvaluationRequest(BaseModel):
    """Request to evaluate a manual."""
    language: str = "en"
    user_language: Optional[str] = None  # User's UI language preference

    @field_validator('language')
    @classmethod
    def validate_language(cls, v: str) -> str:
        """Validate and normalize language to ISO code.

        Accepts both language names ("English") and codes ("en").
        Returns the ISO 639-1 code.
        """
        return normalize_language_to_code(v)

    @field_validator('user_language')
    @classmethod
    def validate_user_language(cls, v: Optional[str]) -> Optional[str]:
        """Validate and normalize user language to ISO code.

        Accepts both language names ("English") and codes ("en").
        Returns the ISO 639-1 code, or None if not provided.
        """
        if v is None:
            return None
        return normalize_language_to_code(v)

router = APIRouter(prefix="/manuals", tags=["manuals"])


def _derive_title_from_video(video_path: str) -> str:
    """Derive a display title from video filename.

    Removes file extension and returns the base name.
    Example: "Visualizar documento contable.mp4" -> "Visualizar documento contable"
    """
    if not video_path:
        return ""
    return Path(video_path).stem


def _get_manual_title(metadata: dict, manual_id: str) -> str:
    """Get display title for a manual.

    Priority:
    1. Explicit title in metadata (user-editable)
    2. Derived from source video filename
    3. Fallback to manual ID
    """
    # Check for explicit title
    if metadata.get("title"):
        return metadata["title"]

    # Derive from video filename
    video_path = metadata.get("video_path", "")
    if video_path:
        return _derive_title_from_video(video_path)

    # Fallback to manual ID
    return manual_id


@router.get("")
async def list_manuals(
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> ManualListResponse:
    """List all manuals for current user."""
    manual_ids = storage.list_manuals()

    manuals = []
    for manual_id in manual_ids:
        languages = storage.list_manual_languages(manual_id)
        screenshots = storage.list_screenshots(manual_id)

        # Get creation time from folder
        manual_dir = storage.manuals_dir / manual_id
        created_at = None
        if manual_dir.exists():
            mtime = manual_dir.stat().st_mtime
            created_at = datetime.fromtimestamp(mtime).isoformat()

        # Get source video info and project_id from metadata
        source_video = None
        project_id = None
        target_audience = None
        target_objective = None
        document_format = None
        title = manual_id  # Default fallback
        metadata = storage.get_manual_metadata(manual_id)
        if metadata:
            video_path = metadata.get("video_path", "")
            sv_info = metadata.get("source_video", {})
            if video_path:
                source_video = SourceVideoInfo(
                    name=Path(video_path).name,
                    exists=sv_info.get("exists", True),
                )
            project_id = metadata.get("project_id")
            target_audience = metadata.get("target_audience")
            target_objective = metadata.get("target_objective")
            document_format = metadata.get("document_format")
            title = _get_manual_title(metadata, manual_id)

        # Get evaluation status for each language
        evaluations: dict[str, LanguageEvaluation] = {}
        version_storage = VersionStorage(user_id, manual_id)
        all_evals = version_storage.list_evaluations()

        # Group by language (most recent for each lang)
        latest_by_lang: dict[str, dict] = {}
        for eval_info in all_evals:
            lang = eval_info.get("language", "en")
            if lang not in latest_by_lang:
                latest_by_lang[lang] = eval_info

        # Create evaluation status for each language
        for lang in languages:
            if lang in latest_by_lang:
                evaluations[lang] = LanguageEvaluation(
                    score=latest_by_lang[lang].get("overall_score"),
                    evaluated=True
                )
            else:
                evaluations[lang] = LanguageEvaluation(evaluated=False)

        manuals.append(
            ManualSummary(
                id=manual_id,
                title=title,
                created_at=created_at,
                screenshot_count=len(screenshots),
                languages=languages,
                evaluations=evaluations,
                source_video=source_video,
                project_id=project_id,
                target_audience=target_audience,
                target_objective=target_objective,
                document_format=document_format,
            )
        )

    return ManualListResponse(manuals=manuals)


@router.get("/{manual_id}")
async def get_manual(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    language: str = "en",
) -> ManualDetail:
    """Get manual content."""
    # Check available languages
    languages = storage.list_manual_languages(manual_id)
    if languages and language not in languages:
        # Fallback to first available
        language = languages[0] if languages else "en"

    content = storage.get_manual_content(manual_id, language)
    if content is None:
        raise HTTPException(status_code=404, detail="Manual not found")

    screenshots = storage.list_screenshots(manual_id)

    # Get source video info, title, document_format, and source_languages from metadata
    source_video = None
    title = manual_id  # Default fallback
    document_format = None
    source_languages = None
    metadata = storage.get_manual_metadata(manual_id)
    if metadata:
        video_path = metadata.get("video_path", "")
        if video_path:
            video_name = Path(video_path).name
            video_exists = (storage.videos_dir / video_name).exists()
            source_video = SourceVideoInfo(
                name=video_name,
                exists=video_exists,
            )
        title = _get_manual_title(metadata, manual_id)
        document_format = metadata.get("document_format")
        source_languages = metadata.get("source_languages")

    return ManualDetail(
        id=manual_id,
        title=title,
        content=content,
        language=language,
        screenshots=[str(s) for s in screenshots],
        source_video=source_video,
        document_format=document_format,
        source_languages=source_languages,
    )


@router.get("/{manual_id}/languages")
async def get_manual_languages(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> dict:
    """Get available languages for a manual."""
    languages = storage.list_manual_languages(manual_id)
    if not languages:
        raise HTTPException(status_code=404, detail="Manual not found")

    return {"manual_id": manual_id, "languages": languages}


@router.put("/{manual_id}/content")
async def update_manual_content(
    manual_id: str,
    update: ManualContentUpdate,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> dict:
    """Update manual content.

    This creates a version snapshot of the current content before saving,
    so the previous state can be restored if needed.
    """
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    try:
        # Create a version snapshot before saving (preserves current state)
        version_storage = VersionStorage(user_id, manual_id)
        version_storage.auto_patch_before_overwrite(notes="Before manual save")

        # Save the new content
        saved_path = storage.save_manual_content(
            manual_id=manual_id,
            content=update.content,
            language_code=update.language,
        )

        return {
            "status": "saved",
            "manual_id": manual_id,
            "language": update.language,
            "path": str(saved_path),
            "version": version_storage.get_current_version(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save: {str(e)}")


@router.put("/{manual_id}/title")
async def update_manual_title(
    manual_id: str,
    update: ManualTitleUpdate,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> dict:
    """Update manual title.

    The title is stored in metadata.json and applies to all languages.
    """
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    try:
        # Update title in metadata
        new_title = update.title.strip()
        storage.update_manual_metadata(manual_id, {"title": new_title})

        return {
            "status": "saved",
            "manual_id": manual_id,
            "title": new_title,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save title: {str(e)}")


# ==================== Clone Manual ====================


@router.post("/{manual_id}/clone")
async def clone_manual(
    manual_id: str,
    clone_request: CloneManualRequest,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> ManualSummary:
    """Clone a manual to a different document format.

    Creates a complete copy of the manual with the same screenshots but
    optionally reformatted content for a different document type.

    Args:
        manual_id: Source manual to clone
        clone_request: Clone configuration (target format, optional title, reformat flag)

    Returns:
        ManualSummary of the newly created manual
    """
    # Verify source manual exists
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Get source metadata for format check
    source_metadata = storage.get_manual_metadata(manual_id)
    source_format = source_metadata.get("document_format", "step-manual") if source_metadata else "step-manual"

    # Prevent cloning to same format
    if clone_request.document_format == source_format:
        raise HTTPException(
            status_code=400,
            detail=f"Manual is already in '{source_format}' format. Choose a different format."
        )

    converted_content = None

    # If reformat_content is True, use AI to convert content
    if clone_request.reformat_content:
        try:
            from ...agents.reformat_agent import create_reformat_agent

            # Get primary language
            languages = storage.list_manual_languages(manual_id)
            primary_lang = languages[0] if languages else "en"

            # Run the reformat agent
            agent = create_reformat_agent()
            result = agent.reformat(
                source_manual_id=manual_id,
                user_id=user_id,
                source_format=source_format,
                target_format=clone_request.document_format,
                language=primary_lang,
            )

            if result.get("status") == "completed" and result.get("converted_content"):
                converted_content = result["converted_content"]
            elif result.get("error"):
                raise HTTPException(
                    status_code=500,
                    detail=f"Content reformatting failed: {result['error']}"
                )

        except ImportError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Reformat agent not available: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to reformat content: {str(e)}"
            )

    try:
        # Clone the manual
        new_manual_id, new_manual_dir = storage.clone_manual(
            source_manual_id=manual_id,
            target_format=clone_request.document_format,
            title=clone_request.title,
            content=converted_content,
        )

        # Build ManualSummary response
        languages = storage.list_manual_languages(new_manual_id)
        screenshots = storage.list_screenshots(new_manual_id)
        new_metadata = storage.get_manual_metadata(new_manual_id)

        # Get source video info
        source_video = None
        if new_metadata:
            video_path = new_metadata.get("video_path", "")
            sv_info = new_metadata.get("source_video", {})
            if video_path:
                source_video = SourceVideoInfo(
                    name=Path(video_path).name,
                    exists=sv_info.get("exists", True),
                )

        return ManualSummary(
            id=new_manual_id,
            title=new_metadata.get("title", new_manual_id) if new_metadata else new_manual_id,
            created_at=datetime.now().isoformat(),
            screenshot_count=len(screenshots),
            languages=languages,
            evaluations={},  # New clone has no evaluations
            source_video=source_video,
            project_id=None,  # Cloned manual is not auto-assigned to project
            target_audience=new_metadata.get("target_audience") if new_metadata else None,
            target_objective=new_metadata.get("target_objective") if new_metadata else None,
            document_format=clone_request.document_format,
        )

    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clone failed: {str(e)}")


@router.post("/{manual_id}/screenshots/extract")
async def extract_new_screenshot(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    timestamp: float = Query(..., description="Timestamp of frame to extract"),
    video_id: str = Query("primary", description="Video ID to extract frame from"),
):
    """Extract a new screenshot from video and save it with a unique filename.

    Used when inserting new images into the manual (e.g., from AI-suggested placeholders).
    Returns the new filename for use in markdown.

    NOTE: This route MUST be defined before /{manual_id}/screenshots/{filename}
    to avoid "extract" being matched as a filename.
    """
    from ...agents.video_manual_agent.tools.video_tools import extract_screenshot_at_timestamp
    from ...agents.video_manual_agent.utils.metadata import get_video_path_by_id

    manual_dir = storage.get_manual_path(manual_id)
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Get video path by ID
    video_path = get_video_path_by_id(manual_dir, video_id)
    if video_path is None:
        if video_id == "primary":
            raise HTTPException(status_code=400, detail="No source video associated with this manual")
        else:
            raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    screenshots_dir = storage.manuals_dir / manual_id / "screenshots"
    screenshots_dir.mkdir(exist_ok=True)

    # Find existing screenshot numbers to determine next number
    existing_files = list(screenshots_dir.glob("figure_*.png"))
    existing_numbers = []
    for f in existing_files:
        import re
        match = re.match(r"figure_(\d+)", f.stem)
        if match:
            existing_numbers.append(int(match.group(1)))

    next_num = max(existing_numbers, default=0) + 1

    # Generate filename with timestamp marker
    timestamp_marker = int(timestamp)
    new_filename = f"figure_{next_num:02d}_t{timestamp_marker}s.png"
    screenshot_path = screenshots_dir / new_filename

    # Validate timestamp is non-negative
    if timestamp < 0:
        raise HTTPException(status_code=400, detail="Timestamp cannot be negative")

    # Get video duration to validate timestamp is in bounds
    try:
        from ...agents.video_manual_agent.tools.video_tools import get_video_metadata
        metadata = get_video_metadata(str(video_path))
        video_duration = metadata.get("duration_seconds", 0)
        if video_duration > 0 and timestamp > video_duration:
            raise HTTPException(
                status_code=400,
                detail=f"Timestamp {timestamp:.2f}s exceeds video duration ({video_duration:.2f}s)"
            )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Video file not found or corrupted")
    except Exception:
        # If we can't get metadata, proceed anyway - extraction will fail if video is bad
        pass

    try:
        # Create version snapshot before adding new screenshot
        version_storage = VersionStorage(user_id, manual_id)
        video_label = "primary video" if video_id == "primary" else f"video '{video_id}'"
        new_version = version_storage.auto_patch_before_overwrite(
            notes=f"Adding new screenshot from {video_label}: {new_filename} at {timestamp:.2f}s"
        )

        # Extract the frame
        extract_screenshot_at_timestamp(
            video_path=str(video_path),
            timestamp_seconds=timestamp,
            output_path=str(screenshot_path),
        )

        return {
            "success": True,
            "filename": new_filename,
            "timestamp": timestamp,
            "video_id": video_id,
            "url": f"/api/manuals/{manual_id}/screenshots/{new_filename}",
            "version": new_version or version_storage.get_current_version(),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"Video file not found: {str(e)}")
    except ValueError as e:
        # Frame extraction failed (timestamp out of bounds, corrupted video)
        raise HTTPException(status_code=400, detail=f"Failed to extract frame: {str(e)}")
    except OSError as e:
        # Disk space or file system errors
        if "No space left" in str(e) or "ENOSPC" in str(e):
            raise HTTPException(status_code=507, detail="Insufficient disk space to save screenshot")
        raise HTTPException(status_code=500, detail=f"File system error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract frame: {str(e)}")


@router.get("/{manual_id}/screenshots/{filename}")
async def get_screenshot(
    manual_id: str,
    filename: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
):
    """Get a screenshot image."""
    # Validate path to prevent path traversal attacks
    screenshot_path = storage.manuals_dir / manual_id / "screenshots" / filename
    screenshot_path = screenshot_path.resolve()
    screenshots_dir = (storage.manuals_dir / manual_id / "screenshots").resolve()

    if not str(screenshot_path).startswith(str(screenshots_dir)):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not screenshot_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")

    return FileResponse(screenshot_path)


@router.post("/{manual_id}/screenshots/{filename}/replace")
async def replace_screenshot(
    manual_id: str,
    filename: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    file: UploadFile = File(...),
):
    """Replace a screenshot with an uploaded image."""
    from PIL import Image
    import io

    screenshot_dir = storage.manuals_dir / manual_id / "screenshots"
    screenshot_path = screenshot_dir / filename

    if not screenshot_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Validate it's an image
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Create version snapshot before replacing (includes screenshots)
        version_storage = VersionStorage(user_id, manual_id)
        new_version = version_storage.auto_patch_before_overwrite(
            notes=f"Before replacing screenshot: {filename}"
        )

        # Read and validate the image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Convert to RGB if needed (for PNG with transparency -> save as PNG)
        if image.mode in ("RGBA", "P"):
            # Keep as PNG
            save_format = "PNG"
        else:
            # Convert to RGB for JPEG compatibility
            image = image.convert("RGB")
            save_format = "PNG"  # Still save as PNG for consistency

        # Save the image, replacing the old one
        image.save(screenshot_path, format=save_format, optimize=True)

        return {
            "success": True,
            "filename": filename,
            "url": f"/api/manuals/{manual_id}/screenshots/{filename}",
            "version": new_version or version_storage.get_current_version(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save image: {str(e)}")


@router.delete("/{manual_id}/screenshots/{filename}")
async def delete_screenshot(
    manual_id: str,
    filename: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
):
    """Delete a screenshot file."""
    screenshot_path = storage.manuals_dir / manual_id / "screenshots" / filename

    if not screenshot_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")

    try:
        screenshot_path.unlink()
        return {"success": True, "filename": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete: {str(e)}")


@router.get("/{manual_id}/frames")
async def extract_frames(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    timestamp: float = Query(..., description="Center timestamp in seconds"),
    window: float = Query(5.0, description="Window size in seconds (before/after)"),
    count: int = Query(10, description="Number of frames to extract"),
    video_id: str = Query("primary", description="Video ID to extract frames from ('primary' or additional video ID)"),
):
    """Extract frames from source video around a timestamp.

    Returns URLs to temporary frame images that can be used for screenshot replacement.
    Supports both primary video and additional videos uploaded for screenshot replacement.
    """
    from ...agents.video_manual_agent.tools.video_tools import extract_screenshot_at_timestamp
    from ...agents.video_manual_agent.utils.metadata import get_video_path_by_id

    manual_dir = storage.get_manual_path(manual_id)
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Get video path by ID (handles both primary and additional videos)
    video_path = get_video_path_by_id(manual_dir, video_id)
    if video_path is None:
        if video_id == "primary":
            raise HTTPException(status_code=400, detail="No source video associated with this manual")
        else:
            raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    # Create temp directory for frames (include video_id to cache separately)
    frames_dir = Path(tempfile.gettempdir()) / "manual_frames" / manual_id / video_id
    frames_dir.mkdir(parents=True, exist_ok=True)

    # Clean old frames (older than 1 hour)
    import time
    current_time = time.time()
    for old_file in frames_dir.glob("*.jpg"):
        if current_time - old_file.stat().st_mtime > 3600:
            old_file.unlink()

    # Calculate timestamps to extract
    start_time = max(0, timestamp - window)
    end_time = timestamp + window
    step = (end_time - start_time) / (count - 1) if count > 1 else window

    frames = []
    for i in range(count):
        frame_timestamp = start_time + (i * step)
        frame_filename = f"frame_{int(frame_timestamp * 1000):08d}.jpg"
        frame_path = frames_dir / frame_filename

        try:
            # Extract frame if not already cached (small thumbnails, video used for full preview)
            if not frame_path.exists():
                extract_screenshot_at_timestamp(
                    video_path=str(video_path),
                    timestamp_seconds=frame_timestamp,
                    output_path=str(frame_path),
                    max_width=320,  # Small thumbnails for frame strip
                )

            frames.append({
                "timestamp": round(frame_timestamp, 2),
                "url": f"/api/manuals/{manual_id}/frames/{video_id}/{frame_filename}",
            })
        except Exception as e:
            # Skip frames that fail to extract
            print(f"Failed to extract frame at {frame_timestamp}s: {e}")
            continue

    # Get video duration from metadata
    from ...agents.video_manual_agent.utils.metadata import load_metadata
    metadata = load_metadata(manual_dir)
    video_duration = metadata.get("video_metadata", {}).get("duration_seconds", 0) if metadata else 0

    return {"frames": frames, "video_duration": video_duration}


@router.get("/{manual_id}/frames/{video_id}/{filename}")
async def get_frame(
    manual_id: str,
    video_id: str,
    filename: str,
    user_id: CurrentUser,
):
    """Get a temporary frame image."""
    # Validate path to prevent path traversal attacks
    frames_dir = Path(tempfile.gettempdir()) / "manual_frames" / manual_id / video_id
    frame_path = frames_dir / filename
    frame_path = frame_path.resolve()
    frames_dir = frames_dir.resolve()

    if not str(frame_path).startswith(str(frames_dir)):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not frame_path.exists():
        raise HTTPException(status_code=404, detail="Frame not found")

    return FileResponse(frame_path, media_type="image/jpeg")


@router.post("/{manual_id}/screenshots/{filename}/from-frame")
async def replace_screenshot_from_frame(
    manual_id: str,
    filename: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    timestamp: float = Query(..., description="Timestamp of frame to use"),
    video_id: str = Query("primary", description="Video ID to extract frame from ('primary' or additional video ID)"),
):
    """Replace a screenshot with a frame extracted from a video.

    Supports both primary video and additional videos uploaded for screenshot replacement.
    """
    from ...agents.video_manual_agent.tools.video_tools import extract_screenshot_at_timestamp
    from ...agents.video_manual_agent.utils.metadata import get_video_path_by_id

    manual_dir = storage.get_manual_path(manual_id)
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Get video path by ID (handles both primary and additional videos)
    video_path = get_video_path_by_id(manual_dir, video_id)
    if video_path is None:
        if video_id == "primary":
            raise HTTPException(status_code=400, detail="No source video associated with this manual")
        else:
            raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found on disk")

    screenshot_path = storage.manuals_dir / manual_id / "screenshots" / filename

    try:
        # Create version snapshot before replacing (includes screenshots)
        version_storage = VersionStorage(user_id, manual_id)
        video_label = "primary video" if video_id == "primary" else f"video '{video_id}'"
        new_version = version_storage.auto_patch_before_overwrite(
            notes=f"Before replacing screenshot from {video_label}: {filename} at {timestamp:.2f}s"
        )

        # Extract the frame at high resolution and save to screenshot path
        extract_screenshot_at_timestamp(
            video_path=str(video_path),
            timestamp_seconds=timestamp,
            output_path=str(screenshot_path),
        )

        return {
            "success": True,
            "filename": filename,
            "timestamp": timestamp,
            "video_id": video_id,
            "url": f"/api/manuals/{manual_id}/screenshots/{filename}",
            "version": new_version or version_storage.get_current_version(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract frame: {str(e)}")


# ==================== Additional Video Sources ====================


@router.get("/{manual_id}/videos")
async def list_manual_videos(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> ManualVideosResponse:
    """List all videos (primary + additional) for a manual."""
    from ...agents.video_manual_agent.utils.metadata import (
        load_metadata,
        get_additional_videos,
    )

    manual_dir = storage.get_manual_path(manual_id)
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    metadata = load_metadata(manual_dir)
    if not metadata:
        raise HTTPException(status_code=404, detail="Manual metadata not found")

    # Build primary video info
    video_path_str = metadata.get("video_path", "")
    video_metadata = metadata.get("video_metadata", {})

    # Check if primary video exists
    optimized_video = manual_dir / "video_optimized.mp4"
    primary_exists = optimized_video.exists()
    if not primary_exists and video_path_str:
        video_name = Path(video_path_str).name
        primary_exists = (storage.videos_dir / video_name).exists()

    primary_info = {
        "id": "primary",
        "filename": "video_optimized.mp4" if optimized_video.exists() else Path(video_path_str).name if video_path_str else "",
        "label": "Original Video",
        "duration_seconds": video_metadata.get("duration_seconds", 0),
        "exists": primary_exists,
    }

    # Get additional videos
    additional_videos_raw = get_additional_videos(manual_dir)
    additional_videos = []
    for video in additional_videos_raw:
        video_path = manual_dir / "videos" / video["filename"]
        additional_videos.append(AdditionalVideoInfo(
            id=video["id"],
            filename=video["filename"],
            label=video["label"],
            language=video.get("language"),
            duration_seconds=video.get("duration_seconds", 0),
            size_bytes=video.get("size_bytes", 0),
            added_at=video.get("added_at"),
            exists=video_path.exists(),
        ))

    return ManualVideosResponse(primary=primary_info, additional=additional_videos)


@router.post("/{manual_id}/videos")
async def upload_additional_video(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    file: UploadFile = File(...),
    label: str = Query("", description="User-friendly label for this video"),
    language: Optional[str] = Query(None, description="ISO language code for UI language (e.g., 'en', 'es')"),
) -> AdditionalVideoUploadResponse:
    """Upload an additional video as a frame source for screenshot replacement.

    The video will be compressed to save storage space while maintaining
    sufficient quality for frame extraction.
    """
    import uuid
    from ...agents.video_manual_agent.tools.video_tools import get_video_metadata
    from ...agents.video_manual_agent.tools.video_preprocessor import (
        needs_optimization,
        preprocess_video_for_analysis,
    )
    from ...agents.video_manual_agent.utils.metadata import add_additional_video

    manual_dir = storage.get_manual_path(manual_id)
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Validate file type
    allowed_extensions = {".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v"}
    file_ext = Path(file.filename).suffix.lower() if file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Generate unique ID and filename
    video_id = f"video_{uuid.uuid4().hex[:8]}"
    # Use language code as filename if provided, otherwise use ID
    base_filename = language if language else video_id
    output_filename = f"{base_filename}.mp4"

    # Create videos directory
    videos_dir = storage.get_manual_videos_dir(manual_id)

    # Check for duplicate filename
    counter = 1
    while (videos_dir / output_filename).exists():
        output_filename = f"{base_filename}_{counter}.mp4"
        counter += 1

    # Save uploaded file to temp location
    temp_path = Path(tempfile.gettempdir()) / f"upload_{video_id}{file_ext}"
    try:
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)

        # Get video metadata
        try:
            video_meta = get_video_metadata(str(temp_path))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid video file: {str(e)}")

        duration_seconds = video_meta.get("duration_seconds", 0)

        # Compress the video (always compress to save storage)
        final_path = videos_dir / output_filename
        if needs_optimization(video_meta):
            # Use compression
            result = preprocess_video_for_analysis(
                video_path=str(temp_path),
                output_dir=str(videos_dir),
                video_metadata=video_meta,
            )
            # Rename optimized file to our desired filename
            optimized_path = Path(result["optimized_path"])
            if optimized_path != final_path:
                shutil.move(str(optimized_path), str(final_path))
            size_bytes = final_path.stat().st_size
        else:
            # Video is already small enough, just copy
            shutil.copy(str(temp_path), str(final_path))
            size_bytes = final_path.stat().st_size

        # Add to metadata
        video_label = label if label else (f"{language.upper()} UI" if language else "Additional Video")
        add_additional_video(
            manual_dir=manual_dir,
            video_id=video_id,
            filename=output_filename,
            label=video_label,
            language=language,
            duration_seconds=duration_seconds,
            size_bytes=size_bytes,
        )

        return AdditionalVideoUploadResponse(
            id=video_id,
            filename=output_filename,
            label=video_label,
            language=language,
            duration_seconds=duration_seconds,
            size_bytes=size_bytes,
        )

    finally:
        # Clean up temp file
        if temp_path.exists():
            temp_path.unlink()


@router.delete("/{manual_id}/videos/{video_id}")
async def delete_additional_video(
    manual_id: str,
    video_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> dict:
    """Delete an additional video.

    Cannot delete the primary video - only additional videos can be removed.
    """
    from ...agents.video_manual_agent.utils.metadata import (
        get_additional_video_by_id,
        remove_additional_video,
    )

    if video_id == "primary":
        raise HTTPException(status_code=400, detail="Cannot delete primary video")

    manual_dir = storage.get_manual_path(manual_id)
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Get video info before removing
    video_info = get_additional_video_by_id(manual_dir, video_id)
    if not video_info:
        raise HTTPException(status_code=404, detail="Video not found")

    # Delete file from disk
    video_path = manual_dir / "videos" / video_info["filename"]
    if video_path.exists():
        video_path.unlink()

    # Remove from metadata
    removed = remove_additional_video(manual_dir, video_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Video not found in metadata")

    return {"status": "deleted", "video_id": video_id}


@router.get("/{manual_id}/videos/{video_id}/stream")
async def stream_additional_video(
    manual_id: str,
    video_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
):
    """Stream a video (primary or additional) for playback in the editor."""
    from ...agents.video_manual_agent.utils.metadata import get_video_path_by_id

    manual_dir = storage.get_manual_path(manual_id)
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    video_path = get_video_path_by_id(manual_dir, video_id)
    if video_path is None or not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename=video_path.name,
    )


@router.delete("/{manual_id}")
async def delete_manual(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    trash: TrashStorageDep,
    project_storage: ProjectStorageDep,
) -> dict:
    """Delete a manual (moves to trash)."""
    manual_dir = storage.manuals_dir / manual_id

    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Get metadata to know project association
    metadata = storage.get_manual_metadata(manual_id)
    project_id = metadata.get("project_id") if metadata else None

    # Remove from project if assigned
    if project_id:
        try:
            project_storage.remove_manual_from_project(project_id, manual_id)
        except ValueError:
            pass  # Project may not exist

    # Move to trash
    trash.move_to_trash(
        item_type="manual",
        item_name=manual_id,
        metadata={"project_id": project_id},
    )

    return {"status": "moved_to_trash", "manual_id": manual_id}


# ==================== Project Assignment ====================


@router.put("/{manual_id}/project")
async def assign_manual_to_project(
    manual_id: str,
    assignment: ManualProjectAssignment,
    user_id: CurrentUser,
    storage: UserStorageDep,
    project_storage: ProjectStorageDep,
) -> dict:
    """Assign a manual to a project and optionally a chapter.

    If the manual is already in another project, it will be moved.
    """
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Check target project exists
    project = project_storage.get_project(assignment.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get current assignment
    metadata = storage.get_manual_metadata(manual_id)
    current_project_id = metadata.get("project_id") if metadata else None

    # Remove from current project if different
    if current_project_id and current_project_id != assignment.project_id:
        try:
            project_storage.remove_manual_from_project(current_project_id, manual_id)
        except ValueError:
            pass

    # Add to new project
    project_storage.add_manual_to_project(
        assignment.project_id,
        manual_id,
        assignment.chapter_id,
    )

    return {
        "manual_id": manual_id,
        "project_id": assignment.project_id,
        "chapter_id": assignment.chapter_id,
    }


@router.delete("/{manual_id}/project")
async def remove_manual_from_project(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    project_storage: ProjectStorageDep,
) -> dict:
    """Remove a manual from its current project."""
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    metadata = storage.get_manual_metadata(manual_id)
    project_id = metadata.get("project_id") if metadata else None

    if not project_id:
        raise HTTPException(status_code=400, detail="Manual is not assigned to a project")

    project_storage.remove_manual_from_project(project_id, manual_id)

    return {"manual_id": manual_id, "removed_from_project": project_id}


# ==================== Tags ====================


@router.get("/{manual_id}/tags")
async def get_manual_tags(
    manual_id: str,
    user_id: CurrentUser,
    project_storage: ProjectStorageDep,
) -> dict:
    """Get tags for a manual."""
    metadata = project_storage._get_manual_metadata(manual_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Manual not found")

    return {"manual_id": manual_id, "tags": metadata.get("tags", [])}


@router.post("/{manual_id}/tags")
async def add_manual_tags(
    manual_id: str,
    tags: list[str],
    user_id: CurrentUser,
    project_storage: ProjectStorageDep,
) -> dict:
    """Add tags to a manual."""
    for tag in tags:
        project_storage.add_tag_to_manual(manual_id, tag)

    return {"manual_id": manual_id, "added_tags": tags}


@router.delete("/{manual_id}/tags/{tag}")
async def remove_manual_tag(
    manual_id: str,
    tag: str,
    user_id: CurrentUser,
    project_storage: ProjectStorageDep,
) -> dict:
    """Remove a tag from a manual."""
    project_storage.remove_tag_from_manual(manual_id, tag)
    return {"manual_id": manual_id, "removed_tag": tag}


# ==================== Version History ====================


@router.get("/{manual_id}/versions")
async def list_manual_versions(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    language: str = None,
) -> dict:
    """List all versions for a manual, optionally filtered by language."""
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    version_storage = VersionStorage(user_id, manual_id)
    versions = version_storage.list_versions()

    # Filter versions by language if specified
    if language:
        filtered_versions = []
        current_version = version_storage.get_current_version()

        for v in versions:
            version_num = v["version"]
            has_language = False

            if version_num == current_version:
                # Check current manual directory
                manual_path = manual_dir / language / "manual.md"
                has_language = manual_path.exists()
            else:
                # Check version snapshot directory
                snapshot_dir = version_storage.versions_dir / f"v{version_num}"
                if snapshot_dir.exists():
                    manual_path = snapshot_dir / language / "manual.md"
                    has_language = manual_path.exists()

            if has_language:
                filtered_versions.append(v)

        versions = filtered_versions

    return {
        "manual_id": manual_id,
        "current_version": version_storage.get_current_version(),
        "versions": versions,
    }


@router.get("/{manual_id}/versions/{version}/content")
async def get_version_content(
    manual_id: str,
    version: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    language: str = "en",
) -> dict:
    """Get manual content for a specific version."""
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    version_storage = VersionStorage(user_id, manual_id)
    content = version_storage._get_version_content(version, language)

    if content is None:
        raise HTTPException(
            status_code=404,
            detail=f"Version {version} not found or no content for language {language}"
        )

    return {
        "manual_id": manual_id,
        "version": version,
        "language": language,
        "content": content,
    }


@router.get("/{manual_id}/versions/{version}/screenshots/{filename}")
async def get_version_screenshot(
    manual_id: str,
    version: str,
    filename: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
):
    """Get a screenshot from a specific version.

    Supports both new hash-based storage (screenshots.json) and
    old full-copy storage (screenshots/ directory) for backward compatibility.
    """
    version_dir = storage.manuals_dir / manual_id / "versions" / f"v{version}"

    if not version_dir.exists():
        raise HTTPException(status_code=404, detail=f"Version {version} not found")

    # Check for new hash-based mapping first
    mapping_path = version_dir / "screenshots.json"
    if mapping_path.exists():
        try:
            with open(mapping_path, "r", encoding="utf-8") as f:
                mapping = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            raise HTTPException(status_code=500, detail=f"Failed to read screenshot mapping: {e}")

        if filename not in mapping:
            raise HTTPException(status_code=404, detail="Screenshot not found in version")

        file_meta = mapping[filename]
        content_hash = file_meta.get("hash")
        if not content_hash:
            raise HTTPException(status_code=500, detail="Invalid screenshot mapping")

        # Get from content-addressable store
        store = ScreenshotStore(storage.manuals_dir / manual_id)
        store_path = store.get_store_path(content_hash)

        if not store_path.exists():
            raise HTTPException(status_code=404, detail="Screenshot file not found in store")

        return FileResponse(store_path)

    # Fallback: old full-copy format
    screenshot_path = version_dir / "screenshots" / filename
    screenshot_path = screenshot_path.resolve()
    screenshots_dir = (version_dir / "screenshots").resolve()

    if not str(screenshot_path).startswith(str(screenshots_dir)):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if screenshot_path.exists():
        return FileResponse(screenshot_path)

    raise HTTPException(status_code=404, detail="Screenshot not found")


@router.post("/{manual_id}/versions/{version}/restore")
async def restore_manual_version(
    manual_id: str,
    version: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    language: str = "en",
) -> dict:
    """Restore a manual to a previous version.

    This creates an auto-patch of the current state before restoring.
    """
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    version_storage = VersionStorage(user_id, manual_id)

    # Check if version exists
    version_info = version_storage.get_version(version)
    if version_info is None:
        raise HTTPException(status_code=404, detail=f"Version {version} not found")

    if version_info.get("is_current"):
        raise HTTPException(status_code=400, detail="Cannot restore current version")

    # Restore the version
    success = version_storage.restore_version(version, language)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore version")

    return {
        "manual_id": manual_id,
        "restored_version": version,
        "language": language,
        "new_current_version": version_storage.get_current_version(),
    }


@router.post("/{manual_id}/versions/snapshot")
async def create_version_snapshot(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    notes: str = "",
    bump_type: str = "minor",
) -> dict:
    """Create a manual version snapshot.

    Args:
        bump_type: "minor" or "major" version bump
        notes: Optional notes about this version
    """
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    if bump_type not in ("minor", "major"):
        raise HTTPException(status_code=400, detail="bump_type must be 'minor' or 'major'")

    version_storage = VersionStorage(user_id, manual_id)

    try:
        new_version = version_storage.bump_version(bump_type, notes)
        return {
            "manual_id": manual_id,
            "new_version": new_version,
            "bump_type": bump_type,
            "notes": notes,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create snapshot: {str(e)}")


# ==================== Export ====================


class ManualExportRequest(BaseModel):
    """Request to export a manual."""
    format: str = "pdf"  # pdf, word, html, chunks
    language: str = "en"
    embed_images: bool = True  # For HTML only
    template_name: str | None = None  # For Word template-based export


@router.post("/{manual_id}/export")
async def export_manual(
    manual_id: str,
    export_request: ManualExportRequest,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> dict:
    """Export manual to specified format (PDF, Word, or HTML).

    Args:
        manual_id: Manual identifier
        export_request: Export configuration

    Returns:
        Export details including download URL
    """
    from ...export.manual_exporter import create_manual_exporter

    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    # Validate format
    if export_request.format.lower() not in ("pdf", "word", "docx", "html", "chunks"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {export_request.format}. Supported: pdf, word, html, chunks"
        )

    # Verify manual has content for the requested language
    content = storage.get_manual_content(manual_id, export_request.language)
    if not content:
        raise HTTPException(
            status_code=404,
            detail=f"Manual content not found for language: {export_request.language}"
        )

    try:
        # Handle chunks (RAG) export
        if export_request.format.lower() == "chunks":
            from ...export.chunks_exporter import create_chunks_exporter

            exporter = create_chunks_exporter(user_id=user_id, manual_id=manual_id)
            output_path = exporter.export(language=export_request.language)

            output_file = Path(output_path)
            return {
                "status": "success",
                "manual_id": manual_id,
                "format": "chunks",
                "language": export_request.language,
                "template": None,
                "filename": output_file.name,
                "download_url": f"/api/manuals/{manual_id}/exports/{output_file.name}",
                "size_bytes": output_file.stat().st_size,
                "created_at": datetime.fromtimestamp(output_file.stat().st_mtime).isoformat(),
            }

        # Check if using template-based export for Word format
        if (
            export_request.format.lower() in ("word", "docx")
            and export_request.template_name
        ):
            # Use template-based exporter
            from ...export.template_word_exporter import ManualTemplateExporter
            from ...storage.template_storage import TemplateStorage

            template_storage = TemplateStorage(user_id)
            template_path = template_storage.get_template(export_request.template_name)

            if not template_path:
                raise HTTPException(
                    status_code=404,
                    detail=f"Template not found: {export_request.template_name}"
                )

            exporter = ManualTemplateExporter(user_id=user_id, manual_id=manual_id)
            output_path = exporter.export(
                template_path=template_path,
                language=export_request.language,
            )
        else:
            # Use standard exporter
            exporter = create_manual_exporter(
                user_id=user_id,
                manual_id=manual_id,
                format=export_request.format
            )

            # Export manual
            output_path = exporter.export(
                language=export_request.language,
                embed_images=export_request.embed_images if export_request.format.lower() == "html" else True,
            )

        # Return export details
        output_file = Path(output_path)
        return {
            "status": "success",
            "manual_id": manual_id,
            "format": export_request.format.lower(),
            "language": export_request.language,
            "template": export_request.template_name,
            "filename": output_file.name,
            "download_url": f"/api/manuals/{manual_id}/exports/{output_file.name}",
            "size_bytes": output_file.stat().st_size,
            "created_at": datetime.fromtimestamp(output_file.stat().st_mtime).isoformat(),
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/{manual_id}/exports")
async def list_manual_exports(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> dict:
    """List all previous exports for a manual."""
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    export_dir = manual_dir / "exports"
    if not export_dir.exists():
        return {"manual_id": manual_id, "exports": []}

    exports = []
    for export_file in export_dir.glob("*.*"):
        # Skip directories and hidden files
        if export_file.is_dir() or export_file.name.startswith('.'):
            continue

        # Determine format from extension
        ext = export_file.suffix.lower()
        format_map = {
            '.pdf': 'pdf',
            '.docx': 'word',
            '.html': 'html',
            '.zip': 'chunks',
        }
        format_type = format_map.get(ext, 'unknown')

        # Parse language from filename (format: manualid_lang_timestamp.ext)
        parts = export_file.stem.split('_')
        language = parts[1] if len(parts) >= 3 else 'unknown'

        exports.append({
            "filename": export_file.name,
            "format": format_type,
            "language": language,
            "download_url": f"/api/manuals/{manual_id}/exports/{export_file.name}",
            "size_bytes": export_file.stat().st_size,
            "created_at": datetime.fromtimestamp(export_file.stat().st_mtime).isoformat(),
        })

    # Sort by creation time (newest first)
    exports.sort(key=lambda e: e["created_at"], reverse=True)

    return {"manual_id": manual_id, "exports": exports}


@router.get("/{manual_id}/exports/{filename}")
async def download_manual_export(
    manual_id: str,
    filename: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
):
    """Download a manual export file."""
    export_path = storage.manuals_dir / manual_id / "exports" / filename

    if not export_path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")

    # Determine media type from extension
    ext = export_path.suffix.lower()
    media_types = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.html': 'text/html',
        '.zip': 'application/zip',
    }
    media_type = media_types.get(ext, 'application/octet-stream')

    return FileResponse(
        export_path,
        media_type=media_type,
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==================== Manual Evaluation ====================


@router.post(
    "/{manual_id}/evaluate",
    summary="Evaluate manual quality",
    description="""
Evaluates a manual using AI to assess its quality across multiple dimensions.

## Evaluation Categories

When **target audience/objective are provided**, the evaluation includes:
- **Objective Alignment**: How well the manual helps achieve the stated objective
- **Audience Appropriateness**: Whether language and technical depth match the target audience

When **no target context is provided**, evaluates:
- **General Usability**: How easy it is for a general user to follow the manual

**Always evaluated:**
- **Clarity & Completeness**: Are instructions clear and complete?
- **Technical Accuracy**: Are UI elements and actions correctly described?
- **Structure & Flow**: Is the manual well-organized with logical progression?

## Scoring

Scores range from 1-10:
- **10**: Exceptional, professional quality
- **8-9**: Very good, minor improvements possible
- **6-7**: Good, some notable areas for improvement
- **4-5**: Adequate but needs significant improvement
- **1-3**: Poor, major revisions needed

## Response

Returns a detailed evaluation with:
- Overall score and summary
- Individual category scores with explanations
- Specific strengths identified
- Areas for improvement
- Actionable recommendations
    """,
    response_description="Evaluation results with scores, analysis, and recommendations",
    responses={
        200: {
            "description": "Successful evaluation",
            "content": {
                "application/json": {
                    "example": {
                        "manual_id": "my-software-guide",
                        "language": "en",
                        "overall_score": 8,
                        "summary": "A well-structured manual with clear instructions...",
                        "strengths": ["Clear step-by-step instructions", "Good use of screenshots"],
                        "areas_for_improvement": ["Could add more context for beginners"],
                        "clarity_and_completeness": {"score": 8, "explanation": "Instructions are clear..."},
                        "technical_accuracy": {"score": 9, "explanation": "UI elements correctly described..."},
                        "structure_and_flow": {"score": 7, "explanation": "Good organization..."},
                        "recommendations": ["Add a troubleshooting section", "Include keyboard shortcuts"],
                        "evaluated_at": "2024-01-15T10:30:00",
                        "score_range": {"min": 1, "max": 10}
                    }
                }
            }
        },
        404: {"description": "Manual or language not found"},
        422: {"description": "Invalid language code"},
        500: {"description": "Evaluation failed (API error)"}
    }
)
async def evaluate_manual(
    manual_id: str,
    evaluation_request: ManualEvaluationRequest,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> dict:
    """Evaluate a manual's quality using AI analysis.

    Uses Gemini AI to assess the manual across multiple quality dimensions,
    providing scores, explanations, and actionable recommendations.

    Args:
        manual_id: The unique identifier of the manual to evaluate
        evaluation_request: Request containing the language code to evaluate
        user_id: Current authenticated user
        storage: User storage dependency

    Returns:
        Comprehensive evaluation report with scores and recommendations
    """
    import os
    from dotenv import load_dotenv
    from langchain.chat_models import init_chat_model
    from langchain_anthropic import ChatAnthropic
    from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
    from ...core.models import get_model, get_langchain_model_string, ModelProvider

    load_dotenv()

    # Get manual content and metadata (use asyncio.to_thread for blocking I/O)
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    content = await asyncio.to_thread(
        storage.get_manual_content, manual_id, evaluation_request.language
    )
    if not content:
        raise HTTPException(
            status_code=404,
            detail=f"Manual content not found for language: {evaluation_request.language}"
        )

    metadata = await asyncio.to_thread(storage.get_manual_metadata, manual_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Manual metadata not found")

    # Get target context and sanitize (defense in depth for older manuals)
    try:
        target_audience = sanitize_target_audience(metadata.get("target_audience"))
        target_objective = sanitize_target_objective(metadata.get("target_objective"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get document format for format-specific evaluation
    document_format = metadata.get("document_format", "step-manual")

    # Build evaluation prompt with context if available
    has_context = bool(target_audience or target_objective)
    context_section = ""
    if has_context:
        context_section = "\n\n**Evaluation Context:**"
        if target_audience:
            context_section += f"\n- Target Audience: {target_audience}"
        if target_objective:
            context_section += f"\n- Target Objective: {target_objective}"
    else:
        context_section = "\n\n*No specific target audience or objective was defined for this manual. Evaluate based on general documentation best practices.*"

    score_range = f"{EVALUATION_SCORE_MIN}-{EVALUATION_SCORE_MAX}"

    # Build dynamic evaluation categories based on available context
    # Always include these core categories
    core_categories = f'''  "clarity_and_completeness": {{
    "score": <number {score_range}>,
    "explanation": "<are instructions clear, unambiguous, and complete? Are there any missing steps or confusing explanations?>"
  }},
  "technical_accuracy": {{
    "score": <number {score_range}>,
    "explanation": "<are the technical instructions accurate? Are UI elements, buttons, and actions correctly described?>"
  }},
  "structure_and_flow": {{
    "score": <number {score_range}>,
    "explanation": "<is the manual well-organized with logical progression? Are headings clear? Is navigation easy?>"
  }},'''

    # Add context-dependent categories only when context is provided
    if has_context:
        context_categories = f'''  "objective_alignment": {{
    "score": <number {score_range}>,
    "explanation": "<how well does the manual help readers achieve the stated objective? Does it cover all necessary steps?>"
  }},
  "audience_appropriateness": {{
    "score": <number {score_range}>,
    "explanation": "<is the language, tone, and technical depth appropriate for the target audience? Are prerequisites clearly stated?>"
  }},
'''
    else:
        # When no context, evaluate general usability instead
        context_categories = f'''  "general_usability": {{
    "score": <number {score_range}>,
    "explanation": "<how easy is it for a general user to follow and understand this manual? Is it self-contained and accessible?>"
  }},
'''

    # Format-specific evaluation criteria
    format_criteria = {
        "step-manual": f'''  "step_quality": {{
    "score": <number {score_range}>,
    "explanation": "<are steps sequential and numbered correctly? Is there ONE action per step? Do steps start with action verbs (Click, Select, Enter)? Are screenshots placed after the relevant step?>"
  }},
  "procedural_completeness": {{
    "score": <number {score_range}>,
    "explanation": "<can a user complete the task by following these steps? Are there missing steps or unclear transitions? Are prerequisites and outcomes clear?>"
  }},
''',
        "quick-guide": f'''  "conciseness": {{
    "score": <number {score_range}>,
    "explanation": "<can this be read in 2-3 minutes? Is it scannable with bullet points? Does it focus only on essential information without unnecessary detail?>"
  }},
  "key_information_clarity": {{
    "score": <number {score_range}>,
    "explanation": "<are the most important points clearly highlighted? Is the guide useful as a quick reference during actual work?>"
  }},
''',
        "reference": f'''  "topic_organization": {{
    "score": <number {score_range}>,
    "explanation": "<is content organized by topic/feature rather than workflow? Is it easy to look up specific information? Are sections self-contained?>"
  }},
  "comprehensiveness": {{
    "score": <number {score_range}>,
    "explanation": "<are all options, parameters, and features documented? Are technical terms defined? Are practical examples provided?>"
  }},
''',
        "summary": f'''  "executive_focus": {{
    "score": <number {score_range}>,
    "explanation": "<does it lead with conclusions rather than background? Is it concise enough for decision-makers (under 5 minutes to read)? Does it avoid technical jargon?>"
  }},
  "actionability": {{
    "score": <number {score_range}>,
    "explanation": "<are recommendations specific and actionable? Are findings evidence-based with clear supporting information? Is the business impact clear?>"
  }},
''',
    }

    format_categories = format_criteria.get(document_format, format_criteria["step-manual"])

    # Human-readable format names
    format_names = {
        "step-manual": "Step-by-step Manual",
        "quick-guide": "Quick Guide",
        "reference": "Reference Document",
        "summary": "Executive Summary",
    }
    format_name = format_names.get(document_format, "Step-by-step Manual")

    # Check for language mismatch between video UI and manual language
    source_languages = metadata.get("source_languages")
    has_language_mismatch = False
    language_mismatch_info = None

    if source_languages:
        video_ui_language = source_languages.get("ui_text")
        manual_language = evaluation_request.language

        if video_ui_language and video_ui_language != manual_language:
            has_language_mismatch = True
            video_ui_language_name = SUPPORTED_LANGUAGES.get(video_ui_language, video_ui_language)
            manual_language_name = SUPPORTED_LANGUAGES.get(manual_language, manual_language)
            language_mismatch_info = {
                "video_ui_language": video_ui_language,
                "video_ui_language_name": video_ui_language_name,
                "manual_language": manual_language,
                "manual_language_name": manual_language_name,
            }

    # Add language consistency category when there's a mismatch
    language_consistency_category = ""
    if has_language_mismatch:
        language_consistency_category = f'''  "screenshot_language_mismatch": {{
    "score": <number {score_range}>,
    "explanation": "<IMPORTANT: The manual text is correctly written in {language_mismatch_info['manual_language_name']} (the target language), but the SCREENSHOTS show UI in {language_mismatch_info['video_ui_language_name']}. This is a localization issue with the screenshots, NOT with the manual text. Evaluate how much this screenshot/text language mismatch affects usability: Do the {language_mismatch_info['video_ui_language_name']} button names and labels in screenshots match what the {language_mismatch_info['manual_language_name']} text describes? Can users follow along despite seeing {language_mismatch_info['video_ui_language_name']} UI while reading {language_mismatch_info['manual_language_name']} instructions? Score 1-3: severe confusion, user cannot follow; 4-6: noticeable friction but manageable; 7-10: text clearly guides despite different screenshot language. RECOMMENDATION: Screenshots should be replaced with {language_mismatch_info['manual_language_name']} UI versions to match the manual's target language.>"
  }},
'''

    # Determine the language for the evaluation response
    # Use user_language if provided, otherwise fall back to manual language, then English
    evaluation_language_code = evaluation_request.user_language or evaluation_request.language
    evaluation_language_name = SUPPORTED_LANGUAGES.get(evaluation_language_code, "English")

    # Language instruction for the LLM
    language_instruction = f"\n\n**CRITICAL: Provide your entire evaluation response in {evaluation_language_name}.** All text in your response (summary, strengths, areas for improvement, explanations, recommendations) must be written in {evaluation_language_name}."

    evaluation_prompt = f"""You are an expert technical documentation evaluator. Please evaluate the following **{format_name}**.
{context_section}

**Document Type:** {format_name}

**Content:**
{content}

---

Evaluate this {format_name.lower()} comprehensively. This is a video-generated document with screenshots, so assess both written and visual content quality.

**Important:** Evaluate against the standards for a {format_name.lower()}, not a generic document.
{language_instruction}

Provide your evaluation in the following JSON format:

{{
  "overall_score": <number {score_range}>,
  "summary": "<brief 2-3 sentence executive summary of the evaluation>",
  "strengths": [
    "<specific strength with example from the document>",
    "<another strength>",
    ...
  ],
  "areas_for_improvement": [
    "<specific improvement area with suggestion>",
    "<another area>",
    ...
  ],
{context_categories}{format_categories}{language_consistency_category}{core_categories}
  "recommendations": [
    "<specific actionable recommendation to improve the document>",
    "<another recommendation>",
    ...
  ]
}}

Scoring Guidelines:
- {EVALUATION_SCORE_MAX}: Exceptional, professional quality
- 8-9: Very good, minor improvements possible
- 6-7: Good, some notable areas for improvement
- 4-5: Adequate but needs significant improvement
- {EVALUATION_SCORE_MIN}-3: Poor, major revisions needed

Provide your evaluation as valid JSON only, with no additional text before or after."""

    try:
        # Get the configured model for evaluation
        model_id = AdminSettings.get_model_for_task(TaskType.MANUAL_EVALUATION)
        model_info = get_model(model_id)

        # Check for appropriate API key based on provider and create LLM
        model_string = get_langchain_model_string(model_id)

        if model_info and model_info.provider == ModelProvider.ANTHROPIC:
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise HTTPException(
                    status_code=500,
                    detail="ANTHROPIC_API_KEY not configured for Claude models"
                )
            # Use ChatAnthropic with prompt caching middleware for cost savings
            llm = ChatAnthropic(
                model=model_id,
                api_key=api_key,
                temperature=0.3,
            ).with_config(
                middleware=[AnthropicPromptCachingMiddleware(ttl="5m")]
            )
        else:
            api_key = os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise HTTPException(
                    status_code=500,
                    detail="GOOGLE_API_KEY not configured"
                )
            llm = init_chat_model(model_string, temperature=0.3, api_key=api_key)

        # Use asyncio.to_thread for the blocking LLM call
        response = await asyncio.to_thread(llm.invoke, evaluation_prompt)
        evaluation_text = response.content

        # Log token usage
        try:
            from ...db.usage_tracking import UsageTracking
            usage = response.usage_metadata if hasattr(response, 'usage_metadata') else {}
            if usage:
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
                    operation="evaluation",
                    model=model_id,
                    input_tokens=usage.get("input_tokens", 0),
                    output_tokens=usage.get("output_tokens", 0),
                    cached_tokens=cached_tokens,
                    cache_read_tokens=cache_read_tokens,
                    cache_creation_tokens=cache_creation_tokens,
                    manual_id=manual_id,
                )
        except Exception as usage_error:
            # Don't fail the whole operation if usage tracking fails
            print(f"Warning: Failed to log token usage: {usage_error}")

        # Parse JSON response
        import json
        import re

        # Extract JSON from response (in case there's any surrounding text)
        json_match = re.search(r'\{.*\}', evaluation_text, re.DOTALL)
        if json_match:
            evaluation_data = json.loads(json_match.group(0))
        else:
            evaluation_data = json.loads(evaluation_text)

        # Validate and clamp scores to valid range
        def validate_score(score: any) -> int:
            """Validate and clamp score to valid range."""
            try:
                score_int = int(score)
                return max(EVALUATION_SCORE_MIN, min(EVALUATION_SCORE_MAX, score_int))
            except (TypeError, ValueError):
                return EVALUATION_SCORE_MIN

        # Validate top-level score
        if "overall_score" in evaluation_data:
            evaluation_data["overall_score"] = validate_score(evaluation_data["overall_score"])

        # Validate nested scores for all evaluation categories
        # Include both context-dependent and context-independent categories
        score_categories = [
            "objective_alignment",           # Only when has_context
            "audience_appropriateness",      # Only when has_context
            "general_usability",             # Only when no context
            "screenshot_language_mismatch",  # Only when language mismatch detected
            "clarity_and_completeness",      # Always
            "technical_accuracy",            # Always
            "structure_and_flow",            # Always
        ]
        for key in score_categories:
            if key in evaluation_data and isinstance(evaluation_data[key], dict):
                if "score" in evaluation_data[key]:
                    evaluation_data[key]["score"] = validate_score(evaluation_data[key]["score"])

        # Add metadata
        evaluation_data["manual_id"] = manual_id
        evaluation_data["language"] = evaluation_request.language
        evaluation_data["evaluated_at"] = datetime.now().isoformat()
        evaluation_data["target_audience"] = target_audience
        evaluation_data["target_objective"] = target_objective
        evaluation_data["score_range"] = {
            "min": EVALUATION_SCORE_MIN,
            "max": EVALUATION_SCORE_MAX,
        }

        # Add language mismatch metadata (reuse values computed earlier for the prompt)
        if has_language_mismatch and language_mismatch_info:
            evaluation_data["language_mismatch"] = {
                "detected": True,
                "video_ui_language": language_mismatch_info["video_ui_language"],
                "video_ui_language_name": language_mismatch_info["video_ui_language_name"],
                "manual_language": language_mismatch_info["manual_language"],
                "manual_language_name": language_mismatch_info["manual_language_name"],
                "warning": f"Screenshots show {language_mismatch_info['video_ui_language_name']} UI but manual is in {language_mismatch_info['manual_language_name']}. Consider replacing screenshots with {language_mismatch_info['manual_language_name']} UI versions using edit mode, or providing a localized video source.",
            }
        elif source_languages:
            evaluation_data["language_mismatch"] = {
                "detected": False,
            }
        else:
            # No source language info available
            evaluation_data["language_mismatch"] = None

        # Save evaluation to storage (per-version, use asyncio.to_thread for blocking I/O)
        version_storage = VersionStorage(user_id, manual_id)
        saved_evaluation = await asyncio.to_thread(
            version_storage.save_evaluation,
            evaluation_data,
            evaluation_request.language,
        )

        return saved_evaluation

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse evaluation response: {str(e)}"
        )
    except (asyncio.TimeoutError, TimeoutError):
        raise HTTPException(
            status_code=504,
            detail="Evaluation timed out. The manual may be too long or the API is experiencing delays. Please try again."
        )
    except Exception as e:
        # Check for timeout-related errors from HTTP libraries (httpx, requests, etc.)
        error_msg = str(e).lower()
        if "timeout" in error_msg or "timed out" in error_msg:
            raise HTTPException(
                status_code=504,
                detail="Evaluation timed out. The manual may be too long or the API is experiencing delays. Please try again."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Evaluation failed: {str(e)}"
        )


@router.get("/{manual_id}/evaluations")
async def list_evaluations(
    manual_id: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
):
    """List all stored evaluations for a manual."""
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    version_storage = VersionStorage(user_id, manual_id)
    evaluations = version_storage.list_evaluations()

    return {"manual_id": manual_id, "evaluations": evaluations}


@router.get("/{manual_id}/evaluations/{version}")
async def get_evaluation(
    manual_id: str,
    version: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    language: str = Query(default="en"),
):
    """Get a stored evaluation for a specific version."""
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    version_storage = VersionStorage(user_id, manual_id)
    evaluation = version_storage.get_evaluation(language=language, version=version)

    if not evaluation:
        raise HTTPException(
            status_code=404,
            detail=f"No evaluation found for version {version} in language {language}"
        )

    return evaluation
