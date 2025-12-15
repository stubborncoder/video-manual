# Implementation Plan: New Export Options for vDocs

## Summary
Add two new export options:
1. **Multi-platform Markdown Export** - ZIP with markdown + images + platform configs
2. **PowerPoint (PPTX) Export** - Each step becomes a slide

---

## New Files to Create

### 1. `/src/export/markdown_exporter.py` (~350 lines)

```python
class MarkdownPlatform(Enum):
    GENERIC = "generic"      # Clean .md + images/
    MKDOCS = "mkdocs"        # docs/index.md + frontmatter + mkdocs.yml
    DOCUSAURUS = "docusaurus" # docs/manual.mdx + frontmatter + sidebars.js
    GITBOOK = "gitbook"      # README.md + SUMMARY.md + .gitbook/assets/

class ManualMarkdownExporter(BaseManualExporter):
    file_extension = "zip"

    def export(self, language: str, platform: MarkdownPlatform) -> str
    def _create_generic_export(self, content: str, images: List[Path]) -> Dict[str, bytes]
    def _create_mkdocs_export(self, content: str, images: List[Path], metadata: Dict) -> Dict[str, bytes]
    def _create_docusaurus_export(self, content: str, images: List[Path], metadata: Dict) -> Dict[str, bytes]
    def _create_gitbook_export(self, content: str, images: List[Path], metadata: Dict) -> Dict[str, bytes]
    def _generate_yaml_frontmatter(self, metadata: Dict, platform: MarkdownPlatform) -> str
    def _create_zip_archive(self, files: Dict[str, bytes], output_path: str) -> str
```

**Output Structure by Platform:**

| Platform | Files |
|----------|-------|
| Generic | `manual.md`, `images/` |
| MkDocs | `docs/index.md`, `docs/images/`, `mkdocs.yml` |
| Docusaurus | `docs/manual.mdx`, `docs/img/`, `sidebars.js` |
| GitBook | `README.md`, `SUMMARY.md`, `.gitbook/assets/` |

---

### 2. `/src/export/pptx_exporter.py` (~400 lines)

```python
class ManualPPTXExporter(BaseManualExporter):
    file_extension = "pptx"

    # 16:9 widescreen
    SLIDE_WIDTH = Inches(13.333)
    SLIDE_HEIGHT = Inches(7.5)

    def export(self, language: str, layout: str = "side_by_side") -> str
    def _create_title_slide(self, prs: Presentation, title: str, metadata: Dict) -> None
    def _create_step_slide(self, prs, step_number, step_content, image_path, layout) -> None
    def _create_slide_side_by_side(self, slide, step_number, title, body, image_path) -> None
    def _create_slide_top_bottom(self, slide, step_number, title, body, image_path) -> None
    def _add_notes(self, slide, content: str) -> None
    def _parse_step_content(self, step_content: str) -> Tuple[str, str, Optional[str]]
```

**Layouts:**
- `side_by_side`: Image left (55%), text right (40%)
- `top_bottom`: Image top, text bottom

---

## Files to Modify

### 1. `/src/export/__init__.py` (+10 lines)
```python
from .markdown_exporter import ManualMarkdownExporter, MarkdownPlatform
from .pptx_exporter import ManualPPTXExporter
# Add to __all__
```

### 2. `/src/export/manual_exporter.py` (+15 lines)
Update factory function:
```python
exporters = {
    # ... existing ...
    'markdown': ManualMarkdownExporter,
    'md': ManualMarkdownExporter,
    'pptx': ManualPPTXExporter,
    'powerpoint': ManualPPTXExporter,
}
```

### 3. `/src/api/routes/manuals.py` (~60 lines)

**Update `ManualExportRequest` model:**
```python
class ManualExportRequest(BaseModel):
    format: str = "pdf"  # pdf, word, html, chunks, markdown, pptx
    language: str = "en"
    markdown_platform: str | None = None  # generic, mkdocs, docusaurus, gitbook
    pptx_layout: str | None = None        # side_by_side, top_bottom
```

**Add format handling in `export_manual` endpoint (~line 1483):**
- Validate new formats
- Create appropriate exporter
- Pass platform/layout options

**Update media types in `download_manual_export`:**
```python
'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
```

### 4. `/pyproject.toml` (+1 line)
```toml
"python-pptx>=1.0.0",  # PowerPoint export
```

---

## API Usage

**Markdown Export:**
```json
POST /api/manuals/{manual_id}/export
{
  "format": "markdown",
  "language": "en",
  "markdown_platform": "mkdocs"  // generic, mkdocs, docusaurus, gitbook
}
```

**PPTX Export:**
```json
POST /api/manuals/{manual_id}/export
{
  "format": "pptx",
  "language": "en",
  "pptx_layout": "side_by_side"  // side_by_side, top_bottom
}
```

---

## Implementation Sequence

1. **Dependencies**: Add `python-pptx` to `pyproject.toml`, run `uv sync`
2. **Markdown Exporter**: Create `markdown_exporter.py`
   - Generic export first
   - Add frontmatter generation
   - Platform-specific exports (MkDocs, Docusaurus, GitBook)
3. **PPTX Exporter**: Create `pptx_exporter.py`
   - Title slide
   - Step parsing (reuse `get_steps()` from `tag_parser.py`)
   - Side-by-side layout
   - Top-bottom layout
4. **API Integration**: Update `manuals.py` routes
5. **Testing**: Test with sample manuals

---

## Critical Reference Files

- `/src/export/manual_exporter.py` - Base class pattern
- `/src/export/chunks_exporter.py` - ZIP creation pattern
- `/src/export/tag_parser.py` - `strip_semantic_tags()`, `get_steps()`
- `/src/api/routes/manuals.py:1434-1639` - Export endpoints

---

## Edge Cases to Handle

| Case | Solution |
|------|----------|
| Steps without images | Text-only slide, centered |
| Long step text | Truncate on slide, full text in speaker notes |
| Image aspect ratio | Maintain ratio, constrain to max dimensions |
| ZIP filename collision | Use `_markdown.zip` vs `_chunks.zip` patterns |

---

## Future Export Options (Not in this implementation)

For future consideration:
- **Notion Export** - API-based or copy-paste compatible markdown
- **EPUB** - E-book format using `ebooklib`
- **Confluence** - Storage format or REST API
- **SCORM Package** - LMS integration for training completion tracking
