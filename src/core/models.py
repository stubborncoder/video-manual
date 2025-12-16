"""LLM Model Registry with pricing and capabilities.

This module defines the available models for different tasks
and their associated costs for tracking and admin configuration.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ModelProvider(str, Enum):
    """Supported model providers."""
    GOOGLE = "google"
    ANTHROPIC = "anthropic"


class TaskType(str, Enum):
    """Types of tasks that use LLMs."""
    VIDEO_ANALYSIS = "video_analysis"
    MANUAL_GENERATION = "manual_generation"
    MANUAL_EVALUATION = "manual_evaluation"
    MANUAL_EDITING = "manual_editing"
    GUIDE_ASSISTANT = "guide_assistant"


@dataclass
class ModelInfo:
    """Information about an LLM model."""
    id: str  # Full model ID for API calls
    name: str  # Display name
    provider: ModelProvider
    input_cost_per_million: float  # Cost per 1M input tokens
    output_cost_per_million: float  # Cost per 1M output tokens
    supports_video: bool = False  # Can process video directly
    supports_vision: bool = False  # Can process images
    description: Optional[str] = None

    @property
    def input_cost_per_token(self) -> float:
        """Cost per single input token."""
        return self.input_cost_per_million / 1_000_000

    @property
    def output_cost_per_token(self) -> float:
        """Cost per single output token."""
        return self.output_cost_per_million / 1_000_000


# ============================================
# MODEL DEFINITIONS
# ============================================

# Google Gemini Models
GEMINI_3_PRO_PREVIEW = ModelInfo(
    id="gemini-3-pro-preview",
    name="Gemini 3 Pro Preview",
    provider=ModelProvider.GOOGLE,
    input_cost_per_million=2.00,
    output_cost_per_million=12.00,
    supports_video=True,
    supports_vision=True,
    description="Latest Gemini model with advanced reasoning",
)

GEMINI_2_5_PRO = ModelInfo(
    id="gemini-2.5-pro",
    name="Gemini 2.5 Pro",
    provider=ModelProvider.GOOGLE,
    input_cost_per_million=1.25,
    output_cost_per_million=10.00,
    supports_video=True,
    supports_vision=True,
    description="Production-ready Gemini model",
)

GEMINI_2_5_FLASH = ModelInfo(
    id="gemini-2.5-flash",
    name="Gemini 2.5 Flash",
    provider=ModelProvider.GOOGLE,
    input_cost_per_million=0.30,
    output_cost_per_million=2.50,
    supports_video=True,
    supports_vision=True,
    description="Fast and cost-effective Gemini model",
)

# Anthropic Claude Models
CLAUDE_OPUS_4_5 = ModelInfo(
    id="claude-opus-4-5-20251101",
    name="Claude Opus 4.5",
    provider=ModelProvider.ANTHROPIC,
    input_cost_per_million=5.00,
    output_cost_per_million=25.00,
    supports_video=False,
    supports_vision=True,
    description="Most capable Claude model",
)

CLAUDE_SONNET_4_5 = ModelInfo(
    id="claude-sonnet-4-5-20250929",
    name="Claude Sonnet 4.5",
    provider=ModelProvider.ANTHROPIC,
    input_cost_per_million=3.00,
    output_cost_per_million=15.00,
    supports_video=False,
    supports_vision=True,
    description="Balanced performance and cost",
)

CLAUDE_HAIKU_4_5 = ModelInfo(
    id="claude-haiku-4-5-20251001",
    name="Claude Haiku 4.5",
    provider=ModelProvider.ANTHROPIC,
    input_cost_per_million=1.00,
    output_cost_per_million=5.00,
    supports_video=False,
    supports_vision=True,
    description="Fast and affordable Claude model",
)


# ============================================
# MODEL REGISTRY
# ============================================

# All available models indexed by ID
MODEL_REGISTRY: dict[str, ModelInfo] = {
    model.id: model for model in [
        GEMINI_3_PRO_PREVIEW,
        GEMINI_2_5_PRO,
        GEMINI_2_5_FLASH,
        CLAUDE_OPUS_4_5,
        CLAUDE_SONNET_4_5,
        CLAUDE_HAIKU_4_5,
    ]
}

# Models available for each task type
MODELS_BY_TASK: dict[TaskType, list[str]] = {
    # Video analysis requires video processing capability (Gemini only)
    TaskType.VIDEO_ANALYSIS: [
        GEMINI_3_PRO_PREVIEW.id,
        GEMINI_2_5_PRO.id,
        GEMINI_2_5_FLASH.id,
    ],
    # Manual generation works with any model (text-based)
    TaskType.MANUAL_GENERATION: [
        GEMINI_3_PRO_PREVIEW.id,
        GEMINI_2_5_PRO.id,
        GEMINI_2_5_FLASH.id,
        CLAUDE_OPUS_4_5.id,
        CLAUDE_SONNET_4_5.id,
        CLAUDE_HAIKU_4_5.id,
    ],
    # Manual evaluation works with any model (text-based)
    TaskType.MANUAL_EVALUATION: [
        GEMINI_3_PRO_PREVIEW.id,
        GEMINI_2_5_PRO.id,
        GEMINI_2_5_FLASH.id,
        CLAUDE_OPUS_4_5.id,
        CLAUDE_SONNET_4_5.id,
        CLAUDE_HAIKU_4_5.id,
    ],
    # Manual editing (copilot) - currently uses Claude
    TaskType.MANUAL_EDITING: [
        CLAUDE_OPUS_4_5.id,
        CLAUDE_SONNET_4_5.id,
        CLAUDE_HAIKU_4_5.id,
        GEMINI_3_PRO_PREVIEW.id,
        GEMINI_2_5_PRO.id,
        GEMINI_2_5_FLASH.id,
    ],
    # Guide assistant - fast model for interactive help
    TaskType.GUIDE_ASSISTANT: [
        GEMINI_2_5_FLASH.id,
        GEMINI_2_5_PRO.id,
        GEMINI_3_PRO_PREVIEW.id,
        CLAUDE_HAIKU_4_5.id,
        CLAUDE_SONNET_4_5.id,
        CLAUDE_OPUS_4_5.id,
    ],
}

# Default models for each task
DEFAULT_MODELS: dict[TaskType, str] = {
    TaskType.VIDEO_ANALYSIS: GEMINI_2_5_PRO.id,
    TaskType.MANUAL_GENERATION: GEMINI_2_5_PRO.id,
    TaskType.MANUAL_EVALUATION: GEMINI_2_5_FLASH.id,
    TaskType.MANUAL_EDITING: CLAUDE_SONNET_4_5.id,
    TaskType.GUIDE_ASSISTANT: GEMINI_2_5_FLASH.id,
}


def get_model(model_id: str) -> Optional[ModelInfo]:
    """Get model info by ID.

    Args:
        model_id: The model identifier

    Returns:
        ModelInfo if found, None otherwise
    """
    return MODEL_REGISTRY.get(model_id)


def get_models_for_task(task: TaskType) -> list[ModelInfo]:
    """Get all available models for a task type.

    Args:
        task: The task type

    Returns:
        List of ModelInfo for available models
    """
    model_ids = MODELS_BY_TASK.get(task, [])
    return [MODEL_REGISTRY[mid] for mid in model_ids if mid in MODEL_REGISTRY]


def get_default_model(task: TaskType) -> ModelInfo:
    """Get the default model for a task type.

    Args:
        task: The task type

    Returns:
        ModelInfo for the default model
    """
    model_id = DEFAULT_MODELS.get(task)
    if model_id and model_id in MODEL_REGISTRY:
        return MODEL_REGISTRY[model_id]
    # Fallback to first available model for the task
    models = get_models_for_task(task)
    return models[0] if models else GEMINI_2_5_PRO


def calculate_cost(
    model_id: str,
    input_tokens: int,
    output_tokens: int
) -> float:
    """Calculate the cost for a request.

    Args:
        model_id: The model identifier
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Cost in USD
    """
    model = get_model(model_id)
    if not model:
        return 0.0

    input_cost = input_tokens * model.input_cost_per_token
    output_cost = output_tokens * model.output_cost_per_token
    return input_cost + output_cost


def is_valid_model_for_task(model_id: str, task: TaskType) -> bool:
    """Check if a model is valid for a specific task.

    Args:
        model_id: The model identifier
        task: The task type

    Returns:
        True if model can be used for the task
    """
    return model_id in MODELS_BY_TASK.get(task, [])


def get_langchain_model_string(model_id: str) -> str:
    """Get the LangChain model string (provider:model format).

    This format is required by init_chat_model and deepagents.

    Args:
        model_id: The model identifier (e.g., 'claude-sonnet-4-5-20250929')

    Returns:
        Provider-prefixed model string (e.g., 'anthropic:claude-sonnet-4-5-20250929')
    """
    model = get_model(model_id)
    if not model:
        # Fallback: if model not found, assume it's already in provider:model format
        return model_id

    provider_prefix = {
        ModelProvider.ANTHROPIC: "anthropic",
        ModelProvider.GOOGLE: "google_genai",
    }

    prefix = provider_prefix.get(model.provider, "")
    return f"{prefix}:{model_id}" if prefix else model_id


def validate_api_key_for_model(model_id: str) -> tuple[bool, Optional[str]]:
    """Check if the required API key is configured for a model.

    Args:
        model_id: The model identifier

    Returns:
        Tuple of (is_valid, error_message)
        - (True, None) if API key is configured
        - (False, error_message) if API key is missing
    """
    import os

    model = get_model(model_id)
    if not model:
        return False, f"Unknown model: {model_id}"

    if model.provider == ModelProvider.ANTHROPIC:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return False, "ANTHROPIC_API_KEY environment variable is not set"
    elif model.provider == ModelProvider.GOOGLE:
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            return False, "GOOGLE_API_KEY environment variable is not set"

    return True, None


def get_api_key_status() -> dict[str, bool]:
    """Get the status of all required API keys.

    Returns:
        Dict mapping provider name to whether the API key is configured
    """
    import os

    return {
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
        "google": bool(os.getenv("GOOGLE_API_KEY")),
    }
