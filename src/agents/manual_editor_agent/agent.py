"""Manual Editor Agent using deepagents."""

from typing import Optional

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain.chat_models import init_chat_model
from langchain.agents.middleware import ModelFallbackMiddleware

from .tools import EDITOR_TOOLS
from .prompts import EDITOR_SYSTEM_PROMPT
from .config import DEFAULT_EDITOR_MODEL, FALLBACK_MODELS


def get_editor_agent(
    model: Optional[str] = None,
):
    """Get the manual editor deep agent with memory checkpointing.

    Args:
        model: LLM model to use in format 'provider:model'.
               If not provided, uses DEFAULT_EDITOR_MODEL from config.
               Examples: 'anthropic:claude-sonnet-4-5-20250929', 'google:gemini-2.0-flash'

    Returns:
        Ready-to-use deep agent for manual editing
    """
    # Load environment variables
    load_dotenv()

    # Get default model from config if not provided
    if model is None:
        model = DEFAULT_EDITOR_MODEL

    # Convert string model identifier to BaseChatModel
    # (required for deepagents 0.3.0+ which accesses model.profile)
    if isinstance(model, str):
        model = init_chat_model(model)

    # Use MemorySaver for session-based checkpointing
    checkpointer = MemorySaver()

    # Setup fallback middleware for resilience
    fallback_middleware = ModelFallbackMiddleware(*FALLBACK_MODELS)

    return create_deep_agent(
        model=model,
        tools=EDITOR_TOOLS,
        system_prompt=EDITOR_SYSTEM_PROMPT,
        checkpointer=checkpointer,
        middleware=[fallback_middleware],
    )
