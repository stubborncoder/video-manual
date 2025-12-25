"""Tests for src/core/models.py - LLM model registry, pricing, and capabilities."""

import os
from unittest.mock import patch

import pytest

from src.core.models import (
    ModelProvider,
    TaskType,
    ModelInfo,
    MODEL_REGISTRY,
    MODELS_BY_TASK,
    DEFAULT_MODELS,
    GEMINI_2_5_PRO,
    GEMINI_2_5_FLASH,
    GEMINI_3_PRO_PREVIEW,
    GEMINI_3_FLASH,
    CLAUDE_OPUS_4_5,
    CLAUDE_SONNET_4_5,
    CLAUDE_HAIKU_4_5,
    get_model,
    get_models_for_task,
    get_default_model,
    calculate_cost,
    is_valid_model_for_task,
    get_langchain_model_string,
    validate_api_key_for_model,
    get_api_key_status,
)


class TestModelProvider:
    """Tests for ModelProvider enum."""

    def test_model_provider_google(self):
        """Test Google provider value."""
        assert ModelProvider.GOOGLE.value == "google"

    def test_model_provider_anthropic(self):
        """Test Anthropic provider value."""
        assert ModelProvider.ANTHROPIC.value == "anthropic"

    def test_model_provider_is_string_enum(self):
        """Test that ModelProvider is a string enum."""
        assert isinstance(ModelProvider.GOOGLE, str)
        assert isinstance(ModelProvider.ANTHROPIC, str)


class TestTaskType:
    """Tests for TaskType enum."""

    def test_task_type_video_analysis(self):
        """Test VIDEO_ANALYSIS task type."""
        assert TaskType.VIDEO_ANALYSIS.value == "video_analysis"

    def test_task_type_manual_generation(self):
        """Test MANUAL_GENERATION task type."""
        assert TaskType.MANUAL_GENERATION.value == "manual_generation"

    def test_task_type_manual_evaluation(self):
        """Test MANUAL_EVALUATION task type."""
        assert TaskType.MANUAL_EVALUATION.value == "manual_evaluation"

    def test_task_type_manual_editing(self):
        """Test MANUAL_EDITING task type."""
        assert TaskType.MANUAL_EDITING.value == "manual_editing"

    def test_task_type_guide_assistant(self):
        """Test GUIDE_ASSISTANT task type."""
        assert TaskType.GUIDE_ASSISTANT.value == "guide_assistant"


class TestModelInfo:
    """Tests for ModelInfo dataclass."""

    def test_model_info_creation(self):
        """Test creating a ModelInfo instance."""
        model = ModelInfo(
            id="test-model",
            name="Test Model",
            provider=ModelProvider.GOOGLE,
            input_cost_per_million=1.0,
            output_cost_per_million=2.0,
        )
        assert model.id == "test-model"
        assert model.name == "Test Model"
        assert model.provider == ModelProvider.GOOGLE
        assert model.input_cost_per_million == 1.0
        assert model.output_cost_per_million == 2.0

    def test_model_info_defaults(self):
        """Test ModelInfo default values."""
        model = ModelInfo(
            id="test-model",
            name="Test Model",
            provider=ModelProvider.GOOGLE,
            input_cost_per_million=1.0,
            output_cost_per_million=2.0,
        )
        assert model.supports_video is False
        assert model.supports_vision is False
        assert model.description is None

    def test_model_info_with_capabilities(self):
        """Test ModelInfo with all capabilities set."""
        model = ModelInfo(
            id="test-model",
            name="Test Model",
            provider=ModelProvider.GOOGLE,
            input_cost_per_million=1.0,
            output_cost_per_million=2.0,
            supports_video=True,
            supports_vision=True,
            description="A test model",
        )
        assert model.supports_video is True
        assert model.supports_vision is True
        assert model.description == "A test model"

    def test_input_cost_per_token(self):
        """Test input_cost_per_token property."""
        model = ModelInfo(
            id="test-model",
            name="Test Model",
            provider=ModelProvider.GOOGLE,
            input_cost_per_million=2.0,
            output_cost_per_million=4.0,
        )
        expected = 2.0 / 1_000_000
        assert model.input_cost_per_token == expected

    def test_output_cost_per_token(self):
        """Test output_cost_per_token property."""
        model = ModelInfo(
            id="test-model",
            name="Test Model",
            provider=ModelProvider.GOOGLE,
            input_cost_per_million=2.0,
            output_cost_per_million=4.0,
        )
        expected = 4.0 / 1_000_000
        assert model.output_cost_per_token == expected


