#!/usr/bin/env python3
"""Create default Word templates for vDocs.

Run this script to generate the default templates in data/templates/.
These templates use Jinja2 syntax compatible with docxtpl.
"""

from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE


def create_manual_template(output_path: Path) -> None:
    """Create a default template for individual manuals."""
    doc = Document()

    # Set up styles
    styles = doc.styles

    # Title style
    title_style = styles['Title']
    title_style.font.size = Pt(28)
    title_style.font.color.rgb = RGBColor(0x1a, 0x36, 0x5d)

    # Heading 1 for step titles
    h1_style = styles['Heading 1']
    h1_style.font.size = Pt(16)
    h1_style.font.color.rgb = RGBColor(0x2c, 0x52, 0x82)

    # Add title placeholder
    title = doc.add_paragraph("{{ title }}", style='Title')
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Add metadata line
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run("Generated: {{ generated_at }} | Language: {{ language_upper }}")
    meta.runs[0].font.size = Pt(10)
    meta.runs[0].font.color.rgb = RGBColor(0x71, 0x80, 0x96)

    doc.add_paragraph()  # Spacing

    # Add target context (optional)
    doc.add_paragraph("{% if target_audience %}")
    audience = doc.add_paragraph()
    audience.add_run("Target Audience: ").bold = True
    audience.add_run("{{ target_audience }}")
    doc.add_paragraph("{% endif %}")

    doc.add_paragraph("{% if target_objective %}")
    objective = doc.add_paragraph()
    objective.add_run("Objective: ").bold = True
    objective.add_run("{{ target_objective }}")
    doc.add_paragraph("{% endif %}")

    doc.add_paragraph()  # Spacing

    # Add steps loop
    doc.add_paragraph("{% for step in steps %}")

    # Step header
    step_header = doc.add_heading("Step {{ step.number }}{% if step.title %}: {{ step.title }}{% endif %}", level=1)

    # Step description
    doc.add_paragraph("{{ step.description }}")

    # Step image (conditional)
    doc.add_paragraph("{% if step.has_image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ step.image }}")

    # Image caption
    caption = doc.add_paragraph()
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption_run = caption.add_run("{{ step.alt_text }}")
    caption_run.font.size = Pt(9)
    caption_run.font.italic = True
    caption_run.font.color.rgb = RGBColor(0x71, 0x80, 0x96)
    doc.add_paragraph("{% endif %}")

    doc.add_paragraph()  # Spacing between steps
    doc.add_paragraph("{% endfor %}")

    # Add summary footer
    doc.add_paragraph()
    footer = doc.add_paragraph()
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer_run = footer.add_run("Total Steps: {{ step_count }} | Screenshots: {{ screenshot_count }}")
    footer_run.font.size = Pt(9)
    footer_run.font.color.rgb = RGBColor(0x71, 0x80, 0x96)

    doc.save(output_path)
    print(f"Created: {output_path}")


def create_project_template(output_path: Path) -> None:
    """Create a default template for project compilations."""
    doc = Document()

    # Set up styles
    styles = doc.styles

    # Title style
    title_style = styles['Title']
    title_style.font.size = Pt(32)
    title_style.font.color.rgb = RGBColor(0x1a, 0x36, 0x5d)

    # Add project title
    title = doc.add_paragraph("{{ project_name }}", style='Title')
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Add project description
    doc.add_paragraph("{% if project_description %}")
    desc = doc.add_paragraph("{{ project_description }}")
    desc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph("{% endif %}")

    # Add metadata
    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.add_run("Generated: {{ generated_at }} | Language: {{ language_upper }}")
    meta.runs[0].font.size = Pt(10)
    meta.runs[0].font.color.rgb = RGBColor(0x71, 0x80, 0x96)

    # Add summary
    summary = doc.add_paragraph()
    summary.alignment = WD_ALIGN_PARAGRAPH.CENTER
    summary.add_run("{{ chapter_count }} Chapters | {{ total_manuals }} Manuals | {{ total_steps }} Steps")
    summary.runs[0].font.size = Pt(10)
    summary.runs[0].font.color.rgb = RGBColor(0x71, 0x80, 0x96)

    # Page break after title page
    doc.add_page_break()

    # Chapters loop
    doc.add_paragraph("{% for chapter in chapters %}")

    # Chapter header
    chapter_title = doc.add_heading("Chapter {{ chapter.order }}: {{ chapter.title }}", level=1)

    doc.add_paragraph("{% if chapter.description %}")
    doc.add_paragraph("{{ chapter.description }}")
    doc.add_paragraph("{% endif %}")

    doc.add_paragraph()

    # Manuals within chapter
    doc.add_paragraph("{% for manual in chapter.manuals %}")

    # Manual title
    doc.add_heading("{{ manual.title }}", level=2)

    # Steps within manual
    doc.add_paragraph("{% for step in manual.steps %}")

    doc.add_heading("Step {{ step.number }}{% if step.title %}: {{ step.title }}{% endif %}", level=3)
    doc.add_paragraph("{{ step.description }}")

    doc.add_paragraph("{% if step.has_image %}")
    img_para = doc.add_paragraph()
    img_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    img_para.add_run("{{ step.image }}")

    caption = doc.add_paragraph()
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption_run = caption.add_run("{{ step.alt_text }}")
    caption_run.font.size = Pt(9)
    caption_run.font.italic = True
    doc.add_paragraph("{% endif %}")

    doc.add_paragraph()
    doc.add_paragraph("{% endfor %}")  # End steps

    doc.add_paragraph("{% endfor %}")  # End manuals

    doc.add_page_break()
    doc.add_paragraph("{% endfor %}")  # End chapters

    doc.save(output_path)
    print(f"Created: {output_path}")


def main():
    """Create all default templates."""
    # Find project root
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    templates_dir = project_root / "data" / "templates"

    # Ensure templates directory exists
    templates_dir.mkdir(parents=True, exist_ok=True)

    # Create templates
    create_manual_template(templates_dir / "default-manual.docx")
    create_project_template(templates_dir / "default-project.docx")

    print(f"\nDefault templates created in: {templates_dir}")


if __name__ == "__main__":
    main()
