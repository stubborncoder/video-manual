"""Guide Agent using deepagents for context-aware assistance."""

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from deepagents import create_deep_agent, FilesystemMiddleware
from deepagents.backends import CompositeBackend, StateBackend, FilesystemBackend
from langgraph.checkpoint.memory import MemorySaver
from langchain.chat_models import init_chat_model

from .tools import create_guide_tools
from .prompts import GUIDE_SYSTEM_PROMPT
from ...core.models import TaskType, get_langchain_model_string, get_model, ModelProvider
from ...db.admin_settings import AdminSettings

# Sandboxed paths for documentation and user memories
PUBLIC_DOCS_ROOT = Path(__file__).parent.parent.parent.parent / "ai_documents" / "public"
USER_MEMORIES_ROOT = Path(__file__).parent.parent.parent.parent / "ai_documents" / "user_memories"


def get_guide_agent(user_id: str, model: Optional[str] = None):
    """Get the guide deep agent with user-specific tools.

    Args:
        user_id: User ID to bind tools to for data access
        model: LLM model to use in format 'provider:model'.
               If not provided, uses configured model from admin settings.

    Returns:
        Ready-to-use deep agent for guiding users
    """
    # Load environment variables
    load_dotenv()

    # Get configured model from admin settings if not provided
    if model is None:
        # Get model ID from admin settings (e.g., 'gemini-2.5-flash')
        model_id = AdminSettings.get_model_for_task(TaskType.GUIDE_ASSISTANT)
        # Convert to LangChain format (e.g., 'google_genai:gemini-2.5-flash')
        model = get_langchain_model_string(model_id)
        print(f"Using model for guide assistant: {model}")

    # Convert string model identifier to BaseChatModel
    if isinstance(model, str):
        # Determine API key based on provider
        model_id = AdminSettings.get_model_for_task(TaskType.GUIDE_ASSISTANT)
        model_info = get_model(model_id)
        if model_info and model_info.provider == ModelProvider.ANTHROPIC:
            api_key = os.getenv("ANTHROPIC_API_KEY")
        else:
            api_key = os.getenv("GOOGLE_API_KEY")
        model = init_chat_model(model, api_key=api_key)

    # Create tools bound to this user
    tools = create_guide_tools(user_id)

    # Use MemorySaver for session-based memory (not persisted)
    checkpointer = MemorySaver()

    # User-specific memories directory
    user_memories_path = USER_MEMORIES_ROOT / user_id
    user_memories_path.mkdir(parents=True, exist_ok=True)

    return create_deep_agent(
        model=model,
        tools=tools,
        system_prompt=GUIDE_SYSTEM_PROMPT,
        checkpointer=checkpointer,
        backend=lambda rt: CompositeBackend(
            default=StateBackend(rt),
            routes={
                "/guides/": FilesystemBackend(str(PUBLIC_DOCS_ROOT), virtual_mode=True),
                "/memories/": FilesystemBackend(str(user_memories_path), virtual_mode=True)
            }
        )
    )
