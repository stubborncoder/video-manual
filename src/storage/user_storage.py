"""User storage management for videos and manuals."""

import re
from pathlib import Path
from typing import Optional, List
import uuid

from ..config import USERS_DIR


def slugify(text: str) -> str:
    """Convert text to a URL/filesystem-friendly slug.

    Args:
        text: Text to convert

    Returns:
        Lowercase string with only alphanumeric chars and hyphens
    """
    # Convert to lowercase
    text = text.lower()
    # Replace spaces and underscores with hyphens
    text = re.sub(r'[\s_]+', '-', text)
    # Remove non-alphanumeric characters except hyphens
    text = re.sub(r'[^a-z0-9\-]', '', text)
    # Remove multiple consecutive hyphens
    text = re.sub(r'-+', '-', text)
    # Strip leading/trailing hyphens
    text = text.strip('-')
    # Limit length
    return text[:50] if text else "manual"


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

    def get_manual_dir(self, manual_id: Optional[str] = None, video_name: Optional[str] = None) -> tuple[Path, str]:
        """Get or create a manual output directory.

        Args:
            manual_id: Optional manual ID. If not provided, derives from video_name or generates UUID.
            video_name: Optional video filename to derive manual ID from.

        Returns:
            Tuple of (manual directory path, manual_id)
        """
        if manual_id is None:
            if video_name:
                # Create slug from video name (without extension)
                base_name = Path(video_name).stem
                manual_id = slugify(base_name)
                # If slug already exists, append a number
                if (self.manuals_dir / manual_id).exists():
                    counter = 2
                    while (self.manuals_dir / f"{manual_id}-{counter}").exists():
                        counter += 1
                    manual_id = f"{manual_id}-{counter}"
            else:
                manual_id = str(uuid.uuid4())[:8]

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

    def list_videos(self) -> List[Path]:
        """List all video files in user's videos directory.

        Returns:
            List of video file paths, sorted by modification time (newest first)
        """
        VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v", ".flv"}

        if not self.videos_dir.exists():
            return []

        videos = []
        for ext in VIDEO_EXTENSIONS:
            videos.extend(self.videos_dir.glob(f"*{ext}"))
            videos.extend(self.videos_dir.glob(f"*{ext.upper()}"))

        return sorted(videos, key=lambda p: p.stat().st_mtime, reverse=True)
