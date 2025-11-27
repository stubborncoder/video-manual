"""Project Compiler Agent using deepagents."""

import sqlite3
from typing import Optional

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langgraph.checkpoint.sqlite import SqliteSaver

from .tools import analyze_project, compile_manuals
from .prompts import COMPILER_INSTRUCTIONS
from .config import DEFAULT_DEEPAGENT_MODEL
from ...config import get_checkpoint_db_path


def get_compiler_agent(
    db_path: Optional[str] = None,
    model: Optional[str] = None,
):
    """Get the project compiler deep agent with SQLite persistence.

    Args:
        db_path: Path to SQLite database for checkpointing (required for HITL).
                 If not provided, uses default from global config.
        model: LLM model to use in format 'provider:model'.
               If not provided, uses DEFAULT_DEEPAGENT_MODEL from agent config.
               Examples: 'anthropic:claude-sonnet-4-5-20250929', 'google:gemini-2.0-flash'

    Returns:
        Ready-to-use deep agent with HITL support
    """
    # Load environment variables
    load_dotenv()
    # Get db path from global config if not provided
    if db_path is None:
        db_path = str(get_checkpoint_db_path("compiler"))

    # Get default model from agent config if not provided
    if model is None:
        model = DEFAULT_DEEPAGENT_MODEL

    # Ensure directory exists
    db_dir = get_checkpoint_db_path("compiler").parent
    db_dir.mkdir(parents=True, exist_ok=True)

    # Create SQLite checkpointer for state persistence
    conn = sqlite3.connect(db_path, check_same_thread=False)
    checkpointer = SqliteSaver(conn)

    return create_deep_agent(
        model=model,
        tools=[analyze_project, compile_manuals],
        system_prompt=COMPILER_INSTRUCTIONS,
        checkpointer=checkpointer,
        # HITL: Require human approval before compile_manuals executes
        interrupt_on={
            "compile_manuals": True,
        },
    )
