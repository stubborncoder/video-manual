"""Tests for src/core/constants.py - Language and configuration constants."""

import pytest

from src.core.constants import (
    SUPPORTED_LANGUAGES,
    DEFAULT_OUTPUT_LANGUAGE,
    MAX_TARGET_AUDIENCE_LENGTH,
    MAX_TARGET_OBJECTIVE_LENGTH,
    DEFAULT_EVALUATION_MODEL,
    EVALUATION_SCORE_MIN,
    EVALUATION_SCORE_MAX,
    LLM_TIMEOUT_SECONDS,
    LLM_VIDEO_TIMEOUT_SECONDS,
    get_language_code,
    is_valid_language,
    normalize_language_to_code,
)


class TestSupportedLanguages:
    """Tests for SUPPORTED_LANGUAGES dictionary."""

    def test_supported_languages_is_dict(self):
        """Test that SUPPORTED_LANGUAGES is a dictionary."""
        assert isinstance(SUPPORTED_LANGUAGES, dict)

    def test_supported_languages_not_empty(self):
        """Test that SUPPORTED_LANGUAGES contains languages."""
        assert len(SUPPORTED_LANGUAGES) > 0

    def test_supported_languages_has_common_languages(self):
        """Test that common languages are included."""
        expected_codes = ["en", "es", "fr", "de", "it", "pt", "ja", "ko", "zh"]
        for code in expected_codes:
            assert code in SUPPORTED_LANGUAGES, f"Missing language code: {code}"

    def test_supported_languages_codes_are_lowercase(self):
        """Test that all language codes are lowercase."""
        for code in SUPPORTED_LANGUAGES.keys():
            assert code == code.lower(), f"Language code not lowercase: {code}"

    def test_supported_languages_codes_are_two_chars(self):
        """Test that all language codes are 2 characters (ISO 639-1)."""
        for code in SUPPORTED_LANGUAGES.keys():
            assert len(code) == 2, f"Language code not 2 chars: {code}"

    def test_supported_languages_names_are_strings(self):
        """Test that all language names are strings."""
        for name in SUPPORTED_LANGUAGES.values():
            assert isinstance(name, str)
            assert len(name) > 0

    def test_english_is_default(self):
        """Test that English is the default language."""
        assert SUPPORTED_LANGUAGES.get("en") == "English"
        assert DEFAULT_OUTPUT_LANGUAGE == "English"


