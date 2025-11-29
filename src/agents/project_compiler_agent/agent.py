"""Project Compiler Agent using deepagents."""

from typing import Optional

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

from .tools import analyze_project, compile_manuals
from .prompts import COMPILER_INSTRUCTIONS
from .config import DEFAULT_DEEPAGENT_MODEL


def get_compiler_agent(
    model: Optional[str] = None,
):
    """Get the project compiler deep agent with memory checkpointing.

    Args:
        model: LLM model to use in format 'provider:model'.
               If not provided, uses DEFAULT_DEEPAGENT_MODEL from agent config.
               Examples: 'anthropic:claude-sonnet-4-5-20250929', 'google:gemini-2.0-flash'

    Returns:
        Ready-to-use deep agent with HITL support
    """
    # Load environment variables
    load_dotenv()

    # Get default model from agent config if not provided
    if model is None:
        model = DEFAULT_DEEPAGENT_MODEL

    # Use MemorySaver for session-based checkpointing
    checkpointer = MemorySaver()

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
