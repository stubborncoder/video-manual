"""Reformat Agent for converting manuals between document formats.

This agent takes an existing manual and converts it to a different
document format (e.g., step-manual to quick-guide) while preserving
screenshots and adapting the content structure.
"""

import sqlite3
from typing import Dict, Any, Optional

from dotenv import load_dotenv
from langgraph.checkpoint.sqlite import SqliteSaver

from .graph import create_reformat_graph
from .state import ReformatState
from .config import SUPPORTED_FORMATS, FORMAT_NAMES
from ...config import get_checkpoint_db_path, ensure_directories


AGENT_NAME = "reformat_agent"


class ReformatAgent:
    """Reformat Agent for converting manuals between document formats.

    This agent uses LangGraph to orchestrate a simple 2-node workflow:
    1. load_content: Load source manual markdown
    2. convert: Convert to target format using Claude

    The conversion preserves all screenshots and adapts the content
    structure to match the target format's semantic tags.
    """

    def __init__(self, use_checkpointer: bool = True):
        """Initialize Reformat Agent.

        Args:
            use_checkpointer: Whether to enable SQLite checkpointing for persistence
        """
        load_dotenv()
        ensure_directories()

        # Setup graph with optional checkpointer
        if use_checkpointer:
            db_path = get_checkpoint_db_path(AGENT_NAME)
            self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
            self.checkpointer = SqliteSaver(self._conn)
            self.graph = create_reformat_graph(checkpointer=self.checkpointer)
        else:
            self._conn = None
            self.checkpointer = None
            self.graph = create_reformat_graph()

    def reformat(
        self,
        source_manual_id: str,
        user_id: str,
        source_format: str,
        target_format: str,
        language: str = "en",
        thread_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Convert a manual to a different document format.

        Args:
            source_manual_id: ID of the manual to convert
            user_id: User identifier
            source_format: Current format (step-manual, quick-guide, reference, summary)
            target_format: Target format to convert to
            language: Language code of the content to convert (default: en)
            thread_id: Optional thread ID for checkpointing

        Returns:
            Dictionary containing:
            - status: "completed" or "error"
            - converted_content: The reformatted markdown content
            - error: Error message if status is "error"
        """
        # Validate formats
        if source_format not in SUPPORTED_FORMATS:
            return {
                "status": "error",
                "error": f"Unknown source format: {source_format}. "
                         f"Supported: {SUPPORTED_FORMATS}"
            }

        if target_format not in SUPPORTED_FORMATS:
            return {
                "status": "error",
                "error": f"Unknown target format: {target_format}. "
                         f"Supported: {SUPPORTED_FORMATS}"
            }

        # Prepare initial state
        initial_state: ReformatState = {
            "source_manual_id": source_manual_id,
            "user_id": user_id,
            "source_format": source_format,
            "target_format": target_format,
            "language": language,
            "source_content": None,
            "converted_content": None,
            "status": "loading",
            "error": None,
        }

        # Run graph
        config = {"configurable": {"thread_id": thread_id or f"{user_id}_{source_manual_id}"}}
        result = self.graph.invoke(initial_state, config=config)

        return result

    def close(self):
        """Close database connection if using checkpointer."""
        if self._conn:
            self._conn.close()


def create_reformat_agent(use_checkpointer: bool = True) -> ReformatAgent:
    """Create a Reformat Agent instance.

    Args:
        use_checkpointer: Whether to enable checkpointing

    Returns:
        ReformatAgent instance
    """
    return ReformatAgent(use_checkpointer=use_checkpointer)


def reformat_manual_content(
    source_manual_id: str,
    user_id: str,
    source_format: str,
    target_format: str,
    language: str = "en",
) -> Dict[str, Any]:
    """Convenience function to reformat manual content.

    Creates a temporary agent, runs the conversion, and returns the result.

    Args:
        source_manual_id: ID of the manual to convert
        user_id: User identifier
        source_format: Current format
        target_format: Target format
        language: Language code (default: en)

    Returns:
        Conversion result dictionary
    """
    agent = create_reformat_agent(use_checkpointer=False)
    try:
        return agent.reformat(
            source_manual_id=source_manual_id,
            user_id=user_id,
            source_format=source_format,
            target_format=target_format,
            language=language,
        )
    finally:
        agent.close()
