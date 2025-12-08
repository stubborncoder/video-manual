"""Prompts for Video Manual Agent."""

from .system import VIDEO_ANALYZER_PROMPT, MANUAL_GENERATOR_PROMPT
from .document_formats import (
    DOCUMENT_FORMATS,
    DEFAULT_FORMAT,
    get_format_prompt,
    get_format_tags,
    list_formats,
)

__all__ = [
    "VIDEO_ANALYZER_PROMPT",
    "MANUAL_GENERATOR_PROMPT",
    "DOCUMENT_FORMATS",
    "DEFAULT_FORMAT",
    "get_format_prompt",
    "get_format_tags",
    "list_formats",
]
