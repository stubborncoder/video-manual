"""Tools for the Manual Editor Agent.

These tools create pending changes that are streamed to the frontend
for user review. The user must accept or reject each change.
"""

import uuid
from typing import Dict, Any, Literal, Optional
from langchain_core.tools import tool


def generate_change_id() -> str:
    """Generate a unique ID for a pending change."""
    return f"change_{uuid.uuid4().hex[:8]}"


@tool
def replace_text(
    start_line: int,
    end_line: int,
    new_content: str,
    reason: str,
) -> Dict[str, Any]:
    """Replace a range of lines in the document with new content.

    This creates a pending change that the user must review and approve.
    The change will be shown as an inline diff in the document.

    Args:
        start_line: First line to replace (1-indexed)
        end_line: Last line to replace (1-indexed, inclusive)
        new_content: The new text to insert (can be multiple lines)
        reason: Brief explanation of why this change is being made

    Returns:
        Dict with change_id and status for tracking
    """
    change_id = generate_change_id()

    return {
        "change_id": change_id,
        "type": "text_replace",
        "start_line": start_line,
        "end_line": end_line,
        "new_content": new_content,
        "reason": reason,
        "status": "pending",
    }


@tool
def insert_text(
    after_line: int,
    content: str,
    reason: str,
) -> Dict[str, Any]:
    """Insert new content after a specific line in the document.

    This creates a pending change that the user must review and approve.

    Args:
        after_line: Line number after which to insert (1-indexed, 0 = at beginning)
        content: The text to insert (can be multiple lines)
        reason: Brief explanation of why this insertion is being made

    Returns:
        Dict with change_id and status for tracking
    """
    change_id = generate_change_id()

    return {
        "change_id": change_id,
        "type": "text_insert",
        "after_line": after_line,
        "new_content": content,
        "reason": reason,
        "status": "pending",
    }


@tool
def delete_text(
    start_line: int,
    end_line: int,
    reason: str,
) -> Dict[str, Any]:
    """Delete a range of lines from the document.

    This creates a pending change that the user must review and approve.

    Args:
        start_line: First line to delete (1-indexed)
        end_line: Last line to delete (1-indexed, inclusive)
        reason: Brief explanation of why this deletion is being made

    Returns:
        Dict with change_id and status for tracking
    """
    change_id = generate_change_id()

    return {
        "change_id": change_id,
        "type": "text_delete",
        "start_line": start_line,
        "end_line": end_line,
        "reason": reason,
        "status": "pending",
    }


@tool
def flag_screenshot_issue(
    figure_id: str,
    issue_type: Literal["wrong_timing", "blurry", "missing_element", "mismatch", "other"],
    description: str,
) -> Dict[str, Any]:
    """Flag a screenshot that needs to be replaced by the user.

    You cannot directly replace images - this tool marks them for user review.
    The user will then manually select a new frame from the source video.

    Args:
        figure_id: The image filename (e.g., "screenshot_001.png")
        issue_type: Category of the problem:
            - "wrong_timing": Screenshot taken at wrong moment
            - "blurry": Image is unclear or low quality
            - "missing_element": Important UI element not visible
            - "mismatch": Image doesn't match the text description
            - "other": Other issue
        description: Detailed explanation of what's wrong and what the image should show

    Returns:
        Dict with flag_id and status for tracking
    """
    flag_id = f"flag_{uuid.uuid4().hex[:8]}"

    return {
        "flag_id": flag_id,
        "type": "screenshot_flag",
        "figure_id": figure_id,
        "issue_type": issue_type,
        "description": description,
        "status": "flagged",
    }


@tool
def update_image_caption(
    figure_id: str,
    new_caption: str,
    reason: str,
) -> Dict[str, Any]:
    """Update the alt text/caption for an image in the document.

    This creates a pending change that the user must review and approve.

    Args:
        figure_id: The image filename (e.g., "screenshot_001.png")
        new_caption: The new alt text or caption for the image
        reason: Brief explanation of why the caption is being changed

    Returns:
        Dict with change_id and status for tracking
    """
    change_id = generate_change_id()

    return {
        "change_id": change_id,
        "type": "caption_update",
        "figure_id": figure_id,
        "new_caption": new_caption,
        "reason": reason,
        "status": "pending",
    }


@tool
def insert_image_placeholder(
    after_line: int,
    description: str,
    suggested_timestamp: Optional[float] = None,
) -> Dict[str, Any]:
    """Insert a placeholder for a new image that the user will select from the video.

    Use this when the user asks to add a screenshot or image at a specific location.
    The placeholder will be shown in the document, and the user can click it to
    select a frame from the source video.

    Args:
        after_line: Line number after which to insert (1-indexed, 0 = at beginning)
        description: What the image should show (e.g., "the login button highlighted")
        suggested_timestamp: Optional video timestamp in seconds where this frame might be found

    Returns:
        Dict with change_id and status for tracking
    """
    change_id = generate_change_id()

    # Format timestamp for the placeholder URL (0 if not provided)
    timestamp = suggested_timestamp if suggested_timestamp is not None else 0

    # Create the placeholder markdown with blank lines for proper parsing
    # Format: ![IMAGE_NEEDED: description](placeholder:timestamp)
    # Blank lines ensure it's parsed as a standalone image, not inline text
    placeholder_content = f"\n![IMAGE_NEEDED: {description}](placeholder:{timestamp})\n"

    return {
        "change_id": change_id,
        "type": "image_placeholder",
        "after_line": after_line,
        "new_content": placeholder_content,
        "description": description,
        "suggested_timestamp": timestamp,
        "reason": f"Add screenshot: {description}",
        "status": "pending",
    }


# Export all tools for the agent
EDITOR_TOOLS = [
    replace_text,
    insert_text,
    delete_text,
    flag_screenshot_issue,
    update_image_caption,
    insert_image_placeholder,
]
