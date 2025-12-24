"""Prompts for Video Doc Agent."""

from .system import (
    VIDEO_ANALYZER_PROMPT,
    VIDEO_ANALYZER_PROMPT_BASE,
    MANUAL_GENERATOR_PROMPT,
    DOC_GENERATOR_PROMPT,
    get_video_analyzer_prompt,
    get_format_analysis_hint,
    FORMAT_ANALYSIS_HINTS,
    FORMAT_TO_HINT,
)
from .document_formats import (
    DOCUMENT_FORMATS,
    DEFAULT_FORMAT,
    get_format_prompt,
    get_format_tags,
    list_formats,
)

__all__ = [
    # Video analysis prompts
    "VIDEO_ANALYZER_PROMPT",
    "VIDEO_ANALYZER_PROMPT_BASE",
    "get_video_analyzer_prompt",
    "get_format_analysis_hint",
    "FORMAT_ANALYSIS_HINTS",
    "FORMAT_TO_HINT",
    # Document generation prompts
    "MANUAL_GENERATOR_PROMPT",
    "DOC_GENERATOR_PROMPT",
    # Document format registry
    "DOCUMENT_FORMATS",
    "DEFAULT_FORMAT",
    "get_format_prompt",
    "get_format_tags",
    "list_formats",
]
