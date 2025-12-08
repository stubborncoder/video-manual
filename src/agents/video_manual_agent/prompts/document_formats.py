"""Document format definitions and format-specific prompts.

Each format defines:
- label: Human-readable name for UI
- description: Brief description for user selection
- tags: List of semantic tags used in this format
- prompt: Detailed instructions for the LLM on how to structure output
"""

from typing import Dict, List, TypedDict


class DocumentFormat(TypedDict):
    """Type definition for a document format."""
    label: str
    description: str
    tags: List[str]
    prompt: str


# Common rules for all formats
SCREENSHOT_RULES = """
SCREENSHOT EMBEDDING RULES:
- You MUST embed EVERY screenshot from the "AVAILABLE SCREENSHOTS" section
- Use exact format: ![Description](../screenshots/figure_XX_tYYs.png)
- Use the exact filename from the "File:" field
- Place screenshots immediately after the content they illustrate
- Every screenshot must appear in the final document
"""

OUTPUT_RULES = """
OUTPUT FORMAT RULES:
- Start DIRECTLY with <title> tag - no preamble or greeting
- Use the semantic tags specified for this format
- Tags contain valid Markdown inside them
- Do NOT add your own numbering to titles (e.g., "Step 1:", "Paso 1:") - the template handles numbering
- Write in the requested language naturally
- End with the content - no closing remarks or sign-offs
"""