class TestNormalizeLanguageToCode:
    """Tests for normalize_language_to_code function."""

    def test_normalize_language_english(self):
        """Test normalizing 'English' to 'en'."""
        assert normalize_language_to_code("English") == "en"
        assert normalize_language_to_code("en") == "en"

    def test_normalize_language_spanish(self):
        """Test normalizing 'Spanish' to 'es'."""
        assert normalize_language_to_code("Spanish") == "es"
        assert normalize_language_to_code("es") == "es"

    def test_normalize_language_case_insensitive(self):
        """Test that normalization is case insensitive."""
        assert normalize_language_to_code("ENGLISH") == "en"
        assert normalize_language_to_code("english") == "en"
        assert normalize_language_to_code("English") == "en"
        assert normalize_language_to_code("EN") == "en"

    def test_normalize_language_french(self):
        """Test normalizing French."""
        assert normalize_language_to_code("French") == "fr"
        assert normalize_language_to_code("fr") == "fr"

    def test_normalize_language_german(self):
        """Test normalizing German."""
        assert normalize_language_to_code("German") == "de"
        assert normalize_language_to_code("de") == "de"

    def test_normalize_language_japanese(self):
        """Test normalizing Japanese."""
        assert normalize_language_to_code("Japanese") == "ja"
        assert normalize_language_to_code("ja") == "ja"

    def test_normalize_language_chinese(self):
        """Test normalizing Chinese."""
        assert normalize_language_to_code("Chinese") == "zh"
        assert normalize_language_to_code("zh") == "zh"

    def test_normalize_language_invalid_raises_error(self):
        """Test that invalid language raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            normalize_language_to_code("invalid_lang")
        assert "Unsupported language" in str(exc_info.value)
        assert "invalid_lang" in str(exc_info.value)

    def test_normalize_language_empty_raises_error(self):
        """Test that empty string raises ValueError."""
        with pytest.raises(ValueError):
            normalize_language_to_code("")

    def test_normalize_language_gibberish_raises_error(self):
        """Test that gibberish raises ValueError."""
        with pytest.raises(ValueError):
            normalize_language_to_code("xyz123")


class TestLanguageCodeValidation:
    """Tests for is_valid_language function."""

    def test_valid_language_code(self):
        """Test that valid language codes return True."""
        assert is_valid_language("en") is True
        assert is_valid_language("es") is True
        assert is_valid_language("fr") is True
        assert is_valid_language("de") is True

    def test_valid_language_name(self):
        """Test that valid language names return True."""
        assert is_valid_language("English") is True
        assert is_valid_language("Spanish") is True
        assert is_valid_language("French") is True
        assert is_valid_language("German") is True

    def test_valid_language_case_insensitive(self):
        """Test that validation is case insensitive."""
        assert is_valid_language("EN") is True
        assert is_valid_language("ENGLISH") is True
        assert is_valid_language("english") is True

    def test_invalid_language_code(self):
        """Test that invalid language codes return False."""
        assert is_valid_language("xx") is False
        assert is_valid_language("invalid") is False
        assert is_valid_language("") is False

    def test_invalid_language_name(self):
        """Test that invalid language names return False."""
        assert is_valid_language("Klingon") is False
        assert is_valid_language("Elvish") is False


class TestGetLanguageCode:
    """Tests for get_language_code function."""

    def test_get_language_code_from_name(self):
        """Test getting code from language name."""
        assert get_language_code("English") == "en"
        assert get_language_code("Spanish") == "es"
        assert get_language_code("French") == "fr"

    def test_get_language_code_case_insensitive(self):
        """Test that get_language_code is case insensitive."""
        assert get_language_code("ENGLISH") == "en"
        assert get_language_code("english") == "en"

    def test_get_language_code_passthrough(self):
        """Test that valid codes pass through."""
        assert get_language_code("en") == "en"
        assert get_language_code("es") == "es"

    def test_get_language_code_fallback_to_english(self):
        """Test that invalid language falls back to 'en'."""
        assert get_language_code("invalid") == "en"
        assert get_language_code("xyz") == "en"


class TestDocumentFormatConstants:
    """Tests for document format related constants."""

    def test_max_target_audience_length(self):
        """Test MAX_TARGET_AUDIENCE_LENGTH is reasonable."""
        assert isinstance(MAX_TARGET_AUDIENCE_LENGTH, int)
        assert MAX_TARGET_AUDIENCE_LENGTH > 0
        assert MAX_TARGET_AUDIENCE_LENGTH == 500

    def test_max_target_objective_length(self):
        """Test MAX_TARGET_OBJECTIVE_LENGTH is reasonable."""
        assert isinstance(MAX_TARGET_OBJECTIVE_LENGTH, int)
        assert MAX_TARGET_OBJECTIVE_LENGTH > 0
        assert MAX_TARGET_OBJECTIVE_LENGTH == 500

    def test_evaluation_score_range(self):
        """Test evaluation score range constants."""
        assert isinstance(EVALUATION_SCORE_MIN, int)
        assert isinstance(EVALUATION_SCORE_MAX, int)
        assert EVALUATION_SCORE_MIN == 1
        assert EVALUATION_SCORE_MAX == 10
        assert EVALUATION_SCORE_MIN < EVALUATION_SCORE_MAX

    def test_default_evaluation_model(self):
        """Test default evaluation model is set."""
        assert isinstance(DEFAULT_EVALUATION_MODEL, str)
        assert len(DEFAULT_EVALUATION_MODEL) > 0
        assert "gemini" in DEFAULT_EVALUATION_MODEL.lower()

    def test_llm_timeout_seconds(self):
        """Test LLM timeout constants are reasonable."""
        assert isinstance(LLM_TIMEOUT_SECONDS, int)
        assert LLM_TIMEOUT_SECONDS > 0
        assert LLM_TIMEOUT_SECONDS == 60

    def test_llm_video_timeout_seconds(self):
        """Test video LLM timeout is longer than text timeout."""
        assert isinstance(LLM_VIDEO_TIMEOUT_SECONDS, int)
        assert LLM_VIDEO_TIMEOUT_SECONDS > LLM_TIMEOUT_SECONDS
        assert LLM_VIDEO_TIMEOUT_SECONDS == 300  # 5 minutes


class TestLanguageCodeEdgeCases:
    """Edge case tests for language functions."""

    def test_all_supported_languages_normalize_correctly(self):
        """Test that all supported languages normalize to their code."""
        for code, name in SUPPORTED_LANGUAGES.items():
            assert normalize_language_to_code(code) == code
            assert normalize_language_to_code(name) == code

    def test_all_supported_languages_are_valid(self):
        """Test that all supported languages pass validation."""
        for code, name in SUPPORTED_LANGUAGES.items():
            assert is_valid_language(code) is True
            assert is_valid_language(name) is True

    def test_whitespace_handling_in_normalize(self):
        """Test that whitespace around language names is not handled (strict matching)."""
        # The function does not strip whitespace, so this should fail
        with pytest.raises(ValueError):
            normalize_language_to_code(" English ")

    def test_unicode_language_input(self):
        """Test handling of unicode characters in language input."""
        # These should all fail as they are not supported
        with pytest.raises(ValueError):
            normalize_language_to_code("\u4e2d\u6587")  # Chinese characters
