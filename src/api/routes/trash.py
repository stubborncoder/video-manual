"""Trash management routes for soft-delete recovery."""

from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..schemas import TrashItemInfo, TrashListResponse, RestoreResponse
from ..dependencies import CurrentUser, TrashStorageDep, UserStorageDep

router = APIRouter(prefix="/trash", tags=["trash"])


@router.get("")
async def list_trash(
    user_id: CurrentUser,
    trash: TrashStorageDep,
    item_type: str | None = None,
) -> TrashListResponse:
    """List all items in trash.

    Args:
        item_type: Optional filter by type ("video", "manual", "project")
    """
    # Clean up expired items first
    trash.cleanup_expired()

    items = trash.list_trash(item_type)
    stats = trash.get_trash_stats()

    return TrashListResponse(
        items=[
            TrashItemInfo(
                trash_id=item.trash_id,
                item_type=item.item_type,
                original_name=item.original_name,
                deleted_at=item.deleted_at,
                expires_at=item.expires_at,
                cascade_deleted=item.cascade_deleted,
                related_items=item.related_items,
            )
            for item in items
        ],
        stats=stats,
    )


@router.post("/{item_type}/{trash_id}/restore")
async def restore_item(
    item_type: str,
    trash_id: str,
    user_id: CurrentUser,
    trash: TrashStorageDep,
    storage: UserStorageDep,
) -> RestoreResponse:
    """Restore an item from trash.

    Args:
        item_type: Type of item ("video", "manual", "project")
        trash_id: Trash ID (filename in trash)
    """
    if item_type not in ("video", "manual", "project"):
        raise HTTPException(status_code=400, detail=f"Invalid item type: {item_type}")

    # Get the trash item to find original name
    trash_item = trash.get_trash_item(item_type, trash_id)
    if not trash_item:
        raise HTTPException(status_code=404, detail="Item not found in trash")

    try:
        restored_path = trash.restore(item_type, trash_id)

        # If video restored, update associated manuals
        if item_type == "video":
            video_name = Path(restored_path).name
            storage.mark_video_restored_for_docs(video_name)

        return RestoreResponse(
            restored_path=str(restored_path),
            item_type=item_type,
            original_name=trash_item.original_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{item_type}/{trash_id}")
async def permanent_delete(
    item_type: str,
    trash_id: str,
    user_id: CurrentUser,
    trash: TrashStorageDep,
) -> dict:
    """Permanently delete an item from trash.

    This cannot be undone.

    Args:
        item_type: Type of item ("video", "manual", "project")
        trash_id: Trash ID
    """
    if item_type not in ("video", "manual", "project"):
        raise HTTPException(status_code=400, detail=f"Invalid item type: {item_type}")

    try:
        trash.permanent_delete(item_type, trash_id)
        return {"status": "deleted", "trash_id": trash_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/empty")
async def empty_trash(
    user_id: CurrentUser,
    trash: TrashStorageDep,
) -> dict:
    """Permanently delete all items in trash.

    This cannot be undone.
    """
    count = trash.empty_trash()
    return {"status": "emptied", "deleted_count": count}
