"""Base exporter class for multi-format export."""

import re
from abc import ABC, abstractmethod
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from ..storage.project_storage import ProjectStorage
from ..storage.user_storage import UserStorage
from ..storage.version_storage import VersionStorage
from .tag_parser import strip_semantic_tags


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower()
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'[^a-z0-9\-]', '', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


class BaseExporter(ABC):
    """Abstract base class for format exporters."""

    # File extension for this export format (e.g., 'pdf', 'docx', 'html')
    file_extension: str = ""

    def __init__(self, user_id: str, project_id: str):
        """Initialize exporter.

        Args:
            user_id: User identifier
            project_id: Project identifier
        """
        self.user_id = user_id
        self.project_id = project_id
        self.project_storage = ProjectStorage(user_id)
        self.user_storage = UserStorage(user_id)

        self.project = self.project_storage.get_project(project_id)
        if not self.project:
            raise ValueError(f"Project not found: {project_id}")

    @abstractmethod
    def export(
        self,
        output_path: Optional[str] = None,
        language: str = "en",
        **options,
    ) -> str:
        """Export project to the target format.

        Args:
            output_path: Optional output file path
            language: Language code for manual content
            **options: Format-specific options

        Returns:
            Path to the generated file
        """
        pass

    def _get_output_path(
        self,
        output_path: Optional[str],
        language: str,
    ) -> str:
        """Get or generate output path for export.

        Args:
            output_path: Optional explicit output path
            language: Language code

        Returns:
            Output file path
        """
        if output_path:
            return output_path

        export_dir = self.project_storage.projects_dir / self.project_id / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        # Get version from first manual in project
        version = "1.0.0"
        chapters = self.project.get("chapters", [])
        if chapters:
            for chapter in chapters:
                if chapter.get("manuals"):
                    first_manual_id = chapter["manuals"][0]
                    vs = VersionStorage(self.user_id, first_manual_id)
                    version = vs.get_current_version()
                    break

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.project_id}_{language}_v{version}_{timestamp}.{self.file_extension}"
        return str(export_dir / filename)

    def _build_combined_markdown(
        self,
        language: str,
        include_toc: bool = False,
        include_chapter_covers: bool = False,
    ) -> str:
        """Build combined markdown document from all manuals.

        Args:
            language: Language code
            include_toc: Include table of contents
            include_chapter_covers: Include chapter cover pages

        Returns:
            Combined markdown string
        """
        sections = []

        # Project title
        sections.append(f"# {self.project['name']}\n")

        if self.project.get('description'):
            sections.append(f"*{self.project['description']}*\n")

        sections.append(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n")

        # Table of contents
        if include_toc:
            toc = self._generate_toc()
            sections.append(toc)

        # Chapters and manuals
        chapters = self.project.get("chapters", [])
        for chapter in sorted(chapters, key=lambda c: c.get("order", 0)):
            # Chapter cover
            if include_chapter_covers:
                cover = self._generate_chapter_cover(chapter)
                sections.append(cover)

            # Chapter manuals
            for manual_id in chapter.get("manuals", []):
                manual_content = self._get_manual_content(manual_id, language)
                if manual_content:
                    # Add manual section with anchor
                    anchor = slugify(manual_id)
                    sections.append(f'<a name="{anchor}"></a>\n')
                    sections.append('<div class="manual-section" markdown="1">\n')

                    # Fix image paths to be absolute
                    manual_content = self._fix_image_paths(manual_content, manual_id)
                    sections.append(manual_content)

                    sections.append('\n</div>\n')
                else:
                    sections.append(f"\n## {manual_id}\n")
                    sections.append(f"*Manual not found for language: {language}*\n")

        return "\n".join(sections)

    def _generate_toc(self) -> str:
        """Generate table of contents markdown."""
        lines = ['<div class="toc" markdown="1">\n']
        lines.append("# Table of Contents\n")
        lines.append("<ul>\n")

        chapters = self.project.get("chapters", [])
        for chapter in sorted(chapters, key=lambda c: c.get("order", 0)):
            chapter_anchor = slugify(chapter["id"])
            lines.append(f'<li class="chapter"><a href="#{chapter_anchor}">{chapter["title"]}</a></li>\n')

            for manual_id in chapter.get("manuals", []):
                manual_anchor = slugify(manual_id)
                # Get manual title from metadata if available
                metadata = self.project_storage._get_manual_metadata(manual_id)
                title = manual_id
                if metadata and metadata.get("video_metadata"):
                    title = metadata["video_metadata"].get("filename", manual_id)
                    # Remove extension
                    title = Path(title).stem

                lines.append(f'<li class="manual"><a href="#{manual_anchor}">{title}</a></li>\n')

        lines.append("</ul>\n")
        lines.append("</div>\n")

        return "".join(lines)

    def _generate_chapter_cover(self, chapter: Dict[str, Any]) -> str:
        """Generate chapter cover page markdown."""
        anchor = slugify(chapter["id"])
        lines = [f'<a name="{anchor}"></a>\n']
        lines.append('<div class="chapter-cover" markdown="1">\n')
        lines.append(f'## Chapter {chapter.get("order", "")}: {chapter["title"]}\n')

        if chapter.get("description"):
            lines.append(f'\n<p>{chapter["description"]}</p>\n')

        manual_count = len(chapter.get("manuals", []))
        lines.append(f'\n<p>{manual_count} manual(s)</p>\n')
        lines.append("</div>\n")

        return "".join(lines)

    def _get_manual_content(self, manual_id: str, language: str) -> Optional[str]:
        """Get manual content for a specific language.

        Strips semantic tags from the content so that exported documents
        contain clean markdown without XML-like tags.
        """
        content = self.user_storage.get_doc_content(manual_id, language)
        if content:
            # Strip semantic tags (e.g., <step>, <note>, <introduction>) for clean export
            content = strip_semantic_tags(content)
        return content

    def _fix_image_paths(self, content: str, manual_id: str) -> str:
        """Fix relative image paths to absolute paths.

        Args:
            content: Markdown content
            manual_id: Manual identifier

        Returns:
            Content with fixed image paths
        """
        screenshots_dir = self.user_storage.docs_dir / manual_id / "screenshots"

        def replace_path(match):
            # Normalize alt text (may span multiple lines)
            alt = match.group(1).replace('\n', ' ').strip()
            alt = re.sub(r'\s+', ' ', alt)
            path = match.group(2)

            # Handle ../screenshots/ paths
            if path.startswith("../screenshots/"):
                filename = path.replace("../screenshots/", "")
                abs_path = screenshots_dir / filename
                if abs_path.exists():
                    return f"![{alt}](file://{abs_path})"

            # Handle screenshots/ paths
            if path.startswith("screenshots/"):
                filename = path.replace("screenshots/", "")
                abs_path = screenshots_dir / filename
                if abs_path.exists():
                    return f"![{alt}](file://{abs_path})"

            return f"![{alt}]({path})"

        # Use [\s\S]*? to match alt text that may span multiple lines
        pattern = r'!\[([\s\S]*?)\]\(([^)]+)\)'
        return re.sub(pattern, replace_path, content)

    def get_export_history(self) -> List[Dict[str, Any]]:
        """Get list of previous exports for this format.

        Returns:
            List of export info dicts
        """
        export_dir = self.project_storage.projects_dir / self.project_id / "exports"
        if not export_dir.exists():
            return []

        exports = []
        for export_file in export_dir.glob(f"*.{self.file_extension}"):
            exports.append({
                "filename": export_file.name,
                "path": str(export_file),
                "size": export_file.stat().st_size,
                "created": datetime.fromtimestamp(export_file.stat().st_mtime).isoformat(),
            })

        return sorted(exports, key=lambda e: e["created"], reverse=True)
