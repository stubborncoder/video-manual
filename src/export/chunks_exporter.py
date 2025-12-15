"""Semantic chunks exporter for RAG pipelines.

Exports manuals as structured JSON chunks with images for ingestion
into vector databases and RAG systems.
"""

import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from ..storage.user_storage import UserStorage
from .tag_parser import parse_semantic_tags, get_title


class ManualChunksExporter:
    """Export manual as semantic chunks for RAG pipelines.

    Creates a ZIP archive containing:
    - chunks.json: Structured chunk data with metadata
    - images/: Folder with referenced screenshots
    """

    def __init__(self, user_id: str, manual_id: str):
        """Initialize the exporter.

        Args:
            user_id: User identifier
            manual_id: Manual identifier
        """
        self.user_id = user_id
        self.manual_id = manual_id
        self.user_storage = UserStorage(user_id)

        # Verify manual exists
        manual_dir = self.user_storage.manuals_dir / manual_id
        if not manual_dir.exists():
            raise ValueError(f"Manual not found: {manual_id}")

    def export(
        self,
        language: str = "en",
        output_path: Optional[str] = None,
    ) -> str:
        """Export manual as semantic chunks ZIP.

        Args:
            language: Language code for manual content
            output_path: Optional output file path

        Returns:
            Path to the generated ZIP file
        """
        # Get manual content
        content = self.user_storage.get_manual_content(self.manual_id, language)
        if not content:
            raise ValueError(f"Manual content not found for language: {language}")

        # Get metadata
        metadata = self.user_storage.get_manual_metadata(self.manual_id) or {}

        # Parse semantic tags into chunks
        chunks = self._parse_chunks(content)

        # Build the export structure
        export_data = {
            "manual": {
                "id": self.manual_id,
                "title": metadata.get("title") or get_title(content) or self.manual_id,
                "language": language,
                "format": metadata.get("document_format", "step-manual"),
                "target_audience": metadata.get("target_audience"),
                "target_objective": metadata.get("target_objective"),
                "exported_at": datetime.now().isoformat(),
                "chunk_count": len(chunks),
            },
            "chunks": chunks,
        }

        # Determine output path
        if output_path is None:
            output_path = self._get_output_path(language)

        # Create ZIP archive
        self._create_zip(export_data, output_path, chunks)

        return output_path

    def _get_output_path(self, language: str) -> str:
        """Generate output path for the export.

        Args:
            language: Language code

        Returns:
            Output file path
        """
        export_dir = self.user_storage.manuals_dir / self.manual_id / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.manual_id}_{language}_{timestamp}_chunks.zip"
        return str(export_dir / filename)

    def _parse_chunks(self, content: str) -> List[Dict[str, Any]]:
        """Parse semantic tags into chunks.

        Args:
            content: Markdown content with semantic tags

        Returns:
            List of chunk dictionaries
        """
        blocks = parse_semantic_tags(content)
        chunks = []
        chunk_counters: Dict[str, int] = {}

        for block in blocks:
            tag = block.tag_name

            # Generate unique chunk ID
            chunk_counters[tag] = chunk_counters.get(tag, 0) + 1
            chunk_id = f"{tag}-{chunk_counters[tag]}"

            # Extract images from content
            images = self._extract_image_refs(block.content)

            # Clean content (remove image markdown, keep text)
            clean_content = self._clean_content(block.content)

            chunk: Dict[str, Any] = {
                "id": chunk_id,
                "type": tag,
                "content": clean_content,
                "images": images,
            }

            # Add type-specific fields
            if tag == "step":
                chunk["number"] = block.number
                chunk["title"] = self._extract_title(block.content)
            elif tag == "keypoint":
                chunk["number"] = block.attributes.get("number", chunk_counters[tag])
                chunk["title"] = block.attributes.get("title", "")
            elif tag == "note":
                chunk["note_type"] = block.attributes.get("type", "info")
            elif tag == "section":
                chunk["title"] = block.attributes.get("title", "")
            elif tag == "definition":
                chunk["term"] = block.attributes.get("term", "")
            elif tag == "finding":
                chunk["number"] = block.attributes.get("number", chunk_counters[tag])
                chunk["title"] = block.attributes.get("title", "")
            elif tag == "recommendation":
                chunk["number"] = block.attributes.get("number", chunk_counters[tag])
                chunk["title"] = block.attributes.get("title", "")
            elif tag == "example":
                chunk["title"] = block.attributes.get("title", "")

            chunks.append(chunk)

        return chunks

    def _extract_image_refs(self, content: str) -> List[str]:
        """Extract image references from content.

        Args:
            content: Content that may contain image markdown

        Returns:
            List of image filenames (relative paths)
        """
        import re

        images = []
        for match in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", content):
            img_path = match.group(1)

            # Normalize to just the filename
            if "../screenshots/" in img_path:
                img_path = img_path.replace("../screenshots/", "")
            elif "screenshots/" in img_path:
                img_path = img_path.replace("screenshots/", "")

            # Only include local images (not URLs)
            if not img_path.startswith(("http://", "https://", "data:")):
                images.append(f"images/{img_path}")

        return images

    def _extract_title(self, content: str) -> str:
        """Extract title from content (first heading or first line).

        Args:
            content: Block content

        Returns:
            Extracted title
        """
        import re

        # Look for markdown heading
        match = re.match(r"^#+\s*(.+?)$", content, re.MULTILINE)
        if match:
            return match.group(1).strip()

        # Fall back to first non-empty line
        for line in content.split("\n"):
            line = line.strip()
            if line and not line.startswith("!"):  # Skip image lines
                return line[:100]  # Limit length

        return ""

    def _clean_content(self, content: str) -> str:
        """Clean content for chunk storage.

        Removes images, cleans markdown, strips semantic tags.

        Args:
            content: Raw content

        Returns:
            Cleaned text content
        """
        import re
        from .tag_parser import strip_semantic_tags

        # Strip any nested semantic tags
        content = strip_semantic_tags(content)

        # Remove images
        content = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", content)

        # Remove links, keep text
        content = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", content)

        # Remove markdown formatting but keep structure
        content = re.sub(r"^#+\s*", "", content, flags=re.MULTILINE)  # Headers
        content = re.sub(r"\*\*([^*]+)\*\*", r"\1", content)  # Bold
        content = re.sub(r"\*([^*]+)\*", r"\1", content)  # Italic
        content = re.sub(r"`([^`]+)`", r"\1", content)  # Inline code

        # Clean up whitespace
        content = re.sub(r"\n{3,}", "\n\n", content)

        return content.strip()

    def _create_zip(
        self,
        export_data: Dict[str, Any],
        output_path: str,
        chunks: List[Dict[str, Any]],
    ) -> None:
        """Create ZIP archive with chunks.json and images.

        Args:
            export_data: The full export data structure
            output_path: Path for the ZIP file
            chunks: List of chunks (to extract image references)
        """
        screenshots_dir = self.user_storage.manuals_dir / self.manual_id / "screenshots"

        # Collect all referenced images
        referenced_images = set()
        for chunk in chunks:
            for img_path in chunk.get("images", []):
                # Extract just the filename from "images/filename.png"
                filename = img_path.replace("images/", "")
                referenced_images.add(filename)

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # Write chunks.json
            chunks_json = json.dumps(export_data, indent=2, ensure_ascii=False)
            zf.writestr("chunks.json", chunks_json)

            # Write referenced images
            for img_filename in referenced_images:
                img_path = screenshots_dir / img_filename
                if img_path.exists():
                    zf.write(img_path, f"images/{img_filename}")


