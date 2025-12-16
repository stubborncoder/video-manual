"""Global configuration for the vDocs platform."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Project root
PROJECT_ROOT = Path(__file__).parent.parent

# Data directories - configurable via environment variables for production
DATA_DIR = Path(os.getenv("VDOCS_DATA_DIR", str(PROJECT_ROOT / "data")))
USERS_DIR = DATA_DIR / "users"
CHECKPOINTS_DIR = DATA_DIR / "checkpoints"
TEMPLATES_DIR = DATA_DIR / "templates"  # Global Word templates

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{PROJECT_ROOT / 'src' / 'db' / 'vdocs.db'}")

# Supabase configuration (for production auth)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# CORS configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")

# API Keys (already loaded from .env by python-dotenv in most cases)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Feature flags
USE_SUPABASE_AUTH = bool(SUPABASE_URL and SUPABASE_JWT_SECRET)


def get_checkpoint_db_path(agent_name: str) -> Path:
    """Get checkpoint DB path for a specific agent.

    Each agent has its own independent SQLite database for checkpointing.

    Args:
        agent_name: Name of the agent (e.g., "video_manual_agent")

    Returns:
        Path to the agent's checkpoint database
    """
    return CHECKPOINTS_DIR / f"{agent_name}.db"


def ensure_directories():
    """Create required directories if they don't exist."""
    DATA_DIR.mkdir(exist_ok=True)
    USERS_DIR.mkdir(exist_ok=True)
    CHECKPOINTS_DIR.mkdir(exist_ok=True)
    TEMPLATES_DIR.mkdir(exist_ok=True)


def get_chat_model():
    """Get a LangChain chat model for general-purpose use.

    Returns a cost-effective model suitable for the Guide Agent
    and other lightweight chat tasks.

    Returns:
        A LangChain chat model instance
    """
    from langchain.chat_models import init_chat_model

    # Prefer Gemini Flash for cost-effectiveness and speed
    if GOOGLE_API_KEY:
        return init_chat_model(
            "google_genai:gemini-2.0-flash",
            api_key=GOOGLE_API_KEY,
        )

    # Fallback to Anthropic if available
    if ANTHROPIC_API_KEY:
        return init_chat_model(
            "anthropic:claude-sonnet-4-20250514",
            api_key=ANTHROPIC_API_KEY,
        )

    raise ValueError("No API key configured. Set GOOGLE_API_KEY or ANTHROPIC_API_KEY.")
