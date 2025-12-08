"""State definition for the Reformat Agent workflow."""

from typing import TypedDict, Optional


class ReformatState(TypedDict):
    """State for the reformat workflow.

    This state is passed through the LangGraph nodes as the manual
    is loaded and converted to a different document format.
    """

    # Inputs
    source_manual_id: str
    user_id: str
    source_format: str      # "step-manual", "quick-guide", "reference", "summary"
    target_format: str      # "step-manual", "quick-guide", "reference", "summary"
    language: str           # Language code (en, es, ca, etc.)

    # Content
    source_content: Optional[str]           # Full markdown content loaded from manual
    converted_content: Optional[str]        # Converted output with new format tags

    # Status tracking
    status: str             # "loading", "converting", "completed", "error"
    error: Optional[str]    # Error message if status is "error"
