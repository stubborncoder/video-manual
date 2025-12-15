"""Configuration for the Manual Editor Agent."""

# Default model for the editor agent
# Uses a capable model for quality editing with vision support
DEFAULT_EDITOR_MODEL = "anthropic:claude-sonnet-4-5-20250929"

# Fallback chain - primary model first, then fallbacks in order
# Models are tried in sequence until one succeeds
FALLBACK_MODELS = [
    "anthropic:claude-sonnet-4-5-20250929",   # Primary model
    "anthropic:claude-3-5-sonnet-20241022",   # Stable Claude 3.5 Sonnet
    "anthropic:claude-3-haiku-20240307",      # Fast fallback
]
