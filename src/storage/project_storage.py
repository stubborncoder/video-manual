"""Project storage management for organizing docs into projects."""

import json
import re
import secrets
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
import uuid

from ..config import USERS_DIR


# Default project constants
DEFAULT_PROJECT_ID = "__default__"


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

    Projects group related docs into hierarchical chapters.
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
        self.docs_dir = self.user_dir / "docs"

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
            "sections": [],  # New: Sections that contain chapters
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
            project = json.load(f)

        # Migrate legacy "Uncategorized" chapters
        chapters = project.get("chapters", [])
        modified = False
        cleaned_chapters = []

        for ch in chapters:
            if ch.get("title") == "Uncategorized":
                docs = ch.get("docs", [])
                if not docs:
                    # Remove empty "Uncategorized" chapters
                    modified = True
                    continue
                elif len(docs) == 1:
                    # Rename chapter to match the single manual's title
                    doc_id = docs[0]
                    metadata = self._get_doc_metadata(doc_id)
                    if metadata:
                        title = metadata.get("title") or doc_id.replace("-", " ").title()
                        ch["title"] = title
                        modified = True
            cleaned_chapters.append(ch)

        if modified:
            project["chapters"] = cleaned_chapters
            self._save_project(project_id, project)

        return project

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

    def delete_project(self, project_id: str, delete_docs: bool = False) -> None:
        """Delete a project.

        Args:
            project_id: Project identifier
            delete_docs: If True, also delete docs in the project

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

        if delete_docs:
            # Delete all manuals in the project
            for chapter in project.get("chapters", []):
                for doc_id in chapter.get("docs", []):
                    doc_dir = self.docs_dir / doc_id
                    if doc_dir.exists():
                        shutil.rmtree(doc_dir)
        else:
            # Just remove project_id from manual metadata
            for chapter in project.get("chapters", []):
                for doc_id in chapter.get("docs", []):
                    self._update_doc_project_ref(doc_id, None, None)

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
                    total_docs = sum(
                        len(ch.get("docs", []))
                        for ch in project.get("chapters", [])
                    )
                    project["total_docs"] = total_docs
                    project["total_chapters"] = len(project.get("chapters", []))
                    projects.append(project)

        return sorted(projects, key=lambda p: p.get("updated_at", ""), reverse=True)

    def ensure_default_project(self) -> Dict[str, Any]:
        """Ensure default project exists, creating it if necessary.

        The default project is a special project that:
        - Has a fixed ID of "__default__"
        - Cannot be deleted
        - Is marked with is_default=True
        - Chapters are created automatically when docs are added

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
            "name": "My Docs",
            "description": "Default project for new docs",
            "is_default": True,
            "created_at": now,
            "updated_at": now,
            "default_language": "en",
            "sections": [],  # New: Sections that contain chapters
            "chapters": [],  # Chapters are created automatically when docs are added
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
            "docs": [],
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
                updates.pop("docs", None)
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
                for doc_id in chapter.get("docs", []):
                    self._update_doc_project_ref(doc_id, project_id, None)
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

    # ==================== Section Management ====================

    def add_section(
        self,
        project_id: str,
        title: str,
        description: str = "",
    ) -> str:
        """Add a section to a project.

        Args:
            project_id: Project identifier
            title: Section title
            description: Section description

        Returns:
            Section ID
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        sections = project.get("sections", [])

        # Generate section ID
        section_num = len(sections) + 1
        section_id = f"sec-{section_num:02d}"

        # Ensure unique ID
        existing_ids = {sec["id"] for sec in sections}
        while section_id in existing_ids:
            section_num += 1
            section_id = f"sec-{section_num:02d}"

        section = {
            "id": section_id,
            "title": title,
            "description": description,
            "order": len(sections) + 1,
            "chapters": [],  # Chapter IDs that belong to this section
        }

        sections.append(section)
        self.update_project(project_id, {"sections": sections})

        return section_id

    def update_section(
        self,
        project_id: str,
        section_id: str,
        updates: Dict[str, Any],
    ) -> None:
        """Update a section.

        Args:
            project_id: Project identifier
            section_id: Section identifier
            updates: Fields to update (title, description)
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        sections = project.get("sections", [])
        for section in sections:
            if section["id"] == section_id:
                # Don't allow changing id or chapters through this method
                updates.pop("id", None)
                updates.pop("chapters", None)
                section.update(updates)
                self.update_project(project_id, {"sections": sections})
                return

        raise ValueError(f"Section not found: {section_id}")

    def delete_section(self, project_id: str, section_id: str, force: bool = False) -> None:
        """Delete a section.

        Args:
            project_id: Project identifier
            section_id: Section identifier
            force: If True, delete even if section has chapters (orphans them)

        Raises:
            ValueError: If section has chapters and force=False
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        sections = project.get("sections", [])
        new_sections = []

        for section in sections:
            if section["id"] == section_id:
                # Check if section has chapters
                if section.get("chapters") and not force:
                    raise ValueError(
                        f"Cannot delete section with chapters. "
                        f"Move or delete the {len(section['chapters'])} chapter(s) first, "
                        f"or use force=True to orphan them."
                    )
            else:
                new_sections.append(section)

        # Re-order remaining sections
        for i, section in enumerate(new_sections):
            section["order"] = i + 1

        self.update_project(project_id, {"sections": new_sections})

    def reorder_sections(self, project_id: str, section_order: List[str]) -> None:
        """Reorder sections in a project.

        Args:
            project_id: Project identifier
            section_order: List of section IDs in desired order
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        sections = project.get("sections", [])
        section_map = {sec["id"]: sec for sec in sections}

        # Validate all IDs exist
        for sec_id in section_order:
            if sec_id not in section_map:
                raise ValueError(f"Section not found: {sec_id}")

        # Reorder
        new_sections = []
        for i, sec_id in enumerate(section_order):
            section = section_map[sec_id]
            section["order"] = i + 1
            new_sections.append(section)

        self.update_project(project_id, {"sections": new_sections})

    def move_chapter_to_section(
        self,
        project_id: str,
        chapter_id: str,
        target_section_id: Optional[str],
    ) -> None:
        """Move a chapter to a different section (or remove from section if target_section_id is None).

        Args:
            project_id: Project identifier
            chapter_id: Chapter identifier
            target_section_id: Target section identifier (None to remove from all sections)
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        sections = project.get("sections", [])

        # Remove from current section
        for section in sections:
            if chapter_id in section.get("chapters", []):
                section["chapters"].remove(chapter_id)

        # Add to target section if specified
        if target_section_id:
            target_found = False
            for section in sections:
                if section["id"] == target_section_id:
                    if chapter_id not in section["chapters"]:
                        section["chapters"].append(chapter_id)
                    target_found = True
                    break

            if not target_found:
                raise ValueError(f"Section not found: {target_section_id}")

        self.update_project(project_id, {"sections": sections})

    def list_sections(self, project_id: str) -> List[Dict[str, Any]]:
        """List all sections in a project.

        Args:
            project_id: Project identifier

        Returns:
            List of section dicts
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        return sorted(project.get("sections", []), key=lambda s: s.get("order", 0))

    # ==================== Doc Organization ====================

    def add_doc_to_project(
        self,
        project_id: str,
        doc_id: str,
        chapter_id: Optional[str] = None,
    ) -> None:
        """Add a doc to a project.

        Args:
            project_id: Project identifier
            doc_id: Doc identifier
            chapter_id: Optional chapter to add to (creates chapter from doc title if None)
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        # Verify manual exists
        doc_dir = self.docs_dir / doc_id
        if not doc_dir.exists():
            raise ValueError(f"Manual not found: {doc_id}")

        chapters = project.get("chapters", [])

        # If no chapter specified, create a chapter named after the manual
        if chapter_id is None:
            # Get manual title from metadata
            from .user_storage import UserStorage
            user_storage = UserStorage(self.user_id)
            metadata = user_storage.get_doc_metadata(doc_id)
            doc_title = metadata.get("title") if metadata else None

            # Use manual title or ID as chapter name
            chapter_title = doc_title or doc_id.replace("-", " ").title()

            # Create a new chapter for this manual
            chapter_id = self.add_chapter(project_id, chapter_title)
            # Refresh project data
            project = self.get_project(project_id)
            chapters = project.get("chapters", [])

        # Find chapter and add manual
        chapter_found = False
        for chapter in chapters:
            if chapter["id"] == chapter_id:
                if doc_id not in chapter["docs"]:
                    chapter["docs"].append(doc_id)
                chapter_found = True
                break

        if not chapter_found:
            raise ValueError(f"Chapter not found: {chapter_id}")

        self.update_project(project_id, {"chapters": chapters})

        # Update manual metadata
        self._update_doc_project_ref(doc_id, project_id, chapter_id)

    def remove_doc_from_project(self, project_id: str, doc_id: str) -> None:
        """Remove a doc from a project (keeps the manual, just removes association).

        Args:
            project_id: Project identifier
            doc_id: Doc identifier
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])
        chapter_to_cleanup = None

        for chapter in chapters:
            if doc_id in chapter["docs"]:
                chapter["docs"].remove(doc_id)
                # Mark empty chapters for cleanup (since each manual creates its own chapter)
                if not chapter["docs"]:
                    chapter_to_cleanup = chapter["id"]
                break

        # Remove empty chapters
        if chapter_to_cleanup:
            chapters = [ch for ch in chapters if ch["id"] != chapter_to_cleanup]

        self.update_project(project_id, {"chapters": chapters})

        # Update manual metadata
        self._update_doc_project_ref(doc_id, None, None)

    def move_doc_to_chapter(
        self,
        project_id: str,
        doc_id: str,
        target_chapter_id: str,
    ) -> None:
        """Move a manual to a different chapter within the same project.

        Args:
            project_id: Project identifier
            doc_id: Doc identifier
            target_chapter_id: Target chapter identifier
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])

        # Remove from current chapter
        for chapter in chapters:
            if doc_id in chapter["docs"]:
                chapter["docs"].remove(doc_id)
                break

        # Add to target chapter
        target_found = False
        for chapter in chapters:
            if chapter["id"] == target_chapter_id:
                if doc_id not in chapter["docs"]:
                    chapter["docs"].append(doc_id)
                target_found = True
                break

        if not target_found:
            raise ValueError(f"Chapter not found: {target_chapter_id}")

        self.update_project(project_id, {"chapters": chapters})

        # Update manual metadata
        self._update_doc_project_ref(doc_id, project_id, target_chapter_id)

    def reorder_docs_in_chapter(
        self,
        project_id: str,
        chapter_id: str,
        doc_order: List[str],
    ) -> None:
        """Reorder manuals within a chapter.

        Args:
            project_id: Project identifier
            chapter_id: Chapter identifier
            doc_order: List of doc IDs in desired order
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        chapters = project.get("chapters", [])
        for chapter in chapters:
            if chapter["id"] == chapter_id:
                # Validate all manual IDs exist in chapter
                current_docs = set(chapter["docs"])
                new_docs = set(doc_order)
                if current_docs != new_docs:
                    raise ValueError("Manual order must contain exactly the same manuals")
                chapter["docs"] = doc_order
                self.update_project(project_id, {"chapters": chapters})
                return

        raise ValueError(f"Chapter not found: {chapter_id}")

    # ==================== Queries ====================

    def get_project_docs(self, project_id: str) -> List[Dict[str, Any]]:
        """Get all manuals in a project with their metadata.

        Args:
            project_id: Project identifier

        Returns:
            List of doc info dicts with chapter context
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        docs = []
        for chapter in project.get("chapters", []):
            for doc_id in chapter.get("docs", []):
                doc_info = {
                    "id": doc_id,
                    "chapter_id": chapter["id"],
                    "chapter_title": chapter["title"],
                }

                # Try to get manual metadata
                metadata = self._get_doc_metadata(doc_id)
                if metadata:
                    doc_info["video_path"] = metadata.get("video_path")
                    doc_info["created_at"] = metadata.get("created_at")
                    doc_info["languages"] = metadata.get("languages_generated", [])
                    doc_info["tags"] = metadata.get("tags", [])
                    doc_info["version"] = metadata.get("version", {}).get("number", "1.0.0")

                docs.append(doc_info)

        return docs

    def get_docs_by_tag(self, tag: str) -> List[str]:
        """Find all manuals with a specific tag.

        Args:
            tag: Tag to search for

        Returns:
            List of doc IDs
        """
        if not self.docs_dir.exists():
            return []

        matching = []
        for doc_dir in self.docs_dir.iterdir():
            if doc_dir.is_dir():
                metadata = self._get_doc_metadata(doc_dir.name)
                if metadata and tag in metadata.get("tags", []):
                    matching.append(doc_dir.name)

        return matching

    def get_unassigned_docs(self) -> List[str]:
        """Get manuals not assigned to any project.

        Returns:
            List of doc IDs
        """
        if not self.docs_dir.exists():
            return []

        unassigned = []
        for doc_dir in self.docs_dir.iterdir():
            if doc_dir.is_dir():
                metadata = self._get_doc_metadata(doc_dir.name)
                if not metadata or not metadata.get("project_id"):
                    unassigned.append(doc_dir.name)

        return unassigned

    # ==================== Tags ====================

    def add_tag_to_doc(self, doc_id: str, tag: str) -> None:
        """Add a tag to a manual.

        Args:
            doc_id: Doc identifier
            tag: Tag to add
        """
        metadata = self._get_doc_metadata(doc_id)
        if metadata is None:
            metadata = {}

        tags = metadata.get("tags", [])
        if tag not in tags:
            tags.append(tag)
            self._update_doc_metadata(doc_id, {"tags": tags})

    def remove_tag_from_doc(self, doc_id: str, tag: str) -> None:
        """Remove a tag from a manual.

        Args:
            doc_id: Doc identifier
            tag: Tag to remove
        """
        metadata = self._get_doc_metadata(doc_id)
        if metadata is None:
            return

        tags = metadata.get("tags", [])
        if tag in tags:
            tags.remove(tag)
            self._update_doc_metadata(doc_id, {"tags": tags})

    def list_all_tags(self) -> List[str]:
        """List all unique tags across all manuals.

        Returns:
            Sorted list of unique tags
        """
        if not self.docs_dir.exists():
            return []

        all_tags = set()
        for doc_dir in self.docs_dir.iterdir():
            if doc_dir.is_dir():
                metadata = self._get_doc_metadata(doc_dir.name)
                if metadata:
                    all_tags.update(metadata.get("tags", []))

        return sorted(all_tags)

    # ==================== Share Token Methods ====================

    def create_share_token(self, project_id: str, language: str = "en") -> str:
        """Create a share token for a project.

        Generates a unique, cryptographically secure token that can be used
        to access the compiled project without authentication.

        Note: Projects must be compiled before they can be shared.

        Args:
            project_id: Project identifier
            language: Language code for the shared version

        Returns:
            The generated share token

        Raises:
            ValueError: If project not found or not compiled
        """
        project = self.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        # Check if project has been compiled
        compiled_dir = self.projects_dir / project_id / "compiled" / "current"
        if not compiled_dir.exists():
            raise ValueError("Project must be compiled before sharing")

        token = secrets.token_urlsafe(32)

        share_info = {
            "token": token,
            "language": language,
            "created_at": datetime.now().isoformat(),
            "expires_at": None,  # Permanent until revoked
        }

        project["share"] = share_info
        project["updated_at"] = datetime.now().isoformat()
        self._save_project(project_id, project)

        return token

    def get_share_info(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get share information for a project.

        Args:
            project_id: Project identifier

        Returns:
            Share info dict or None if not shared
        """
        project = self.get_project(project_id)
        if project is None:
            return None
        return project.get("share")

    def revoke_share(self, project_id: str) -> bool:
        """Revoke the share token for a project.

        Args:
            project_id: Project identifier

        Returns:
            True if share was revoked, False if no share existed
        """
        project = self.get_project(project_id)
        if project is None or "share" not in project:
            return False

        # Remove share from project data
        del project["share"]
        project["updated_at"] = datetime.now().isoformat()
        self._save_project(project_id, project)

        return True

    def is_compiled(self, project_id: str) -> bool:
        """Check if a project has been compiled.

        Args:
            project_id: Project identifier

        Returns:
            True if project has compiled content
        """
        compiled_dir = self.projects_dir / project_id / "compiled" / "current"
        return compiled_dir.exists()

    # ==================== Private Helpers ====================

    def _save_project(self, project_id: str, data: Dict[str, Any]) -> None:
        """Save project data to file."""
        project_file = self.projects_dir / project_id / "project.json"
        with open(project_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _get_doc_metadata(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a manual."""
        metadata_file = self.docs_dir / doc_id / "metadata.json"
        if not metadata_file.exists():
            return None

        with open(metadata_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _update_doc_metadata(self, doc_id: str, updates: Dict[str, Any]) -> None:
        """Update manual metadata."""
        metadata_file = self.docs_dir / doc_id / "metadata.json"

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

    def _update_doc_project_ref(
        self,
        doc_id: str,
        project_id: Optional[str],
        chapter_id: Optional[str],
    ) -> None:
        """Update project/chapter reference in manual metadata."""
        self._update_doc_metadata(doc_id, {
            "project_id": project_id,
            "chapter_id": chapter_id,
        })


def find_project_by_share_token(token: str) -> Optional[Tuple[str, str, Dict[str, Any]]]:
    """Find a project by its share token across all users.

    This is a module-level function that searches all user directories
    to find a project with the given share token.

    Args:
        token: The share token to search for

    Returns:
        Tuple of (user_id, project_id, share_info) or None if not found
    """
    if not USERS_DIR.exists():
        return None

    for user_dir in USERS_DIR.iterdir():
        if not user_dir.is_dir():
            continue

        user_id = user_dir.name
        projects_dir = user_dir / "projects"

        if not projects_dir.exists():
            continue

        for project_dir in projects_dir.iterdir():
            if not project_dir.is_dir():
                continue

            project_file = project_dir / "project.json"
            if not project_file.exists():
                continue

            try:
                with open(project_file, "r", encoding="utf-8") as f:
                    project = json.load(f)

                share_info = project.get("share")
                if share_info and share_info.get("token") == token:
                    return (user_id, project_dir.name, share_info)
            except (json.JSONDecodeError, IOError):
                continue

    return None
