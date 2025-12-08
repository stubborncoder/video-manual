"""Conversion prompts for the reformat agent."""

from .base_rules import BASE_CONVERSION_RULES
from .to_quick_guide import TO_QUICK_GUIDE_PROMPT
from .to_summary import TO_SUMMARY_PROMPT
from .to_reference import TO_REFERENCE_PROMPT
from .to_step_manual import TO_STEP_MANUAL_PROMPT

# Map format IDs to their conversion prompts
CONVERSION_PROMPTS = {
    "quick-guide": TO_QUICK_GUIDE_PROMPT,
    "summary": TO_SUMMARY_PROMPT,
    "reference": TO_REFERENCE_PROMPT,
    "step-manual": TO_STEP_MANUAL_PROMPT,
}


def get_conversion_prompt(source_format: str, target_format: str) -> str:
    """Get the full conversion prompt for a source→target format conversion.

    Args:
        source_format: The current format of the manual
        target_format: The desired output format

    Returns:
        Complete prompt string including base rules and format-specific instructions
    """
    if target_format not in CONVERSION_PROMPTS:
        raise ValueError(f"Unknown target format: {target_format}. "
                         f"Available: {list(CONVERSION_PROMPTS.keys())}")

    format_prompt = CONVERSION_PROMPTS[target_format]

    return f"""{BASE_CONVERSION_RULES}

{format_prompt}

You are converting from {source_format} format to {target_format} format.
"""


__all__ = [
    "BASE_CONVERSION_RULES",
    "TO_QUICK_GUIDE_PROMPT",
    "TO_SUMMARY_PROMPT",
    "TO_REFERENCE_PROMPT",
    "TO_STEP_MANUAL_PROMPT",
    "CONVERSION_PROMPTS",
    "get_conversion_prompt",
]
