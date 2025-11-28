"""Manual management routes."""

from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ..schemas import ManualSummary, ManualDetail, ManualListResponse
from ..dependencies import CurrentUser, UserStorageDep, ProjectStorageDep

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

        manuals.append(
            ManualSummary(
                id=manual_id,
                created_at=created_at,
                screenshot_count=len(screenshots),
                languages=languages,
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
) -> dict:
    """Delete a manual."""
    manual_dir = storage.manuals_dir / manual_id

    if not manual_dir.exists():
        raise HTTPException(status_code=404, detail="Manual not found")

    import shutil
    shutil.rmtree(manual_dir)

    return {"status": "deleted", "manual_id": manual_id}


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
