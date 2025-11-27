"""Configuration for Project Compiler Agent."""

# Anthropic Model Configuration
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"  # Best balance of quality and speed
FALLBACK_MODEL = "claude-opus-4-5-20251101"  # Higher quality for complex merges

# Model format for deepagents (provider:model)
DEFAULT_DEEPAGENT_MODEL = f"anthropic:{DEFAULT_MODEL}"

# Supported models
SUPPORTED_MODELS = {
    "sonnet": f"anthropic:{DEFAULT_MODEL}",
    "opus": f"anthropic:{FALLBACK_MODEL}",
    "gemini": "google:gemini-2.5-flash",  # Alternative provider
}

# Compilation Configuration
MAX_MANUALS_PER_PROJECT = 50  # Maximum manuals to compile at once
MAX_CONTENT_SIZE = 500_000  # Maximum characters per manual (500KB)

# Merge Plan Configuration
DEFAULT_MERGE_STRATEGY = "sequential"  # sequential, interleaved, or smart
DETECT_DUPLICATES = True  # Enable duplicate content detection
SUGGEST_TRANSITIONS = True  # Enable transition suggestions

# Output Configuration
COMPILED_DIR_NAME = "compiled"  # Directory name for compiled outputs
