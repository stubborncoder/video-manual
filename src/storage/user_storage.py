"""User storage management for videos and manuals."""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
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

    def find_existing_manual(self, video_name: str) -> Optional[str]:
        """Find an existing manual for a video name.

        Args:
            video_name: Video filename to search for

        Returns:
            manual_id if found, None otherwise
        """
        base_name = Path(video_name).stem
        manual_id = slugify(base_name)

        # Check if manual exists
        if (self.manuals_dir / manual_id).exists():
            return manual_id
        return None

    def get_manual_dir(
        self,
        manual_id: Optional[str] = None,
        video_name: Optional[str] = None,
        create_new: bool = False,
    ) -> tuple[Path, str]:
        """Get or create a manual output directory.

        Args:
            manual_id: Optional manual ID. If not provided, derives from video_name or generates UUID.
            video_name: Optional video filename to derive manual ID from.
            create_new: If True, always create a new manual (append -2, -3, etc.)
                       If False, reuse existing manual if found.

        Returns:
            Tuple of (manual directory path, manual_id)
        """
        if manual_id is None:
            if video_name:
                # Create slug from video name (without extension)
                base_name = Path(video_name).stem
                manual_id = slugify(base_name)

                # If slug already exists and we want a new one, append a number
                if create_new and (self.manuals_dir / manual_id).exists():
                    counter = 2
                    while (self.manuals_dir / f"{manual_id}-{counter}").exists():
                        counter += 1
                    manual_id = f"{manual_id}-{counter}"
            else:
                manual_id = str(uuid.uuid4())[:8]

        manual_dir = self.manuals_dir / manual_id
        manual_dir.mkdir(parents=True, exist_ok=True)
        # Note: screenshots folder is created by manual_generator.py when needed
        return manual_dir, manual_id

    def get_video_path(self, filename: str) -> Path:
        """Get path for a user's video file.

        Args:
            filename: Name of the video file

        Returns:
            Full path to the video file in user's videos directory
        """
        return self.videos_dir / filename

    def get_manual_path(self, manual_id: str) -> Path:
        """Get the path to a manual directory.

        Args:
            manual_id: ID of the manual

        Returns:
            Path to the manual directory
        """
        return self.manuals_dir / manual_id

    def list_manuals(self) -> List[str]:
        """List all manual IDs for this user.

        Returns:
            List of manual directory names (manual IDs)
        """
        if not self.manuals_dir.exists():
            return []
        return [d.name for d in self.manuals_dir.iterdir() if d.is_dir()]

    def list_manual_languages(self, manual_id: str) -> List[str]:
        """List available language versions for a manual.

        Args:
            manual_id: ID of the manual

        Returns:
            List of language codes (e.g., ["en", "es"])
        """
        manual_dir = self.manuals_dir / manual_id
        if not manual_dir.exists():
            return []

        languages = []
        for item in manual_dir.iterdir():
            if item.is_dir() and (item / "manual.md").exists():
                languages.append(item.name)
        return sorted(languages)

    def get_manual_content(self, manual_id: str, language_code: str = "en") -> Optional[str]:
        """Read the content of a manual in a specific language.

        Args:
            manual_id: ID of the manual to read
            language_code: Language code (default: "en")

        Returns:
            Manual content as string, or None if not found
        """
        # Try language-specific path first (new structure)
        lang_manual_path = self.manuals_dir / manual_id / language_code / "manual.md"
        if lang_manual_path.exists():
            return lang_manual_path.read_text(encoding="utf-8")

        # Fallback to old structure (manual_id/manual.md) for backwards compatibility
        legacy_path = self.manuals_dir / manual_id / "manual.md"
        if legacy_path.exists():
            return legacy_path.read_text(encoding="utf-8")

        return None

    def list_screenshots(self, manual_id: str) -> List[Path]:
        """List all screenshots for a manual.

        Screenshots are stored in a shared folder at {manual}/screenshots/,
        not per-language.

        Args:
            manual_id: ID of the manual

        Returns:
            List of screenshot file paths
        """
        screenshots_dir = self.manuals_dir / manual_id / "screenshots"
        if screenshots_dir.exists():
            return sorted(screenshots_dir.glob("*.png"))
        return []

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

    # ==================== Video-Manual Relationship ====================

    def get_manuals_by_video(self, video_name: str) -> List[Dict[str, Any]]:
        """Find all manuals created from a specific video.

        Args:
            video_name: Name of the video file

        Returns:
            List of dicts with manual_id and metadata
        """
        if not self.manuals_dir.exists():
            return []

        matching_manuals = []
        video_path_str = str(self.videos_dir / video_name)

        for manual_dir in self.manuals_dir.iterdir():
            if not manual_dir.is_dir():
                continue

            metadata_file = manual_dir / "metadata.json"
            if not metadata_file.exists():
                continue

            try:
                with open(metadata_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)

                # Check if this manual was created from the video
                stored_path = metadata.get("video_path", "")
                stored_name = Path(stored_path).name if stored_path else ""

                # Match by path or by filename
                if stored_path == video_path_str or stored_name == video_name:
                    matching_manuals.append({
                        "manual_id": manual_dir.name,
                        "video_path": stored_path,
                        "languages": metadata.get("languages_generated", []),
                        "created_at": metadata.get("created_at"),
                        "project_id": metadata.get("project_id"),
                    })
            except (json.JSONDecodeError, IOError):
                continue

        return matching_manuals

    def get_manual_metadata(self, manual_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific manual.

        Args:
            manual_id: Manual identifier

        Returns:
            Metadata dict or None if not found
        """
        metadata_file = self.manuals_dir / manual_id / "metadata.json"
        if not metadata_file.exists():
            return None

        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None

    def update_manual_metadata(self, manual_id: str, updates: Dict[str, Any]) -> None:
        """Update metadata for a manual.

        Args:
            manual_id: Manual identifier
            updates: Fields to update
        """
        metadata_file = self.manuals_dir / manual_id / "metadata.json"

        if metadata_file.exists():
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        else:
            metadata = {}

        metadata.update(updates)
        metadata["updated_at"] = datetime.now().isoformat()

        # Ensure directory exists
        metadata_file.parent.mkdir(parents=True, exist_ok=True)

        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    def update_manual_video_status(
        self,
        manual_id: str,
        video_exists: bool,
        deleted_at: Optional[str] = None,
    ) -> None:
        """Update source video status in manual metadata.

        Called when a video is deleted or restored to update
        all associated manuals.

        Args:
            manual_id: Manual identifier
            video_exists: Whether the source video exists
            deleted_at: ISO timestamp when video was deleted (None if exists)
        """
        metadata = self.get_manual_metadata(manual_id)
        if metadata is None:
            return

        # Add or update source_video status
        video_path = metadata.get("video_path", "")
        source_video = metadata.get("source_video", {})

        source_video.update({
            "name": Path(video_path).name if video_path else "",
            "path": video_path,
            "exists": video_exists,
            "deleted_at": deleted_at,
        })

        self.update_manual_metadata(manual_id, {"source_video": source_video})

    def mark_video_deleted_for_manuals(self, video_name: str) -> List[str]:
        """Mark source video as deleted for all associated manuals.

        Args:
            video_name: Name of the deleted video

        Returns:
            List of affected manual IDs
        """
        manuals = self.get_manuals_by_video(video_name)
        deleted_at = datetime.now().isoformat()

        affected_ids = []
        for manual_info in manuals:
            manual_id = manual_info["manual_id"]
            self.update_manual_video_status(manual_id, video_exists=False, deleted_at=deleted_at)
            affected_ids.append(manual_id)

        return affected_ids

    def mark_video_restored_for_manuals(self, video_name: str) -> List[str]:
        """Mark source video as restored for all associated manuals.

        Args:
            video_name: Name of the restored video

        Returns:
            List of affected manual IDs
        """
        manuals = self.get_manuals_by_video(video_name)

        affected_ids = []
        for manual_info in manuals:
            manual_id = manual_info["manual_id"]
            self.update_manual_video_status(manual_id, video_exists=True, deleted_at=None)
            affected_ids.append(manual_id)

        return affected_ids
