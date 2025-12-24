"""Share link management routes."""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..dependencies import CurrentUser, UserStorageDep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/docs", tags=["share"])


class CreateShareRequest(BaseModel):
    """Request to create a share link."""
    language: str = "en"


class ShareInfoResponse(BaseModel):
    """Response with share information."""
    doc_id: str
    token: str
    language: str
    share_url: str
    created_at: str
    expires_at: Optional[str] = None


class ShareStatusResponse(BaseModel):
    """Response with share status."""
    doc_id: str
    is_shared: bool
    share_info: Optional[ShareInfoResponse] = None


@router.post("/{doc_id}/share", response_model=ShareInfoResponse)
async def create_share_link(
    doc_id: str,
    request: CreateShareRequest,
    user: CurrentUser,
    storage: UserStorageDep,
):
    """Create a shareable link for a doc.

    Generates a unique token that allows public access to the rendered doc.
    If the doc already has a share link, returns the existing one.
    """
    # Verify doc exists
    metadata = storage.get_doc_metadata(doc_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Doc not found")

    # Check if share already exists
    existing_share = storage.get_share_info(doc_id)
    if existing_share:
        # Return existing share info
        return ShareInfoResponse(
            doc_id=doc_id,
            token=existing_share["token"],
            language=existing_share["language"],
            share_url=f"/share/{existing_share['token']}",
            created_at=existing_share["created_at"],
            expires_at=existing_share.get("expires_at"),
        )

    # Verify requested language exists
    available_languages = metadata.get("languages_generated", [])
    if request.language not in available_languages:
        raise HTTPException(
            status_code=400,
            detail=f"Language '{request.language}' not available. Available: {available_languages}"
        )

    # Create new share token
    token = storage.create_share_token(doc_id, request.language)

    logger.info(f"Created share link for doc {doc_id} in {request.language}")

    return ShareInfoResponse(
        doc_id=doc_id,
        token=token,
        language=request.language,
        share_url=f"/share/{token}",
        created_at=datetime.now().isoformat(),
        expires_at=None,
    )


@router.get("/{doc_id}/share", response_model=ShareStatusResponse)
async def get_share_status(
    doc_id: str,
    user: CurrentUser,
    storage: UserStorageDep,
):
    """Get share status for a doc.

    Returns whether the doc is shared and the share info if it is.
    """
    # Verify doc exists
    metadata = storage.get_doc_metadata(doc_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Doc not found")

    share_info = storage.get_share_info(doc_id)

    if share_info:
        return ShareStatusResponse(
            doc_id=doc_id,
            is_shared=True,
            share_info=ShareInfoResponse(
                doc_id=doc_id,
                token=share_info["token"],
                language=share_info["language"],
                share_url=f"/share/{share_info['token']}",
                created_at=share_info["created_at"],
                expires_at=share_info.get("expires_at"),
            ),
        )

    return ShareStatusResponse(
        doc_id=doc_id,
        is_shared=False,
        share_info=None,
    )


@router.delete("/{doc_id}/share")
async def revoke_share_link(
    doc_id: str,
    user: CurrentUser,
    storage: UserStorageDep,
):
    """Revoke a share link for a doc.

    The share token will no longer be valid after this call.
    """
    # Verify doc exists
    metadata = storage.get_doc_metadata(doc_id)
    if metadata is None:
        raise HTTPException(status_code=404, detail="Doc not found")

    revoked = storage.revoke_share(doc_id)

    if not revoked:
        raise HTTPException(status_code=404, detail="No share link found for this doc")

    logger.info(f"Revoked share link for doc {doc_id}")

    return {"status": "success", "message": "Share link revoked"}
