"""Trash storage management for soft-delete with recovery."""

import json
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any, Literal

from ..config import USERS_DIR


ItemType = Literal["video", "manual", "project"]


class TrashItem:
    """Represents an item in trash."""

    def __init__(
        self,
        item_type: ItemType,
        original_name: str,
        original_path: str,
        trash_path: str,
        deleted_at: str,
        expires_at: str,
        related_items: Optional[List[str]] = None,
        cascade_deleted: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.item_type = item_type
        self.original_name = original_name
        self.original_path = original_path
        self.trash_path = trash_path
        self.deleted_at = deleted_at
        self.expires_at = expires_at
        self.related_items = related_items or []
        self.cascade_deleted = cascade_deleted
        self.metadata = metadata or {}

    @property
    def trash_id(self) -> str:
        """Get unique ID for this trash item."""
        return Path(self.trash_path).name

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "type": self.item_type,
            "original_name": self.original_name,
            "original_path": self.original_path,
            "trash_path": self.trash_path,
            "deleted_at": self.deleted_at,
            "expires_at": self.expires_at,
            "related_items": self.related_items,
            "cascade_deleted": self.cascade_deleted,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrashItem":
        """Create from dictionary."""
        return cls(
            item_type=data["type"],
            original_name=data["original_name"],
            original_path=data["original_path"],
            trash_path=data["trash_path"],
            deleted_at=data["deleted_at"],
            expires_at=data["expires_at"],
            related_items=data.get("related_items", []),
            cascade_deleted=data.get("cascade_deleted", False),
            metadata=data.get("metadata", {}),
        )


class TrashStorage:
    """Manages soft-deleted items with automatic expiration.

    Structure:
        users/{user_id}/trash/
            manifest.json           - List of all trashed items
            videos/                 - Trashed video files
                {name}___{timestamp}.{ext}
            manuals/                - Trashed manual directories
                {manual_id}___{timestamp}/
            projects/               - Trashed project directories
                {project_id}___{timestamp}/
    """

    RETENTION_DAYS = 30

    def __init__(self, user_id: str):
        """Initialize trash storage.

        Args:
            user_id: User identifier
        """
        self.user_id = user_id
        self.user_dir = USERS_DIR / user_id
        self.trash_dir = self.user_dir / "trash"
        self.manifest_path = self.trash_dir / "manifest.json"

        # Source directories
        self.videos_dir = self.user_dir / "videos"
        self.manuals_dir = self.user_dir / "manuals"
        self.projects_dir = self.user_dir / "projects"

    def ensure_trash_dirs(self) -> None:
        """Create trash directory structure if it doesn't exist."""
        (self.trash_dir / "videos").mkdir(parents=True, exist_ok=True)
        (self.trash_dir / "manuals").mkdir(parents=True, exist_ok=True)
        (self.trash_dir / "projects").mkdir(parents=True, exist_ok=True)

    def _load_manifest(self) -> List[Dict[str, Any]]:
        """Load trash manifest."""
        if not self.manifest_path.exists():
            return []
        with open(self.manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("items", [])

    def _save_manifest(self, items: List[Dict[str, Any]]) -> None:
        """Save trash manifest."""
        self.ensure_trash_dirs()
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump({"items": items}, f, indent=2, ensure_ascii=False)

    def _generate_trash_name(self, original_name: str) -> str:
        """Generate unique trash name with timestamp."""
        timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
        return f"{original_name}___{timestamp}"

    def move_to_trash(
        self,
        item_type: ItemType,
        item_name: str,
        related_items: Optional[List[str]] = None,
        cascade_deleted: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> TrashItem:
        """Move an item to trash.

        Args:
            item_type: Type of item ("video", "manual", "project")
            item_name: Name/ID of the item
            related_items: List of related item IDs (e.g., manuals for a video)
            cascade_deleted: Whether this was deleted as part of a cascade
            metadata: Additional metadata to store

        Returns:
            TrashItem representing the trashed item

        Raises:
            ValueError: If item not found
        """
        self.ensure_trash_dirs()

        # Determine source and destination paths
        if item_type == "video":
            source_path = self.videos_dir / item_name
            trash_subdir = self.trash_dir / "videos"
            # Preserve extension
            stem = Path(item_name).stem
            ext = Path(item_name).suffix
            trash_name = f"{self._generate_trash_name(stem)}{ext}"
        elif item_type == "manual":
            source_path = self.manuals_dir / item_name
            trash_subdir = self.trash_dir / "manuals"
            trash_name = self._generate_trash_name(item_name)
        elif item_type == "project":
            source_path = self.projects_dir / item_name
            trash_subdir = self.trash_dir / "projects"
            trash_name = self._generate_trash_name(item_name)
        else:
            raise ValueError(f"Invalid item type: {item_type}")

        if not source_path.exists():
            raise ValueError(f"{item_type.capitalize()} not found: {item_name}")

        trash_path = trash_subdir / trash_name

        # Move to trash
        shutil.move(str(source_path), str(trash_path))

        # Create trash item
        now = datetime.now()
        expires = now + timedelta(days=self.RETENTION_DAYS)

        trash_item = TrashItem(
            item_type=item_type,
            original_name=item_name,
            original_path=str(source_path),
            trash_path=str(trash_path),
            deleted_at=now.isoformat(),
            expires_at=expires.isoformat(),
            related_items=related_items,
            cascade_deleted=cascade_deleted,
            metadata=metadata,
        )

        # Update manifest
        items = self._load_manifest()
        items.append(trash_item.to_dict())
        self._save_manifest(items)

        return trash_item

    def restore(self, item_type: ItemType, trash_id: str) -> Path:
        """Restore an item from trash.

        Args:
            item_type: Type of item
            trash_id: Trash ID (the trash filename)

        Returns:
            Path to restored item

        Raises:
            ValueError: If item not found in trash
        """
        items = self._load_manifest()

        # Find the item
        item_data = None
        item_index = None
        for i, item in enumerate(items):
            if item["type"] == item_type and Path(item["trash_path"]).name == trash_id:
                item_data = item
                item_index = i
                break

        if item_data is None:
            raise ValueError(f"Item not found in trash: {trash_id}")

        trash_item = TrashItem.from_dict(item_data)
        trash_path = Path(trash_item.trash_path)
        original_path = Path(trash_item.original_path)

        if not trash_path.exists():
            raise ValueError(f"Trash file not found: {trash_path}")

        # Check if original location is available
        if original_path.exists():
            # Generate new name to avoid conflict
            stem = original_path.stem
            ext = original_path.suffix
            parent = original_path.parent
            counter = 2
            while original_path.exists():
                original_path = parent / f"{stem}-restored-{counter}{ext}"
                counter += 1

        # Ensure parent directory exists
        original_path.parent.mkdir(parents=True, exist_ok=True)

        # Move back
        shutil.move(str(trash_path), str(original_path))

        # Remove from manifest
        items.pop(item_index)
        self._save_manifest(items)

        return original_path

    def permanent_delete(self, item_type: ItemType, trash_id: str) -> None:
        """Permanently delete an item from trash.

        Args:
            item_type: Type of item
            trash_id: Trash ID (the trash filename)

        Raises:
            ValueError: If item not found in trash
        """
        items = self._load_manifest()

        # Find and remove the item
        item_index = None
        trash_path = None
        for i, item in enumerate(items):
            if item["type"] == item_type and Path(item["trash_path"]).name == trash_id:
                trash_path = Path(item["trash_path"])
                item_index = i
                break

        if item_index is None:
            raise ValueError(f"Item not found in trash: {trash_id}")

        # Delete the actual file/directory
        if trash_path and trash_path.exists():
            if trash_path.is_dir():
                shutil.rmtree(trash_path)
            else:
                trash_path.unlink()

        # Remove from manifest
        items.pop(item_index)
        self._save_manifest(items)

    def list_trash(self, item_type: Optional[ItemType] = None) -> List[TrashItem]:
        """List all items in trash.

        Args:
            item_type: Optional filter by type

        Returns:
            List of TrashItem objects
        """
        items = self._load_manifest()

        result = []
        for item_data in items:
            if item_type is None or item_data["type"] == item_type:
                result.append(TrashItem.from_dict(item_data))

        # Sort by deleted_at descending (newest first)
        return sorted(result, key=lambda x: x.deleted_at, reverse=True)

    def empty_trash(self) -> int:
        """Permanently delete all items in trash.

        Returns:
            Number of items deleted
        """
        items = self._load_manifest()
        count = len(items)

        for item_data in items:
            trash_path = Path(item_data["trash_path"])
            if trash_path.exists():
                if trash_path.is_dir():
                    shutil.rmtree(trash_path)
                else:
                    trash_path.unlink()

        # Clear manifest
        self._save_manifest([])

        return count

    def cleanup_expired(self) -> int:
        """Delete items that have exceeded retention period.

        Returns:
            Number of items cleaned up
        """
        items = self._load_manifest()
        now = datetime.now()
        cleaned = 0

        remaining_items = []
        for item_data in items:
            expires_at = datetime.fromisoformat(item_data["expires_at"])
            if expires_at < now:
                # Delete expired item
                trash_path = Path(item_data["trash_path"])
                if trash_path.exists():
                    if trash_path.is_dir():
                        shutil.rmtree(trash_path)
                    else:
                        trash_path.unlink()
                cleaned += 1
            else:
                remaining_items.append(item_data)

        if cleaned > 0:
            self._save_manifest(remaining_items)

        return cleaned

    def get_trash_item(self, item_type: ItemType, trash_id: str) -> Optional[TrashItem]:
        """Get a specific trash item.

        Args:
            item_type: Type of item
            trash_id: Trash ID

        Returns:
            TrashItem or None if not found
        """
        items = self._load_manifest()
        for item_data in items:
            if item_data["type"] == item_type and Path(item_data["trash_path"]).name == trash_id:
                return TrashItem.from_dict(item_data)
        return None

    def get_trash_stats(self) -> Dict[str, int]:
        """Get counts of items in trash by type.

        Returns:
            Dict with counts for each type
        """
        items = self._load_manifest()
        stats = {"videos": 0, "manuals": 0, "projects": 0, "total": 0}

        for item in items:
            item_type = item["type"]
            if item_type == "video":
                stats["videos"] += 1
            elif item_type == "manual":
                stats["manuals"] += 1
            elif item_type == "project":
                stats["projects"] += 1
            stats["total"] += 1

        return stats
