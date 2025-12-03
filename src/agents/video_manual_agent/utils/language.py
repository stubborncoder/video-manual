"""Language utilities for output language selection.

Maps common language names to ISO 639-1 codes for folder organization.
"""

# Map common language names to ISO 639-1 codes
# This map MUST include all languages from core/constants.py SUPPORTED_LANGUAGES
LANGUAGE_TO_ISO = {
    # English
    "english": "en",
    # Spanish
    "spanish": "es",
    "español": "es",
    # German
    "german": "de",
    "deutsch": "de",
    # French
    "french": "fr",
    "français": "fr",
    # Portuguese
    "portuguese": "pt",
    "português": "pt",
    # Italian
    "italian": "it",
    "italiano": "it",
    # Japanese
    "japanese": "ja",
    "日本語": "ja",
    # Chinese
    "chinese": "zh",
    "中文": "zh",
    # Korean
    "korean": "ko",
    "한국어": "ko",
    # Dutch
    "dutch": "nl",
    "nederlands": "nl",
    # Russian
    "russian": "ru",
    "русский": "ru",
    # Arabic
    "arabic": "ar",
    "العربية": "ar",
    # Hindi
    "hindi": "hi",
    "हिन्दी": "hi",
    # Turkish
    "turkish": "tr",
    "türkçe": "tr",
    # Polish
    "polish": "pl",
    "polski": "pl",
    # Swedish
    "swedish": "sv",
    "svenska": "sv",
    # Norwegian
    "norwegian": "no",
    "norsk": "no",
    # Danish
    "danish": "da",
    "dansk": "da",
    # Finnish
    "finnish": "fi",
    "suomi": "fi",
    # Czech
    "czech": "cs",
    "čeština": "cs",
    # Greek
    "greek": "el",
    "ελληνικά": "el",
    # Hebrew
    "hebrew": "he",
    "עברית": "he",
    # Thai
    "thai": "th",
    "ไทย": "th",
    # Vietnamese
    "vietnamese": "vi",
    "tiếng việt": "vi",
    # Indonesian
    "indonesian": "id",
    "bahasa indonesia": "id",
    # Malay
    "malay": "ms",
    "bahasa melayu": "ms",
    # Ukrainian
    "ukrainian": "uk",
    "українська": "uk",
    # Romanian
    "romanian": "ro",
    "română": "ro",
    # Hungarian
    "hungarian": "hu",
    "magyar": "hu",
    # Bulgarian
    "bulgarian": "bg",
    "български": "bg",
    # Croatian
    "croatian": "hr",
    "hrvatski": "hr",
    # Slovak
    "slovak": "sk",
    "slovenčina": "sk",
    # Slovenian
    "slovenian": "sl",
    "slovenščina": "sl",
    # Estonian
    "estonian": "et",
    "eesti": "et",
    # Latvian
    "latvian": "lv",
    "latviešu": "lv",
    # Lithuanian
    "lithuanian": "lt",
    "lietuvių": "lt",
    # Catalan
    "catalan": "ca",
    "català": "ca",
    # Basque
    "basque": "eu",
    "euskara": "eu",
    # Galician
    "galician": "gl",
    "galego": "gl",
}


def get_language_code(language: str) -> str:
    """Convert language name to ISO 639-1 code.

    Args:
        language: Language name (e.g., "Spanish", "Español") or ISO code (e.g., "es")

    Returns:
        ISO 639-1 code (e.g., "es"). If input is already a 2-letter code
        or not found in mapping, returns the input lowercased.
    """
    normalized = language.lower().strip()

    # Check if already a 2-letter ISO code
    if len(normalized) == 2 and normalized.isalpha():
        return normalized

    return LANGUAGE_TO_ISO.get(normalized, normalized)


def get_language_name(language: str) -> str:
    """Get display name for use in prompts.

    Args:
        language: Language name or ISO code

    Returns:
        Capitalized language name for prompt display.
        Non-ASCII names (e.g., "日本語") are returned as-is.
    """
    # If it's already a proper name (not ISO code), capitalize it
    if language.isascii():
        return language.capitalize()
    return language
