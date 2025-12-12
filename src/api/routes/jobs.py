"""Job management routes for tracking video processing."""

from fastapi import APIRouter, HTTPException

from ..dependencies import CurrentUser
from ..schemas import JobInfo, JobListResponse
from ...db import JobStorage

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("")
async def list_jobs(
    user_id: CurrentUser,
    status: str | None = None,
    include_seen: bool = True,
) -> JobListResponse:
    """
    List all jobs for the current user.

    Args:
        status: Optional filter ('pending', 'processing', 'complete', 'error')
        include_seen: Whether to include jobs marked as seen (default True)
    """
    jobs = JobStorage.get_user_jobs(user_id, status=status, include_seen=include_seen)
    return JobListResponse(jobs=[JobInfo(**job) for job in jobs])


@router.get("/active")
async def list_active_jobs(user_id: CurrentUser) -> JobListResponse:
    """List all active (pending/processing) jobs for the current user.

    Also cleans up stale jobs that have been processing for over 20 minutes.
    """
    # Clean up any stale jobs first (stuck processing > 20 minutes)
    cleaned = JobStorage.cleanup_stale_processing_jobs(minutes=20)
    if cleaned > 0:
        print(f"[Jobs] Cleaned up {cleaned} stale processing job(s)")

    jobs = JobStorage.get_active_jobs(user_id)
    return JobListResponse(jobs=[JobInfo(**job) for job in jobs])


@router.get("/{job_id}")
async def get_job(job_id: str, user_id: CurrentUser) -> JobInfo:
    """Get a single job by ID."""
    job = JobStorage.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Verify job belongs to user
    if job["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobInfo(**job)


@router.post("/{job_id}/seen")
async def mark_job_seen(job_id: str, user_id: CurrentUser) -> dict:
    """Mark a job as seen (dismiss notification)."""
    job = JobStorage.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Job not found")

    JobStorage.mark_seen(job_id)
    return {"status": "ok"}
