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
from pydantic import BaseModel, field_validator

from ..schemas import ManualSummary, ManualDetail, ManualListResponse, SourceVideoInfo
from ..dependencies import CurrentUser, UserStorageDep, ProjectStorageDep, TrashStorageDep
from ...storage.version_storage import VersionStorage
from ...storage.screenshot_store import ScreenshotStore
from ...core.sanitization import sanitize_target_audience, sanitize_target_objective
from ...core.constants import (
    SUPPORTED_LANGUAGES,
    DEFAULT_EVALUATION_MODEL,
    EVALUATION_SCORE_MIN,
    EVALUATION_SCORE_MAX,
    LLM_TIMEOUT_SECONDS,
    normalize_language_to_code,
)


class ManualProjectAssignment(BaseModel):
    """Request to assign manual to a project."""
    project_id: str
    chapter_id: Optional[str] = None


class ManualContentUpdate(BaseModel):
    """Request to update manual content."""
    content: str
    language: str = "en"


class ManualEvaluationRequest(BaseModel):
    """Request to evaluate a manual."""
    language: str = "en"

    @field_validator('language')
    @classmethod
    def validate_language(cls, v: str) -> str:
        """Validate and normalize language to ISO code.

        Accepts both language names ("English") and codes ("en").
        Returns the ISO 639-1 code.
        """
        return normalize_language_to_code(v)

router = APIRouter(prefix="/manuals", tags=["manuals"])


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

        manuals.append(
            ManualSummary(
                id=manual_id,
                created_at=created_at,
                screenshot_count=len(screenshots),
                languages=languages,
                source_video=source_video,
                project_id=project_id,
                target_audience=target_audience,
                target_objective=target_objective,
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

    # Get source video info from metadata
    source_video = None
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

    return ManualDetail(
        id=manual_id,
        content=content,
        language=language,
        screenshots=[str(s) for s in screenshots],
        source_video=source_video,
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
):
    """Extract frames from source video around a timestamp.

    Returns URLs to temporary frame images that can be used for screenshot replacement.
    """
    from ...agents.video_manual_agent.tools.video_tools import extract_screenshot_at_timestamp

    # Get manual metadata to find source video
    metadata = storage.get_manual_metadata(manual_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Manual not found")

    # Get source video path from metadata (stored as full path)
    video_path_str = metadata.get("video_path", "")
    if not video_path_str:
        raise HTTPException(status_code=400, detail="No source video associated with this manual")

    video_name = Path(video_path_str).name
    video_path = storage.videos_dir / video_name
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Source video not found")

    # Create temp directory for frames
    frames_dir = Path(tempfile.gettempdir()) / "manual_frames" / manual_id
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
                "url": f"/api/manuals/{manual_id}/frames/{frame_filename}",
            })
        except Exception as e:
            # Skip frames that fail to extract
            print(f"Failed to extract frame at {frame_timestamp}s: {e}")
            continue

    return {"frames": frames, "video_duration": metadata.get("video_duration", 0)}


@router.get("/{manual_id}/frames/{filename}")
async def get_frame(
    manual_id: str,
    filename: str,
    user_id: CurrentUser,
):
    """Get a temporary frame image."""
    # Validate path to prevent path traversal attacks
    frames_dir = Path(tempfile.gettempdir()) / "manual_frames" / manual_id
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
):
    """Replace a screenshot with a frame extracted from the source video."""
    from ...agents.video_manual_agent.tools.video_tools import extract_screenshot_at_timestamp

    # Get manual metadata to find source video
    metadata = storage.get_manual_metadata(manual_id)
    if not metadata:
        raise HTTPException(status_code=404, detail="Manual not found")

    # Get source video path from metadata (stored as full path)
    video_path_str = metadata.get("video_path", "")
    if not video_path_str:
        raise HTTPException(status_code=400, detail="No source video associated with this manual")

    video_name = Path(video_path_str).name
    video_path = storage.videos_dir / video_name
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Source video not found")

    screenshot_path = storage.manuals_dir / manual_id / "screenshots" / filename

    try:
        # Create version snapshot before replacing (includes screenshots)
        version_storage = VersionStorage(user_id, manual_id)
        new_version = version_storage.auto_patch_before_overwrite(
            notes=f"Before replacing screenshot from video frame: {filename} at {timestamp:.2f}s"
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
            "url": f"/api/manuals/{manual_id}/screenshots/{filename}",
            "version": new_version or version_storage.get_current_version(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract frame: {str(e)}")


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
) -> dict:
    """List all versions for a manual."""
    manual_dir = storage.manuals_dir / manual_id
    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    version_storage = VersionStorage(user_id, manual_id)
    versions = version_storage.list_versions()

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
    format: str = "pdf"  # pdf, word, html
    language: str = "en"
    embed_images: bool = True  # For HTML only


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
    if export_request.format.lower() not in ("pdf", "word", "docx", "html"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format: {export_request.format}. Supported: pdf, word, html"
        )

    # Verify manual has content for the requested language
    content = storage.get_manual_content(manual_id, export_request.language)
    if not content:
        raise HTTPException(
            status_code=404,
            detail=f"Manual content not found for language: {export_request.language}"
        )

    try:
        # Create exporter
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
    from langchain_google_genai import ChatGoogleGenerativeAI

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

    evaluation_prompt = f"""You are an expert technical documentation evaluator specializing in user manuals and instructional content. Please evaluate the following user manual.
{context_section}

**Manual Content:**
{content}

---

Evaluate this manual comprehensively across multiple dimensions. Consider that this is a video-generated manual with screenshots, so assess both written and visual content quality.

Provide your evaluation in the following JSON format:

{{
  "overall_score": <number {score_range}>,
  "summary": "<brief 2-3 sentence executive summary of the evaluation>",
  "strengths": [
    "<specific strength with example from the manual>",
    "<another strength>",
    ...
  ],
  "areas_for_improvement": [
    "<specific improvement area with suggestion>",
    "<another area>",
    ...
  ],
{context_categories}{core_categories}
  "recommendations": [
    "<specific actionable recommendation to improve the manual>",
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
        # Use Gemini for evaluation
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="GOOGLE_API_KEY not configured"
            )

        llm = ChatGoogleGenerativeAI(
            model=DEFAULT_EVALUATION_MODEL,
            google_api_key=api_key,
            temperature=0.3,
            timeout=LLM_TIMEOUT_SECONDS,
        )

        # Use asyncio.to_thread for the blocking LLM call
        response = await asyncio.to_thread(llm.invoke, evaluation_prompt)
        evaluation_text = response.content

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
            "objective_alignment",       # Only when has_context
            "audience_appropriateness",  # Only when has_context
            "general_usability",         # Only when no context
            "clarity_and_completeness",  # Always
            "technical_accuracy",        # Always
            "structure_and_flow",        # Always
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
    except Exception as e:
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
