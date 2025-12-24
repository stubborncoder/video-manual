"""Project share link management routes."""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..dependencies import CurrentUser, ProjectStorageDep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["project-share"])


class CreateProjectShareRequest(BaseModel):
    """Request to create a share link for a project."""
    language: str = "en"


class ProjectShareInfoResponse(BaseModel):
    """Response with project share information."""
    project_id: str
    token: str
    language: str
    share_url: str
    created_at: str
    expires_at: Optional[str] = None


class ProjectShareStatusResponse(BaseModel):
    """Response with project share status."""
    project_id: str
    is_shared: bool
    is_compiled: bool
    share_info: Optional[ProjectShareInfoResponse] = None


@router.post("/{project_id}/share", response_model=ProjectShareInfoResponse)
async def create_project_share_link(
    project_id: str,
    request: CreateProjectShareRequest,
    user: CurrentUser,
    storage: ProjectStorageDep,
):
    """Create a shareable link for a compiled project.

    Generates a unique token that allows public access to the compiled project.
    If the project already has a share link, returns the existing one.

    Note: Projects must be compiled before they can be shared.
    """
    # Verify project exists
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if project is compiled
    if not storage.is_compiled(project_id):
        raise HTTPException(
            status_code=400,
            detail="Project must be compiled before sharing. Please compile the project first."
        )

    # Check if share already exists
    existing_share = storage.get_share_info(project_id)
    if existing_share:
        # Return existing share info
        return ProjectShareInfoResponse(
            project_id=project_id,
            token=existing_share["token"],
            language=existing_share["language"],
            share_url=f"/share/project/{existing_share['token']}",
            created_at=existing_share["created_at"],
            expires_at=existing_share.get("expires_at"),
        )

    # Create new share token
    token = storage.create_share_token(project_id, request.language)

    logger.info(f"Created share link for project {project_id} in {request.language}")

    return ProjectShareInfoResponse(
        project_id=project_id,
        token=token,
        language=request.language,
        share_url=f"/share/project/{token}",
        created_at=datetime.now().isoformat(),
        expires_at=None,
    )


@router.get("/{project_id}/share", response_model=ProjectShareStatusResponse)
async def get_project_share_status(
    project_id: str,
    user: CurrentUser,
    storage: ProjectStorageDep,
):
    """Get share status for a project.

    Returns whether the project is shared, compiled, and share info if applicable.
    """
    # Verify project exists
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    is_compiled = storage.is_compiled(project_id)
    share_info = storage.get_share_info(project_id)

    if share_info:
        return ProjectShareStatusResponse(
            project_id=project_id,
            is_shared=True,
            is_compiled=is_compiled,
            share_info=ProjectShareInfoResponse(
                project_id=project_id,
                token=share_info["token"],
                language=share_info["language"],
                share_url=f"/share/project/{share_info['token']}",
                created_at=share_info["created_at"],
                expires_at=share_info.get("expires_at"),
            ),
        )

    return ProjectShareStatusResponse(
        project_id=project_id,
        is_shared=False,
        is_compiled=is_compiled,
        share_info=None,
    )


@router.delete("/{project_id}/share")
async def revoke_project_share_link(
    project_id: str,
    user: CurrentUser,
    storage: ProjectStorageDep,
):
    """Revoke a share link for a project.

    The share token will no longer be valid after this call.
    """
    # Verify project exists
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    revoked = storage.revoke_share(project_id)

    if not revoked:
        raise HTTPException(status_code=404, detail="No share link found for this project")

    logger.info(f"Revoked share link for project {project_id}")

    return {"status": "success", "message": "Share link revoked"}
