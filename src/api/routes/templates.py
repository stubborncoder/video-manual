"""API routes for Word template management."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..dependencies import CurrentUser
from ...storage.template_storage import TemplateStorage


router = APIRouter(prefix="/templates", tags=["templates"])


# Pydantic models for API
class TemplateInfoResponse(BaseModel):
    """Template information response."""

    name: str
    is_global: bool
    size_bytes: int
    uploaded_at: str | None = None


class TemplateListResponse(BaseModel):
    """List of templates response."""

    templates: list[TemplateInfoResponse]
    user_count: int
    global_count: int


class TemplateUploadResponse(BaseModel):
    """Template upload response."""

    name: str
    size_bytes: int
    message: str


class TemplateDeleteResponse(BaseModel):
    """Template deletion response."""

    name: str
    deleted: bool
    message: str


# Dependency for template storage
def get_template_storage(user_id: CurrentUser) -> TemplateStorage:
    """Get TemplateStorage for current user."""
    storage = TemplateStorage(user_id)
    storage.ensure_directories()
    return storage


TemplateStorageDep = Annotated[TemplateStorage, Depends(get_template_storage)]


@router.get("", response_model=TemplateListResponse)
async def list_templates(storage: TemplateStorageDep) -> TemplateListResponse:
    """List all available templates (user + global).

    User templates are listed first and take precedence over global templates
    with the same name.
    """
    templates = storage.list_templates()
    user_templates = storage.list_user_templates()
    global_templates = storage.list_global_templates()

    return TemplateListResponse(
        templates=[
            TemplateInfoResponse(
                name=t.name,
                is_global=t.is_global,
                size_bytes=t.size_bytes,
                uploaded_at=t.uploaded_at,
            )
            for t in templates
        ],
        user_count=len(user_templates),
        global_count=len(global_templates),
    )


@router.post("", response_model=TemplateUploadResponse)
async def upload_template(
    storage: TemplateStorageDep,
    file: UploadFile = File(...),
    name: str | None = Form(None),
) -> TemplateUploadResponse:
    """Upload a new Word template.

    The template file must be a valid .docx file. If no name is provided,
    the original filename (without extension) will be used.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a .docx Word document",
        )

    # Read file content
    content = await file.read()

    # Use filename if no name provided
    template_name = name or file.filename.rsplit(".", 1)[0]

    try:
        info = storage.save_template(content, template_name)
        return TemplateUploadResponse(
            name=info.name,
            size_bytes=info.size_bytes,
            message=f"Template '{info.name}' uploaded successfully",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/{template_name}", response_class=FileResponse)
async def download_template(
    template_name: str,
    storage: TemplateStorageDep,
) -> FileResponse:
    """Download a template file.

    Returns the .docx template file for the given name.
    Checks user templates first, then global templates.
    """
    template_path = storage.get_template(template_name)

    if not template_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found: {template_name}",
        )

    return FileResponse(
        path=template_path,
        filename=f"{template_name}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@router.get("/{template_name}/info", response_model=TemplateInfoResponse)
async def get_template_info(
    template_name: str,
    storage: TemplateStorageDep,
) -> TemplateInfoResponse:
    """Get detailed information about a template.

    Returns metadata including name, size, and upload date.
    """
    info = storage.get_template_info(template_name)

    if not info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found: {template_name}",
        )

    return TemplateInfoResponse(
        name=info.name,
        is_global=info.is_global,
        size_bytes=info.size_bytes,
        uploaded_at=info.uploaded_at,
    )


@router.delete("/{template_name}", response_model=TemplateDeleteResponse)
async def delete_template(
    template_name: str,
    storage: TemplateStorageDep,
) -> TemplateDeleteResponse:
    """Delete a user template.

    Only user templates can be deleted. Global templates cannot be removed
    through this endpoint.
    """
    try:
        deleted = storage.delete_template(template_name)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template not found: {template_name}",
            )

        return TemplateDeleteResponse(
            name=template_name,
            deleted=True,
            message=f"Template '{template_name}' deleted successfully",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
