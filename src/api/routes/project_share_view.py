"""Public project share view routes (no authentication required)."""

import json
import logging
import markdown
import re
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ...storage.project_storage import ProjectStorage, find_project_by_share_token
from ...config import USERS_DIR

logger = logging.getLogger(__name__)


# Custom XML-like tags used in doc formats
CUSTOM_TAGS = [
    "title", "summary", "location", "findings", "evidence",
    "severity", "recommendation", "next_steps", "steps",
    "overview", "prerequisites", "tips", "warnings", "notes",
    "introduction", "step", "keypoint", "note", "section",
    "definition", "finding", "example",
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
        # My Title
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


def extract_toc_from_markdown(content: str) -> List[dict]:
    """Extract table of contents from markdown headings.

    Args:
        content: Markdown content

    Returns:
        List of TOC items with id, title, and level
    """
    toc = []
    # Match H1, H2, H3 headings
    heading_pattern = re.compile(r'^(#{1,3})\s+(.+)$', re.MULTILINE)

    for match in heading_pattern.finditer(content):
        level = len(match.group(1))
        title = match.group(2).strip()

        # Generate ID from title (lowercase, replace spaces with dashes)
        heading_id = re.sub(r'[^a-z0-9\s-]', '', title.lower())
        heading_id = re.sub(r'\s+', '-', heading_id)

        toc.append({
            "id": heading_id,
            "title": title,
            "level": level,
        })

    return toc


router = APIRouter(prefix="/share/project", tags=["project-share-view"])


class TocItem(BaseModel):
    """Table of contents item."""
    id: str
    title: str
    level: int


class SharedProjectInfo(BaseModel):
    """Info about a shared project for frontend rendering."""
    title: str
    description: str
    language: str
    content_html: str
    toc: List[TocItem]
    updated_at: Optional[str] = None
    version: Optional[str] = None


@router.get("/{token}")
async def get_shared_project(token: str):
    """Get a shared project by its token.

    This is a public endpoint - no authentication required.
    Returns the compiled project content as rendered HTML.
    """
    # Find project by token
    result = find_project_by_share_token(token)

    if result is None:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    user_id, project_id, share_info = result
    language = share_info.get("language", "en")

    # Get the project storage and project data
    storage = ProjectStorage(user_id)
    project = storage.get_project(project_id)

    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get compiled content
    compiled_dir = storage.projects_dir / project_id / "compiled" / "current"
    markdown_file = compiled_dir / f"manual_{language}.md"

    if not markdown_file.exists():
        # Try without language suffix
        markdown_file = compiled_dir / "manual.md"

    if not markdown_file.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Compiled content not found for language: {language}"
        )

    # Read markdown content
    content = markdown_file.read_text(encoding="utf-8")

    # Extract TOC before stripping tags
    toc = extract_toc_from_markdown(content)

    # Step 1: Strip custom XML-like tags (preserving content)
    content = strip_custom_tags(content)

    # Step 2: Replace image paths in markdown BEFORE conversion
    # ![alt](../screenshots/figure_01.png) -> ![alt](/api/share/project/{token}/image/figure_01.png)
    # ![alt](screenshots/figure_01.png) -> ![alt](/api/share/project/{token}/image/figure_01.png)
    def replace_md_image(match):
        alt = match.group(1)
        path = match.group(2)
        filename = Path(path).name
        return f'![{alt}](/api/share/project/{token}/image/{filename})'

    content = re.sub(
        r'!\[([^\]]*)\]\(([^)]+)\)',
        replace_md_image,
        content
    )

    # Step 3: Convert markdown to HTML
    md = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc'])
    content_html = md.convert(content)

    # Get compilation metadata
    compilation_file = compiled_dir / "compilation.json"
    compilation_info = {}
    if compilation_file.exists():
        with open(compilation_file, "r", encoding="utf-8") as f:
            compilation_info = json.load(f)

    return SharedProjectInfo(
        title=project.get("name", project_id),
        description=project.get("description", ""),
        language=language,
        content_html=content_html,
        toc=[TocItem(**item) for item in toc],
        updated_at=compilation_info.get("compiled_at") or project.get("updated_at"),
        version=compilation_info.get("version"),
    )


@router.get("/{token}/image/{filename}")
async def get_shared_project_image(token: str, filename: str):
    """Get an image from a shared project's compiled output.

    This is a public endpoint - no authentication required.
    """
    # Validate filename to prevent path traversal
    safe_filename = validate_image_filename(filename)

    # Find project by token
    result = find_project_by_share_token(token)

    if result is None:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    user_id, project_id, share_info = result

    # Build path to image in compiled folder
    screenshots_dir = USERS_DIR / user_id / "projects" / project_id / "compiled" / "current" / "screenshots"
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
