"""Configuration for the Reformat Agent."""

# Model configuration
# Uses Sonnet for good balance of quality and speed
DEFAULT_REFORMAT_MODEL = "anthropic:claude-sonnet-4-5-20250929"

# Fallback models in order of preference
FALLBACK_MODELS = [
    "anthropic:claude-sonnet-4-5-20250929",
    "anthropic:claude-3-5-sonnet-20241022",
]

# Timeouts
LLM_TIMEOUT = 300  # Seconds - generous for large manuals

# Supported document formats
SUPPORTED_FORMATS = ["step-manual", "quick-guide", "reference", "summary"]

# Human-readable format names for UI/titles
FORMAT_NAMES = {
    "step-manual": "Step-by-step Manual",
    "quick-guide": "Quick Guide",
    "reference": "Reference",
    "summary": "Summary",
}
