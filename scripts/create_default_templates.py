#!/usr/bin/env python3
"""Create default Word templates for vDocs.

Run this script to generate the default templates in data/templates/.
These templates use Jinja2 syntax compatible with docxtpl.

Creates templates for each document format:
- step-manual: Step-by-step procedural manuals
- quick-guide: Brief overview with key points
- reference: Detailed reference documentation
- summary: Executive summary with findings

Usage:
    uv run python scripts/create_default_templates.py
"""

from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor, Cm, Twips
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE


def setup_base_styles(doc: Document) -> None:
    """Set up common styles used across all templates."""
    styles = doc.styles

    # Title style
    title_style = styles['Title']
    title_style.font.size = Pt(24)
    title_style.font.color.rgb = RGBColor(0x1a, 0x36, 0x5d)
    title_style.paragraph_format.space_after = Pt(6)
    title_style.paragraph_format.keep_with_next = True  # Keep title with content

    # Heading styles with tighter spacing
    h1_style = styles['Heading 1']
    h1_style.font.size = Pt(16)
    h1_style.font.color.rgb = RGBColor(0x1a, 0x36, 0x5d)
    h1_style.paragraph_format.space_before = Pt(12)
    h1_style.paragraph_format.space_after = Pt(4)
    h1_style.paragraph_format.keep_with_next = True  # Never orphan a heading

    h2_style = styles['Heading 2']
    h2_style.font.size = Pt(13)
    h2_style.font.color.rgb = RGBColor(0x2c, 0x52, 0x82)
    h2_style.paragraph_format.space_before = Pt(8)
    h2_style.paragraph_format.space_after = Pt(2)
    h2_style.paragraph_format.keep_with_next = True  # Never orphan a heading

    # Normal paragraph with tighter spacing
    normal_style = styles['Normal']
    normal_style.paragraph_format.space_before = Pt(0)
    normal_style.paragraph_format.space_after = Pt(4)
    normal_style.paragraph_format.widow_control = True  # Prevent widows/orphans

    # Jinja control style - zero spacing for control tags
    try:
        styles['JinjaControl']
    except KeyError:
        jinja_style = styles.add_style('JinjaControl', WD_STYLE_TYPE.PARAGRAPH)
        jinja_style.font.size = Pt(1)  # Tiny font
        jinja_style.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)  # White (invisible)
        jinja_style.paragraph_format.space_before = Pt(0)
        jinja_style.paragraph_format.space_after = Pt(0)
        jinja_style.paragraph_format.line_spacing = Pt(1)

    # Create Code style for code blocks
    try:
        styles['Code']
    except KeyError:
        code_style = styles.add_style('Code', WD_STYLE_TYPE.PARAGRAPH)
        code_style.font.name = 'Consolas'
        code_style.font.size = Pt(9)
        code_style.paragraph_format.space_before = Pt(4)
        code_style.paragraph_format.space_after = Pt(4)
        code_style.paragraph_format.left_indent = Cm(0.5)

    # Create Note styles with appropriate colors
    note_configs = {
        'NoteInfo': RGBColor(0x00, 0x7A, 0xCC),      # Blue
        'NoteWarning': RGBColor(0xD9, 0x53, 0x19),   # Orange
        'NoteTip': RGBColor(0x10, 0x7C, 0x10),       # Green
    }

    for style_name, color in note_configs.items():
        try:
            styles[style_name]
        except KeyError:
            style = styles.add_style(style_name, WD_STYLE_TYPE.PARAGRAPH)
            style.font.size = Pt(10)
            style.font.color.rgb = color
            style.paragraph_format.left_indent = Cm(0.5)
            style.paragraph_format.space_before = Pt(4)
            style.paragraph_format.space_after = Pt(4)
            style.paragraph_format.keep_together = True  # Don't split notes across pages


def add_jinja(doc: Document, text: str) -> None:
    """Add a Jinja control tag with zero spacing."""
    para = doc.add_paragraph(text, style='JinjaControl')
    para.paragraph_format.space_before = Pt(0)
    para.paragraph_format.space_after = Pt(0)


def add_header(doc: Document, subtitle: str = "") -> None:
    """Add common header section to template."""
    # Title
    title = doc.add_paragraph("{{ title }}", style='Title')
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Metadata line
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if subtitle:
        meta.add_run(f"{subtitle} | ")
    meta.add_run("{{ generated_date }} | {{ language_upper }}")
    for run in meta.runs:
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x71, 0x80, 0x96)
    meta.paragraph_format.space_after = Pt(12)


