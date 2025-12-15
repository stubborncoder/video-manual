"""Project Compiler Agent using deepagents."""

from typing import Optional

from dotenv import load_dotenv
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain.chat_models import init_chat_model

from .tools import analyze_project, compile_manuals
from .prompts import COMPILER_INSTRUCTIONS
from ...core.models import TaskType, get_langchain_model_string
from ...db.admin_settings import AdminSettings


def get_compiler_agent(
    model: Optional[str] = None,
):
    """Get the project compiler deep agent with memory checkpointing.

    Args:
        model: LLM model to use in format 'provider:model'.
               If not provided, uses configured model from admin settings.
               Examples: 'anthropic:claude-sonnet-4-5-20250929', 'google:gemini-2.0-flash'

    Returns:
        Ready-to-use deep agent with HITL support
    """
    # Load environment variables
    load_dotenv()

    # Get configured model from admin settings if not provided
    # Uses MANUAL_GENERATION setting since compiling is similar to generating content
    if model is None:
        model_id = AdminSettings.get_model_for_task(TaskType.MANUAL_GENERATION)
        model = get_langchain_model_string(model_id)
        print(f"Using model for project compilation: {model}")

    # Convert string model identifier to BaseChatModel
    # (required for deepagents 0.3.0+ which accesses model.profile)
    if isinstance(model, str):
        model = init_chat_model(model)

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
