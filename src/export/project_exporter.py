"""PDF exporter for projects using WeasyPrint."""

from typing import Optional

import markdown
from weasyprint import HTML, CSS

from .base_exporter import BaseExporter


# Default CSS for PDF export
DEFAULT_CSS = """
@page {
    size: A4;
    margin: 2cm;
    @top-center {
        content: string(project-title);
        font-size: 10pt;
        color: #666;
    }
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10pt;
        color: #666;
    }
}

body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
}

h1 {
    string-set: project-title content();
    font-size: 24pt;
    color: #1a365d;
    border-bottom: 2px solid #1a365d;
    padding-bottom: 10px;
    margin-top: 0;
    page-break-before: always;
}

h1:first-of-type {
    page-break-before: avoid;
}

h2 {
    font-size: 18pt;
    color: #2c5282;
    margin-top: 30px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 5px;
}

h3 {
    font-size: 14pt;
    color: #2d3748;
    margin-top: 25px;
}

h4 {
    font-size: 12pt;
    color: #4a5568;
}

p {
    margin: 10px 0;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 15px auto;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
}

code {
    background-color: #f7fafc;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: "Monaco", "Consolas", monospace;
    font-size: 10pt;
}

pre {
    background-color: #f7fafc;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
    border: 1px solid #e2e8f0;
}

pre code {
    padding: 0;
    background: none;
}

ul, ol {
    margin: 10px 0;
    padding-left: 25px;
}

li {
    margin: 5px 0;
}

blockquote {
    border-left: 4px solid #4299e1;
    margin: 15px 0;
    padding: 10px 20px;
    background-color: #ebf8ff;
    font-style: italic;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 15px 0;
}

th, td {
    border: 1px solid #e2e8f0;
    padding: 8px 12px;
    text-align: left;
}

th {
    background-color: #f7fafc;
    font-weight: bold;
}

hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 30px 0;
}

/* Table of Contents */
.toc {
    page-break-after: always;
}

.toc h1 {
    page-break-before: avoid;
}

.toc ul {
    list-style: none;
    padding-left: 0;
}

.toc li {
    margin: 8px 0;
}

.toc a {
    text-decoration: none;
    color: #2c5282;
}

.toc .chapter {
    font-weight: bold;
    font-size: 12pt;
    margin-top: 15px;
}

.toc .manual {
    padding-left: 20px;
    font-size: 11pt;
}

/* Chapter cover */
.chapter-cover {
    page-break-before: always;
    page-break-after: always;
    text-align: center;
    padding-top: 40%;
}

.chapter-cover h2 {
    font-size: 28pt;
    border: none;
    color: #1a365d;
}

.chapter-cover p {
    font-size: 14pt;
    color: #666;
}

/* Manual section */
.manual-section {
    page-break-before: always;
}
"""


class ProjectExporter(BaseExporter):
    """Exports projects to PDF with table of contents and chapter covers."""

    file_extension = "pdf"

    def export(
        self,
        output_path: Optional[str] = None,
        language: str = "en",
        include_toc: bool = False,
        include_chapter_covers: bool = False,
        custom_css: Optional[str] = None,
    ) -> str:
        """Export project to PDF.

        Args:
            output_path: Optional output file path. If not provided, saves to project exports folder.
            language: Language code for manual content
            include_toc: Whether to include table of contents
            include_chapter_covers: Whether to include chapter cover pages
            custom_css: Optional custom CSS to override default styles

        Returns:
            Path to the generated PDF file
        """
        # Determine output path
        output_path = self._get_output_path(output_path, language)

        # Build combined markdown
        combined_md = self._build_combined_markdown(
            language=language,
            include_toc=include_toc,
            include_chapter_covers=include_chapter_covers,
        )

        # Convert markdown to HTML
        html_content = self._convert_markdown_to_html(combined_md)

        # Generate PDF with WeasyPrint
        css = CSS(string=custom_css or DEFAULT_CSS)
        html_doc = HTML(string=html_content, base_url=str(self.user_storage.docs_dir))
        html_doc.write_pdf(output_path, stylesheets=[css])

        return output_path

    def _convert_markdown_to_html(self, md_content: str) -> str:
        """Convert markdown to HTML."""
        # Enable extensions for better formatting
        extensions = [
            'tables',
            'fenced_code',
            'codehilite',
            'toc',
            'nl2br',
            'md_in_html',  # Process markdown inside HTML blocks
        ]

        html_body = markdown.markdown(
            md_content,
            extensions=extensions,
            extension_configs={
                'codehilite': {
                    'css_class': 'highlight',
                    'guess_lang': False,
                }
            }
        )

        # Wrap in HTML document
        html_doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{self.project['name']}</title>
</head>
<body>
{html_body}
</body>
</html>"""

        return html_doc
