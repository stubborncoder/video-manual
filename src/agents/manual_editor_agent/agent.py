"""Manual Editor Agent using deepagents."""

import os
from typing import Optional

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain.chat_models import init_chat_model
from langchain.agents.middleware import ModelFallbackMiddleware

from .tools import EDITOR_TOOLS
from .prompts import EDITOR_SYSTEM_PROMPT
from .config import FALLBACK_MODELS
from ...core.models import TaskType, get_langchain_model_string, get_model, ModelProvider
from ...db.admin_settings import AdminSettings


def get_editor_agent(
    model: Optional[str] = None,
):
    """Get the manual editor deep agent with memory checkpointing.

    Args:
        model: LLM model to use in format 'provider:model'.
               If not provided, uses configured model from admin settings.
               Examples: 'anthropic:claude-sonnet-4-5-20250929', 'google:gemini-2.0-flash'

    Returns:
        Ready-to-use deep agent for manual editing
    """
    # Load environment variables
    load_dotenv()

    # Get configured model from admin settings if not provided
    if model is None:
        # Get model ID from admin settings (e.g., 'claude-sonnet-4-5-20250929')
        model_id = AdminSettings.get_model_for_task(TaskType.MANUAL_EDITING)
        # Convert to LangChain format (e.g., 'anthropic:claude-sonnet-4-5-20250929')
        model = get_langchain_model_string(model_id)
        print(f"Using model for manual editing: {model}")

    # Convert string model identifier to BaseChatModel
    # (required for deepagents 0.3.0+ which accesses model.profile)
    if isinstance(model, str):
        # Determine API key based on provider
        model_id = AdminSettings.get_model_for_task(TaskType.MANUAL_EDITING)
        model_info = get_model(model_id)
        if model_info and model_info.provider == ModelProvider.ANTHROPIC:
            api_key = os.getenv("ANTHROPIC_API_KEY")
        else:
            api_key = os.getenv("GOOGLE_API_KEY")
        model = init_chat_model(model, api_key=api_key)

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
