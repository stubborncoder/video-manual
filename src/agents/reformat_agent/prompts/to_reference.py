"""Prompt for converting any format to Reference Document."""

TO_REFERENCE_PROMPT = """
You are converting this document to a TECHNICAL REFERENCE format.

TARGET FORMAT: Reference Document
Purpose: Comprehensive technical reference organized by topic (not workflow)

SEMANTIC TAGS TO USE:

<title>Reference: [Feature/Component Name]</title>

<section title="Section Name">
## Section Name

Detailed explanation of this topic or feature. Cover:
- What it is and what it does
- All available options or parameters
- When and why to use it

![Screenshot showing this feature](../screenshots/figure_XX_tYYs.png)

### Subsection if needed
More specific details...
</section>

<definition term="Technical Term">
Clear, precise definition of this term or concept.
Include any important distinctions or common misconceptions.
</definition>

<example title="Example: Specific Use Case">
Practical example showing how to use this feature.

![Screenshot of the example](../screenshots/figure_XX_tYYs.png)

Explanation of what this example demonstrates.
</example>

CONVERSION STRATEGY:

1. REORGANIZE
   - Group by feature/topic, NOT by sequence
   - Create logical sections based on functionality
   - Eliminate workflow-based organization

2. EXPAND
   - Add technical details where helpful
   - Document all available options/parameters
   - Include edge cases and variations

3. DEFINE
   - Explain all technical terms
   - Provide clear definitions
   - Clarify common misconceptions

4. EXEMPLIFY
   - Include practical examples for each major feature
   - Show real use cases
   - Demonstrate variations

STRUCTURAL CHANGE:
- FROM: Sequential workflow (Step 1, 2, 3...)
- TO: Topic-based organization (Feature A, Feature B...)

WHAT TO ADD:
- Technical definitions
- All available options/parameters
- Use cases for each feature
- Cross-references between related sections

WHAT TO REMOVE:
- Sequential flow narrative ("First...", "Next...", "Then...")
- "You will..." transitions
- Workflow-specific context
- Redundant introductions

EXAMPLE TRANSFORMATION:

BEFORE (step-manual):
<step number="3">
## Set Export Quality
Choose between Low, Medium, or High quality. High quality produces larger files but looks better when printed.
</step>
<step number="4">
## Choose Output Format
Select PDF, PNG, or DOCX from the dropdown menu.
</step>

AFTER (reference):
<section title="Export Options">
## Export Options

The export system provides multiple configuration options for customizing output.

### Quality Settings

<definition term="Export Quality">
Controls the resolution and compression of the output file.

Available options:
- **Low**: 72 DPI, maximum compression. Best for: email attachments, web preview
- **Medium**: 150 DPI, balanced compression. Best for: general use, screen viewing
- **High**: 300 DPI, minimal compression. Best for: printing, archival

Note: Higher quality settings produce larger file sizes.
</definition>

### Output Formats

<definition term="Supported Formats">
The system supports three output formats:

- **PDF**: Universal document format. Preserves layout across all devices.
- **PNG**: Lossless image format. Best for screenshots and graphics.
- **DOCX**: Microsoft Word format. Allows further editing.
</definition>

<example title="High-Quality PDF Export">
For print-ready documents, combine High quality with PDF format:
1. Set Quality to High
2. Select PDF as format
3. Click Export

![Export Settings](../screenshots/fig_03.png)

This produces a 300 DPI PDF suitable for professional printing.
</example>
</section>

GUIDELINES:
- Be comprehensive but organized
- Define all technical terms
- Include practical examples for each major feature
- Use consistent terminology throughout
- Cross-reference related sections where helpful
"""
