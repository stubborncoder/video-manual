"""Version storage management for project compilation tracking."""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from ..config import USERS_DIR


class CompilationVersionStorage:
    """Manages project compilation version history with auto-save support.

    Implements versioning for compiled project manuals:
    - Auto-save: Creates version snapshot before each new compilation
    - Manual: User can add notes/tags to versions
    - Restore: Can restore previous compilation to current

    Storage structure:
        projects/{project_id}/
            compiled/
                current/                    # Latest compilation
                    manual_{lang}.md
                    screenshots/
                    compilation.json
                versions/                   # Historical versions
                    v1.0.0_20251128_143000/
                        manual_{lang}.md
                        screenshots/
                        compilation.json
            compilation_history.json        # Version registry
    """

    def __init__(self, user_id: str, project_id: str):
        """Initialize compilation version storage.

        Args:
            user_id: User identifier
            project_id: Project identifier
        """
        self.user_id = user_id
        self.project_id = project_id
        self.user_dir = USERS_DIR / user_id
        self.project_dir = self.user_dir / "projects" / project_id
        self.compiled_dir = self.project_dir / "compiled"
        self.current_dir = self.compiled_dir / "current"
        self.versions_dir = self.compiled_dir / "versions"
        self.history_path = self.project_dir / "compilation_history.json"

    def _load_history(self) -> Dict[str, Any]:
        """Load compilation history."""
        if not self.history_path.exists():
            return {
                "current_version": None,
                "versions": [],
            }

        with open(self.history_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_history(self, history: Dict[str, Any]) -> None:
        """Save compilation history."""
        history["updated_at"] = datetime.now().isoformat()
        with open(self.history_path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)

    def get_current_version(self) -> Optional[str]:
        """Get current version number.

        Returns:
            Version string (e.g., "1.0.0") or None if no compilations exist
        """
        history = self._load_history()
        return history.get("current_version")

    def _bump_version_number(self, current: Optional[str], bump_type: str = "patch") -> str:
        """Calculate next version number.

        Args:
            current: Current version string (can be None for first version)
            bump_type: Type of bump ("major", "minor", or "patch")

        Returns:
            New version string
        """
        if current is None:
            return "1.0.0"

        parts = current.split(".")
        if len(parts) != 3:
            parts = ["1", "0", "0"]

        major, minor, patch = int(parts[0]), int(parts[1]), int(parts[2])

        if bump_type == "major":
            major += 1
            minor = 0
            patch = 0
        elif bump_type == "minor":
            minor += 1
            patch = 0
        else:  # patch
            patch += 1

        return f"{major}.{minor}.{patch}"

    def _get_version_folder_name(self, version: str) -> str:
        """Generate folder name for a version.

        Args:
            version: Version string

        Returns:
            Folder name like "v1.0.0_20251128_143000"
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"v{version}_{timestamp}"

    def _has_current_compilation(self) -> bool:
        """Check if there's a current compilation to version.

        Returns:
            True if current compilation exists with content
        """
        if not self.current_dir.exists():
            # Check legacy structure (files directly in compiled/)
            if self.compiled_dir.exists():
                for f in self.compiled_dir.glob("manual_*.md"):
                    if f.is_file():
                        return True
            return False

        # Check for any manual files in current/
        for f in self.current_dir.glob("manual_*.md"):
            if f.is_file():
                return True
        return False

    def _migrate_legacy_structure(self) -> None:
        """Migrate from legacy structure to versioned structure.

        Legacy: compiled/manual_en.md, compiled/screenshots/
        New: compiled/current/manual_en.md, compiled/current/screenshots/
        """
        if self.current_dir.exists():
            return  # Already migrated

        # Check if there are files directly in compiled/
        has_legacy_files = False
        for f in self.compiled_dir.glob("manual_*.md"):
            if f.is_file():
                has_legacy_files = True
                break

        if not has_legacy_files:
            return  # Nothing to migrate

        # Create current directory
        self.current_dir.mkdir(parents=True, exist_ok=True)

        # Move manual files
        for f in self.compiled_dir.glob("manual_*.md"):
            if f.is_file():
                shutil.move(str(f), str(self.current_dir / f.name))

        # Move compilation.json
        compilation_json = self.compiled_dir / "compilation.json"
        if compilation_json.exists():
            shutil.move(str(compilation_json), str(self.current_dir / "compilation.json"))

        # Move screenshots
        old_screenshots = self.compiled_dir / "screenshots"
        if old_screenshots.exists() and old_screenshots.is_dir():
            new_screenshots = self.current_dir / "screenshots"
            shutil.move(str(old_screenshots), str(new_screenshots))

        # Initialize history if not exists
        if not self.history_path.exists():
            history = {
                "current_version": "1.0.0",
                "versions": [{
                    "version": "1.0.0",
                    "created_at": datetime.now().isoformat(),
                    "folder": None,  # Current, not in versions folder
                    "languages": self._detect_languages(self.current_dir),
                    "source_docs": [],  # Unknown for legacy
                    "notes": "Migrated from legacy structure",
                    "tags": [],
                }],
            }
            self._save_history(history)

    def _detect_languages(self, directory: Path) -> List[str]:
        """Detect available languages from manual files.

        Args:
            directory: Directory to scan

        Returns:
            List of language codes
        """
        languages = []
        for f in directory.glob("manual_*.md"):
            # Extract language from manual_en.md -> en
            name = f.stem  # manual_en
            if name.startswith("manual_"):
                lang = name[7:]  # Remove "manual_" prefix
                languages.append(lang)
        return sorted(languages)

    def auto_save_before_compile(self) -> Optional[str]:
        """Create automatic version snapshot before new compilation.

        Should be called before each compilation to preserve current state.
        Only creates a snapshot if content already exists.

        Returns:
            New version string if snapshot was created, None otherwise
        """
        # Migrate legacy structure if needed
        self._migrate_legacy_structure()

        # Check if there's existing content to preserve
        if not self._has_current_compilation():
            return None  # Nothing to version

        history = self._load_history()
        current_version = history.get("current_version")

        if current_version is None:
            # First compilation, no need to snapshot
            return None

        # Create snapshot of current state
        folder_name = self._get_version_folder_name(current_version)
        snapshot_dir = self.versions_dir / folder_name
        snapshot_dir.mkdir(parents=True, exist_ok=True)

        # Copy all files from current to snapshot
        if self.current_dir.exists():
            for item in self.current_dir.iterdir():
                if item.is_file():
                    shutil.copy2(item, snapshot_dir / item.name)
                elif item.is_dir():
                    shutil.copytree(item, snapshot_dir / item.name)

        # Update version entry with snapshot folder
        for v in history["versions"]:
            if v["version"] == current_version and v.get("folder") is None:
                v["folder"] = folder_name
                v["snapshot_created_at"] = datetime.now().isoformat()
                break

        # Bump to next patch version
        new_version = self._bump_version_number(current_version, "patch")
        history["current_version"] = new_version

        self._save_history(history)

        return new_version

    def save_compilation(
        self,
        languages: List[str],
        source_docs: List[Dict[str, str]],
        merge_plan: Dict[str, Any],
        notes: str = "",
        tags: Optional[List[str]] = None,
    ) -> str:
        """Save a new compilation and update history.

        Args:
            languages: List of language codes compiled
            source_docs: List of {"doc_id": str, "version": str} dicts
            merge_plan: The merge plan used for compilation
            notes: Optional notes about this compilation
            tags: Optional tags for this version

        Returns:
            Version string of the new compilation
        """
        history = self._load_history()
        current_version = history.get("current_version")

        if current_version is None:
            current_version = "1.0.0"
            history["current_version"] = current_version

        # Add or update version entry
        version_entry = {
            "version": current_version,
            "created_at": datetime.now().isoformat(),
            "folder": None,  # Current version, not yet in versions folder
            "languages": languages,
            "source_docs": source_docs,
            "merge_plan_summary": {
                "chapter_count": len(merge_plan.get("chapters", [])),
                "duplicates_detected": len(merge_plan.get("duplicates_detected", [])),
                "transitions_needed": len(merge_plan.get("transitions_needed", [])),
            },
            "notes": notes,
            "tags": tags or [],
        }

        # Check if this version already exists (update it)
        found = False
        for i, v in enumerate(history["versions"]):
            if v["version"] == current_version:
                history["versions"][i] = version_entry
                found = True
                break

        if not found:
            history["versions"].append(version_entry)

        self._save_history(history)

        return current_version

    def list_versions(self) -> List[Dict[str, Any]]:
        """List all compilation versions.

        Returns:
            List of version info dicts (newest first)
        """
        # Migrate legacy structure if needed
        self._migrate_legacy_structure()

        history = self._load_history()
        versions = history.get("versions", [])

        result = []
        current_version = history.get("current_version")

        for v in reversed(versions):
            is_current = v.get("version") == current_version and v.get("folder") is None
            result.append({
                "version": v.get("version"),
                "created_at": v.get("created_at"),
                "languages": v.get("languages", []),
                "source_doc_count": len(v.get("source_docs", [])),
                "notes": v.get("notes", ""),
                "tags": v.get("tags", []),
                "is_current": is_current,
                "folder": v.get("folder"),
            })

        return result

    def get_version(self, version: str) -> Optional[Dict[str, Any]]:
        """Get details about a specific version.

        Args:
            version: Version string

        Returns:
            Version info dict or None if not found
        """
        history = self._load_history()

        for v in history.get("versions", []):
            if v.get("version") == version:
                is_current = version == history.get("current_version") and v.get("folder") is None
                return {
                    **v,
                    "is_current": is_current,
                }

        return None

    def get_version_content(self, version: str, language: str) -> Optional[str]:
        """Get compiled content for a specific version.

        Args:
            version: Version string
            language: Language code

        Returns:
            Compiled markdown content or None if not found
        """
        version_info = self.get_version(version)
        if not version_info:
            return None

        # Determine the directory
        if version_info.get("is_current"):
            content_dir = self.current_dir
        else:
            folder = version_info.get("folder")
            if not folder:
                return None
            content_dir = self.versions_dir / folder

        manual_path = content_dir / f"manual_{language}.md"
        if manual_path.exists():
            return manual_path.read_text(encoding="utf-8")

        return None

    def get_version_directory(self, version: str) -> Optional[Path]:
        """Get the directory path for a specific version.

        Args:
            version: Version string

        Returns:
            Path to version directory or None if not found
        """
        version_info = self.get_version(version)
        if not version_info:
            return None

        if version_info.get("is_current"):
            return self.current_dir

        folder = version_info.get("folder")
        if folder:
            return self.versions_dir / folder

        return None

    def restore_version(self, version: str) -> bool:
        """Restore a previous compilation version to current.

        Args:
            version: Version string to restore

        Returns:
            True if successful, False if version not found
        """
        version_info = self.get_version(version)
        if not version_info:
            return False

        if version_info.get("is_current"):
            return True  # Already current

        folder = version_info.get("folder")
        if not folder:
            return False

        source_dir = self.versions_dir / folder
        if not source_dir.exists():
            return False

        # First, create an auto-save of current state
        self.auto_save_before_compile()

        # Clear current directory
        if self.current_dir.exists():
            shutil.rmtree(self.current_dir)
        self.current_dir.mkdir(parents=True, exist_ok=True)

        # Copy from version to current
        for item in source_dir.iterdir():
            if item.is_file():
                shutil.copy2(item, self.current_dir / item.name)
            elif item.is_dir():
                shutil.copytree(item, self.current_dir / item.name)

        # Update history - create new version entry for restored content
        history = self._load_history()
        new_version = history.get("current_version", "1.0.0")

        # Update version entry
        new_entry = {
            "version": new_version,
            "created_at": datetime.now().isoformat(),
            "folder": None,
            "languages": version_info.get("languages", []),
            "source_docs": version_info.get("source_docs", []),
            "merge_plan_summary": version_info.get("merge_plan_summary", {}),
            "notes": f"Restored from version {version}",
            "tags": version_info.get("tags", []),
        }
        history["versions"].append(new_entry)

        self._save_history(history)

        return True

    def delete_version(self, version: str) -> bool:
        """Delete a specific version (cannot delete current).

        Args:
            version: Version string to delete

        Returns:
            True if successful, False if cannot delete
        """
        version_info = self.get_version(version)
        if not version_info:
            return False

        if version_info.get("is_current"):
            return False  # Cannot delete current version

        folder = version_info.get("folder")
        if folder:
            version_dir = self.versions_dir / folder
            if version_dir.exists():
                shutil.rmtree(version_dir)

        # Remove from history
        history = self._load_history()
        history["versions"] = [
            v for v in history["versions"]
            if v.get("version") != version or v.get("folder") is None
        ]
        self._save_history(history)

        return True

    def update_version_metadata(
        self,
        version: str,
        notes: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> bool:
        """Update notes or tags for a version.

        Args:
            version: Version string
            notes: New notes (None to keep existing)
            tags: New tags (None to keep existing)

        Returns:
            True if successful, False if version not found
        """
        history = self._load_history()

        for v in history["versions"]:
            if v.get("version") == version:
                if notes is not None:
                    v["notes"] = notes
                if tags is not None:
                    v["tags"] = tags
                self._save_history(history)
                return True

        return False

    def cleanup_old_versions(self, keep_count: int = 10) -> int:
        """Remove old versions, keeping only the most recent ones.

        Args:
            keep_count: Number of versions to keep (plus current)

        Returns:
            Number of versions removed
        """
        history = self._load_history()
        versions = history.get("versions", [])

        # Separate current version from historical ones
        current_version = history.get("current_version")
        historical = [
            v for v in versions
            if v.get("folder") is not None  # Has been snapshotted
        ]

        # Sort by creation time (oldest first)
        historical.sort(key=lambda x: x.get("created_at", ""))

        # Remove oldest versions if we have more than keep_count
        removed = 0
        while len(historical) > keep_count:
            to_remove = historical.pop(0)
            folder = to_remove.get("folder")
            if folder:
                version_dir = self.versions_dir / folder
                if version_dir.exists():
                    shutil.rmtree(version_dir)

            # Remove from versions list
            history["versions"] = [
                v for v in history["versions"]
                if not (v.get("version") == to_remove.get("version") and v.get("folder") == folder)
            ]
            removed += 1

        if removed > 0:
            self._save_history(history)

        return removed

    def get_current_directory(self) -> Path:
        """Get the current compilation directory.

        Returns:
            Path to current compilation directory
        """
        # Migrate legacy structure if needed
        self._migrate_legacy_structure()

        self.current_dir.mkdir(parents=True, exist_ok=True)
        return self.current_dir