class TestLLMPricingModels:
    """Tests for LLM pricing in model definitions."""

    def test_gemini_2_5_pro_pricing(self):
        """Test Gemini 2.5 Pro pricing."""
        assert GEMINI_2_5_PRO.input_cost_per_million == 1.25
        assert GEMINI_2_5_PRO.output_cost_per_million == 10.00

    def test_gemini_2_5_flash_pricing(self):
        """Test Gemini 2.5 Flash pricing."""
        assert GEMINI_2_5_FLASH.input_cost_per_million == 0.30
        assert GEMINI_2_5_FLASH.output_cost_per_million == 2.50

    def test_gemini_3_pro_preview_pricing(self):
        """Test Gemini 3 Pro Preview pricing."""
        assert GEMINI_3_PRO_PREVIEW.input_cost_per_million == 2.00
        assert GEMINI_3_PRO_PREVIEW.output_cost_per_million == 12.00

    def test_gemini_3_flash_pricing(self):
        """Test Gemini 3 Flash pricing."""
        assert GEMINI_3_FLASH.input_cost_per_million == 0.50
        assert GEMINI_3_FLASH.output_cost_per_million == 3.00

    def test_claude_opus_pricing(self):
        """Test Claude Opus 4.5 pricing."""
        assert CLAUDE_OPUS_4_5.input_cost_per_million == 5.00
        assert CLAUDE_OPUS_4_5.output_cost_per_million == 25.00

    def test_claude_sonnet_pricing(self):
        """Test Claude Sonnet 4.5 pricing."""
        assert CLAUDE_SONNET_4_5.input_cost_per_million == 3.00
        assert CLAUDE_SONNET_4_5.output_cost_per_million == 15.00

    def test_claude_haiku_pricing(self):
        """Test Claude Haiku 4.5 pricing."""
        assert CLAUDE_HAIKU_4_5.input_cost_per_million == 1.00
        assert CLAUDE_HAIKU_4_5.output_cost_per_million == 5.00


class TestModelCapabilities:
    """Tests for model capability flags."""

    def test_gemini_models_support_video(self):
        """Test that Gemini models support video."""
        assert GEMINI_2_5_PRO.supports_video is True
        assert GEMINI_2_5_FLASH.supports_video is True
        assert GEMINI_3_PRO_PREVIEW.supports_video is True
        assert GEMINI_3_FLASH.supports_video is True

    def test_gemini_models_support_vision(self):
        """Test that Gemini models support vision."""
        assert GEMINI_2_5_PRO.supports_vision is True
        assert GEMINI_2_5_FLASH.supports_vision is True
        assert GEMINI_3_PRO_PREVIEW.supports_vision is True
        assert GEMINI_3_FLASH.supports_vision is True

    def test_claude_models_no_video(self):
        """Test that Claude models do not support video."""
        assert CLAUDE_OPUS_4_5.supports_video is False
        assert CLAUDE_SONNET_4_5.supports_video is False
        assert CLAUDE_HAIKU_4_5.supports_video is False

    def test_claude_models_support_vision(self):
        """Test that Claude models support vision."""
        assert CLAUDE_OPUS_4_5.supports_vision is True
        assert CLAUDE_SONNET_4_5.supports_vision is True
        assert CLAUDE_HAIKU_4_5.supports_vision is True

    def test_gemini_models_are_google_provider(self):
        """Test that Gemini models have Google provider."""
        assert GEMINI_2_5_PRO.provider == ModelProvider.GOOGLE
        assert GEMINI_2_5_FLASH.provider == ModelProvider.GOOGLE
        assert GEMINI_3_PRO_PREVIEW.provider == ModelProvider.GOOGLE
        assert GEMINI_3_FLASH.provider == ModelProvider.GOOGLE

    def test_claude_models_are_anthropic_provider(self):
        """Test that Claude models have Anthropic provider."""
        assert CLAUDE_OPUS_4_5.provider == ModelProvider.ANTHROPIC
        assert CLAUDE_SONNET_4_5.provider == ModelProvider.ANTHROPIC
        assert CLAUDE_HAIKU_4_5.provider == ModelProvider.ANTHROPIC