DOCUMENT_FORMATS: Dict[str, DocumentFormat] = {
    "step-manual": {
        "label": "Step-by-step Manual",
        "description": "Numbered procedural instructions with screenshots",
        "tags": ["title", "introduction", "step", "note", "conclusion"],
        "prompt": f"""You are creating a STEP-BY-STEP PROCEDURAL MANUAL.

WHAT IS A STEP-BY-STEP MANUAL?
A step-by-step manual is a detailed instructional document that guides users through a process or task by breaking it down into sequential, numbered steps. Each step represents ONE distinct action the user must take.

CHARACTERISTICS OF A GOOD STEP-BY-STEP MANUAL:
- Clear, actionable steps that a the target audience can follow
- One action per step (not multiple actions bundled together)
- Each step starts with an action verb (Click, Select, Enter, Navigate, etc.)
- Screenshots showing exactly what the user should see
- Warnings before potentially problematic actions
- Tips for efficiency or best practices

SEMANTIC TAGS TO USE:

<title>Clear, descriptive title of what this manual teaches</title>

<introduction>
1-2 paragraphs explaining:
- What task/process this manual covers
- What the user will be able to do after completing it
- Any prerequisites or requirements
</introduction>

<step number="1">
## Action-oriented title (e.g., "Open the Settings Menu")

Detailed instruction for this single action. Describe:
- Exactly what to click/select/enter
- Where to find it on the screen
- What the user should see after completing this step

![Screenshot description](../screenshots/figure_XX_tYYs.png)
</step>

<note type="warning">
Important warning about potential issues or irreversible actions.
</note>

<note type="tip">
Helpful tip for efficiency or alternative approaches.
</note>

<note type="info">
Additional context or explanation that helps understanding.
</note>

<conclusion>
Summary of what was accomplished and optional next steps.
</conclusion>

CRITICAL - STEP TITLE FORMAT:
The template adds "Step 1:", "Step 2:", etc. automatically. You must NEVER include numbering in your titles.

CORRECT:
<step number="1">
## Open the Settings Menu
...
</step>

INCORRECT (DO NOT DO THIS):
<step number="1">
## Step 1: Open the Settings Menu   ← WRONG! "Step 1:" will be duplicated
## Paso 1: Abrir el menú            ← WRONG! Same issue in Spanish
## 1. Open the Settings Menu        ← WRONG! No numbers at all
</step>

OTHER IMPORTANT RULES:
- Create a separate <step> for EACH distinct action shown in the video
- Every screenshot MUST be embedded in the appropriate step

{SCREENSHOT_RULES}

{OUTPUT_RULES}
""",
    },

    "quick-guide": {
        "label": "Quick Guide",
        "description": "Brief overview with key points for quick reference",
        "tags": ["title", "overview", "keypoint", "tip"],
        "prompt": f"""You are creating a QUICK REFERENCE GUIDE.

WHAT IS A QUICK GUIDE?
A quick guide is a condensed, scannable document that provides essential information at a glance. It's designed for users who need to quickly understand the main concepts or refresh their memory, NOT for learning from scratch.

CHARACTERISTICS OF A GOOD QUICK GUIDE:
- Concise - can be read in 2-3 minutes
- Scannable - uses bullet points and short paragraphs
- Focused on the most important information only
- Assumes some familiarity with the topic
- Easy to reference during actual work

SEMANTIC TAGS TO USE:

<title>Quick Guide: [Topic Name]</title>

<overview>
Brief 2-3 sentence summary of what this covers and when to use it.

![Overview screenshot if applicable](../screenshots/figure_XX_tYYs.png)
</overview>

<keypoint title="Key Concept or Action">
- Bullet point explanation
- Keep it brief and actionable
- Focus on the "what" not the detailed "how"

![Screenshot showing this concept](../screenshots/figure_XX_tYYs.png)
</keypoint>

<tip>
Pro tip or shortcut that experienced users would appreciate.
</tip>

GUIDELINES:
- Maximum 5-7 key points
- Each keypoint should be self-contained
- Use bullet points extensively
- Include screenshots for visual reference
- Skip detailed explanations - link to full manual if needed

{SCREENSHOT_RULES}

{OUTPUT_RULES}
""",
    },

    "reference": {
        "label": "Reference Document",
        "description": "Detailed technical reference with definitions and examples",
        "tags": ["title", "section", "definition", "example"],
        "prompt": f"""You are creating a TECHNICAL REFERENCE DOCUMENT.

WHAT IS A REFERENCE DOCUMENT?
A reference document is a comprehensive resource that provides detailed technical information organized by topic. Unlike tutorials, reference docs are not meant to be read linearly - users look up specific information as needed.

CHARACTERISTICS OF A GOOD REFERENCE DOCUMENT:
- Organized by topic/feature, not by workflow
- Comprehensive coverage of all options and parameters
- Clear definitions of technical terms
- Practical examples showing usage
- Easy to search and navigate

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

GUIDELINES:
- Be comprehensive but organized
- Define all technical terms
- Include practical examples for each major feature
- Use consistent terminology throughout
- Cross-reference related sections

{SCREENSHOT_RULES}

{OUTPUT_RULES}
""",
    },

    "summary": {
        "label": "Executive Summary",
        "description": "High-level overview for decision makers",
        "tags": ["title", "highlights", "finding", "recommendation"],
        "prompt": f"""You are creating an EXECUTIVE SUMMARY.

WHAT IS AN EXECUTIVE SUMMARY?
An executive summary is a high-level document designed for decision-makers who need to understand the key points without reading detailed documentation. It focuses on WHAT and WHY, not HOW.

CHARACTERISTICS OF A GOOD EXECUTIVE SUMMARY:
- Can be read in under 5 minutes
- Leads with the most important information
- Focuses on business impact and outcomes
- Provides clear, actionable recommendations
- Avoids technical jargon
- Supports quick decision-making

SEMANTIC TAGS TO USE:

<title>Summary: [Topic/Process Name]</title>

<highlights>
## Key Highlights

The 3-5 most important takeaways:
- First key point (most important)
- Second key point
- Third key point

![Key screenshot showing the main concept](../screenshots/figure_XX_tYYs.png)
</highlights>

<finding title="Finding Title">
What was observed or discovered. Focus on:
- The observation itself
- Its significance or impact
- Supporting evidence (screenshot)

![Screenshot supporting this finding](../screenshots/figure_XX_tYYs.png)
</finding>

<recommendation title="Recommendation Title">
Specific, actionable recommendation based on the findings.
Include:
- What action to take
- Expected benefit or outcome
- Priority level if applicable
</recommendation>

GUIDELINES:
- Lead with conclusions, not background
- Keep findings objective and evidence-based
- Make recommendations specific and actionable
- Use business language, not technical jargon
- Include only the most impactful screenshots
- Maximum 3-4 findings and 2-3 recommendations

{SCREENSHOT_RULES}

{OUTPUT_RULES}
""",
    },
}


def get_format_prompt(format_id: str) -> str:
    """Get the generation prompt for a document format.

    Args:
        format_id: The format identifier (e.g., "step-manual")

    Returns:
        The prompt string for that format

    Raises:
        ValueError: If format_id is not found
    """
    if format_id not in DOCUMENT_FORMATS:
        raise ValueError(f"Unknown document format: {format_id}. Available: {list(DOCUMENT_FORMATS.keys())}")
    return DOCUMENT_FORMATS[format_id]["prompt"]


def get_format_tags(format_id: str) -> List[str]:
    """Get the semantic tags used by a document format.

    Args:
        format_id: The format identifier

    Returns:
        List of tag names for that format
    """
    if format_id not in DOCUMENT_FORMATS:
        raise ValueError(f"Unknown document format: {format_id}")
    return DOCUMENT_FORMATS[format_id]["tags"]


def list_formats() -> Dict[str, Dict[str, str]]:
    """List all available formats with their labels and descriptions.

    Returns:
        Dict mapping format_id to {label, description}
    """
    return {
        format_id: {
            "label": fmt["label"],
            "description": fmt["description"],
        }
        for format_id, fmt in DOCUMENT_FORMATS.items()
    }


# Default format when not specified
DEFAULT_FORMAT = "step-manual"
