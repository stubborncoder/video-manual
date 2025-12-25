"""Tests for src/export/html_exporter.py - HTML export functionality."""

import base64
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.export.html_exporter import HTMLExporter, DEFAULT_HTML_CSS


@pytest.fixture
def mock_user_storage():
    """Create a mock UserStorage instance."""
    storage = MagicMock()
    storage.docs_dir = Path(tempfile.mkdtemp())
    return storage


@pytest.fixture
def mock_project_storage():
    """Create a mock ProjectStorage instance."""
    storage = MagicMock()
    storage.projects_dir = Path(tempfile.mkdtemp())
    return storage


@pytest.fixture
def sample_project():
    """Create a sample project dict for testing."""
    return {
        "id": "test-project",
        "name": "Test Project",
        "description": "A test project for HTML export",
        "chapters": [
            {
                "id": "chapter-1",
                "title": "Introduction",
                "description": "Getting started",
                "order": 1,
                "manuals": ["manual-1"],
            },
        ],
    }


@pytest.fixture
def sample_markdown():
    """Create sample markdown content."""
    return """# Test Manual

## Introduction
This is the introduction.

## Step 1
First step with **bold** and *italic*.

![Screenshot](screenshots/test.png)

## Code Example
```python
print("Hello World")
```

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
"""


class TestHTMLExporterInit:
    """Tests for HTMLExporter initialization."""

    def test_file_extension(self):
        """Test that file extension is 'html'."""
        assert HTMLExporter.file_extension == "html"

    def test_init_with_valid_project(
        self, mock_user_storage, mock_project_storage, sample_project
    ):
        """Test initialization with a valid project."""
        exporter = HTMLExporter.__new__(HTMLExporter)
        exporter.user_storage = mock_user_storage
        exporter.project_storage = mock_project_storage
        exporter.project = sample_project
        exporter.user_id = "test-user"
        exporter.project_id = "test-project"

        assert exporter.project["name"] == "Test Project"


class TestHTMLExporterExport:
    """Tests for the export method."""

    @pytest.fixture
    def html_exporter(self, mock_user_storage, mock_project_storage, sample_project, tmp_path):
        """Create an HTMLExporter instance for testing."""
        exporter = HTMLExporter.__new__(HTMLExporter)
        exporter.user_storage = mock_user_storage
        exporter.user_storage.docs_dir = tmp_path / "docs"
        exporter.user_storage.docs_dir.mkdir(parents=True)
        exporter.project_storage = mock_project_storage
        exporter.project = sample_project
        exporter.user_id = "test-user"
        exporter.project_id = "test-project"
        return exporter

    def test_export_creates_html_file(self, html_exporter, tmp_path):
        """Test that export creates an HTML file."""
        output_path = str(tmp_path / "test_output.html")

        html_exporter._get_output_path = MagicMock(return_value=output_path)
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test")
        html_exporter._get_manual_content = MagicMock(return_value=None)

        result = html_exporter.export(output_path=output_path)

        assert result == output_path
        assert Path(output_path).exists()

    def test_export_with_language_parameter(self, html_exporter, tmp_path):
        """Test export respects language parameter."""
        output_path = str(tmp_path / "test_es.html")

        html_exporter._get_output_path = MagicMock(return_value=output_path)
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test")

        html_exporter.export(output_path=output_path, language="es")

        html_exporter._build_combined_markdown.assert_called_once()
        call_args = html_exporter._build_combined_markdown.call_args
        assert call_args[1]["language"] == "es"

    def test_export_includes_toc_when_requested(self, html_exporter, tmp_path):
        """Test that TOC is included when requested."""
        output_path = str(tmp_path / "test_toc.html")

        html_exporter._get_output_path = MagicMock(return_value=output_path)
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test")

        html_exporter.export(output_path=output_path, include_toc=True)

        call_args = html_exporter._build_combined_markdown.call_args
        assert call_args[1]["include_toc"] is True

    def test_export_includes_chapter_covers_when_requested(self, html_exporter, tmp_path):
        """Test that chapter covers are included when requested."""
        output_path = str(tmp_path / "test_covers.html")

        html_exporter._get_output_path = MagicMock(return_value=output_path)
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test")

        html_exporter.export(output_path=output_path, include_chapter_covers=True)

        call_args = html_exporter._build_combined_markdown.call_args
        assert call_args[1]["include_chapter_covers"] is True


