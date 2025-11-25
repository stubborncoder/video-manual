"""User storage management for videos and manuals."""

from pathlib import Path
from typing import Optional, List
import uuid

from ..config import USERS_DIR


class UserStorage:
    """Manages user folder structure for videos and manuals.

    Each user has an isolated folder structure:
        users/{user_id}/
            videos/          - Uploaded video files
            manuals/         - Generated manuals
                {manual_id}/
                    manual.md
                    screenshots/
    """

    def __init__(self, user_id: str):
        """Initialize user storage.

        Args:
            user_id: Unique identifier for the user
        """
        self.user_id = user_id
        self.user_dir = USERS_DIR / user_id
        self.videos_dir = self.user_dir / "videos"
        self.manuals_dir = self.user_dir / "manuals"

    def ensure_user_folders(self) -> None:
        """Create user folder structure if it doesn't exist."""
        self.videos_dir.mkdir(parents=True, exist_ok=True)
        self.manuals_dir.mkdir(parents=True, exist_ok=True)

    def get_manual_dir(self, manual_id: Optional[str] = None) -> tuple[Path, str]:
        """Get or create a manual output directory.

        Args:
            manual_id: Optional manual ID. If not provided, generates a new UUID.

        Returns:
            Tuple of (manual directory path, manual_id)
        """
        manual_id = manual_id or str(uuid.uuid4())[:8]
        manual_dir = self.manuals_dir / manual_id
        manual_dir.mkdir(parents=True, exist_ok=True)
        (manual_dir / "screenshots").mkdir(exist_ok=True)
        return manual_dir, manual_id

    def get_video_path(self, filename: str) -> Path:
        """Get path for a user's video file.

        Args:
            filename: Name of the video file

        Returns:
            Full path to the video file in user's videos directory
        """
        return self.videos_dir / filename

    def list_manuals(self) -> List[str]:
        """List all manual IDs for this user.

        Returns:
            List of manual directory names (manual IDs)
        """
        if not self.manuals_dir.exists():
            return []
        return [d.name for d in self.manuals_dir.iterdir() if d.is_dir()]

    def get_manual_content(self, manual_id: str) -> Optional[str]:
        """Read the content of a manual.

        Args:
            manual_id: ID of the manual to read

        Returns:
            Manual content as string, or None if not found
        """
        manual_path = self.manuals_dir / manual_id / "manual.md"
        if manual_path.exists():
            return manual_path.read_text(encoding="utf-8")
        return None

    def list_screenshots(self, manual_id: str) -> List[Path]:
        """List all screenshots for a manual.

        Args:
            manual_id: ID of the manual

        Returns:
            List of screenshot file paths
        """
        screenshots_dir = self.manuals_dir / manual_id / "screenshots"
        if not screenshots_dir.exists():
            return []
        return list(screenshots_dir.glob("*.png"))
