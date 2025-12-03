"""Version storage management for manual revision tracking."""

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from ..config import USERS_DIR
from .screenshot_store import ScreenshotStore


class VersionStorage:
    """Manages manual version history with auto-patching support.

    Implements hybrid versioning strategy:
    - Auto-patch: Creates patch version (1.0.0 -> 1.0.1) before any regeneration/overwrite
    - Manual: User can bump minor/major versions explicitly

    Version snapshots are stored as full copies:
        manuals/{manual_id}/versions/v{version}/
            metadata_snapshot.json
            {lang}/manual.md
            screenshots/  (only if changed)
    """

    def __init__(self, user_id: str, manual_id: str):
        """Initialize version storage.

        Args:
            user_id: User identifier
            manual_id: Manual identifier
        """
        self.user_id = user_id
        self.manual_id = manual_id
        self.user_dir = USERS_DIR / user_id
        self.manual_dir = self.user_dir / "manuals" / manual_id
        self.versions_dir = self.manual_dir / "versions"
        self.metadata_path = self.manual_dir / "metadata.json"

    def _load_metadata(self) -> Dict[str, Any]:
        """Load manual metadata."""
        if not self.metadata_path.exists():
            return {
                "version": {
                    "number": "1.0.0",
                    "history": [],
                }
            }

        with open(self.metadata_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_metadata(self, metadata: Dict[str, Any]) -> None:
        """Save manual metadata."""
        metadata["updated_at"] = datetime.now().isoformat()
        with open(self.metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)

    def get_current_version(self) -> str:
        """Get current version number.

        Returns:
            Version string (e.g., "1.0.0")
        """
        metadata = self._load_metadata()
        version_info = metadata.get("version", {})
        return version_info.get("number", "1.0.0")

    def _bump_version_number(self, current: str, bump_type: str = "patch") -> str:
        """Calculate next version number.

        Args:
            current: Current version string
            bump_type: Type of bump ("major", "minor", or "patch")

        Returns:
            New version string
        """
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

    def _create_snapshot(self, version: str, notes: str = "") -> Path:
        """Create a full snapshot of current manual state.

        Args:
            version: Version string for the snapshot
            notes: Optional notes about this version

        Returns:
            Path to the snapshot directory
        """
        snapshot_dir = self.versions_dir / f"v{version}"
        snapshot_dir.mkdir(parents=True, exist_ok=True)

        # Copy language folders (containing manual.md files)
        for item in self.manual_dir.iterdir():
            if item.is_dir() and item.name not in ("versions", "screenshots"):
                # This is a language folder
                manual_file = item / "manual.md"
                if manual_file.exists():
                    dest_dir = snapshot_dir / item.name
                    dest_dir.mkdir(exist_ok=True)
                    shutil.copy2(manual_file, dest_dir / "manual.md")

        # Use content-addressable storage for screenshots (deduplication)
        screenshots_dir = self.manual_dir / "screenshots"
        if screenshots_dir.exists() and any(screenshots_dir.iterdir()):
            store = ScreenshotStore(self.manual_dir)
            mapping = store.create_snapshot_mapping(screenshots_dir)

            # Save mapping instead of copying files
            mapping_path = snapshot_dir / "screenshots.json"
            with open(mapping_path, "w", encoding="utf-8") as f:
                json.dump(mapping, f, indent=2, ensure_ascii=False)

        # Save snapshot metadata
        metadata = self._load_metadata()
        snapshot_metadata = {
            "version": version,
            "created_at": datetime.now().isoformat(),
            "notes": notes,
            "source_metadata": {
                k: v for k, v in metadata.items()
                if k not in ("version",)  # Don't copy version info
            }
        }

        with open(snapshot_dir / "metadata_snapshot.json", "w", encoding="utf-8") as f:
            json.dump(snapshot_metadata, f, indent=2, ensure_ascii=False)

        return snapshot_dir

    def auto_patch_before_overwrite(self, notes: str = "Auto-save before changes") -> Optional[str]:
        """Create automatic patch version before content is overwritten.

        This should be called before regenerating a manual or saving user edits.
        Only creates a snapshot if content already exists.

        Args:
            notes: Optional notes describing why this snapshot was created

        Returns:
            New patch version string if snapshot was created, None otherwise
        """
        # Check if there's existing content to preserve
        has_content = False
        for item in self.manual_dir.iterdir():
            if item.is_dir() and item.name not in ("versions", "screenshots"):
                if (item / "manual.md").exists():
                    has_content = True
                    break

        if not has_content:
            return None  # Nothing to version

        # Get current version and create snapshot
        current_version = self.get_current_version()

        # Create snapshot of current state
        self._create_snapshot(current_version, notes=notes)

        # Bump to next patch version
        new_version = self._bump_version_number(current_version, "patch")

        # Update metadata with new version and history
        metadata = self._load_metadata()
        version_info = metadata.get("version", {"number": "1.0.0", "history": []})

        # Add to history
        version_info["history"].append({
            "version": current_version,
            "created_at": datetime.now().isoformat(),
            "snapshot_dir": f"versions/v{current_version}",
            "notes": notes,
        })

        version_info["number"] = new_version
        metadata["version"] = version_info
        self._save_metadata(metadata)

        return new_version

    def bump_version(self, bump_type: str, notes: str = "") -> str:
        """Manually bump version (minor or major).

        Args:
            bump_type: "minor" or "major"
            notes: Version notes

        Returns:
            New version string
        """
        if bump_type not in ("minor", "major"):
            raise ValueError(f"Invalid bump type: {bump_type}. Use 'minor' or 'major'.")

        current_version = self.get_current_version()

        # Create snapshot of current state
        self._create_snapshot(current_version, notes=notes)

        # Bump version
        new_version = self._bump_version_number(current_version, bump_type)

        # Update metadata
        metadata = self._load_metadata()
        version_info = metadata.get("version", {"number": "1.0.0", "history": []})

        version_info["history"].append({
            "version": current_version,
            "created_at": datetime.now().isoformat(),
            "snapshot_dir": f"versions/v{current_version}",
            "notes": notes,
        })

        version_info["number"] = new_version
        metadata["version"] = version_info
        self._save_metadata(metadata)

        return new_version

    def list_versions(self) -> List[Dict[str, Any]]:
        """List all version history.

        Returns:
            List of version info dicts (newest first in history)
        """
        metadata = self._load_metadata()
        version_info = metadata.get("version", {})

        result = []

        # Add current version
        result.append({
            "version": version_info.get("number", "1.0.0"),
            "created_at": metadata.get("updated_at", datetime.now().isoformat()),
            "notes": "Current version",
            "is_current": True,
        })

        # Add history (newest first)
        history = version_info.get("history", [])
        for entry in reversed(history):
            result.append({
                "version": entry.get("version"),
                "created_at": entry.get("created_at"),
                "notes": entry.get("notes", ""),
                "snapshot_dir": entry.get("snapshot_dir"),
                "is_current": False,
            })

        return result

    def get_version(self, version: str) -> Optional[Dict[str, Any]]:
        """Get details about a specific version.

        Args:
            version: Version string

        Returns:
            Version info dict or None if not found
        """
        versions = self.list_versions()
        for v in versions:
            if v.get("version") == version:
                return v
        return None

    def restore_version(self, version: str, language: str = "en") -> bool:
        """Restore a manual to a previous version.

        Args:
            version: Version string to restore
            language: Language code to restore

        Returns:
            True if successful, False if version not found
        """
        snapshot_dir = self.versions_dir / f"v{version}"
        if not snapshot_dir.exists():
            return False

        # First, create an auto-patch of current state
        self.auto_patch_before_overwrite()

        # Restore language folder
        source_lang_dir = snapshot_dir / language
        if source_lang_dir.exists():
            dest_lang_dir = self.manual_dir / language
            dest_lang_dir.mkdir(exist_ok=True)

            source_manual = source_lang_dir / "manual.md"
            if source_manual.exists():
                shutil.copy2(source_manual, dest_lang_dir / "manual.md")

        # Restore screenshots - check for new hash-based format first
        dest_screenshots = self.manual_dir / "screenshots"
        mapping_path = snapshot_dir / "screenshots.json"

        if mapping_path.exists():
            # New format: restore from content-addressable store
            with open(mapping_path, "r", encoding="utf-8") as f:
                mapping = json.load(f)

            store = ScreenshotStore(self.manual_dir)

            # Clear existing screenshots
            if dest_screenshots.exists():
                shutil.rmtree(dest_screenshots)

            store.restore_from_mapping(mapping, dest_screenshots)
        else:
            # Old format: copy from screenshots directory (backward compatibility)
            source_screenshots = snapshot_dir / "screenshots"
            if source_screenshots.exists():
                if dest_screenshots.exists():
                    shutil.rmtree(dest_screenshots)
                shutil.copytree(source_screenshots, dest_screenshots)

        return True

    def diff_versions(self, v1: str, v2: str, language: str = "en") -> Dict[str, Any]:
        """Compare two versions and return diff summary.

        Args:
            v1: First version string
            v2: Second version string
            language: Language to compare

        Returns:
            Dict with diff information
        """
        # Get content from both versions
        v1_content = self._get_version_content(v1, language)
        v2_content = self._get_version_content(v2, language)

        if v1_content is None:
            return {"error": f"Version {v1} not found or no content for language {language}"}
        if v2_content is None:
            return {"error": f"Version {v2} not found or no content for language {language}"}

        # Simple diff stats
        v1_lines = v1_content.split("\n")
        v2_lines = v2_content.split("\n")

        return {
            "v1": v1,
            "v2": v2,
            "v1_lines": len(v1_lines),
            "v2_lines": len(v2_lines),
            "v1_chars": len(v1_content),
            "v2_chars": len(v2_content),
            "lines_changed": abs(len(v1_lines) - len(v2_lines)),
            "chars_changed": abs(len(v1_content) - len(v2_content)),
        }

    def _get_version_content(self, version: str, language: str) -> Optional[str]:
        """Get manual content for a specific version.

        Args:
            version: Version string
            language: Language code

        Returns:
            Manual content or None if not found
        """
        current_version = self.get_current_version()

        if version == current_version:
            # Get current content
            manual_path = self.manual_dir / language / "manual.md"
            if manual_path.exists():
                return manual_path.read_text(encoding="utf-8")
            return None

        # Get from snapshot
        snapshot_dir = self.versions_dir / f"v{version}"
        manual_path = snapshot_dir / language / "manual.md"
        if manual_path.exists():
            return manual_path.read_text(encoding="utf-8")

        return None

    # ==================== Evaluation Storage ====================

    def save_evaluation(
        self,
        evaluation: Dict[str, Any],
        language: str = "en",
        version: Optional[str] = None
    ) -> Dict[str, Any]:
        """Save an evaluation for a specific version.

        Args:
            evaluation: Evaluation data from the AI evaluator
            language: Language code of the evaluated manual
            version: Version to associate with (defaults to current)

        Returns:
            Saved evaluation with added metadata
        """
        if version is None:
            version = self.get_current_version()

        # Create evaluations directory
        evaluations_dir = self.manual_dir / "evaluations"
        evaluations_dir.mkdir(parents=True, exist_ok=True)

        # Add version and storage metadata
        evaluation_record = {
            **evaluation,
            "version": version,
            "language": language,
            "stored_at": datetime.now().isoformat(),
        }

        # Save to version-specific file
        eval_file = evaluations_dir / f"v{version}_{language}.json"
        with open(eval_file, "w", encoding="utf-8") as f:
            json.dump(evaluation_record, f, indent=2, ensure_ascii=False)

        return evaluation_record

    def get_evaluation(
        self,
        language: str = "en",
        version: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get stored evaluation for a specific version.

        Args:
            language: Language code
            version: Version to get evaluation for (defaults to current)

        Returns:
            Evaluation data or None if not found
        """
        if version is None:
            version = self.get_current_version()

        eval_file = self.manual_dir / "evaluations" / f"v{version}_{language}.json"
        if not eval_file.exists():
            return None

        with open(eval_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_evaluations(self) -> List[Dict[str, Any]]:
        """List all stored evaluations for this manual.

        Returns:
            List of evaluation summaries (version, language, score, date)
        """
        evaluations_dir = self.manual_dir / "evaluations"
        if not evaluations_dir.exists():
            return []

        results = []
        for eval_file in evaluations_dir.glob("v*_*.json"):
            try:
                with open(eval_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    results.append({
                        "version": data.get("version"),
                        "language": data.get("language"),
                        "overall_score": data.get("overall_score"),
                        "evaluated_at": data.get("evaluated_at"),
                        "stored_at": data.get("stored_at"),
                    })
            except (json.JSONDecodeError, IOError):
                continue

        # Sort by stored_at descending (newest first)
        results.sort(key=lambda x: x.get("stored_at", ""), reverse=True)
        return results

    def delete_evaluation(self, language: str = "en", version: Optional[str] = None) -> bool:
        """Delete a stored evaluation.

        Args:
            language: Language code
            version: Version (defaults to current)

        Returns:
            True if deleted, False if not found
        """
        if version is None:
            version = self.get_current_version()

        eval_file = self.manual_dir / "evaluations" / f"v{version}_{language}.json"
        if eval_file.exists():
            eval_file.unlink()
            return True
        return False

    def cleanup_old_versions(self, keep_count: int = 10) -> int:
        """Remove old versions, keeping only the most recent ones.

        Args:
            keep_count: Number of versions to keep

        Returns:
            Number of versions removed
        """
        if not self.versions_dir.exists():
            return 0

        # Get all version directories sorted by creation time
        version_dirs = []
        for item in self.versions_dir.iterdir():
            if item.is_dir() and item.name.startswith("v"):
                version_dirs.append((item, item.stat().st_mtime))

        # Sort by modification time (oldest first)
        version_dirs.sort(key=lambda x: x[1])

        # Remove oldest versions if we have more than keep_count
        removed = 0
        while len(version_dirs) > keep_count:
            dir_to_remove, _ = version_dirs.pop(0)
            shutil.rmtree(dir_to_remove)
            removed += 1

        # Also update history in metadata to remove references to deleted snapshots
        if removed > 0:
            metadata = self._load_metadata()
            version_info = metadata.get("version", {})
            history = version_info.get("history", [])

            # Keep only entries that still have snapshots
            existing_snapshots = {d.name for d, _ in version_dirs}
            version_info["history"] = [
                h for h in history
                if f"v{h.get('version')}" in existing_snapshots
            ]
            metadata["version"] = version_info
            self._save_metadata(metadata)

        return removed
