"""Project storage management for organizing manuals into projects."""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
import uuid

from ..config import USERS_DIR


# Default project constants
DEFAULT_PROJECT_ID = "__default__"
DEFAULT_CHAPTER_ID = "__uncategorized__"


def slugify(text: str) -> str:
    """Convert text to a URL/filesystem-friendly slug.

    Args:
        text: Text to convert

    Returns:
        Lowercase string with only alphanumeric chars and hyphens
    """
    text = text.lower()
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'[^a-z0-9\-]', '', text)
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text[:50] if text else "project"


class ProjectStorage:
    """Manages project organization and metadata.

    Projects group related manuals into hierarchical chapters.
    Structure:
        users/{user_id}/projects/{project_id}/
            project.json        # Project configuration
            exports/            # Exported PDFs
    """

    def __init__(self, user_id: str):
        """Initialize project storage.

        Args:
            user_id: User identifier
        """
        self.user_id = user_id
        self.user_dir = USERS_DIR / user_id
        self.projects_dir = self.user_dir / "projects"
        self.manuals_dir = self.user_dir / "manuals"

    def ensure_projects_dir(self) -> None:
        """Create projects directory if it doesn't exist."""
        self.projects_dir.mkdir(parents=True, exist_ok=True)

    # ==================== Project CRUD ====================

    def create_project(
        self,
        name: str,
        description: str = "",
        default_language: str = "en",
    ) -> str:
        """Create a new project.

        Args:
            name: Human-readable project name
            description: Project description
            default_language: Default language for exports

        Returns:
            Project ID (slug)
        """
        self.ensure_projects_dir()

        project_id = slugify(name)

        # Handle duplicate names
        if (self.projects_dir / project_id).exists():
            counter = 2
            while (self.projects_dir / f"{project_id}-{counter}").exists():
                counter += 1
            project_id = f"{project_id}-{counter}"

        project_dir = self.projects_dir / project_id
        project_dir.mkdir(parents=True)
        (project_dir / "exports").mkdir()

        now = datetime.now().isoformat()
        project_data = {
            "id": project_id,
            "name": name,
            "description": description,
            "created_at": now,
            "updated_at": now,
            "default_language": default_language,
            "chapters": [],
            "tags": [],
            "template_id": None,
            "export_settings": {
                "include_toc": True,
                "include_chapter_covers": True,
                "page_size": "A4",
            },
        }

        self._save_project(project_id, project_data)
        return project_id

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get project data.

        Args:
            project_id: Project identifier

        Returns:
            Project data dict or None if not found
        """
        project_file = self.projects_dir / project_id / "project.json"
        if not project_file.exists():
            return None

        with open(project_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def update_project(self, project_id: str, updates: Dict[str, Any]) -> None:
        """Update project data.

        Args:
            project_id: Project identifier
            updates: Fields to update
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        # Don't allow changing id
        updates.pop("id", None)

        project.update(updates)
        project["updated_at"] = datetime.now().isoformat()

        self._save_project(project_id, project)

    def delete_project(self, project_id: str, delete_manuals: bool = False) -> None:
        """Delete a project.

        Args:
            project_id: Project identifier
            delete_manuals: If True, also delete manuals in the project

        Raises:
            ValueError: If project not found or is the default project
        """
        import shutil

        # Prevent deletion of default project
        if self.is_default_project(project_id):
            raise ValueError("Cannot delete the default project")

        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        if delete_manuals:
            # Delete all manuals in the project
            for chapter in project.get("chapters", []):
                for manual_id in chapter.get("manuals", []):
                    manual_dir = self.manuals_dir / manual_id
                    if manual_dir.exists():
                        shutil.rmtree(manual_dir)
        else:
            # Just remove project_id from manual metadata
            for chapter in project.get("chapters", []):
                for manual_id in chapter.get("manuals", []):
                    self._update_manual_project_ref(manual_id, None, None)

        # Delete project directory
        project_dir = self.projects_dir / project_id
        if project_dir.exists():
            shutil.rmtree(project_dir)

    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects for this user.

        Returns:
            List of project data dicts with summary info
        """
        if not self.projects_dir.exists():
            return []

        projects = []
        for project_dir in self.projects_dir.iterdir():
            if project_dir.is_dir():
                project = self.get_project(project_dir.name)
                if project:
                    # Add computed fields
                    total_manuals = sum(
                        len(ch.get("manuals", []))
                        for ch in project.get("chapters", [])
                    )
                    project["total_manuals"] = total_manuals
                    project["total_chapters"] = len(project.get("chapters", []))
                    projects.append(project)

        return sorted(projects, key=lambda p: p.get("updated_at", ""), reverse=True)

    def ensure_default_project(self) -> Dict[str, Any]:
        """Ensure default project exists, creating it if necessary.

        The default project is a special project that:
        - Has a fixed ID of "__default__"
        - Cannot be deleted
        - Is marked with is_default=True
        - Has a default "Uncategorized" chapter

        Returns:
            The default project data
        """
        self.ensure_projects_dir()

        project = self.get_project(DEFAULT_PROJECT_ID)
        if project:
            return project

        # Create default project
        project_dir = self.projects_dir / DEFAULT_PROJECT_ID
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "exports").mkdir(exist_ok=True)

        now = datetime.now().isoformat()
        project_data = {
            "id": DEFAULT_PROJECT_ID,
            "name": "My Manuals",
            "description": "Default project for new manuals",
            "is_default": True,
            "created_at": now,
            "updated_at": now,
            "default_language": "en",
            "chapters": [
                {
                    "id": DEFAULT_CHAPTER_ID,
                    "title": "Uncategorized",
                    "description": "Manuals not assigned to a specific chapter",
                    "order": 0,
                    "manuals": [],
                }
            ],
            "tags": [],
            "template_id": None,
            "export_settings": {
                "include_toc": True,
                "include_chapter_covers": True,
                "page_size": "A4",
            },
        }

        self._save_project(DEFAULT_PROJECT_ID, project_data)
        return project_data

    def is_default_project(self, project_id: str) -> bool:
        """Check if a project is the default project.

        Args:
            project_id: Project identifier

        Returns:
            True if this is the default project
        """
        return project_id == DEFAULT_PROJECT_ID

    # ==================== Chapter Management ====================

    def add_chapter(
        self,
        project_id: str,
        title: str,
        description: str = "",
    ) -> str:
        """Add a chapter to a project.

        Args:
            project_id: Project identifier
            title: Chapter title
            description: Chapter description

        Returns:
            Chapter ID
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])

        # Generate chapter ID
        chapter_num = len(chapters) + 1
        chapter_id = f"ch-{chapter_num:02d}"

        # Ensure unique ID
        existing_ids = {ch["id"] for ch in chapters}
        while chapter_id in existing_ids:
            chapter_num += 1
            chapter_id = f"ch-{chapter_num:02d}"

        chapter = {
            "id": chapter_id,
            "title": title,
            "description": description,
            "order": len(chapters) + 1,
            "manuals": [],
        }

        chapters.append(chapter)
        self.update_project(project_id, {"chapters": chapters})

        return chapter_id

    def update_chapter(
        self,
        project_id: str,
        chapter_id: str,
        updates: Dict[str, Any],
    ) -> None:
        """Update a chapter.

        Args:
            project_id: Project identifier
            chapter_id: Chapter identifier
            updates: Fields to update (title, description)
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])
        for chapter in chapters:
            if chapter["id"] == chapter_id:
                # Don't allow changing id or manuals through this method
                updates.pop("id", None)
                updates.pop("manuals", None)
                chapter.update(updates)
                self.update_project(project_id, {"chapters": chapters})
                return

        raise ValueError(f"Chapter not found: {chapter_id}")

    def delete_chapter(self, project_id: str, chapter_id: str) -> None:
        """Delete a chapter (manuals become unassigned within project).

        Args:
            project_id: Project identifier
            chapter_id: Chapter identifier
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])
        new_chapters = []

        for chapter in chapters:
            if chapter["id"] == chapter_id:
                # Update manual metadata to remove chapter reference
                for manual_id in chapter.get("manuals", []):
                    self._update_manual_project_ref(manual_id, project_id, None)
            else:
                new_chapters.append(chapter)

        # Re-order remaining chapters
        for i, chapter in enumerate(new_chapters):
            chapter["order"] = i + 1

        self.update_project(project_id, {"chapters": new_chapters})

    def reorder_chapters(self, project_id: str, chapter_order: List[str]) -> None:
        """Reorder chapters in a project.

        Args:
            project_id: Project identifier
            chapter_order: List of chapter IDs in desired order
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])
        chapter_map = {ch["id"]: ch for ch in chapters}

        # Validate all IDs exist
        for ch_id in chapter_order:
            if ch_id not in chapter_map:
                raise ValueError(f"Chapter not found: {ch_id}")

        # Reorder
        new_chapters = []
        for i, ch_id in enumerate(chapter_order):
            chapter = chapter_map[ch_id]
            chapter["order"] = i + 1
            new_chapters.append(chapter)

        self.update_project(project_id, {"chapters": new_chapters})

    def list_chapters(self, project_id: str) -> List[Dict[str, Any]]:
        """List all chapters in a project.

        Args:
            project_id: Project identifier

        Returns:
            List of chapter dicts
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        return sorted(project.get("chapters", []), key=lambda c: c.get("order", 0))

    # ==================== Manual Organization ====================

    def add_manual_to_project(
        self,
        project_id: str,
        manual_id: str,
        chapter_id: Optional[str] = None,
    ) -> None:
        """Add a manual to a project.

        Args:
            project_id: Project identifier
            manual_id: Manual identifier
            chapter_id: Optional chapter to add to (creates "Uncategorized" if None)
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        # Verify manual exists
        manual_dir = self.manuals_dir / manual_id
        if not manual_dir.exists():
            raise ValueError(f"Manual not found: {manual_id}")

        chapters = project.get("chapters", [])

        # If no chapter specified, use or create "Uncategorized"
        if chapter_id is None:
            uncategorized = next(
                (ch for ch in chapters if ch["id"] == "uncategorized"),
                None
            )
            if not uncategorized:
                chapter_id = self.add_chapter(project_id, "Uncategorized")
                # Refresh project data
                project = self.get_project(project_id)
                chapters = project.get("chapters", [])
            else:
                chapter_id = "uncategorized"

        # Find chapter and add manual
        chapter_found = False
        for chapter in chapters:
            if chapter["id"] == chapter_id:
                if manual_id not in chapter["manuals"]:
                    chapter["manuals"].append(manual_id)
                chapter_found = True
                break

        if not chapter_found:
            raise ValueError(f"Chapter not found: {chapter_id}")

        self.update_project(project_id, {"chapters": chapters})

        # Update manual metadata
        self._update_manual_project_ref(manual_id, project_id, chapter_id)

    def remove_manual_from_project(self, project_id: str, manual_id: str) -> None:
        """Remove a manual from a project (keeps the manual, just removes association).

        Args:
            project_id: Project identifier
            manual_id: Manual identifier
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])
        for chapter in chapters:
            if manual_id in chapter["manuals"]:
                chapter["manuals"].remove(manual_id)
                break

        self.update_project(project_id, {"chapters": chapters})

        # Update manual metadata
        self._update_manual_project_ref(manual_id, None, None)

    def move_manual_to_chapter(
        self,
        project_id: str,
        manual_id: str,
        target_chapter_id: str,
    ) -> None:
        """Move a manual to a different chapter within the same project.

        Args:
            project_id: Project identifier
            manual_id: Manual identifier
            target_chapter_id: Target chapter identifier
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])

        # Remove from current chapter
        for chapter in chapters:
            if manual_id in chapter["manuals"]:
                chapter["manuals"].remove(manual_id)
                break

        # Add to target chapter
        target_found = False
        for chapter in chapters:
            if chapter["id"] == target_chapter_id:
                if manual_id not in chapter["manuals"]:
                    chapter["manuals"].append(manual_id)
                target_found = True
                break

        if not target_found:
            raise ValueError(f"Chapter not found: {target_chapter_id}")

        self.update_project(project_id, {"chapters": chapters})

        # Update manual metadata
        self._update_manual_project_ref(manual_id, project_id, target_chapter_id)

    def reorder_manuals_in_chapter(
        self,
        project_id: str,
        chapter_id: str,
        manual_order: List[str],
    ) -> None:
        """Reorder manuals within a chapter.

        Args:
            project_id: Project identifier
            chapter_id: Chapter identifier
            manual_order: List of manual IDs in desired order
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])
        for chapter in chapters:
            if chapter["id"] == chapter_id:
                # Validate all manual IDs exist in chapter
                current_manuals = set(chapter["manuals"])
                new_manuals = set(manual_order)
                if current_manuals != new_manuals:
                    raise ValueError("Manual order must contain exactly the same manuals")
                chapter["manuals"] = manual_order
                self.update_project(project_id, {"chapters": chapters})
                return

        raise ValueError(f"Chapter not found: {chapter_id}")

    # ==================== Queries ====================

    def get_project_manuals(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all manuals in a project with their metadata.

        Args:
            project_id: Project identifier

        Returns:
            List of manual info dicts with chapter context
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        manuals = []
        for chapter in project.get("chapters", []):
            for manual_id in chapter.get("manuals", []):
                manual_info = {
                    "id": manual_id,
                    "chapter_id": chapter["id"],
                    "chapter_title": chapter["title"],
                }

                # Try to get manual metadata
                metadata = self._get_manual_metadata(manual_id)
                if metadata:
                    manual_info["video_path"] = metadata.get("video_path")
                    manual_info["created_at"] = metadata.get("created_at")
                    manual_info["languages"] = metadata.get("languages_generated", [])
                    manual_info["tags"] = metadata.get("tags", [])
                    manual_info["version"] = metadata.get("version", {}).get("number", "1.0.0")

                manuals.append(manual_info)

        return manuals

    def get_manuals_by_tag(self, tag: str) -> List[str]:
        """Find all manuals with a specific tag.

        Args:
            tag: Tag to search for

        Returns:
            List of manual IDs
        """
        if not self.manuals_dir.exists():
            return []

        matching = []
        for manual_dir in self.manuals_dir.iterdir():
            if manual_dir.is_dir():
                metadata = self._get_manual_metadata(manual_dir.name)
                if metadata and tag in metadata.get("tags", []):
                    matching.append(manual_dir.name)

        return matching

    def get_unassigned_manuals(self) -> List[str]:
        """Get manuals not assigned to any project.

        Returns:
            List of manual IDs
        """
        if not self.manuals_dir.exists():
            return []

        unassigned = []
        for manual_dir in self.manuals_dir.iterdir():
            if manual_dir.is_dir():
                metadata = self._get_manual_metadata(manual_dir.name)
                if not metadata or not metadata.get("project_id"):
                    unassigned.append(manual_dir.name)

        return unassigned

    # ==================== Tags ====================

    def add_tag_to_manual(self, manual_id: str, tag: str) -> None:
        """Add a tag to a manual.

        Args:
            manual_id: Manual identifier
            tag: Tag to add
        """
        metadata = self._get_manual_metadata(manual_id)
        if metadata is None:
            metadata = {}

        tags = metadata.get("tags", [])
        if tag not in tags:
            tags.append(tag)
            self._update_manual_metadata(manual_id, {"tags": tags})

    def remove_tag_from_manual(self, manual_id: str, tag: str) -> None:
        """Remove a tag from a manual.

        Args:
            manual_id: Manual identifier
            tag: Tag to remove
        """
        metadata = self._get_manual_metadata(manual_id)
        if metadata is None:
            return

        tags = metadata.get("tags", [])
        if tag in tags:
            tags.remove(tag)
            self._update_manual_metadata(manual_id, {"tags": tags})

    def list_all_tags(self) -> List[str]:
        """List all unique tags across all manuals.

        Returns:
            Sorted list of unique tags
        """
        if not self.manuals_dir.exists():
            return []

        all_tags = set()
        for manual_dir in self.manuals_dir.iterdir():
            if manual_dir.is_dir():
                metadata = self._get_manual_metadata(manual_dir.name)
                if metadata:
                    all_tags.update(metadata.get("tags", []))

        return sorted(all_tags)

    # ==================== Private Helpers ====================

    def _save_project(self, project_id: str, data: Dict[str, Any]) -> None:
        """Save project data to file."""
        project_file = self.projects_dir / project_id / "project.json"
        with open(project_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _get_manual_metadata(self, manual_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a manual."""
        metadata_file = self.manuals_dir / manual_id / "metadata.json"
        if not metadata_file.exists():
            return None

        with open(metadata_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _update_manual_metadata(self, manual_id: str, updates: Dict[str, Any]) -> None:
        """Update manual metadata."""
        metadata_file = self.manuals_dir / manual_id / "metadata.json"

        if metadata_file.exists():
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        else:
            metadata = {}

        metadata.update(updates)

        # Ensure directory exists
        metadata_file.parent.mkdir(parents=True, exist_ok=True)

        with open(metadata_file, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    def _update_manual_project_ref(
        self,
        manual_id: str,
        project_id: Optional[str],
        chapter_id: Optional[str],
    ) -> None:
        """Update project/chapter reference in manual metadata."""
        self._update_manual_metadata(manual_id, {
            "project_id": project_id,
            "chapter_id": chapter_id,
        })