class TestImageBase64Embedding:
    """Tests for image base64 embedding functionality."""

    @pytest.fixture
    def html_exporter(self, tmp_path):
        """Create HTMLExporter with real temp storage."""
        exporter = HTMLExporter.__new__(HTMLExporter)
        storage = MagicMock()
        storage.docs_dir = tmp_path / "docs"
        storage.docs_dir.mkdir(parents=True)
        exporter.user_storage = storage
        exporter.project = {"name": "Test"}
        return exporter

    def test_embed_images_converts_to_base64(self, html_exporter, tmp_path):
        """Test that images are converted to base64 data URIs."""
        # Create a test image
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        img_path = img_dir / "test.png"

        # Create a simple PNG file
        from PIL import Image
        img = Image.new("RGB", (10, 10), color="red")
        img.save(img_path)

        html_content = f'<img src="{img_path}" alt="test">'
        result = html_exporter._embed_images(html_content)

        assert "data:image/png;base64," in result
        assert str(img_path) not in result

    def test_embed_images_handles_file_urls(self, html_exporter, tmp_path):
        """Test that file:// URLs are embedded correctly."""
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        img_path = img_dir / "test.png"

        from PIL import Image
        img = Image.new("RGB", (10, 10), color="blue")
        img.save(img_path)

        html_content = f'<img src="file://{img_path}" alt="test">'
        result = html_exporter._embed_images(html_content)

        assert "data:image/png;base64," in result

    def test_embed_images_preserves_missing_images(self, html_exporter):
        """Test that missing images are preserved as-is."""
        html_content = '<img src="/nonexistent/image.png" alt="missing">'
        result = html_exporter._embed_images(html_content)

        # Should keep original src
        assert 'src="/nonexistent/image.png"' in result

    def test_embed_images_handles_jpg(self, html_exporter, tmp_path):
        """Test that JPG images are embedded with correct MIME type."""
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        img_path = img_dir / "test.jpg"

        from PIL import Image
        img = Image.new("RGB", (10, 10), color="green")
        img.save(img_path, "JPEG")

        html_content = f'<img src="{img_path}" alt="test">'
        result = html_exporter._embed_images(html_content)

        assert "data:image/jpeg;base64," in result

    def test_embed_images_handles_gif(self, html_exporter, tmp_path):
        """Test that GIF images are embedded with correct MIME type."""
        img_dir = tmp_path / "images"
        img_dir.mkdir()
        img_path = img_dir / "test.gif"

        from PIL import Image
        img = Image.new("RGB", (10, 10), color="yellow")
        img.save(img_path, "GIF")

        html_content = f'<img src="{img_path}" alt="test">'
        result = html_exporter._embed_images(html_content)

        assert "data:image/gif;base64," in result

    def test_embed_images_skips_when_disabled(self, html_exporter, tmp_path):
        """Test that embedding can be disabled."""
        output_path = str(tmp_path / "no_embed.html")

        html_exporter._get_output_path = MagicMock(return_value=output_path)
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test")

        result = html_exporter.export(output_path=output_path, embed_images=False)

        assert Path(result).exists()

    def test_embed_images_regex_handles_multiple_images(self, html_exporter, tmp_path):
        """Test that multiple images are all embedded."""
        img_dir = tmp_path / "images"
        img_dir.mkdir()

        # Create multiple images
        from PIL import Image
        paths = []
        for i in range(3):
            img_path = img_dir / f"test{i}.png"
            img = Image.new("RGB", (10, 10), color=(i * 50, i * 50, i * 50))
            img.save(img_path)
            paths.append(img_path)

        html_content = "\n".join([f'<img src="{p}" alt="test{i}">' for i, p in enumerate(paths)])
        result = html_exporter._embed_images(html_content)

        # Count data URIs
        data_uri_count = result.count("data:image/png;base64,")
        assert data_uri_count == 3


