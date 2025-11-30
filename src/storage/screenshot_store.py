"""Content-addressable storage for screenshots.

Implements deduplication by storing screenshots by their content hash.
This eliminates duplicate storage when the same screenshot appears across
multiple version snapshots.
"""

import hashlib
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List


class ScreenshotStore:
    """Content-addressable storage for screenshots.

    Screenshots are stored by their SHA256 hash (first 16 chars).
    Version snapshots reference screenshots by hash instead of
    copying the files, eliminating duplication.

    Directory structure:
        manuals/{manual_id}/
        ├── screenshots/           # Working directory (unchanged)
        ├── .screenshot_store/     # Content-addressable storage
        │   ├── a1b2c3d4e5f6g7h8.png
        │   └── ...
        └── versions/
            └── v1.0.0/
                └── screenshots.json  # Hash mapping
    """

    HASH_LENGTH = 16  # First 16 chars of SHA256 (64-bit collision resistance)

    def __init__(self, manual_dir: Path):
        """Initialize screenshot store.

        Args:
            manual_dir: Path to the manual directory
        """
        self.manual_dir = Path(manual_dir)
        self.store_dir = self.manual_dir / ".screenshot_store"

    def _ensure_store_dir(self) -> None:
        """Create store directory if it doesn't exist."""
        self.store_dir.mkdir(parents=True, exist_ok=True)

    def compute_hash(self, file_path: Path) -> str:
        """Compute SHA256 hash of file content.

        Args:
            file_path: Path to the file

        Returns:
            First 16 characters of the hex-encoded SHA256 hash
        """
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            # Read in chunks to handle large files
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()[:self.HASH_LENGTH]

    def get_store_path(self, content_hash: str) -> Path:
        """Get the path where a hash would be stored.

        Args:
            content_hash: The content hash

        Returns:
            Path to the stored file
        """
        # Preserve original extension based on what's in the store
        # Default to .png if not found
        for ext in [".png", ".jpg", ".jpeg"]:
            path = self.store_dir / f"{content_hash}{ext}"
            if path.exists():
                return path
        return self.store_dir / f"{content_hash}.png"

    def store(self, file_path: Path) -> str:
        """Store a file in content-addressable storage.

        If a file with the same content already exists, returns the
        existing hash without copying (deduplication).

        Args:
            file_path: Path to the file to store

        Returns:
            Content hash of the stored file
        """
        self._ensure_store_dir()

        content_hash = self.compute_hash(file_path)
        store_path = self.store_dir / f"{content_hash}{file_path.suffix.lower()}"

        # Only copy if not already stored (deduplication)
        if not store_path.exists():
            shutil.copy2(file_path, store_path)

        return content_hash

    def exists(self, content_hash: str) -> bool:
        """Check if a hash exists in the store.

        Args:
            content_hash: The content hash to check

        Returns:
            True if the hash exists in the store
        """
        return self.get_store_path(content_hash).exists()

    def create_snapshot_mapping(self, screenshots_dir: Path) -> Dict[str, Dict[str, Any]]:
        """Create a hash mapping for all screenshots in a directory.

        Stores each screenshot in the content-addressable store and
        returns a mapping from filename to hash metadata.

        Args:
            screenshots_dir: Directory containing screenshots

        Returns:
            Mapping of filename -> {hash, size, captured_at}
        """
        mapping = {}

        if not screenshots_dir.exists():
            return mapping

        for file_path in sorted(screenshots_dir.iterdir()):
            if file_path.is_file() and file_path.suffix.lower() in (".png", ".jpg", ".jpeg"):
                content_hash = self.store(file_path)
                stat = file_path.stat()

                mapping[file_path.name] = {
                    "hash": content_hash,
                    "size": stat.st_size,
                    "captured_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                }

        return mapping

    def restore_from_mapping(
        self,
        mapping: Dict[str, Dict[str, Any]],
        dest_dir: Path,
        overwrite: bool = True
    ) -> List[str]:
        """Restore screenshots from a mapping to a destination directory.

        Args:
            mapping: Mapping of filename -> {hash, ...}
            dest_dir: Directory to restore screenshots to
            overwrite: Whether to overwrite existing files

        Returns:
            List of filenames that were restored
        """
        dest_dir.mkdir(parents=True, exist_ok=True)
        restored = []

        for filename, meta in mapping.items():
            content_hash = meta.get("hash")
            if not content_hash:
                continue

            store_path = self.get_store_path(content_hash)
            if not store_path.exists():
                continue

            dest_path = dest_dir / filename

            if dest_path.exists() and not overwrite:
                continue

            shutil.copy2(store_path, dest_path)
            restored.append(filename)

        return restored

    def get_all_referenced_hashes(self) -> set:
        """Get all hashes referenced by any version.

        Scans all version directories for screenshots.json files
        and collects all referenced hashes.

        Returns:
            Set of hash strings that are referenced
        """
        referenced = set()
        versions_dir = self.manual_dir / "versions"

        if not versions_dir.exists():
            return referenced

        for version_dir in versions_dir.iterdir():
            if not version_dir.is_dir():
                continue

            mapping_path = version_dir / "screenshots.json"
            if mapping_path.exists():
                try:
                    with open(mapping_path, "r", encoding="utf-8") as f:
                        mapping = json.load(f)
                    for meta in mapping.values():
                        if isinstance(meta, dict) and "hash" in meta:
                            referenced.add(meta["hash"])
                except (json.JSONDecodeError, IOError):
                    continue

        return referenced

    def get_current_hashes(self) -> set:
        """Get hashes of current screenshots (working directory).

        Returns:
            Set of hash strings for current screenshots
        """
        current = set()
        screenshots_dir = self.manual_dir / "screenshots"

        if not screenshots_dir.exists():
            return current

        for file_path in screenshots_dir.iterdir():
            if file_path.is_file() and file_path.suffix.lower() in (".png", ".jpg", ".jpeg"):
                current.add(self.compute_hash(file_path))

        return current

    def cleanup_unreferenced(self, dry_run: bool = False) -> List[str]:
        """Remove hashes not referenced by any version or current screenshots.

        Args:
            dry_run: If True, only return what would be deleted

        Returns:
            List of hash strings that were (or would be) deleted
        """
        if not self.store_dir.exists():
            return []

        # Collect all referenced hashes
        referenced = self.get_all_referenced_hashes()
        current = self.get_current_hashes()
        all_needed = referenced | current

        # Find unreferenced files in store
        unreferenced = []
        for file_path in self.store_dir.iterdir():
            if not file_path.is_file():
                continue

            # Extract hash from filename (remove extension)
            file_hash = file_path.stem

            if file_hash not in all_needed:
                unreferenced.append(file_hash)
                if not dry_run:
                    file_path.unlink()

        return unreferenced

    def get_store_stats(self) -> Dict[str, Any]:
        """Get statistics about the screenshot store.

        Returns:
            Dict with store statistics
        """
        if not self.store_dir.exists():
            return {
                "total_files": 0,
                "total_size_bytes": 0,
                "referenced_count": 0,
                "unreferenced_count": 0,
            }

        total_files = 0
        total_size = 0
        file_hashes = set()

        for file_path in self.store_dir.iterdir():
            if file_path.is_file():
                total_files += 1
                total_size += file_path.stat().st_size
                file_hashes.add(file_path.stem)

        referenced = self.get_all_referenced_hashes()
        current = self.get_current_hashes()
        all_needed = referenced | current

        unreferenced_count = len(file_hashes - all_needed)

        return {
            "total_files": total_files,
            "total_size_bytes": total_size,
            "referenced_count": len(file_hashes & all_needed),
            "unreferenced_count": unreferenced_count,
        }