def create_chunks_exporter(user_id: str, manual_id: str) -> ManualChunksExporter:
    """Factory function to create chunks exporter.

    Args:
        user_id: User identifier
        manual_id: Manual identifier

    Returns:
        ManualChunksExporter instance
    """
    return ManualChunksExporter(user_id, manual_id)


class ProjectChunksExporter:
    """Export all project manuals as semantic chunks for RAG pipelines.

    Creates a ZIP archive containing:
    - project.json: Project metadata and structure
    - manuals/: Folder with individual manual chunk data
    - images/: Folder with all referenced screenshots
    """

    def __init__(self, user_id: str, project_id: str):
        """Initialize the exporter.

        Args:
            user_id: User identifier
            project_id: Project identifier
        """
        from ..storage.project_storage import ProjectStorage

        self.user_id = user_id
        self.project_id = project_id
        self.user_storage = UserStorage(user_id)
        self.project_storage = ProjectStorage(user_id)

        # Verify project exists
        project = self.project_storage.get_project(project_id)
        if not project:
            raise ValueError(f"Project not found: {project_id}")

        self.project = project

    def export(
        self,
        language: str = "en",
        output_path: Optional[str] = None,
    ) -> str:
        """Export all project manuals as semantic chunks ZIP.

        Args:
            language: Language code for manual content
            output_path: Optional output file path

        Returns:
            Path to the generated ZIP file
        """
        # Get all manuals in the project
        project_manuals = self.project_storage.get_project_manuals(self.project_id)

        if not project_manuals:
            raise ValueError("Project has no manuals to export")

        # Collect all manual chunks
        all_manuals_data: List[Dict[str, Any]] = []
        all_images: Dict[str, Path] = {}  # filename -> path

        for manual_info in project_manuals:
            manual_id = manual_info["id"]

            try:
                manual_data = self._export_manual_chunks(manual_id, language, all_images)
                manual_data["chapter_id"] = manual_info.get("chapter_id")
                manual_data["chapter_title"] = manual_info.get("chapter_title")
                all_manuals_data.append(manual_data)
            except ValueError as e:
                # Skip manuals without content for this language
                continue

        if not all_manuals_data:
            raise ValueError(f"No manuals have content for language: {language}")

        # Build project export structure
        export_data = {
            "project": {
                "id": self.project_id,
                "name": self.project.get("name", self.project_id),
                "description": self.project.get("description", ""),
                "language": language,
                "exported_at": datetime.now().isoformat(),
                "manual_count": len(all_manuals_data),
                "total_chunks": sum(m["chunk_count"] for m in all_manuals_data),
            },
            "chapters": [
                {
                    "id": ch["id"],
                    "title": ch["title"],
                    "description": ch.get("description", ""),
                    "order": ch.get("order", 0),
                }
                for ch in self.project.get("chapters", [])
            ],
            "manuals": all_manuals_data,
        }

        # Determine output path
        if output_path is None:
            output_path = self._get_output_path(language)

        # Create ZIP archive
        self._create_zip(export_data, output_path, all_images)

        return output_path

    def _export_manual_chunks(
        self,
        manual_id: str,
        language: str,
        all_images: Dict[str, Path],
    ) -> Dict[str, Any]:
        """Export a single manual's chunks.

        Args:
            manual_id: Manual identifier
            language: Language code
            all_images: Dict to accumulate image paths

        Returns:
            Manual chunk data
        """
        # Get manual content
        content = self.user_storage.get_manual_content(manual_id, language)
        if not content:
            raise ValueError(f"Manual content not found: {manual_id}")

        # Get metadata
        metadata = self.user_storage.get_manual_metadata(manual_id) or {}

        # Create a temporary exporter to parse chunks
        exporter = ManualChunksExporter(self.user_id, manual_id)
        chunks = exporter._parse_chunks(content)

        # Collect images for this manual
        screenshots_dir = self.user_storage.manuals_dir / manual_id / "screenshots"
        for chunk in chunks:
            for img_path in chunk.get("images", []):
                filename = img_path.replace("images/", "")
                full_path = screenshots_dir / filename
                if full_path.exists():
                    # Prefix with manual_id to avoid collisions
                    prefixed_name = f"{manual_id}/{filename}"
                    all_images[prefixed_name] = full_path
                    # Update chunk reference
                    chunk["images"] = [
                        f"images/{manual_id}/{f.replace('images/', '')}"
                        for f in chunk.get("images", [])
                    ]

        return {
            "id": manual_id,
            "title": metadata.get("title") or get_title(content) or manual_id,
            "format": metadata.get("document_format", "step-manual"),
            "target_audience": metadata.get("target_audience"),
            "target_objective": metadata.get("target_objective"),
            "chunk_count": len(chunks),
            "chunks": chunks,
        }

    def _get_output_path(self, language: str) -> str:
        """Generate output path for the export.

        Args:
            language: Language code

        Returns:
            Output file path
        """
        export_dir = self.project_storage.projects_dir / self.project_id / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.project_id}_{language}_{timestamp}_chunks.zip"
        return str(export_dir / filename)

    def _create_zip(
        self,
        export_data: Dict[str, Any],
        output_path: str,
        all_images: Dict[str, Path],
    ) -> None:
        """Create ZIP archive with project chunks and images.

        Args:
            export_data: The full export data structure
            output_path: Path for the ZIP file
            all_images: Dict mapping prefixed filenames to source paths
        """
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # Write project.json
            project_json = json.dumps(export_data, indent=2, ensure_ascii=False)
            zf.writestr("project_chunks.json", project_json)

            # Write all images
            for prefixed_name, source_path in all_images.items():
                zf.write(source_path, f"images/{prefixed_name}")


def create_project_chunks_exporter(user_id: str, project_id: str) -> ProjectChunksExporter:
    """Factory function to create project chunks exporter.

    Args:
        user_id: User identifier
        project_id: Project identifier

    Returns:
        ProjectChunksExporter instance
    """
    return ProjectChunksExporter(user_id, project_id)
