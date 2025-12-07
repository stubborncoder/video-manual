"""Template storage management for Word templates."""

import json
from datetime import datetime
from pathlib import Path
from typing import Optional, List
from dataclasses import dataclass

from ..config import USERS_DIR, TEMPLATES_DIR


@dataclass
class TemplateInfo:
    """Information about a Word template."""

    name: str
    is_global: bool
    size_bytes: int
    path: Path
    uploaded_at: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "name": self.name,
            "is_global": self.is_global,
            "size_bytes": self.size_bytes,
            "uploaded_at": self.uploaded_at,
        }


class TemplateStorage:
    """Manages Word template files for users and global templates.

    Templates are stored in two locations:
    - User templates: data/users/{user_id}/templates/
    - Global templates: data/templates/

    User templates take precedence over global templates with the same name.
    """

    ALLOWED_EXTENSIONS = {".docx"}
    MAX_TEMPLATE_SIZE = 10 * 1024 * 1024  # 10MB

    def __init__(self, user_id: str):
        """Initialize template storage.

        Args:
            user_id: Unique identifier for the user
        """
        self.user_id = user_id
        self.user_dir = USERS_DIR / user_id
        self.templates_dir = self.user_dir / "templates"
        self.global_templates_dir = TEMPLATES_DIR

    def ensure_directories(self) -> None:
        """Create template directories if they don't exist."""
        self.templates_dir.mkdir(parents=True, exist_ok=True)
        self.global_templates_dir.mkdir(parents=True, exist_ok=True)

    def _get_template_metadata_path(self, template_path: Path) -> Path:
        """Get the metadata JSON file path for a template."""
        return template_path.with_suffix(".json")

    def _load_template_metadata(self, template_path: Path) -> dict:
        """Load metadata for a template."""
        meta_path = self._get_template_metadata_path(template_path)
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return {}

    def _save_template_metadata(self, template_path: Path, metadata: dict) -> None:
        """Save metadata for a template."""
        meta_path = self._get_template_metadata_path(template_path)
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

    def _get_template_info(self, path: Path, is_global: bool) -> TemplateInfo:
        """Create TemplateInfo from a template file path."""
        metadata = self._load_template_metadata(path)
        return TemplateInfo(
            name=path.stem,
            is_global=is_global,
            size_bytes=path.stat().st_size,
            path=path,
            uploaded_at=metadata.get("uploaded_at"),
        )

    def list_templates(self) -> List[TemplateInfo]:
        """List all available templates (user + global).

        User templates are listed first and take precedence.

        Returns:
            List of TemplateInfo objects
        """
        templates = {}

        # First add global templates
        if self.global_templates_dir.exists():
            for path in self.global_templates_dir.glob("*.docx"):
                templates[path.stem] = self._get_template_info(path, is_global=True)

        # Then add/override with user templates
        if self.templates_dir.exists():
            for path in self.templates_dir.glob("*.docx"):
                templates[path.stem] = self._get_template_info(path, is_global=False)

        return sorted(templates.values(), key=lambda t: (t.is_global, t.name))

    def list_user_templates(self) -> List[TemplateInfo]:
        """List only user-specific templates.

        Returns:
            List of TemplateInfo objects for user templates only
        """
        templates = []
        if self.templates_dir.exists():
            for path in self.templates_dir.glob("*.docx"):
                templates.append(self._get_template_info(path, is_global=False))
        return sorted(templates, key=lambda t: t.name)

    def list_global_templates(self) -> List[TemplateInfo]:
        """List only global templates.

        Returns:
            List of TemplateInfo objects for global templates only
        """
        templates = []
        if self.global_templates_dir.exists():
            for path in self.global_templates_dir.glob("*.docx"):
                templates.append(self._get_template_info(path, is_global=True))
        return sorted(templates, key=lambda t: t.name)

    def get_template(self, name: str) -> Optional[Path]:
        """Get template path by name (user first, then global).

        Args:
            name: Template name (without .docx extension)

        Returns:
            Path to template file, or None if not found
        """
        # Check user templates first
        user_path = self.templates_dir / f"{name}.docx"
        if user_path.exists():
            return user_path

        # Fall back to global templates
        global_path = self.global_templates_dir / f"{name}.docx"
        if global_path.exists():
            return global_path

        return None

    def template_exists(self, name: str) -> bool:
        """Check if a template exists.

        Args:
            name: Template name (without .docx extension)

        Returns:
            True if template exists (user or global)
        """
        return self.get_template(name) is not None

    def user_template_exists(self, name: str) -> bool:
        """Check if a user template exists.

        Args:
            name: Template name (without .docx extension)

        Returns:
            True if user template exists
        """
        return (self.templates_dir / f"{name}.docx").exists()

    def get_template_info(self, name: str) -> Optional[TemplateInfo]:
        """Get detailed information about a template.

        Args:
            name: Template name (without .docx extension)

        Returns:
            TemplateInfo or None if not found
        """
        # Check user templates first
        user_path = self.templates_dir / f"{name}.docx"
        if user_path.exists():
            return self._get_template_info(user_path, is_global=False)

        # Fall back to global templates
        global_path = self.global_templates_dir / f"{name}.docx"
        if global_path.exists():
            return self._get_template_info(global_path, is_global=True)

        return None

    def save_template(self, content: bytes, name: str) -> TemplateInfo:
        """Save a template file.

        Args:
            content: Template file content as bytes
            name: Template name (without .docx extension)

        Returns:
            TemplateInfo for the saved template

        Raises:
            ValueError: If template is too large or invalid
        """
        # Validate size
        if len(content) > self.MAX_TEMPLATE_SIZE:
            raise ValueError(
                f"Template exceeds maximum size of {self.MAX_TEMPLATE_SIZE // (1024*1024)}MB"
            )

        # Validate it's a valid docx (basic check: ZIP with proper structure)
        if not self._is_valid_docx(content):
            raise ValueError("Invalid Word document format")

        # Ensure directory exists
        self.ensure_directories()

        # Clean up name
        safe_name = self._sanitize_name(name)

        # Save template
        template_path = self.templates_dir / f"{safe_name}.docx"
        template_path.write_bytes(content)

        # Save metadata
        metadata = {
            "uploaded_at": datetime.now().isoformat(),
            "original_name": name,
        }
        self._save_template_metadata(template_path, metadata)

        return self._get_template_info(template_path, is_global=False)

    def delete_template(self, name: str) -> bool:
        """Delete a user template.

        Args:
            name: Template name (without .docx extension)

        Returns:
            True if deleted, False if not found

        Raises:
            ValueError: If trying to delete a global template
        """
        user_path = self.templates_dir / f"{name}.docx"

        if not user_path.exists():
            # Check if it's a global template
            global_path = self.global_templates_dir / f"{name}.docx"
            if global_path.exists():
                raise ValueError("Cannot delete global templates")
            return False

        # Delete template and metadata
        user_path.unlink()
        meta_path = self._get_template_metadata_path(user_path)
        if meta_path.exists():
            meta_path.unlink()

        return True

    def _sanitize_name(self, name: str) -> str:
        """Sanitize template name for filesystem.

        Args:
            name: Original template name

        Returns:
            Sanitized name safe for filesystem
        """
        import re

        # Remove extension if present
        if name.lower().endswith(".docx"):
            name = name[:-5]

        # Replace spaces with hyphens
        name = name.replace(" ", "-")

        # Remove invalid characters
        name = re.sub(r"[^a-zA-Z0-9\-_]", "", name)

        # Limit length
        name = name[:50] if name else "template"

        return name.lower()

    def _is_valid_docx(self, content: bytes) -> bool:
        """Basic validation that content is a valid .docx file.

        Args:
            content: File content as bytes

        Returns:
            True if it appears to be a valid docx file
        """
        import zipfile
        from io import BytesIO

        try:
            with zipfile.ZipFile(BytesIO(content)) as zf:
                # Check for required docx components
                names = zf.namelist()
                required = ["[Content_Types].xml", "word/document.xml"]
                return all(r in names for r in required)
        except (zipfile.BadZipFile, KeyError):
            return False
