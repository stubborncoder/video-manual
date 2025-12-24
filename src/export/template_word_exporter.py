"""Template-based Word exporter using python-docx-template (docxtpl)."""

import re
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

from docxtpl import DocxTemplate, InlineImage
from docx.shared import Mm, Inches
from PIL import Image as PILImage

from ..storage.user_storage import UserStorage
from ..storage.template_storage import TemplateStorage
from .tag_parser import parse_semantic_tags, strip_semantic_tags, get_title

logger = logging.getLogger(__name__)


class ManualTemplateExporter:
    """Export individual docs using Word templates with Jinja2 placeholders.

    Templates can include placeholders like:
    - {{ title }} - Doc title
    - {{ language }} - Language code
    - {{ generated_at }} - Generation timestamp
    - {% for step in steps %} - Loop over steps
    - {{ step.number }}, {{ step.description }}, {{ step.image }}
    """

    def __init__(self, user_id: str, doc_id: str):
        """Initialize the exporter.

        Args:
            user_id: User identifier
            doc_id: Doc identifier
        """
        self.user_id = user_id
        self.doc_id = doc_id
        self.user_storage = UserStorage(user_id)
        self.template_storage = TemplateStorage(user_id)

        # Verify doc exists
        doc_dir = self.user_storage.docs_dir / doc_id
        if not doc_dir.exists():
            raise ValueError(f"Doc not found: {doc_id}")

    def export(
        self,
        template_path: Path,
        language: str = "en",
        output_path: Optional[str] = None,
    ) -> str:
        """Export manual using the specified template.

        Args:
            template_path: Path to the Word template file
            language: Language code for manual content
            output_path: Optional output file path

        Returns:
            Path to the generated Word file

        Raises:
            ValueError: If template or manual content not found
            Exception: If template rendering fails
        """
        if not template_path.exists():
            raise ValueError(f"Template not found: {template_path}")

        # Get manual content
        content = self.user_storage.get_doc_content(self.doc_id, language)
        if not content:
            raise ValueError(f"Manual content not found for language: {language}")

        # Load template
        doc = DocxTemplate(template_path)

        # Build context
        context = self._build_context(doc, content, language)

        # Render template
        doc.render(context)

        # Determine output path
        if output_path is None:
            output_path = self._get_output_path(language)

        # Save document
        doc.save(output_path)

        return output_path

    def _get_output_path(self, language: str) -> str:
        """Generate output path for the exported document.

        Args:
            language: Language code

        Returns:
            Output file path
        """
        export_dir = self.user_storage.docs_dir / self.doc_id / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.doc_id}_{language}_{timestamp}_template.docx"
        return str(export_dir / filename)

    def _build_context(
        self, doc: DocxTemplate, content: str, language: str
    ) -> Dict[str, Any]:
        """Build the Jinja2 context for template rendering.

        Args:
            doc: DocxTemplate instance (needed for InlineImage)
            content: Markdown content of the manual
            language: Language code

        Returns:
            Dictionary with template context variables
        """
        # Get manual metadata
        metadata = self.user_storage.get_doc_metadata(self.doc_id) or {}

        # Parse semantic tags for structured content
        semantic_content = self._parse_semantic_content(doc, content)

        # Also parse steps from markdown (fallback / legacy support)
        steps = self._parse_steps_from_markdown(doc, content)

        # Get title from semantic tags or fallback to metadata
        semantic_title = get_title(content)

        # Create a subdocument with a page break for use in templates
        page_break_subdoc = doc.new_subdoc()
        page_break_subdoc.add_page_break()

        # Build context
        context = {
            # Metadata
            "title": semantic_title or metadata.get("title", self.doc_id),
            "doc_id": self.doc_id,
            "language": language,
            "language_upper": language.upper(),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "generated_date": datetime.now().strftime("%Y-%m-%d"),
            "generated_time": datetime.now().strftime("%H:%M"),
            # Target context
            "target_audience": metadata.get("target_audience", ""),
            "target_objective": metadata.get("target_objective", ""),
            # Document format info
            "document_format": metadata.get("document_format", "step-manual"),
            # Page break subdocument for use in loops
            "page_break": page_break_subdoc,
            # Semantic content blocks - available for all formats
            **semantic_content,
            # Legacy steps (for backward compatibility)
            "steps": steps,
            "step_count": len(steps),
            "screenshot_count": sum(1 for s in steps if s.get("has_image")),
            # Video info (if available)
            "video_name": Path(metadata.get("video_path", "")).name
            if metadata.get("video_path")
            else "",
            "video_duration": metadata.get("video_duration", ""),
        }

        return context

    def _parse_semantic_content(
        self, doc: DocxTemplate, content: str
    ) -> Dict[str, Any]:
        """Parse semantic tags into structured content for templates.

        This method parses semantic tags (like <step>, <note>, <introduction>)
        and builds a dictionary of content blocks for template rendering.

        Args:
            doc: DocxTemplate instance (needed for InlineImage)
            content: Markdown content with semantic tags

        Returns:
            Dictionary with semantic content blocks:
            - introduction: Introduction text (from <introduction> tag)
            - conclusion: Conclusion text (from <conclusion> tag)
            - semantic_steps: List of step blocks (from <step> tags)
            - notes: List of note blocks (from <note> tags)
            - keypoints: List of key points (from <keypoint> tags)
            - overview: Overview text (from <overview> tag)
            - tips: List of tips (from <tip> tags)
            - sections: List of sections (from <section> tags)
            - definitions: List of definitions (from <definition> tags)
            - examples: List of examples (from <example> tags)
            - highlights: Highlights text (from <highlights> tag)
            - findings: List of findings (from <finding> tags)
            - recommendations: List of recommendations (from <recommendation> tags)
        """
        screenshots_dir = self.user_storage.docs_dir / self.doc_id / "screenshots"
        blocks = parse_semantic_tags(content)

        result: Dict[str, Any] = {
            # Common
            "introduction": "",
            "conclusion": "",
            "overview": "",
            "highlights": "",
            "semantic_steps": [],
            "notes": [],
            "keypoints": [],
            "tips": [],
            "sections": [],
            "definitions": [],
            "examples": [],
            "findings": [],
            "recommendations": [],
            # Report formats
            "summary": "",
            "location": "",
            "next_steps": "",
            "status_summary": "",
            "period": "",
            "timeline": "",
            "evidences": [],
            "severity": {},
            "inspection_items": [],
            "accomplishments": [],
            "issues": [],
        }

        for block in blocks:
            tag = block.tag_name
            block_content = block.content
            attrs = block.attributes

            # Process images in the content
            processed_content, images = self._extract_images_from_content(
                doc, block_content, screenshots_dir
            )

            if tag == "introduction":
                result["introduction"] = self._strip_markdown(processed_content)
            elif tag == "conclusion":
                result["conclusion"] = self._strip_markdown(processed_content)
            elif tag == "overview":
                result["overview"] = self._strip_markdown(processed_content)
            elif tag == "highlights":
                result["highlights"] = self._strip_markdown(processed_content)
            elif tag == "step":
                step_data = {
                    "number": block.number or len(result["semantic_steps"]) + 1,
                    "title": self._extract_step_title(processed_content),
                    "description": self._strip_markdown(
                        self._remove_step_title(processed_content)
                    ),
                    "image": images[0] if images else None,
                    "alt_text": "",
                    "has_image": len(images) > 0,
                }
                result["semantic_steps"].append(step_data)
            elif tag == "note":
                note_data = {
                    "type": attrs.get("type", "info"),
                    "content": self._strip_markdown(processed_content),
                }
                result["notes"].append(note_data)
            elif tag == "keypoint":
                keypoint_data = {
                    "number": attrs.get("number", len(result["keypoints"]) + 1),
                    "title": attrs.get("title", ""),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["keypoints"].append(keypoint_data)
            elif tag == "tip":
                tip_data = {
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["tips"].append(tip_data)
            elif tag == "section":
                section_data = {
                    "title": attrs.get("title", ""),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["sections"].append(section_data)
            elif tag == "definition":
                definition_data = {
                    "term": attrs.get("term", ""),
                    "content": self._strip_markdown(processed_content),
                }
                result["definitions"].append(definition_data)
            elif tag == "example":
                example_data = {
                    "title": attrs.get("title", ""),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["examples"].append(example_data)
            elif tag == "finding":
                finding_data = {
                    "number": attrs.get("number", len(result["findings"]) + 1),
                    "title": attrs.get("title", ""),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["findings"].append(finding_data)
            elif tag == "findings":
                # The <findings> tag (with 's') is used in incident-report format
                # as a singular container for the "Detailed Findings" section
                # Parse it as a single finding entry
                finding_data = {
                    "number": 1,
                    "title": attrs.get("title", "Detailed Findings"),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["findings"].append(finding_data)
            elif tag == "recommendation":
                recommendation_data = {
                    "number": attrs.get("number", len(result["recommendations"]) + 1),
                    "title": attrs.get("title", ""),
                    "priority": attrs.get("priority", "medium"),
                    "content": self._strip_markdown(processed_content),
                }
                result["recommendations"].append(recommendation_data)
            # Report format tags
            elif tag == "summary":
                result["summary"] = self._strip_markdown(processed_content)
                if images:
                    result["summary_image"] = images[0]
            elif tag == "location":
                result["location"] = self._strip_markdown(processed_content)
                if images:
                    result["location_image"] = images[0]
            elif tag == "next_steps":
                result["next_steps"] = self._strip_markdown(processed_content)
            elif tag == "evidence":
                evidence_data = {
                    "title": attrs.get("title", f"Evidence {len(result['evidences']) + 1}"),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["evidences"].append(evidence_data)
            elif tag == "severity":
                result["severity"] = {
                    "level": attrs.get("level", "medium"),
                    "content": self._strip_markdown(processed_content),
                }
            elif tag == "inspection_item":
                item_data = {
                    "title": attrs.get("title", ""),
                    "status": attrs.get("status", "pass"),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["inspection_items"].append(item_data)
            elif tag == "status":
                result["status_summary"] = self._strip_markdown(processed_content)
            elif tag == "period":
                result["period"] = self._strip_markdown(processed_content)
                if images:
                    result["period_image"] = images[0]
            elif tag == "accomplishment":
                accomplishment_data = {
                    "title": attrs.get("title", ""),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["accomplishments"].append(accomplishment_data)
            elif tag == "issue":
                issue_data = {
                    "title": attrs.get("title", ""),
                    "impact": attrs.get("impact", "medium"),
                    "content": self._strip_markdown(processed_content),
                    "image": images[0] if images else None,
                    "has_image": len(images) > 0,
                }
                result["issues"].append(issue_data)
            elif tag == "timeline":
                result["timeline"] = self._strip_markdown(processed_content)

        return result

    def _extract_images_from_content(
        self, doc: DocxTemplate, content: str, screenshots_dir: Path
    ) -> tuple[str, list]:
        """Extract images from content and return processed content and image list.

        Args:
            doc: DocxTemplate instance
            content: Content that may contain image references
            screenshots_dir: Path to screenshots directory

        Returns:
            Tuple of (content without images, list of InlineImage objects)
        """
        images = []
        processed_content = content

        for img_match in re.finditer(r"!\[([^\]]*)\]\(([^)]+)\)", content):
            alt_text = img_match.group(1)
            img_path = img_match.group(2)

            # Remove the image markdown from content
            processed_content = processed_content.replace(img_match.group(0), "")

            # Resolve and create inline image
            resolved_path = self._resolve_image_path(img_path, screenshots_dir)
            if resolved_path and resolved_path.exists():
                try:
                    inline_image = self._create_inline_image(doc, resolved_path)
                    images.append(inline_image)
                except Exception as e:
                    logger.warning(f"Failed to create inline image: {e}")

        return processed_content.strip(), images

    def _extract_step_title(self, content: str) -> str:
        """Extract title from step content (usually the first heading).

        Args:
            content: Step content

        Returns:
            Step title or empty string
        """
        # Look for markdown headings
        match = re.match(r"^#+\s*(.+?)$", content, re.MULTILINE)
        if match:
            return match.group(1).strip()
        return ""

    def _remove_step_title(self, content: str) -> str:
        """Remove the first heading from step content.

        Args:
            content: Step content

        Returns:
            Content without the first heading
        """
        # Remove the first heading line
        return re.sub(r"^#+\s*.+?\n", "", content, count=1).strip()

    def _parse_steps_from_markdown(
        self, doc: DocxTemplate, content: str
    ) -> List[Dict[str, Any]]:
        """Parse markdown content into structured steps.

        This is the legacy parser that looks for markdown headings.
        For new content with semantic tags, use semantic_steps from _parse_semantic_content.

        Args:
            doc: DocxTemplate instance (needed for InlineImage creation)
            content: Markdown content

        Returns:
            List of step dictionaries
        """
        screenshots_dir = self.user_storage.docs_dir / self.doc_id / "screenshots"
        steps = []
        current_step = None
        step_number = 0

        # Strip semantic tags before parsing to avoid confusion
        clean_content = strip_semantic_tags(content)
        lines = clean_content.split("\n")
        i = 0

        while i < len(lines):
            line = lines[i]

            # Detect step headers - matches ## or ### followed by any word and a number
            # Examples: "## Step 1:", "### Paso 1:", "## 1. Title", "### Étape 1 -", etc.
            step_match = re.match(r"^#{2,3}\s+(?:\w+\s+)?(\d+)[\s:.,-]*(.*)$", line, re.I)
            if step_match:
                # Save previous step if exists
                if current_step is not None:
                    current_step["description"] = current_step["description"].strip()
                    steps.append(current_step)

                step_number = int(step_match.group(1))
                step_title = step_match.group(2).strip()

                current_step = {
                    "number": step_number,
                    "title": step_title,
                    "description": "",
                    "image": None,
                    "alt_text": "",
                    "has_image": False,
                }
                i += 1
                continue

            # Detect images
            img_match = re.match(r"!\[([^\]]*)\]\(([^)]+)\)", line)
            if img_match and current_step is not None:
                alt_text = img_match.group(1).replace("\n", " ").strip()
                img_path = img_match.group(2)

                # Resolve image path
                resolved_path = self._resolve_image_path(img_path, screenshots_dir)

                if resolved_path and resolved_path.exists():
                    try:
                        inline_image = self._create_inline_image(doc, resolved_path)
                        current_step["image"] = inline_image
                        current_step["alt_text"] = alt_text
                        current_step["has_image"] = True
                    except Exception as e:
                        # If image fails, log the error and continue without it
                        import logging
                        logging.warning(f"Failed to create inline image from {resolved_path}: {e}")
                        current_step["alt_text"] = f"[Image: {alt_text}]"
                else:
                    import logging
                    logging.warning(f"Image not found: {img_path} -> resolved to: {resolved_path}")

                i += 1
                continue

            # Regular content - add to current step description
            if current_step is not None:
                # Skip code blocks
                if line.strip().startswith("```"):
                    code_content = []
                    i += 1
                    while i < len(lines) and not lines[i].strip().startswith("```"):
                        code_content.append(lines[i])
                        i += 1
                    if code_content:
                        current_step["description"] += "\n" + "\n".join(code_content)
                    i += 1
                    continue

                # Skip top-level headings
                if line.startswith("# ") and not line.startswith("## "):
                    i += 1
                    continue

                # Add regular text
                if line.strip():
                    # Clean up markdown formatting for plain text
                    clean_line = self._strip_markdown(line)
                    if clean_line:
                        if current_step["description"]:
                            current_step["description"] += "\n"
                        current_step["description"] += clean_line

            i += 1

        # Don't forget the last step
        if current_step is not None:
            current_step["description"] = current_step["description"].strip()
            steps.append(current_step)

        # If no steps were parsed with headers, treat the whole content as one step
        if not steps:
            steps.append(
                {
                    "number": 1,
                    "title": "",
                    "description": self._strip_markdown(content),
                    "image": None,
                    "alt_text": "",
                    "has_image": False,
                }
            )

        return steps

    def _resolve_image_path(
        self, img_path: str, screenshots_dir: Path
    ) -> Optional[Path]:
        """Resolve image path to absolute path.

        Args:
            img_path: Image path from markdown
            screenshots_dir: Screenshots directory

        Returns:
            Resolved Path or None
        """
        # Handle ../screenshots/ paths
        if img_path.startswith("../screenshots/"):
            filename = img_path.replace("../screenshots/", "")
            return screenshots_dir / filename

        # Handle screenshots/ paths
        if img_path.startswith("screenshots/"):
            filename = img_path.replace("screenshots/", "")
            return screenshots_dir / filename

        # Handle file:// URLs
        if img_path.startswith("file://"):
            return Path(img_path.replace("file://", ""))

        # Handle absolute paths
        if img_path.startswith("/"):
            return Path(img_path)

        # Handle bare filenames
        if not img_path.startswith(("http://", "https://")):
            return screenshots_dir / img_path

        return None

    def _create_inline_image(
        self,
        doc: DocxTemplate,
        image_path: Path,
        max_width_mm: int = 150,
        max_height_mm: int = 100,
    ) -> InlineImage:
        """Create an InlineImage for the template.

        Args:
            doc: DocxTemplate instance
            image_path: Path to the image file
            max_width_mm: Maximum width in millimeters
            max_height_mm: Maximum height in millimeters

        Returns:
            InlineImage object for template insertion
        """
        # Ensure absolute path
        abs_path = image_path.resolve()

        # Get image dimensions to maintain aspect ratio
        with PILImage.open(abs_path) as img:
            img_width, img_height = img.size

        # Calculate scaling to fit within bounds while maintaining aspect ratio
        aspect_ratio = img_width / img_height

        if aspect_ratio > (max_width_mm / max_height_mm):
            # Width-constrained
            width = Mm(max_width_mm)
            return InlineImage(doc, str(abs_path), width=width)
        else:
            # Height-constrained
            height = Mm(max_height_mm)
            return InlineImage(doc, str(abs_path), height=height)

    def _strip_markdown(self, text: str) -> str:
        """Strip markdown formatting from text.

        Args:
            text: Text with potential markdown formatting

        Returns:
            Plain text without markdown
        """
        # Remove semantic tags (e.g., <step>, <note>, <introduction>, etc.)
        # This is critical - leftover XML-like tags will corrupt Word documents
        text = strip_semantic_tags(text)
        # Remove images
        text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
        # Remove links, keep text
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        # Remove bold
        text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
        # Remove italic
        text = re.sub(r"\*([^*]+)\*", r"\1", text)
        # Remove inline code
        text = re.sub(r"`([^`]+)`", r"\1", text)
        # Remove headers
        text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
        # Remove list markers
        text = re.sub(r"^[\-\*\+]\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\d+\.\s+", "", text, flags=re.MULTILINE)

        return text.strip()


class ProjectTemplateExporter:
    """Export projects (multi-manual compilations) using Word templates.

    Templates can include placeholders like:
    - {{ project_name }} - Project name
    - {{ project_description }} - Project description
    - {% for chapter in chapters %} - Loop over chapters
    - {% for manual in chapter.manuals %} - Loop over manuals in chapter
    """

    def __init__(self, user_id: str, project_id: str):
        """Initialize the exporter.

        Args:
            user_id: User identifier
            project_id: Project identifier
        """
        self.user_id = user_id
        self.project_id = project_id
        self.user_storage = UserStorage(user_id)
        self.template_storage = TemplateStorage(user_id)

        # Import here to avoid circular imports
        from ..storage.project_storage import ProjectStorage

        self.project_storage = ProjectStorage(user_id)

        # Load project data
        self.project = self.project_storage.get_project(project_id)
        if not self.project:
            raise ValueError(f"Project not found: {project_id}")

    def export(
        self,
        template_path: Path,
        language: str = "en",
        output_path: Optional[str] = None,
    ) -> str:
        """Export project using the specified template.

        Args:
            template_path: Path to the Word template file
            language: Language code for manual content
            output_path: Optional output file path

        Returns:
            Path to the generated Word file
        """
        if not template_path.exists():
            raise ValueError(f"Template not found: {template_path}")

        # Load template
        doc = DocxTemplate(template_path)

        # Build context
        context = self._build_context(doc, language)

        # Render template
        doc.render(context)

        # Determine output path
        if output_path is None:
            output_path = self._get_output_path(language)

        # Save document
        doc.save(output_path)

        return output_path

    def _get_output_path(self, language: str) -> str:
        """Generate output path for the exported document.

        Args:
            language: Language code

        Returns:
            Output file path
        """
        export_dir = (
            self.user_storage.user_dir / "projects" / self.project_id / "exports"
        )
        export_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{self.project_id}_{language}_{timestamp}_template.docx"
        return str(export_dir / filename)

    def _build_context(self, doc: DocxTemplate, language: str) -> Dict[str, Any]:
        """Build the Jinja2 context for project template rendering.

        Args:
            doc: DocxTemplate instance
            language: Language code

        Returns:
            Dictionary with template context variables
        """
        chapters = self.project.get("chapters", [])
        processed_chapters = []
        total_manuals = 0
        total_steps = 0

        for chapter in sorted(chapters, key=lambda c: c.get("order", 0)):
            chapter_manuals = []

            for manual_id in chapter.get("manuals", []):
                # Get manual content
                content = self.user_storage.get_doc_content(manual_id, language)
                if not content:
                    continue

                # Parse steps
                manual_exporter = ManualTemplateExporter(self.user_id, manual_id)
                steps = manual_exporter._parse_steps_from_markdown(doc, content)

                # Get manual metadata
                metadata = self.user_storage.get_doc_metadata(manual_id) or {}

                chapter_manuals.append(
                    {
                        "id": manual_id,
                        "title": metadata.get("title", manual_id),
                        "steps": steps,
                        "step_count": len(steps),
                    }
                )

                total_manuals += 1
                total_steps += len(steps)

            processed_chapters.append(
                {
                    "title": chapter.get("title", ""),
                    "description": chapter.get("description", ""),
                    "order": chapter.get("order", 0),
                    "manuals": chapter_manuals,
                    "manual_count": len(chapter_manuals),
                }
            )

        context = {
            # Project metadata
            "project_name": self.project.get("name", self.project_id),
            "project_description": self.project.get("description", ""),
            "project_id": self.project_id,
            "language": language,
            "language_upper": language.upper(),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "generated_date": datetime.now().strftime("%Y-%m-%d"),
            # Chapters and manuals
            "chapters": processed_chapters,
            "chapter_count": len(processed_chapters),
            "total_manuals": total_manuals,
            "total_steps": total_steps,
        }

        return context