def create_step_manual_template(output_path: Path) -> None:
    """Create template for step-by-step manual format."""
    doc = Document()
    setup_base_styles(doc)
    set_document_format_in_docx(doc, "step-manual")
    add_header(doc, "Step-by-step Manual")

    # Introduction
    add_jinja(doc, "{% if introduction %}")
    doc.add_heading("Introduction", level=1)
    doc.add_paragraph("{{ introduction }}")
    add_jinja(doc, "{% endif %}")

    # Steps
    add_jinja(doc, "{% for step in semantic_steps %}")
    doc.add_heading("Step {{ step.number }}: {{ step.title }}", level=2)
    doc.add_paragraph("{{ step.description }}")

    # Step image
    add_jinja(doc, "{% if step.image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ step.image }}")
    add_jinja(doc, "{% endif %}")

    add_jinja(doc, "{% endfor %}")

    # Notes
    add_jinja(doc, "{% for note in notes %}")
    add_jinja(doc, "{% if note.type == 'warning' %}")
    doc.add_paragraph("⚠️ Warning: {{ note.content }}", style='NoteWarning')
    add_jinja(doc, "{% elif note.type == 'tip' %}")
    doc.add_paragraph("💡 Tip: {{ note.content }}", style='NoteTip')
    add_jinja(doc, "{% else %}")
    doc.add_paragraph("ℹ️ {{ note.content }}", style='NoteInfo')
    add_jinja(doc, "{% endif %}")
    add_jinja(doc, "{% endfor %}")

    # Conclusion
    add_jinja(doc, "{% if conclusion %}")
    doc.add_heading("Conclusion", level=1)
    doc.add_paragraph("{{ conclusion }}")
    add_jinja(doc, "{% endif %}")

    doc.save(output_path)
    print(f"  ✓ Created: {output_path.name}")


def create_quick_guide_template(output_path: Path) -> None:
    """Create template for quick guide format."""
    doc = Document()
    setup_base_styles(doc)
    set_document_format_in_docx(doc, "quick-guide")
    add_header(doc, "Quick Guide")

    # Overview
    add_jinja(doc, "{% if overview %}")
    doc.add_heading("Overview", level=1)
    doc.add_paragraph("{{ overview }}")
    add_jinja(doc, "{% endif %}")

    # Key Points
    add_jinja(doc, "{% if keypoints %}")
    doc.add_heading("Key Points", level=1)

    add_jinja(doc, "{% for kp in keypoints %}")
    add_jinja(doc, "{% if kp.title %}")
    doc.add_heading("{{ kp.title }}", level=2)
    add_jinja(doc, "{% endif %}")
    doc.add_paragraph("{{ kp.content }}")

    # Keypoint image
    add_jinja(doc, "{% if kp.image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ kp.image }}")
    add_jinja(doc, "{% endif %}")

    add_jinja(doc, "{% endfor %}")
    add_jinja(doc, "{% endif %}")

    # Tips
    add_jinja(doc, "{% if tips %}")
    doc.add_heading("Tips", level=1)
    add_jinja(doc, "{% for tip in tips %}")
    doc.add_paragraph("💡 {{ tip.content }}", style='NoteTip')

    # Tip image
    add_jinja(doc, "{% if tip.image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ tip.image }}")
    add_jinja(doc, "{% endif %}")

    add_jinja(doc, "{% endfor %}")
    add_jinja(doc, "{% endif %}")

    doc.save(output_path)
    print(f"  ✓ Created: {output_path.name}")


def create_reference_template(output_path: Path) -> None:
    """Create template for reference document format."""
    doc = Document()
    setup_base_styles(doc)
    set_document_format_in_docx(doc, "reference")
    add_header(doc, "Reference Document")

    # Sections
    add_jinja(doc, "{% for section in sections %}")
    add_jinja(doc, "{% if section.title %}")
    doc.add_heading("{{ section.title }}", level=1)
    add_jinja(doc, "{% endif %}")
    doc.add_paragraph("{{ section.content }}")

    # Section image
    add_jinja(doc, "{% if section.image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ section.image }}")
    add_jinja(doc, "{% endif %}")

    add_jinja(doc, "{% endfor %}")

    # Definitions
    add_jinja(doc, "{% if definitions %}")
    doc.add_heading("Definitions", level=1)
    add_jinja(doc, "{% for def in definitions %}")
    term_para = doc.add_paragraph()
    term_run = term_para.add_run("{{ def.term }}: ")
    term_run.bold = True
    term_para.add_run("{{ def.content }}")
    add_jinja(doc, "{% endfor %}")
    add_jinja(doc, "{% endif %}")

    # Examples
    add_jinja(doc, "{% if examples %}")
    doc.add_heading("Examples", level=1)
    add_jinja(doc, "{% for ex in examples %}")
    add_jinja(doc, "{% if ex.title %}")
    doc.add_heading("{{ ex.title }}", level=2)
    add_jinja(doc, "{% endif %}")
    doc.add_paragraph("{{ ex.content }}")

    # Example image
    add_jinja(doc, "{% if ex.image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ ex.image }}")
    add_jinja(doc, "{% endif %}")

    add_jinja(doc, "{% endfor %}")
    add_jinja(doc, "{% endif %}")

    doc.save(output_path)
    print(f"  ✓ Created: {output_path.name}")