class TestCSSStyleing:
    """Tests for CSS styling functionality."""

    def test_default_css_exists(self):
        """Test that default CSS is defined."""
        assert DEFAULT_HTML_CSS is not None
        assert len(DEFAULT_HTML_CSS) > 0

    def test_default_css_has_body_styles(self):
        """Test that default CSS includes body styles."""
        assert "body {" in DEFAULT_HTML_CSS
        assert "font-family" in DEFAULT_HTML_CSS

    def test_default_css_has_heading_styles(self):
        """Test that default CSS includes heading styles."""
        assert "h1 {" in DEFAULT_HTML_CSS or "h1," in DEFAULT_HTML_CSS
        assert "h2 {" in DEFAULT_HTML_CSS or "h2," in DEFAULT_HTML_CSS

    def test_default_css_has_code_styles(self):
        """Test that default CSS includes code styles."""
        assert "code {" in DEFAULT_HTML_CSS
        assert "pre {" in DEFAULT_HTML_CSS

    def test_default_css_has_image_styles(self):
        """Test that default CSS includes image styles."""
        assert "img {" in DEFAULT_HTML_CSS
        assert "max-width" in DEFAULT_HTML_CSS

    def test_default_css_has_table_styles(self):
        """Test that default CSS includes table styles."""
        assert "table {" in DEFAULT_HTML_CSS

    def test_default_css_has_blockquote_styles(self):
        """Test that default CSS includes blockquote styles."""
        assert "blockquote {" in DEFAULT_HTML_CSS

    def test_default_css_has_print_styles(self):
        """Test that default CSS includes print media query."""
        assert "@media print" in DEFAULT_HTML_CSS

    def test_export_uses_custom_css(self, tmp_path):
        """Test that custom CSS overrides default."""
        exporter = HTMLExporter.__new__(HTMLExporter)
        exporter.user_storage = MagicMock()
        exporter.user_storage.docs_dir = tmp_path
        exporter.project_storage = MagicMock()
        exporter.project = {"name": "Test", "chapters": []}
        exporter._get_output_path = MagicMock(return_value=str(tmp_path / "custom.html"))
        exporter._build_combined_markdown = MagicMock(return_value="# Test")

        custom_css = "body { background: red; }"
        result = exporter.export(custom_css=custom_css)

        with open(result, "r") as f:
            content = f.read()

        assert "background: red" in content
        # Default CSS should not be present
        assert "#1a365d" not in content  # Default heading color

    def test_default_css_has_manual_section_styles(self):
        """Test that default CSS includes manual section styles."""
        assert ".manual-section" in DEFAULT_HTML_CSS

    def test_default_css_has_chapter_cover_styles(self):
        """Test that default CSS includes chapter cover styles."""
        assert ".chapter-cover" in DEFAULT_HTML_CSS

    def test_default_css_has_toc_styles(self):
        """Test that default CSS includes TOC styles."""
        assert ".toc" in DEFAULT_HTML_CSS


class TestMarkdownConversion:
    """Tests for markdown to HTML conversion."""

    @pytest.fixture
    def html_exporter(self):
        """Create HTMLExporter for markdown conversion tests."""
        exporter = HTMLExporter.__new__(HTMLExporter)
        return exporter

    def test_convert_heading(self, html_exporter):
        """Test converting markdown headings."""
        md = "# Main Title\n\n## Subtitle"
        html = html_exporter._convert_markdown_to_html(md)

        assert "<h1>" in html or "<h1" in html
        assert "<h2>" in html or "<h2" in html

    def test_convert_paragraph(self, html_exporter):
        """Test converting markdown paragraphs."""
        md = "This is a paragraph."
        html = html_exporter._convert_markdown_to_html(md)

        assert "<p>" in html

    def test_convert_bold(self, html_exporter):
        """Test converting bold text."""
        md = "This is **bold** text."
        html = html_exporter._convert_markdown_to_html(md)

        assert "<strong>" in html or "<b>" in html

    def test_convert_italic(self, html_exporter):
        """Test converting italic text."""
        md = "This is *italic* text."
        html = html_exporter._convert_markdown_to_html(md)

        assert "<em>" in html or "<i>" in html

    def test_convert_code_block(self, html_exporter):
        """Test converting code blocks."""
        md = "```python\nprint('hello')\n```"
        html = html_exporter._convert_markdown_to_html(md)

        assert "<code" in html or "<pre" in html

    def test_convert_inline_code(self, html_exporter):
        """Test converting inline code."""
        md = "Use `code` here."
        html = html_exporter._convert_markdown_to_html(md)

        assert "<code>" in html

    def test_convert_bullet_list(self, html_exporter):
        """Test converting bullet lists."""
        md = "- Item 1\n- Item 2"
        html = html_exporter._convert_markdown_to_html(md)

        assert "<ul>" in html
        assert "<li>" in html

    def test_convert_numbered_list(self, html_exporter):
        """Test converting numbered lists."""
        md = "1. First\n2. Second"
        html = html_exporter._convert_markdown_to_html(md)

        assert "<ol>" in html
        assert "<li>" in html

    def test_convert_table(self, html_exporter):
        """Test converting markdown tables."""
        md = """
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
"""
        html = html_exporter._convert_markdown_to_html(md)

        assert "<table>" in html
        assert "<th>" in html or "<thead>" in html
        assert "<td>" in html

    def test_convert_blockquote(self, html_exporter):
        """Test converting blockquotes."""
        md = "> This is a quote"
        html = html_exporter._convert_markdown_to_html(md)

        assert "<blockquote>" in html

    def test_convert_link(self, html_exporter):
        """Test converting links."""
        md = "[Link text](https://example.com)"
        html = html_exporter._convert_markdown_to_html(md)

        assert "<a " in html
        assert "href=" in html

    def test_convert_image(self, html_exporter):
        """Test converting images."""
        md = "![Alt text](image.png)"
        html = html_exporter._convert_markdown_to_html(md)

        assert "<img " in html
        assert "alt=" in html


