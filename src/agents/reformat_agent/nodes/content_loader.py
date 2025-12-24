"""Node for loading source manual content."""

from typing import Any, Dict
from pathlib import Path

from ..state import ReformatState


def load_content(state: ReformatState) -> Dict[str, Any]:
    """Load the source manual content from storage.

    Reads the markdown file for the specified language from the manual directory.

    Args:
        state: Current workflow state with source_manual_id, user_id, and language

    Returns:
        Dict with source_content and updated status
    """
    from src.storage.user_storage import UserStorage

    try:
        storage = UserStorage(state["user_id"])
        # get_manual_dir returns (path, manual_id) tuple
        manual_dir, _ = storage.get_doc_dir(state["source_manual_id"])

        # Read the markdown for the specified language
        language = state["language"]
        content_path = manual_dir / language / "manual.md"

        if not content_path.exists():
            return {
                "status": "error",
                "error": f"Manual content not found for language '{language}' at {content_path}"
            }

        content = content_path.read_text(encoding="utf-8")

        if not content.strip():
            return {
                "status": "error",
                "error": f"Manual content is empty for language '{language}'"
            }

        return {
            "source_content": content,
            "status": "converting"
        }

    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to load manual content: {str(e)}"
        }
