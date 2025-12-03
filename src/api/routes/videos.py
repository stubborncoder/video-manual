"""Video management routes."""

from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse

from ..schemas import VideoInfo, VideoListResponse, VideoWithManuals
from ..dependencies import CurrentUser, UserStorageDep, TrashStorageDep

router = APIRouter(prefix="/videos", tags=["videos"])

# MIME types for video files
VIDEO_MIME_TYPES = {
    ".mp4": "video/mp4",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
}


@router.get("")
async def list_videos(
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> VideoListResponse:
    """List all videos in user's folder."""
    videos = storage.list_videos()

    video_infos = []
    for video_path in videos:
        stat = video_path.stat()
        video_infos.append(
            VideoInfo(
                name=video_path.name,
                path=str(video_path),
                size_bytes=stat.st_size,
                modified_at=datetime.fromtimestamp(stat.st_mtime),
            )
        )

    return VideoListResponse(videos=video_infos)


@router.post("/upload")
async def upload_video(
    user_id: CurrentUser,
    storage: UserStorageDep,
    file: UploadFile = File(...),
) -> VideoInfo:
    """Upload a video file."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # Validate file extension
    allowed_extensions = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    ext = Path(file.filename).suffix.lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}",
        )

    # Save to user's videos folder
    video_path = storage.videos_dir / file.filename

    with open(video_path, "wb") as f:
        content = await file.read()
        f.write(content)

    stat = video_path.stat()
    return VideoInfo(
        name=video_path.name,
        path=str(video_path),
        size_bytes=stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime),
    )


@router.get("/{video_name}/manuals")
async def get_video_manuals(
    video_name: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
) -> dict:
    """Get all manuals associated with a video.

    This is useful for showing users what will be affected
    when deleting a video.
    """
    video_path = storage.videos_dir / video_name

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    manuals = storage.get_manuals_by_video(video_name)
    return {
        "video_name": video_name,
        "manual_count": len(manuals),
        "manuals": manuals,
    }


@router.delete("/{video_name}")
async def delete_video(
    video_name: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
    trash: TrashStorageDep,
    cascade: bool = False,
) -> dict:
    """Delete a video file (moves to trash).

    Args:
        video_name: Name of the video file
        cascade: If True, also delete all associated manuals

    Returns:
        Status with list of affected manuals
    """
    video_path = storage.videos_dir / video_name

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    # Get associated manuals
    associated_manuals = storage.get_manuals_by_video(video_name)
    manual_ids = [m["manual_id"] for m in associated_manuals]

    if cascade and manual_ids:
        # Delete manuals first (move to trash)
        for manual_id in manual_ids:
            try:
                trash.move_to_trash(
                    item_type="manual",
                    item_name=manual_id,
                    cascade_deleted=True,
                )
            except ValueError:
                pass  # Manual may not exist

    # Move video to trash
    trash.move_to_trash(
        item_type="video",
        item_name=video_name,
        related_items=manual_ids,
    )

    # Update manual metadata to mark video as deleted
    storage.mark_video_deleted_for_manuals(video_name)

    return {
        "status": "moved_to_trash",
        "video": video_name,
        "cascade": cascade,
        "affected_manuals": manual_ids,
    }


@router.get("/{video_name}/stream")
async def stream_video(
    video_name: str,
    user_id: CurrentUser,
    storage: UserStorageDep,
):
    """Stream a video file for playback."""
    # Validate path to prevent path traversal attacks
    video_path = storage.videos_dir / video_name
    video_path = video_path.resolve()
    videos_dir = storage.videos_dir.resolve()

    if not str(video_path).startswith(str(videos_dir)):
        raise HTTPException(status_code=400, detail="Invalid video name")

    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    # Get MIME type
    ext = video_path.suffix.lower()
    media_type = VIDEO_MIME_TYPES.get(ext, "video/mp4")

    return FileResponse(
        path=video_path,
        media_type=media_type,
        filename=video_name,
    )
