"""Global configuration for the vDocs platform."""

from pathlib import Path

# Project root
PROJECT_ROOT = Path(__file__).parent.parent

# Data directories
DATA_DIR = PROJECT_ROOT / "data"
USERS_DIR = DATA_DIR / "users"
CHECKPOINTS_DIR = DATA_DIR / "checkpoints"
TEMPLATES_DIR = DATA_DIR / "templates"  # Global Word templates


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
