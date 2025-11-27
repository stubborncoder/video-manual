"""HTML exporter for projects - standalone HTML with embedded images."""

import base64
import mimetypes
import re
from pathlib import Path
from typing import Optional

import markdown

from .base_exporter import BaseExporter


# Default CSS for HTML export
DEFAULT_HTML_CSS = """
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 16px;
    line-height: 1.6;
    color: #333;
    max-width: 900px;
    margin: 0 auto;
    padding: 20px 40px;
    background-color: #fff;
}

h1 {
    font-size: 2.5em;
    color: #1a365d;
    border-bottom: 3px solid #1a365d;
    padding-bottom: 10px;
    margin-top: 40px;
}

h1:first-of-type {
    margin-top: 0;
}

h2 {
    font-size: 1.8em;
    color: #2c5282;
    margin-top: 35px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 8px;
}

h3 {
    font-size: 1.4em;
    color: #2d3748;
    margin-top: 30px;
}

h4 {
    font-size: 1.2em;
    color: #4a5568;
    margin-top: 25px;
}

p {
    margin: 15px 0;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 20px auto;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

code {
    background-color: #f7fafc;
    padding: 3px 8px;
    border-radius: 4px;
    font-family: "SF Mono", Monaco, "Courier New", monospace;
    font-size: 0.9em;
    color: #c7254e;
}

pre {
    background-color: #f7fafc;
    padding: 20px;
    border-radius: 8px;
    overflow-x: auto;
    border: 1px solid #e2e8f0;
}

pre code {
    padding: 0;
    background: none;
    color: inherit;
}

ul, ol {
    margin: 15px 0;
    padding-left: 30px;
}

li {
    margin: 8px 0;
}

blockquote {
    border-left: 4px solid #4299e1;
    margin: 20px 0;
    padding: 15px 25px;
    background-color: #ebf8ff;
    border-radius: 0 8px 8px 0;
    font-style: italic;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
}

th, td {
    border: 1px solid #e2e8f0;
    padding: 12px 15px;
    text-align: left;
}

th {
    background-color: #f7fafc;
    font-weight: 600;
}

tr:nth-child(even) {
    background-color: #f9fafb;
}

hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 40px 0;
}

a {
    color: #3182ce;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

/* Manual section styling */
.manual-section {
    margin-top: 50px;
    padding-top: 30px;
    border-top: 2px solid #e2e8f0;
}

/* Chapter cover styling */
.chapter-cover {
    text-align: center;
    padding: 60px 20px;
    margin: 40px 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 12px;
}

.chapter-cover h2 {
    color: white;
    border: none;
    font-size: 2em;
}

.chapter-cover p {
    color: rgba(255,255,255,0.9);
}

/* TOC styling */
.toc {
    background-color: #f8fafc;
    padding: 30px;
    border-radius: 12px;
    margin: 30px 0;
}

.toc h1 {
    margin-top: 0;
    font-size: 1.5em;
    border: none;
}

.toc ul {
    list-style: none;
    padding-left: 0;
}

.toc li {
    margin: 10px 0;
}

.toc .chapter {
    font-weight: 600;
    font-size: 1.1em;
    margin-top: 20px;
}

.toc .manual {
    padding-left: 25px;
}

/* Print styles */
@media print {
    body {
        max-width: none;
        padding: 0;
    }

    .manual-section {
        page-break-before: always;
    }

    .chapter-cover {
        page-break-before: always;
        page-break-after: always;
    }
}
"""


class HTMLExporter(BaseExporter):
    """Exports projects to standalone HTML with embedded images."""

    file_extension = "html"

    def export(
        self,
        output_path: Optional[str] = None,
        language: str = "en",
        include_toc: bool = False,
        include_chapter_covers: bool = False,
        custom_css: Optional[str] = None,
        embed_images: bool = True,
    ) -> str:
        """Export project to standalone HTML.

        Args:
            output_path: Optional output file path
            language: Language code for manual content
            include_toc: Whether to include table of contents
            include_chapter_covers: Whether to include chapter cover pages
            custom_css: Optional custom CSS to override default styles
            embed_images: Whether to embed images as base64 (default True for standalone)

        Returns:
            Path to the generated HTML file
        """
        output_path = self._get_output_path(output_path, language)

        # Build combined markdown
        combined_md = self._build_combined_markdown(
            language=language,
            include_toc=include_toc,
            include_chapter_covers=include_chapter_covers,
        )

        # Convert markdown to HTML
        html_body = self._convert_markdown_to_html(combined_md)

        # Embed images if requested
        if embed_images:
            html_body = self._embed_images(html_body)

        # Build full HTML document
        css = custom_css or DEFAULT_HTML_CSS
        html_doc = self._build_html_document(html_body, css)

        # Write to file
        Path(output_path).write_text(html_doc, encoding='utf-8')

        return output_path

    def _convert_markdown_to_html(self, md_content: str) -> str:
        """Convert markdown to HTML."""
        extensions = [
            'tables',
            'fenced_code',
            'codehilite',
            'toc',
            'nl2br',
            'md_in_html',
        ]

        return markdown.markdown(
            md_content,
            extensions=extensions,
            extension_configs={
                'codehilite': {
                    'css_class': 'highlight',
                    'guess_lang': False,
                }
            }
        )

    def _embed_images(self, html_content: str) -> str:
        """Embed images as base64 data URIs.

        Args:
            html_content: HTML content with image tags

        Returns:
            HTML content with embedded images
        """
        def replace_image(match):
            src = match.group(1)

            # Handle file:// URLs
            if src.startswith('file://'):
                img_path = Path(src.replace('file://', ''))
            else:
                img_path = Path(src)

            if img_path.exists():
                try:
                    # Read image and convert to base64
                    with open(img_path, 'rb') as f:
                        img_data = f.read()

                    # Get MIME type
                    mime_type, _ = mimetypes.guess_type(str(img_path))
                    if not mime_type:
                        mime_type = 'image/png'

                    # Create data URI
                    b64_data = base64.b64encode(img_data).decode('utf-8')
                    data_uri = f'data:{mime_type};base64,{b64_data}'

                    return f'src="{data_uri}"'
                except Exception:
                    pass

            return match.group(0)

        # Replace file:// URLs with base64 data URIs
        pattern = r'src="(file://[^"]+|[^"]+\.(?:png|jpg|jpeg|gif|webp|svg))"'
        return re.sub(pattern, replace_image, html_content, flags=re.IGNORECASE)

    def _build_html_document(self, body: str, css: str) -> str:
        """Build complete HTML document.

        Args:
            body: HTML body content
            css: CSS styles

        Returns:
            Complete HTML document
        """
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{self.project['name']}</title>
    <style>
{css}
    </style>
</head>
<body>
{body}
</body>
</html>"""