class TestCostCalculation:
    """Tests for calculate_cost function."""

    def test_calculate_cost_basic(self):
        """Test basic cost calculation."""
        # Using Gemini 2.5 Pro: $1.25/M input, $10.00/M output
        cost = calculate_cost(
            GEMINI_2_5_PRO.id,
            input_tokens=1_000_000,
            output_tokens=1_000_000,
        )
        expected = 1.25 + 10.00
        assert cost == expected

    def test_calculate_cost_zero_tokens(self):
        """Test cost with zero tokens."""
        cost = calculate_cost(GEMINI_2_5_PRO.id, input_tokens=0, output_tokens=0)
        assert cost == 0.0

    def test_calculate_cost_only_input(self):
        """Test cost with only input tokens."""
        cost = calculate_cost(
            GEMINI_2_5_PRO.id,
            input_tokens=1_000_000,
            output_tokens=0,
        )
        assert cost == 1.25

    def test_calculate_cost_only_output(self):
        """Test cost with only output tokens."""
        cost = calculate_cost(
            GEMINI_2_5_PRO.id,
            input_tokens=0,
            output_tokens=1_000_000,
        )
        assert cost == 10.00

    def test_calculate_cost_invalid_model(self):
        """Test cost calculation with invalid model returns 0."""
        cost = calculate_cost(
            "invalid-model-id",
            input_tokens=1_000,
            output_tokens=1_000,
        )
        assert cost == 0.0

    def test_calculate_cost_small_tokens(self):
        """Test cost calculation with small token counts."""
        # 1000 input tokens at $2/M = $0.002
        # 500 output tokens at $4/M = $0.002
        model = ModelInfo(
            id="test-model",
            name="Test",
            provider=ModelProvider.GOOGLE,
            input_cost_per_million=2.0,
            output_cost_per_million=4.0,
        )
        with patch.dict(MODEL_REGISTRY, {"test-model": model}):
            cost = calculate_cost("test-model", input_tokens=1000, output_tokens=500)
            expected = (1000 * 2.0 / 1_000_000) + (500 * 4.0 / 1_000_000)
            assert abs(cost - expected) < 1e-10

    def test_calculate_cost_claude_model(self):
        """Test cost calculation for Claude model."""
        # Claude Sonnet: $3/M input, $15/M output
        cost = calculate_cost(
            CLAUDE_SONNET_4_5.id,
            input_tokens=1_000_000,
            output_tokens=1_000_000,
        )
        expected = 3.00 + 15.00
        assert cost == expected


class TestModelRegistry:
    """Tests for MODEL_REGISTRY."""

    def test_registry_contains_all_gemini_models(self):
        """Test that registry contains all Gemini models."""
        assert GEMINI_2_5_PRO.id in MODEL_REGISTRY
        assert GEMINI_2_5_FLASH.id in MODEL_REGISTRY
        assert GEMINI_3_PRO_PREVIEW.id in MODEL_REGISTRY
        assert GEMINI_3_FLASH.id in MODEL_REGISTRY

    def test_registry_contains_all_claude_models(self):
        """Test that registry contains all Claude models."""
        assert CLAUDE_OPUS_4_5.id in MODEL_REGISTRY
        assert CLAUDE_SONNET_4_5.id in MODEL_REGISTRY
        assert CLAUDE_HAIKU_4_5.id in MODEL_REGISTRY

    def test_get_model_valid(self):
        """Test get_model with valid ID."""
        model = get_model(GEMINI_2_5_PRO.id)
        assert model is not None
        assert model.id == GEMINI_2_5_PRO.id

    def test_get_model_invalid(self):
        """Test get_model with invalid ID."""
        model = get_model("nonexistent-model")
        assert model is None


