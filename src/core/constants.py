"""Centralized constants for validation and configuration.

These constants are shared across backend validation, sanitization, and frontend.
"""

# Input field length limits
MAX_TARGET_AUDIENCE_LENGTH = 500
MAX_TARGET_OBJECTIVE_LENGTH = 500

# Evaluation configuration
DEFAULT_EVALUATION_MODEL = "gemini-2.0-flash-exp"
EVALUATION_SCORE_MIN = 1
EVALUATION_SCORE_MAX = 10

# Supported language codes for manual generation
# ISO 639-1 codes mapped to full names
SUPPORTED_LANGUAGES = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "nl": "Dutch",
    "pl": "Polish",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "ar": "Arabic",
    "hi": "Hindi",
    "tr": "Turkish",
    "vi": "Vietnamese",
    "th": "Thai",
    "id": "Indonesian",
    "ms": "Malay",
    "sv": "Swedish",
    "no": "Norwegian",
    "da": "Danish",
    "fi": "Finnish",
    "cs": "Czech",
    "uk": "Ukrainian",
    "he": "Hebrew",
    "el": "Greek",
    "ro": "Romanian",
    "hu": "Hungarian",
    "bg": "Bulgarian",
    "hr": "Croatian",
    "sk": "Slovak",
    "sl": "Slovenian",
    "et": "Estonian",
    "lv": "Latvian",
    "lt": "Lithuanian",
    "ca": "Catalan",
    "eu": "Basque",
    "gl": "Galician",
}

# Default language for manual generation
DEFAULT_OUTPUT_LANGUAGE = "English"


def get_language_code(language_name: str) -> str:
    """Get ISO 639-1 code from language name.

    Args:
        language_name: Full language name (e.g., "English", "Spanish")

    Returns:
        Two-letter language code (e.g., "en", "es")
    """
    name_lower = language_name.lower()
    for code, name in SUPPORTED_LANGUAGES.items():
        if name.lower() == name_lower:
            return code
    # Fallback: assume it's already a code
    if language_name.lower() in SUPPORTED_LANGUAGES:
        return language_name.lower()
    return "en"


def is_valid_language(language: str) -> bool:
    """Check if a language name or code is supported.

    Args:
        language: Language name (e.g., "English") or code (e.g., "en")

    Returns:
        True if supported, False otherwise
    """
    language_lower = language.lower()
    # Check if it's a code
    if language_lower in SUPPORTED_LANGUAGES:
        return True
    # Check if it's a name
    for name in SUPPORTED_LANGUAGES.values():
        if name.lower() == language_lower:
            return True
    return False
