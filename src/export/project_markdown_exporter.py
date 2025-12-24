"""Markdown exporter for projects.

Exports projects as a ZIP archive containing:
- {project_id}.md - Combined markdown with all manuals
- images/ - All screenshots from all manuals
"""

import re
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional, Set, Tuple

from .base_exporter import BaseExporter, slugify
from .tag_parser import strip_semantic_tags


class ProjectMarkdownExporter(BaseExporter):
    """Export project to Markdown ZIP with combined content and images.

    Creates a ZIP archive containing:
    - {project_id}.md - The combined markdown with chapter structure
    - images/ - Folder containing all referenced screenshots from all manuals
    """

    file_extension = "zip"

    def export(
        self,
        output_path: Optional[str] = None,
        language: str = "en",
        include_toc: bool = True,
        include_chapter_covers: bool = True,
        **options,
    ) -> str:
        """Export project to Markdown ZIP archive.

        Args:
            output_path: Optional output file path
            language: Language code
            include_toc: Include table of contents
            include_chapter_covers: Include chapter cover pages
            **options: Additional options (currently unused)

        Returns:
            Path to generated ZIP file
        """
        # Collect all images and rewrite paths
        referenced_images: Set[Tuple[str, str, Path]] = set()  # (zip_name, filename, source_path)

        # Build combined markdown with image path rewriting
        combined_md = self._build_markdown_with_images(
            language=language,
            include_toc=include_toc,
            include_chapter_covers=include_chapter_covers,
            referenced_images=referenced_images,
        )

        # Generate output path
        output_path = self._get_output_path(output_path, language)

        # Create ZIP file
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            # Add markdown file
            md_filename = f"{self.project_id}.md"
            zipf.writestr(md_filename, combined_md)

            # Add all referenced images
            for zip_name, _filename, source_path in referenced_images:
                if source_path.exists():
                    zipf.write(source_path, f"images/{zip_name}")

        return output_path

    def _build_markdown_with_images(
        self,
        language: str,
        include_toc: bool,
        include_chapter_covers: bool,
        referenced_images: Set[Tuple[str, str, Path]],
    ) -> str:
        """Build combined markdown with image paths rewritten for ZIP.

        Args:
            language: Language code
            include_toc: Include table of contents
            include_chapter_covers: Include chapter cover pages
            referenced_images: Set to collect image references

        Returns:
            Combined markdown string
        """
        sections = []

        # Project title
        sections.append(f"# {self.project['name']}\n")

        if self.project.get("description"):
            sections.append(f"*{self.project['description']}*\n")

        sections.append(f"*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n")

        # Table of contents
        if include_toc:
            toc = self._generate_markdown_toc()
            sections.append(toc)

        # Chapters and manuals
        chapters = self.project.get("chapters", [])
        for chapter in sorted(chapters, key=lambda c: c.get("order", 0)):
            # Chapter cover
            if include_chapter_covers:
                cover = self._generate_markdown_chapter_cover(chapter)
                sections.append(cover)

            # Chapter manuals
            for manual_id in chapter.get("manuals", []):
                manual_content = self._get_manual_content_with_images(
                    manual_id, language, referenced_images
                )
                if manual_content:
                    # Add manual section with anchor
                    anchor = slugify(manual_id)
                    sections.append(f'\n<a id="{anchor}"></a>\n')
                    sections.append(manual_content)
                else:
                    sections.append(f"\n## {manual_id}\n")
                    sections.append(f"*Manual not found for language: {language}*\n")

        return "\n".join(sections)

    def _generate_markdown_toc(self) -> str:
        """Generate table of contents in plain markdown format."""
        lines = ["\n## Table of Contents\n"]

        chapters = self.project.get("chapters", [])
        for chapter in sorted(chapters, key=lambda c: c.get("order", 0)):
            chapter_anchor = slugify(chapter["id"])
            lines.append(f"- [{chapter['title']}](#{chapter_anchor})")

            for manual_id in chapter.get("manuals", []):
                manual_anchor = slugify(manual_id)
                # Get manual title from metadata if available
                metadata = self.user_storage.get_doc_metadata(manual_id)
                title = manual_id
                if metadata:
                    title = metadata.get("title", manual_id)
                    if not title:
                        video_meta = metadata.get("video_metadata", {})
                        title = video_meta.get("filename", manual_id)
                        if title:
                            title = Path(title).stem

                lines.append(f"  - [{title}](#{manual_anchor})")

        lines.append("")
        return "\n".join(lines)

    def _generate_markdown_chapter_cover(self, chapter: dict) -> str:
        """Generate chapter cover in plain markdown format."""
        anchor = slugify(chapter["id"])
        lines = [f'\n<a id="{anchor}"></a>']
        lines.append(f'\n## Chapter {chapter.get("order", "")}: {chapter["title"]}\n')

        if chapter.get("description"):
            lines.append(f'{chapter["description"]}\n')

        manual_count = len(chapter.get("manuals", []))
        lines.append(f"*{manual_count} manual(s)*\n")
        lines.append("---")

        return "\n".join(lines)

    def _get_manual_content_with_images(
        self,
        manual_id: str,
        language: str,
        referenced_images: Set[Tuple[str, str, Path]],
    ) -> Optional[str]:
        """Get manual content with image paths rewritten for ZIP structure.

        Args:
            manual_id: Manual identifier
            language: Language code
            referenced_images: Set to collect image references

        Returns:
            Content with rewritten image paths, or None if not found
        """
        content = self.user_storage.get_doc_content(manual_id, language)
        if not content:
            return None

        # Strip semantic tags
        content = strip_semantic_tags(content)

        # Get screenshots directory for this manual
        screenshots_dir = self.user_storage.docs_dir / manual_id / "screenshots"

        def rewrite_image_path(match: re.Match) -> str:
            alt = match.group(1).replace("\n", " ").strip()
            alt = re.sub(r"\s+", " ", alt)
            path = match.group(2)

            # Skip external URLs
            if path.startswith(("http://", "https://", "data:")):
                return f"![{alt}]({path})"

            # Extract filename from various path formats
            filename = None
            if path.startswith("../screenshots/"):
                filename = path.replace("../screenshots/", "")
            elif path.startswith("screenshots/"):
                filename = path.replace("screenshots/", "")
            elif not path.startswith(("file://", "/")):
                filename = path

            if filename:
                source_path = screenshots_dir / filename
                if source_path.exists():
                    # Create unique name with manual_id prefix to avoid collisions
                    zip_name = f"{manual_id}_{filename}"
                    referenced_images.add((zip_name, filename, source_path))
                    # Return path relative to ZIP root
                    return f"![{alt}](./images/{zip_name})"

            return f"![{alt}]({path})"

        # Rewrite all image paths
        pattern = r"!\[([\s\S]*?)\]\(([^)]+)\)"
        return re.sub(pattern, rewrite_image_path, content)


def create_project_markdown_exporter(user_id: str, project_id: str) -> ProjectMarkdownExporter:
    """Factory function to create project markdown exporter.

    Args:
        user_id: User identifier
        project_id: Project identifier

    Returns:
        ProjectMarkdownExporter instance
    """
    return ProjectMarkdownExporter(user_id, project_id)
