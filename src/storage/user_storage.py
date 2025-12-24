"""User storage management for videos and docs."""

import json
import re
import secrets
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
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
    return text[:50] if text else "doc"


class UserStorage:
    """Manages user folder structure for videos and docs.

    Each user has an isolated folder structure:
        users/{user_id}/
            videos/          - Uploaded video files
            docs/            - Generated docs
                {doc_id}/
                    doc.md
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
        self.docs_dir = self.user_dir / "docs"

    def ensure_user_folders(self) -> None:
        """Create user folder structure if it doesn't exist."""
        self.videos_dir.mkdir(parents=True, exist_ok=True)
        self.docs_dir.mkdir(parents=True, exist_ok=True)

    def find_existing_doc(self, video_name: str) -> Optional[str]:
        """Find an existing doc for a video name.

        Args:
            video_name: Video filename to search for

        Returns:
            doc_id if found, None otherwise
        """
        base_name = Path(video_name).stem
        doc_id = slugify(base_name)

        # Check if doc exists
        if (self.docs_dir / doc_id).exists():
            return doc_id
        return None

    def get_doc_dir(
        self,
        doc_id: Optional[str] = None,
        video_name: Optional[str] = None,
        create_new: bool = False,
    ) -> tuple[Path, str]:
        """Get or create a doc output directory.

        Args:
            doc_id: Optional doc ID. If not provided, derives from video_name or generates UUID.
            video_name: Optional video filename to derive doc ID from.
            create_new: If True, always create a new doc (append -2, -3, etc.)
                       If False, reuse existing doc if found.

        Returns:
            Tuple of (doc directory path, doc_id)
        """
        if doc_id is None:
            if video_name:
                # Create slug from video name (without extension)
                base_name = Path(video_name).stem
                doc_id = slugify(base_name)

                # If slug already exists and we want a new one, append a number
                if create_new and (self.docs_dir / doc_id).exists():
                    counter = 2
                    while (self.docs_dir / f"{doc_id}-{counter}").exists():
                        counter += 1
                    doc_id = f"{doc_id}-{counter}"
            else:
                doc_id = str(uuid.uuid4())[:8]

        doc_dir = self.docs_dir / doc_id
        doc_dir.mkdir(parents=True, exist_ok=True)
        # Note: screenshots folder is created by doc_generator.py when needed
        return doc_dir, doc_id

    def get_video_path(self, filename: str) -> Path:
        """Get path for a user's video file.

        Args:
            filename: Name of the video file

        Returns:
            Full path to the video file in user's videos directory
        """
        return self.videos_dir / filename

    def get_doc_path(self, doc_id: str) -> Path:
        """Get the path to a doc directory.

        Args:
            doc_id: ID of the doc

        Returns:
            Path to the doc directory
        """
        return self.docs_dir / doc_id

    def list_docs(self) -> List[str]:
        """List all doc IDs for this user.

        Returns:
            List of doc directory names (doc IDs)
        """
        if not self.docs_dir.exists():
            return []
        return [d.name for d in self.docs_dir.iterdir() if d.is_dir()]

    def list_doc_languages(self, doc_id: str) -> List[str]:
        """List available language versions for a doc.

        Args:
            doc_id: ID of the doc

        Returns:
            List of language codes (e.g., ["en", "es"])
        """
        doc_dir = self.docs_dir / doc_id
        if not doc_dir.exists():
            return []

        languages = []
        for item in doc_dir.iterdir():
            # Support both new (doc.md) and legacy (manual.md) filenames
            if item.is_dir() and ((item / "doc.md").exists() or (item / "manual.md").exists()):
                languages.append(item.name)
        return sorted(languages)

    def get_doc_content(self, doc_id: str, language_code: str = "en") -> Optional[str]:
        """Read the content of a doc in a specific language.

        Args:
            doc_id: ID of the doc to read
            language_code: Language code (default: "en")

        Returns:
            Doc content as string, or None if not found
        """
        # Try language-specific path first (new structure with doc.md)
        lang_doc_path = self.docs_dir / doc_id / language_code / "doc.md"
        if lang_doc_path.exists():
            return lang_doc_path.read_text(encoding="utf-8")

        # Try legacy filename (manual.md) in language-specific folder
        lang_manual_path = self.docs_dir / doc_id / language_code / "manual.md"
        if lang_manual_path.exists():
            return lang_manual_path.read_text(encoding="utf-8")

        # Fallback to old structure (doc_id/doc.md) for very old data
        legacy_path = self.docs_dir / doc_id / "doc.md"
        if legacy_path.exists():
            return legacy_path.read_text(encoding="utf-8")

        # Fallback to legacy manual.md at root level
        legacy_manual_path = self.docs_dir / doc_id / "manual.md"
        if legacy_manual_path.exists():
            return legacy_manual_path.read_text(encoding="utf-8")

        return None

    def save_doc_content(self, doc_id: str, content: str, language_code: str = "en") -> Path:
        """Save doc content to disk.

        Args:
            doc_id: ID of the doc
            content: Markdown content to save
            language_code: Language code (default: "en")

        Returns:
            Path to the saved file

        Raises:
            FileNotFoundError: If doc directory doesn't exist
        """
        doc_dir = self.docs_dir / doc_id
        if not doc_dir.exists():
            raise FileNotFoundError(f"Doc directory not found: {doc_id}")

        # Use language-specific path (new structure)
        lang_dir = doc_dir / language_code
        lang_dir.mkdir(parents=True, exist_ok=True)

        doc_path = lang_dir / "doc.md"
        doc_path.write_text(content, encoding="utf-8")

        return doc_path

    def list_screenshots(self, doc_id: str) -> List[Path]:
        """List all screenshots for a doc.

        Screenshots are stored in a shared folder at {doc}/screenshots/,
        not per-language.

        Args:
            doc_id: ID of the doc

        Returns:
            List of screenshot file paths
        """
        screenshots_dir = self.docs_dir / doc_id / "screenshots"
        if screenshots_dir.exists():
            # Support common image formats
            image_extensions = ["*.png", "*.jpg", "*.jpeg", "*.webp", "*.gif"]
            all_images: List[Path] = []
            for ext in image_extensions:
                all_images.extend(screenshots_dir.glob(ext))
            return sorted(all_images)
        return []

    def get_doc_videos_dir(self, doc_id: str, create: bool = True) -> Path:
        """Get the videos subfolder for a doc (additional video sources).

        Args:
            doc_id: ID of the doc
            create: If True, create the directory if it doesn't exist

        Returns:
            Path to the videos subfolder
        """
        videos_dir = self.docs_dir / doc_id / "videos"
        if create:
            videos_dir.mkdir(parents=True, exist_ok=True)
        return videos_dir

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

    # ==================== Video-Doc Relationship ====================

    def get_docs_by_video(self, video_name: str) -> List[Dict[str, Any]]:
        """Find all docs created from a specific video.

        Args:
            video_name: Name of the video file

        Returns:
            List of dicts with doc_id and metadata
        """
        if not self.docs_dir.exists():
            return []

        matching_docs = []
        video_path_str = str(self.videos_dir / video_name)

        for doc_dir in self.docs_dir.iterdir():
            if not doc_dir.is_dir():
                continue

            metadata_file = doc_dir / "metadata.json"
            if not metadata_file.exists():
                continue

            try:
                with open(metadata_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)

                # Check if this doc was created from the video
                stored_path = metadata.get("video_path", "")
                stored_name = Path(stored_path).name if stored_path else ""

                # Also check video_metadata.filename as fallback
                video_metadata = metadata.get("video_metadata", {})
                metadata_filename = video_metadata.get("filename", "") if video_metadata else ""

                # Match by path, filename from path, or video_metadata.filename
                if stored_path == video_path_str or stored_name == video_name or metadata_filename == video_name:
                    matching_docs.append({
                        "doc_id": doc_dir.name,
                        "video_path": stored_path,
                        "languages": metadata.get("languages_generated", []),
                        "created_at": metadata.get("created_at"),
                        "project_id": metadata.get("project_id"),
                        "document_format": metadata.get("document_format", "step-manual"),
                    })
            except (json.JSONDecodeError, IOError):
                continue

        return matching_docs

    def get_doc_metadata(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific doc.

        Args:
            doc_id: Doc identifier

        Returns:
            Metadata dict or None if not found
        """
        metadata_file = self.docs_dir / doc_id / "metadata.json"
        if not metadata_file.exists():
            return None

        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None

    def update_doc_metadata(self, doc_id: str, updates: Dict[str, Any]) -> None:
        """Update metadata for a doc.

        Args:
            doc_id: Doc identifier
            updates: Fields to update
        """
        metadata_file = self.docs_dir / doc_id / "metadata.json"

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

    def update_doc_video_status(
        self,
        doc_id: str,
        video_exists: bool,
        deleted_at: Optional[str] = None,
    ) -> None:
        """Update source video status in doc metadata.

        Called when a video is deleted or restored to update
        all associated docs.

        Args:
            doc_id: Doc identifier
            video_exists: Whether the source video exists
            deleted_at: ISO timestamp when video was deleted (None if exists)
        """
        metadata = self.get_doc_metadata(doc_id)
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

        self.update_doc_metadata(doc_id, {"source_video": source_video})

    def mark_video_deleted_for_docs(self, video_name: str) -> List[str]:
        """Mark source video as deleted for all associated docs.

        Args:
            video_name: Name of the deleted video

        Returns:
            List of affected doc IDs
        """
        docs = self.get_docs_by_video(video_name)
        deleted_at = datetime.now().isoformat()

        affected_ids = []
        for doc_info in docs:
            doc_id = doc_info["doc_id"]
            self.update_doc_video_status(doc_id, video_exists=False, deleted_at=deleted_at)
            affected_ids.append(doc_id)

        return affected_ids

    def mark_video_restored_for_docs(self, video_name: str) -> List[str]:
        """Mark source video as restored for all associated docs.

        Args:
            video_name: Name of the restored video

        Returns:
            List of affected doc IDs
        """
        docs = self.get_docs_by_video(video_name)

        affected_ids = []
        for doc_info in docs:
            doc_id = doc_info["doc_id"]
            self.update_doc_video_status(doc_id, video_exists=True, deleted_at=None)
            affected_ids.append(doc_id)

        return affected_ids

    # ==================== Clone Doc ====================

    def clone_doc(
        self,
        source_doc_id: str,
        target_format: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
    ) -> tuple[str, Path]:
        """Clone a doc to a new document format.

        Creates a complete copy of the doc with:
        - New unique doc ID (based on source ID + format)
        - Copies all screenshots (symlinked to save disk space)
        - Uses provided content or copies original content
        - New metadata with updated document_format and cloned_from reference

        Args:
            source_doc_id: ID of the doc to clone
            target_format: Target document format (step-manual, quick-guide, reference, summary)
            title: Optional custom title (defaults to "Original Title (Format)")
            content: Optional reformatted content (if None, copies original)

        Returns:
            Tuple of (new_doc_id, new_doc_path)

        Raises:
            FileNotFoundError: If source doc doesn't exist
            ValueError: If target format is invalid
        """
        import shutil

        # Validate source exists
        source_dir = self.docs_dir / source_doc_id
        if not source_dir.exists():
            raise FileNotFoundError(f"Source doc not found: {source_doc_id}")

        # Human-readable format names for titles
        format_names = {
            "step-manual": "Step Manual",
            "quick-guide": "Quick Guide",
            "reference": "Reference",
            "summary": "Summary",
        }

        if target_format not in format_names:
            raise ValueError(f"Invalid target format: {target_format}")

        # Generate new doc ID
        base_id = f"{source_doc_id}-{target_format}"
        new_doc_id = base_id
        counter = 2
        while (self.docs_dir / new_doc_id).exists():
            new_doc_id = f"{base_id}-{counter}"
            counter += 1

        # Create new doc directory
        new_doc_dir = self.docs_dir / new_doc_id
        new_doc_dir.mkdir(parents=True, exist_ok=True)

        # Get source metadata
        source_metadata = self.get_doc_metadata(source_doc_id) or {}

        # Determine title
        if title:
            new_title = title
        else:
            # Get original title and append format
            original_title = source_metadata.get("title", "")
            if not original_title:
                # Derive from video name if no explicit title
                video_path = source_metadata.get("video_path", "")
                original_title = Path(video_path).stem if video_path else source_doc_id
            new_title = f"{original_title} ({format_names[target_format]})"

        # Copy screenshots directory (use hard links to save space if possible)
        source_screenshots = source_dir / "screenshots"
        if source_screenshots.exists():
            new_screenshots = new_doc_dir / "screenshots"
            new_screenshots.mkdir(exist_ok=True)

            for screenshot in source_screenshots.glob("*.png"):
                dest = new_screenshots / screenshot.name
                try:
                    # Try hard link first (saves disk space)
                    dest.hardlink_to(screenshot)
                except OSError:
                    # Fall back to copy if hard link fails (cross-device, etc.)
                    shutil.copy2(screenshot, dest)

        # Copy or create content for each language
        source_languages = self.list_doc_languages(source_doc_id)
        if not source_languages:
            # Legacy structure - check for direct doc.md or manual.md
            if (source_dir / "doc.md").exists() or (source_dir / "manual.md").exists():
                source_languages = ["en"]

        for lang in source_languages:
            lang_dir = new_doc_dir / lang
            lang_dir.mkdir(exist_ok=True)

            if content and lang == source_languages[0]:
                # Use provided reformatted content for primary language
                (lang_dir / "doc.md").write_text(content, encoding="utf-8")
            else:
                # Copy original content
                source_content = self.get_doc_content(source_doc_id, lang)
                if source_content:
                    (lang_dir / "doc.md").write_text(source_content, encoding="utf-8")

        # Create metadata for cloned doc
        new_metadata = {
            "title": new_title,
            "document_format": target_format,
            "video_path": source_metadata.get("video_path", ""),
            "source_video": source_metadata.get("source_video", {}),
            "cloned_from": {
                "doc_id": source_doc_id,
                "source_format": source_metadata.get("document_format", "step-manual"),
                "cloned_at": datetime.now().isoformat(),
            },
            "languages_generated": source_languages,
            "target_audience": source_metadata.get("target_audience"),
            "target_objective": source_metadata.get("target_objective"),
            "created_at": datetime.now().isoformat(),
        }

        # Save metadata
        metadata_path = new_doc_dir / "metadata.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(new_metadata, f, indent=2, ensure_ascii=False)

        return new_doc_id, new_doc_dir

    # ========== Share Token Methods ==========

    def create_share_token(self, doc_id: str, language: str = "en") -> str:
        """Create a share token for a doc.

        Generates a unique, cryptographically secure token that can be used
        to access the doc without authentication.

        Args:
            doc_id: Doc identifier
            language: Language code for the shared version

        Returns:
            The generated share token
        """
        token = secrets.token_urlsafe(32)

        share_info = {
            "token": token,
            "language": language,
            "created_at": datetime.now().isoformat(),
            "expires_at": None,  # Permanent until revoked
        }

        self.update_doc_metadata(doc_id, {"share": share_info})
        return token

    def get_share_info(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get share information for a doc.

        Args:
            doc_id: Doc identifier

        Returns:
            Share info dict or None if not shared
        """
        metadata = self.get_doc_metadata(doc_id)
        if metadata is None:
            return None
        return metadata.get("share")

    def revoke_share(self, doc_id: str) -> bool:
        """Revoke the share token for a doc.

        Args:
            doc_id: Doc identifier

        Returns:
            True if share was revoked, False if no share existed
        """
        metadata = self.get_doc_metadata(doc_id)
        if metadata is None or "share" not in metadata:
            return False

        # Remove share from metadata
        del metadata["share"]
        metadata["updated_at"] = datetime.now().isoformat()

        metadata_file = self.docs_dir / doc_id / "metadata.json"
        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

        return True


def find_doc_by_share_token(token: str) -> Optional[Tuple[str, str, Dict[str, Any]]]:
    """Find a doc by its share token across all users.

    This is a module-level function that searches all user directories
    to find a doc with the given share token.

    Args:
        token: The share token to search for

    Returns:
        Tuple of (user_id, doc_id, share_info) or None if not found
    """
    from ..config import USERS_DIR

    if not USERS_DIR.exists():
        return None

    for user_dir in USERS_DIR.iterdir():
        if not user_dir.is_dir():
            continue

        user_id = user_dir.name
        docs_dir = user_dir / "docs"

        if not docs_dir.exists():
            continue

        for doc_dir in docs_dir.iterdir():
            if not doc_dir.is_dir():
                continue

            metadata_file = doc_dir / "metadata.json"
            if not metadata_file.exists():
                continue

            try:
                with open(metadata_file, "r", encoding="utf-8") as f:
                    metadata = json.load(f)

                share_info = metadata.get("share")
                if share_info and share_info.get("token") == token:
                    # Check if token is expired
                    expires_at = share_info.get("expires_at")
                    if expires_at:
                        expiry = datetime.fromisoformat(expires_at)
                        if datetime.now() > expiry:
                            continue  # Token expired

                    return (user_id, doc_dir.name, share_info)
            except (json.JSONDecodeError, IOError):
                continue

    return None