class TestHTMLDocumentStructure:
    """Tests for complete HTML document structure."""

    @pytest.fixture
    def html_exporter(self, tmp_path):
        """Create HTMLExporter for document structure tests."""
        exporter = HTMLExporter.__new__(HTMLExporter)
        exporter.user_storage = MagicMock()
        exporter.user_storage.docs_dir = tmp_path
        exporter.project_storage = MagicMock()
        exporter.project = {"name": "Test Project", "chapters": []}
        return exporter

    def test_build_html_document_has_doctype(self, html_exporter):
        """Test that HTML document has DOCTYPE."""
        html = html_exporter._build_html_document("<p>Test</p>", "")
        assert "<!DOCTYPE html>" in html

    def test_build_html_document_has_head(self, html_exporter):
        """Test that HTML document has head section."""
        html = html_exporter._build_html_document("<p>Test</p>", "")
        assert "<head>" in html
        assert "</head>" in html

    def test_build_html_document_has_body(self, html_exporter):
        """Test that HTML document has body section."""
        html = html_exporter._build_html_document("<p>Test</p>", "")
        assert "<body>" in html
        assert "</body>" in html

    def test_build_html_document_includes_title(self, html_exporter):
        """Test that HTML document includes project title."""
        html = html_exporter._build_html_document("<p>Test</p>", "")
        assert "<title>Test Project</title>" in html

    def test_build_html_document_includes_charset(self, html_exporter):
        """Test that HTML document specifies UTF-8 charset."""
        html = html_exporter._build_html_document("<p>Test</p>", "")
        assert 'charset="UTF-8"' in html

    def test_build_html_document_includes_viewport(self, html_exporter):
        """Test that HTML document includes viewport meta tag."""
        html = html_exporter._build_html_document("<p>Test</p>", "")
        assert 'viewport' in html
        assert 'width=device-width' in html

    def test_build_html_document_includes_css(self, html_exporter):
        """Test that HTML document includes CSS in style tag."""
        css = "body { color: red; }"
        html = html_exporter._build_html_document("<p>Test</p>", css)
        assert "<style>" in html
        assert css in html

    def test_build_html_document_includes_body_content(self, html_exporter):
        """Test that HTML document includes body content."""
        body = "<p>Test content</p>"
        html = html_exporter._build_html_document(body, "")
        assert body in html


class TestExportOptions:
    """Tests for various export options."""

    @pytest.fixture
    def html_exporter(self, tmp_path):
        """Create HTMLExporter with temp storage."""
        exporter = HTMLExporter.__new__(HTMLExporter)
        exporter.user_storage = MagicMock()
        exporter.user_storage.docs_dir = tmp_path
        exporter.project_storage = MagicMock()
        exporter.project_storage.projects_dir = tmp_path
        exporter.project = {"name": "Test", "chapters": []}
        exporter.project_id = "test-project"
        return exporter

    def test_export_default_embeds_images(self, html_exporter, tmp_path):
        """Test that images are embedded by default."""
        output_path = str(tmp_path / "default.html")
        html_exporter._get_output_path = MagicMock(return_value=output_path)
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test")
        html_exporter._embed_images = MagicMock(return_value="<h1>Test</h1>")

        html_exporter.export()

        # _embed_images should have been called
        html_exporter._embed_images.assert_called_once()

    def test_export_no_toc_by_default(self, html_exporter, tmp_path):
        """Test that TOC is not included by default."""
        output_path = str(tmp_path / "no_toc.html")
        html_exporter._get_output_path = MagicMock(return_value=output_path)
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test")

        html_exporter.export()

        call_args = html_exporter._build_combined_markdown.call_args
        assert call_args[1]["include_toc"] is False

    def test_export_no_chapter_covers_by_default(self, html_exporter, tmp_path):
        """Test that chapter covers are not included by default."""
        output_path = str(tmp_path / "no_covers.html")
        html_exporter._get_output_path = MagicMock(return_value=output_path)
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test")

        html_exporter.export()

        call_args = html_exporter._build_combined_markdown.call_args
        assert call_args[1]["include_chapter_covers"] is False

    def test_export_writes_utf8(self, html_exporter, tmp_path):
        """Test that output is written with UTF-8 encoding."""
        output_path = str(tmp_path / "utf8.html")
        html_exporter._get_output_path = MagicMock(return_value=output_path)
        # Include unicode characters
        html_exporter._build_combined_markdown = MagicMock(return_value="# Test \u4e2d\u6587")

        result = html_exporter.export()

        with open(result, "r", encoding="utf-8") as f:
            content = f.read()

        assert "\u4e2d\u6587" in content  # Chinese characters