class TestModelsForTask:
    """Tests for get_models_for_task function."""

    def test_video_analysis_only_gemini(self):
        """Test that video analysis only includes Gemini models."""
        models = get_models_for_task(TaskType.VIDEO_ANALYSIS)
        for model in models:
            assert model.provider == ModelProvider.GOOGLE
            assert model.supports_video is True

    def test_video_analysis_excludes_claude(self):
        """Test that video analysis excludes Claude models."""
        model_ids = MODELS_BY_TASK[TaskType.VIDEO_ANALYSIS]
        assert CLAUDE_OPUS_4_5.id not in model_ids
        assert CLAUDE_SONNET_4_5.id not in model_ids
        assert CLAUDE_HAIKU_4_5.id not in model_ids

    def test_manual_generation_includes_all(self):
        """Test that manual generation includes both providers."""
        models = get_models_for_task(TaskType.MANUAL_GENERATION)
        providers = {model.provider for model in models}
        assert ModelProvider.GOOGLE in providers
        assert ModelProvider.ANTHROPIC in providers

    def test_manual_evaluation_includes_all(self):
        """Test that manual evaluation includes both providers."""
        models = get_models_for_task(TaskType.MANUAL_EVALUATION)
        providers = {model.provider for model in models}
        assert ModelProvider.GOOGLE in providers
        assert ModelProvider.ANTHROPIC in providers

    def test_guide_assistant_includes_all(self):
        """Test that guide assistant includes both providers."""
        models = get_models_for_task(TaskType.GUIDE_ASSISTANT)
        providers = {model.provider for model in models}
        assert ModelProvider.GOOGLE in providers
        assert ModelProvider.ANTHROPIC in providers

    def test_all_tasks_have_models(self):
        """Test that all task types have at least one model."""
        for task in TaskType:
            models = get_models_for_task(task)
            assert len(models) > 0, f"No models for task: {task}"


class TestDefaultModels:
    """Tests for default model selection."""

    def test_default_model_for_video_analysis(self):
        """Test default model for video analysis."""
        model = get_default_model(TaskType.VIDEO_ANALYSIS)
        assert model is not None
        assert model.supports_video is True

    def test_default_model_for_manual_generation(self):
        """Test default model for manual generation."""
        model = get_default_model(TaskType.MANUAL_GENERATION)
        assert model is not None

    def test_default_model_for_manual_editing(self):
        """Test default model for manual editing."""
        model = get_default_model(TaskType.MANUAL_EDITING)
        assert model is not None

    def test_all_tasks_have_default(self):
        """Test that all task types have a default model."""
        for task in TaskType:
            model = get_default_model(task)
            assert model is not None, f"No default model for task: {task}"

    def test_default_models_dict_complete(self):
        """Test that DEFAULT_MODELS covers all task types."""
        for task in TaskType:
            assert task in DEFAULT_MODELS, f"Missing default for: {task}"


class TestIsValidModelForTask:
    """Tests for is_valid_model_for_task function."""

    def test_gemini_valid_for_video_analysis(self):
        """Test that Gemini models are valid for video analysis."""
        assert is_valid_model_for_task(GEMINI_2_5_PRO.id, TaskType.VIDEO_ANALYSIS) is True
        assert is_valid_model_for_task(GEMINI_2_5_FLASH.id, TaskType.VIDEO_ANALYSIS) is True

    def test_claude_invalid_for_video_analysis(self):
        """Test that Claude models are invalid for video analysis."""
        assert is_valid_model_for_task(CLAUDE_OPUS_4_5.id, TaskType.VIDEO_ANALYSIS) is False
        assert is_valid_model_for_task(CLAUDE_SONNET_4_5.id, TaskType.VIDEO_ANALYSIS) is False

    def test_all_models_valid_for_text_tasks(self):
        """Test that all models are valid for text-based tasks."""
        text_tasks = [TaskType.MANUAL_GENERATION, TaskType.MANUAL_EVALUATION]
        for task in text_tasks:
            for model_id in MODEL_REGISTRY.keys():
                # All models should be valid for text tasks
                assert is_valid_model_for_task(model_id, task) is True

    def test_invalid_model_invalid_for_all_tasks(self):
        """Test that invalid model ID is invalid for all tasks."""
        for task in TaskType:
            assert is_valid_model_for_task("nonexistent", task) is False