def create_summary_template(output_path: Path) -> None:
    """Create template for executive summary format."""
    doc = Document()
    setup_base_styles(doc)
    set_document_format_in_docx(doc, "summary")
    add_header(doc, "Executive Summary")

    # Highlights
    add_jinja(doc, "{% if highlights %}")
    doc.add_heading("Key Highlights", level=1)
    doc.add_paragraph("{{ highlights }}")
    add_jinja(doc, "{% endif %}")

    # Findings
    add_jinja(doc, "{% if findings %}")
    doc.add_heading("Findings", level=1)
    add_jinja(doc, "{% for finding in findings %}")
    add_jinja(doc, "{% if finding.title %}")
    doc.add_heading("{{ finding.title }}", level=2)
    add_jinja(doc, "{% else %}")
    doc.add_heading("Finding {{ finding.number }}", level=2)
    add_jinja(doc, "{% endif %}")
    doc.add_paragraph("{{ finding.content }}")

    # Finding image
    add_jinja(doc, "{% if finding.image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ finding.image }}")
    add_jinja(doc, "{% endif %}")

    add_jinja(doc, "{% endfor %}")
    add_jinja(doc, "{% endif %}")

    # Recommendations
    add_jinja(doc, "{% if recommendations %}")
    doc.add_heading("Recommendations", level=1)
    add_jinja(doc, "{% for rec in recommendations %}")
    add_jinja(doc, "{% if rec.title %}")
    doc.add_heading("{{ rec.title }}", level=2)
    add_jinja(doc, "{% else %}")
    doc.add_heading("Recommendation {{ rec.number }}", level=2)
    add_jinja(doc, "{% endif %}")
    doc.add_paragraph("{{ rec.content }}")
    add_jinja(doc, "{% endfor %}")
    add_jinja(doc, "{% endif %}")

    doc.save(output_path)
    print(f"  ✓ Created: {output_path.name}")


def create_legacy_template(output_path: Path) -> None:
    """Create a legacy template for manuals without semantic tags."""
    doc = Document()
    setup_base_styles(doc)
    add_header(doc, "Manual")

    # Steps loop (legacy format using markdown-parsed steps)
    add_jinja(doc, "{% for step in steps %}")
    doc.add_heading("Step {{ step.number }}{% if step.title %}: {{ step.title }}{% endif %}", level=2)
    doc.add_paragraph("{{ step.description }}")

    add_jinja(doc, "{% if step.has_image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ step.image }}")
    add_jinja(doc, "{% endif %}")

    add_jinja(doc, "{% endfor %}")

    doc.save(output_path)
    print(f"  ✓ Created: {output_path.name}")


def set_document_format_in_docx(doc: Document, document_format: str) -> None:
    """Store document format in the docx core properties (category field)."""
    doc.core_properties.category = f"vdocs:{document_format}"


def create_template_metadata(template_path: Path, document_format: str) -> None:
    """Create metadata JSON file for a template."""
    import json
    meta_path = template_path.with_suffix(".json")
    metadata = {
        "document_format": document_format,
        "is_default": True,
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


def main():
    """Create all default templates."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    templates_dir = project_root / "data" / "templates"

    templates_dir.mkdir(parents=True, exist_ok=True)

    print(f"Creating default templates in: {templates_dir}\n")

    # Map template names to their creation functions and document formats
    templates = {
        "step-manual": (create_step_manual_template, "step-manual"),
        "quick-guide": (create_quick_guide_template, "quick-guide"),
        "reference": (create_reference_template, "reference"),
        "summary": (create_summary_template, "summary"),
        "default-manual": (create_legacy_template, None),  # Legacy has no specific format
    }

    for name, (create_func, doc_format) in templates.items():
        template_path = templates_dir / f"{name}.docx"
        create_func(template_path)
        if doc_format:
            create_template_metadata(template_path, doc_format)

    print("\n✅ All templates created successfully!")


if __name__ == "__main__":
    main()
