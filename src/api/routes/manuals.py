"""Manual management routes."""

from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..schemas import ManualSummary, ManualDetail, ManualListResponse, SourceVideoInfo
from ..dependencies import CurrentUser, UserStorageDep, ProjectStorageDep, TrashStorageDep


class ManualProjectAssignment(BaseModel):
    """Request to assign manual to a project."""
    project_id: str
    chapter_id: Optional[str] = None

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

        manuals.append(
            ManualSummary(
                id=manual_id,
                created_at=created_at,
                screenshot_count=len(screenshots),
                languages=languages,
                source_video=source_video,
                project_id=project_id,
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

    return ManualDetail(
        id=manual_id,
        content=content,
        language=language,
        screenshots=[str(s) for s in screenshots],
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


@router.get("/{manual_id}/screenshots/{filename}")
async def get_screenshot(
    manual_id: str,
    filename: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
):
    """Get a screenshot image."""
    screenshot_path = storage.manuals_dir / manual_id / "screenshots" / filename

    if not screenshot_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")

    return FileResponse(screenshot_path)


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