class TestLangchainModelString:
    """Tests for get_langchain_model_string function."""

    def test_google_model_format(self):
        """Test LangChain format for Google models."""
        result = get_langchain_model_string(GEMINI_2_5_PRO.id)
        assert result.startswith("google_genai:")
        assert GEMINI_2_5_PRO.id in result

    def test_anthropic_model_format(self):
        """Test LangChain format for Anthropic models."""
        result = get_langchain_model_string(CLAUDE_SONNET_4_5.id)
        assert result.startswith("anthropic:")
        assert CLAUDE_SONNET_4_5.id in result

    def test_unknown_model_passthrough(self):
        """Test that unknown model ID is returned as-is."""
        result = get_langchain_model_string("unknown-model")
        assert result == "unknown-model"


class TestApiKeyValidation:
    """Tests for API key validation functions."""

    def test_validate_google_key_missing(self):
        """Test validation when Google API key is missing."""
        with patch.dict(os.environ, {}, clear=True):
            # Remove the key if present
            os.environ.pop("GOOGLE_API_KEY", None)
            is_valid, error = validate_api_key_for_model(GEMINI_2_5_PRO.id)
            assert is_valid is False
            assert "GOOGLE_API_KEY" in error

    def test_validate_google_key_present(self):
        """Test validation when Google API key is present."""
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}):
            is_valid, error = validate_api_key_for_model(GEMINI_2_5_PRO.id)
            assert is_valid is True
            assert error is None

    def test_validate_anthropic_key_missing(self):
        """Test validation when Anthropic API key is missing."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("ANTHROPIC_API_KEY", None)
            is_valid, error = validate_api_key_for_model(CLAUDE_SONNET_4_5.id)
            assert is_valid is False
            assert "ANTHROPIC_API_KEY" in error

    def test_validate_anthropic_key_present(self):
        """Test validation when Anthropic API key is present."""
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-key"}):
            is_valid, error = validate_api_key_for_model(CLAUDE_SONNET_4_5.id)
            assert is_valid is True
            assert error is None

    def test_validate_unknown_model(self):
        """Test validation with unknown model."""
        is_valid, error = validate_api_key_for_model("unknown-model")
        assert is_valid is False
        assert "Unknown model" in error

    def test_get_api_key_status_both_missing(self):
        """Test API key status when both are missing."""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("GOOGLE_API_KEY", None)
            os.environ.pop("ANTHROPIC_API_KEY", None)
            status = get_api_key_status()
            assert status["google"] is False
            assert status["anthropic"] is False

    def test_get_api_key_status_both_present(self):
        """Test API key status when both are present."""
        with patch.dict(os.environ, {
            "GOOGLE_API_KEY": "test-google",
            "ANTHROPIC_API_KEY": "test-anthropic",
        }):
            status = get_api_key_status()
            assert status["google"] is True
            assert status["anthropic"] is True

    def test_get_api_key_status_only_google(self):
        """Test API key status when only Google key is present."""
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-google"}, clear=True):
            os.environ.pop("ANTHROPIC_API_KEY", None)
            status = get_api_key_status()
            assert status["google"] is True
            assert status["anthropic"] is False


class TestModelDescriptions:
    """Tests for model description fields."""

    def test_all_models_have_descriptions(self):
        """Test that all models have descriptions."""
        for model_id, model in MODEL_REGISTRY.items():
            assert model.description is not None, f"Model {model_id} missing description"
            assert len(model.description) > 0, f"Model {model_id} has empty description"

    def test_all_models_have_names(self):
        """Test that all models have display names."""
        for model_id, model in MODEL_REGISTRY.items():
            assert model.name is not None, f"Model {model_id} missing name"
            assert len(model.name) > 0, f"Model {model_id} has empty name"

    def test_model_ids_are_unique(self):
        """Test that all model IDs are unique."""
        ids = list(MODEL_REGISTRY.keys())
        assert len(ids) == len(set(ids)), "Duplicate model IDs found"
