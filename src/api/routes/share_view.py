"""Public share view routes (no authentication required)."""

import logging
import markdown
import re
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ...storage.user_storage import UserStorage, find_doc_by_share_token
from ...config import USERS_DIR

logger = logging.getLogger(__name__)


# Custom XML-like tags used in doc formats
CUSTOM_TAGS = [
    "title", "summary", "location", "findings", "evidence",
    "severity", "recommendation", "next_steps", "steps",
    "overview", "prerequisites", "tips", "warnings", "notes",
]


ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def validate_image_filename(filename: str) -> str:
    """Validate and sanitize image filename to prevent path traversal.

    Args:
        filename: The filename to validate

    Returns:
        Sanitized filename (basename only)

    Raises:
        HTTPException: If filename is invalid or contains path traversal attempts
    """
    # Get only the basename to prevent path traversal
    safe_name = Path(filename).name

    # Reject if basename differs from original (path traversal attempt)
    if safe_name != filename or not filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Check for path separators that might have been encoded
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Validate extension
    suffix = Path(safe_name).suffix.lower()
    if suffix not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid image type")

    return safe_name


def strip_custom_tags(content: str) -> str:
    """Remove custom XML-like tags from content while preserving inner content.

    Converts:
        <title>My Title</title>
        <evidence title="Evidence: Foo">content</evidence>
    Into:
        My Title
        ### Evidence: Foo
        content
    """
    result = content

    # Handle <title>Document Type: Actual Title</title>
    # Remove the document type prefix (before colon), keep just the actual title
    def process_title(match):
        title_content = match.group(1)
        if ':' in title_content:
            # Remove "Document Type: " prefix, keep the rest as H1
            actual_title = title_content.split(':', 1)[1].strip()
            return f'# {actual_title}\n'
        else:
            # No prefix to remove, just convert to H1
            return f'# {title_content}\n'

    result = re.sub(
        r'<title>([^<]*)</title>\n*',
        process_title,
        result
    )

    # Handle tags with title attribute -> ### Title
    for tag in CUSTOM_TAGS:
        result = re.sub(
            rf'<{tag}\s+title="([^"]*)"[^>]*>',
            r'### \1\n',
            result
        )
        result = re.sub(
            rf'<{tag}\s+level="([^"]*)"[^>]*>',
            '',  # severity level tag - just remove opening
            result
        )

    # Remove remaining opening and closing custom tags
    for tag in CUSTOM_TAGS:
        result = re.sub(rf'<{tag}[^>]*>', '', result)
        result = re.sub(rf'</{tag}>', '', result)

    # Clean up excessive blank lines
    result = re.sub(r'\n{3,}', '\n\n', result)

    return result.strip()

router = APIRouter(prefix="/share", tags=["share-view"])


class SharedDocInfo(BaseModel):
    """Info about a shared doc for frontend rendering."""
    title: str
    language: str
    content_html: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    version: Optional[str] = None
    document_format: Optional[str] = None


@router.get("/{token}")
async def get_shared_doc(token: str):
    """Get a shared doc by its token.

    This is a public endpoint - no authentication required.
    Returns the doc content as rendered HTML.
    """
    # Find doc by token
    result = find_doc_by_share_token(token)

    if result is None:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    user_id, doc_id, share_info = result
    language = share_info.get("language", "en")

    # Get the user storage and doc content
    storage = UserStorage(user_id)
    metadata = storage.get_doc_metadata(doc_id)

    if metadata is None:
        raise HTTPException(status_code=404, detail="Doc not found")

    # Get doc content
    content = storage.get_doc_content(doc_id, language)

    if content is None:
        raise HTTPException(
            status_code=404,
            detail=f"Doc content not found for language: {language}"
        )

    # Step 1: Strip custom XML-like tags (preserving content)
    content = strip_custom_tags(content)

    # Step 2: Replace image paths in markdown BEFORE conversion
    # ![alt](../screenshots/figure_01.png) -> ![alt](/api/share/{token}/image/figure_01.png)
    def replace_md_image(match):
        alt = match.group(1)
        path = match.group(2)
        filename = Path(path).name
        return f'![{alt}](/api/share/{token}/image/{filename})'

    content = re.sub(
        r'!\[([^\]]*)\]\(([^)]+)\)',
        replace_md_image,
        content
    )

    # Step 3: Convert markdown to HTML
    md = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc'])
    content_html = md.convert(content)

    # Extract version number
    version_info = metadata.get("version", {})
    version_number = version_info.get("number") if isinstance(version_info, dict) else None

    return SharedDocInfo(
        title=metadata.get("title", doc_id),
        language=language,
        content_html=content_html,
        created_at=metadata.get("created_at"),
        updated_at=metadata.get("updated_at"),
        version=version_number,
        document_format=metadata.get("document_format"),
    )


@router.get("/{token}/image/{filename}")
async def get_shared_image(token: str, filename: str):
    """Get an image from a shared doc.

    This is a public endpoint - no authentication required.
    """
    # Validate filename to prevent path traversal
    safe_filename = validate_image_filename(filename)

    # Find doc by token
    result = find_doc_by_share_token(token)

    if result is None:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    user_id, doc_id, share_info = result

    # Build path to image
    screenshots_dir = USERS_DIR / user_id / "docs" / doc_id / "screenshots"
    image_path = (screenshots_dir / safe_filename).resolve()

    # Verify resolved path is still within the screenshots directory (defense in depth)
    if not str(image_path).startswith(str(screenshots_dir.resolve())):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    # Determine content type
    suffix = image_path.suffix.lower()
    content_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    content_type = content_types.get(suffix, "application/octet-stream")

    return FileResponse(
        path=image_path,
        media_type=content_type,
        filename=safe_filename,
    )
