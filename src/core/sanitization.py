"""Input sanitization utilities to prevent prompt injection attacks.

These functions sanitize user-provided text before it's interpolated into LLM prompts.
"""

import re
from typing import Optional

from .constants import MAX_TARGET_AUDIENCE_LENGTH, MAX_TARGET_OBJECTIVE_LENGTH

# Patterns that could indicate prompt injection attempts
INJECTION_PATTERNS = [
    # Instructions to ignore/override previous instructions
    r"ignore\s+(all\s+)?previous\s+instructions?",
    r"disregard\s+(all\s+)?previous",
    r"forget\s+(everything|all|what)",
    r"override\s+instructions?",
    r"new\s+instructions?:",
    # System/assistant role manipulation
    r"system\s*:",
    r"assistant\s*:",
    r"user\s*:",
    r"\[system\]",
    r"\[assistant\]",
    r"</?system>",
    r"</?assistant>",
    # Output manipulation
    r"output\s*:",
    r"respond\s+with\s*:",
    r"reply\s+with\s*:",
    r"answer\s*:",
    # Common injection prefixes
    r"^---+\s*$",  # Markdown horizontal rules at start
    r"^\*{3,}\s*$",  # Asterisk separators
    r"^#{1,6}\s+",  # Markdown headers at line start
]


def sanitize_prompt_input(
    text: Optional[str],
    max_length: int,
    field_name: str = "input"
) -> Optional[str]:
    """Sanitize user input before including in LLM prompts.

    Args:
        text: The user-provided text to sanitize
        max_length: Maximum allowed length (default 500)
        field_name: Name of the field for error messages

    Returns:
        Sanitized text, or None if input was None/empty

    Raises:
        ValueError: If input contains obvious injection attempts
    """
    if text is None:
        return None

    # Strip whitespace and check if empty
    text = text.strip()
    if not text:
        return None

    # Enforce length limit
    if len(text) > max_length:
        text = text[:max_length].rsplit(' ', 1)[0]  # Truncate at word boundary
        if not text:  # Edge case: single very long word
            text = text[:max_length]

    # Normalize whitespace (collapse multiple spaces/newlines)
    text = re.sub(r'\s+', ' ', text)

    # Check for injection patterns
    text_lower = text.lower()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, text_lower, re.IGNORECASE | re.MULTILINE):
            raise ValueError(
                f"Invalid {field_name}: contains disallowed patterns"
            )

    return text


def sanitize_target_audience(text: Optional[str]) -> Optional[str]:
    """Sanitize target audience input.

    Args:
        text: User-provided target audience description

    Returns:
        Sanitized text or None
    """
    return sanitize_prompt_input(
        text,
        max_length=MAX_TARGET_AUDIENCE_LENGTH,
        field_name="target audience"
    )


def sanitize_target_objective(text: Optional[str]) -> Optional[str]:
    """Sanitize target objective input.

    Args:
        text: User-provided target objective description

    Returns:
        Sanitized text or None
    """
    return sanitize_prompt_input(
        text,
        max_length=MAX_TARGET_OBJECTIVE_LENGTH,
        field_name="target objective"
    )
