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

    # ==================== Report Formats ====================

    "incident-report": {
        "label": "Incident Report",
        "description": "Document issues, damage, or problems with visual evidence",
        "tags": ["title", "summary", "location", "findings", "evidence", "severity", "recommendation", "next_steps"],
        "prompt": f"""You are creating an INCIDENT REPORT from video documentation.

WHAT IS AN INCIDENT REPORT?
An incident report documents an issue, problem, or damage that was recorded on video. It's used by field technicians, inspectors, and service professionals to provide professional documentation of what they observed. The video serves as visual evidence.

CHARACTERISTICS OF A GOOD INCIDENT REPORT:
- Clear identification of the problem
- Visual evidence with screenshots from the video
- Professional, objective language
- Severity assessment
- Actionable recommendations
- Suitable for insurance claims, work orders, or client communication

SEMANTIC TAGS TO USE:

<title>Incident Report: [Brief Description of Issue]</title>

<summary>
## Summary

Brief 2-3 sentence overview of the incident:
- What the issue is
- Where it was observed
- Overall severity assessment

![Overview shot of the affected area](../screenshots/figure_XX_tYYs.png)
</summary>

<location>
## Location Details

Describe where the issue was found:
- Specific location within the property/equipment
- Context that helps identify the area
- Any relevant environmental factors

![Screenshot showing the location](../screenshots/figure_XX_tYYs.png)
</location>

<findings>
## Detailed Findings

Describe what was observed in detail:
- Physical condition/damage observed
- Extent of the issue
- Any contributing factors visible

![Close-up of the issue](../screenshots/figure_XX_tYYs.png)
</findings>

<evidence title="Evidence: [Specific observation]">
Visual documentation of a specific aspect of the incident.

![Screenshot as evidence](../screenshots/figure_XX_tYYs.png)

Description of what this evidence shows and why it's significant.
</evidence>

<severity level="[low|medium|high|critical]">
## Severity Assessment

Assessment of how serious this issue is:
- **Level**: [low/medium/high/critical]
- **Immediate Risk**: [description]
- **Potential Consequences**: [if not addressed]
</severity>

<recommendation title="Recommendation">
Specific recommended action to address this issue:
- What needs to be done
- Who should do it
- Timeline/priority
</recommendation>

<next_steps>
## Next Steps

1. Immediate actions required
2. Follow-up tasks
3. Documentation/reporting needs
</next_steps>

GUIDELINES:
- Be objective and factual - describe what you SEE, not assumptions
- Include ALL relevant screenshots as evidence
- Use professional language suitable for formal documentation
- Clearly state severity so readers understand urgency
- Make recommendations actionable and specific
- This report may be used for insurance, legal, or compliance purposes

{SCREENSHOT_RULES}

{OUTPUT_RULES}
""",
    },

    "inspection-report": {
        "label": "Inspection Report",
        "description": "Document condition assessments and compliance checks",
        "tags": ["title", "overview", "inspection_item", "finding", "status", "recommendation"],
        "prompt": f"""You are creating an INSPECTION REPORT from video documentation.

WHAT IS AN INSPECTION REPORT?
An inspection report systematically documents the condition of items, areas, or systems that were examined on video. It's used for pre/post condition assessments, compliance checks, safety inspections, and quality control.

CHARACTERISTICS OF A GOOD INSPECTION REPORT:
- Systematic coverage of all inspected items
- Clear pass/fail or condition status for each item
- Visual evidence supporting each assessment
- Objective, consistent evaluation criteria
- Actionable items for issues found

SEMANTIC TAGS TO USE:

<title>Inspection Report: [Subject of Inspection]</title>

<overview>
## Inspection Overview

- **Date**: [Date of inspection from video]
- **Subject**: [What was inspected]
- **Purpose**: [Type of inspection]
- **Overall Result**: [Pass/Fail/Conditional]

![Overview shot of inspection subject](../screenshots/figure_XX_tYYs.png)
</overview>

<inspection_item title="[Area/Component Name]" status="[pass|fail|needs_attention]">
## [Area/Component Name]

**Status**: [Pass / Fail / Needs Attention]

Description of this inspection point:
- What was examined
- Current condition observed
- Compliance with standards (if applicable)

![Screenshot of this inspection item](../screenshots/figure_XX_tYYs.png)
</inspection_item>

<finding type="[positive|issue|observation]">
Specific observation during inspection.
- What was found
- Significance of finding
- Evidence supporting this finding

![Screenshot supporting finding](../screenshots/figure_XX_tYYs.png)
</finding>

<status>
## Overall Status Summary

| Area | Status | Notes |
|------|--------|-------|
| [Area 1] | [Status] | [Brief note] |
| [Area 2] | [Status] | [Brief note] |
</status>

<recommendation priority="[low|medium|high]">
## Recommendations

Action items based on inspection findings:
- **Priority**: [High/Medium/Low]
- **Action Required**: [Description]
- **Timeline**: [When to address]
</recommendation>

GUIDELINES:
- Be systematic - cover all areas shown in the video
- Use consistent terminology (Pass/Fail/Needs Attention)
- Include visual evidence for EVERY inspection point
- Distinguish between issues and observations
- Prioritize recommendations clearly
- This is a formal document - maintain professional tone

{SCREENSHOT_RULES}

{OUTPUT_RULES}
""",
    },

    "progress-report": {
        "label": "Progress Report",
        "description": "Document project status and milestones",
        "tags": ["title", "period", "accomplishment", "issue", "next_steps", "timeline"],
        "prompt": f"""You are creating a PROGRESS REPORT from video documentation.

WHAT IS A PROGRESS REPORT?
A progress report documents the current status of work, project milestones, and ongoing activities captured on video. It's used for construction updates, project tracking, work-in-progress documentation, and status communications.

CHARACTERISTICS OF A GOOD PROGRESS REPORT:
- Clear timeline and period covered
- Visual before/after or progress comparisons
- Accomplishments and milestones reached
- Issues or delays encountered
- Forward-looking next steps
- Suitable for stakeholder communication

SEMANTIC TAGS TO USE:

<title>Progress Report: [Project/Work Name]</title>

<period>
## Reporting Period

- **Period**: [Date range]
- **Project/Work**: [Description]
- **Overall Status**: [On Track / Delayed / Ahead of Schedule]

![Current state overview](../screenshots/figure_XX_tYYs.png)
</period>

<accomplishment title="[Completed Work/Milestone]">
## Accomplishment: [Title]

Description of completed work:
- What was accomplished
- Comparison to plan/schedule
- Quality notes if applicable

![Screenshot showing completed work](../screenshots/figure_XX_tYYs.png)
</accomplishment>

<issue title="[Issue/Challenge]" impact="[low|medium|high]">
## Issue: [Title]

Description of challenge encountered:
- What the issue is
- Impact on schedule/work
- How it's being addressed

![Screenshot showing issue](../screenshots/figure_XX_tYYs.png)
</issue>

<next_steps>
## Next Steps

Upcoming work and priorities:
1. [Next task/phase]
2. [Second priority]
3. [Third priority]

Expected completion or next milestone date.
</next_steps>

<timeline>
## Timeline Status

| Milestone | Planned | Actual/Expected | Status |
|-----------|---------|-----------------|--------|
| [Phase 1] | [Date] | [Date] | [Complete/In Progress/Delayed] |
| [Phase 2] | [Date] | [Date] | [Status] |
</timeline>

GUIDELINES:
- Focus on what's VISIBLE in the video
- Be honest about issues and delays
- Use screenshots to show progress visually
- Keep language professional but accessible
- Include timeline/schedule context
- This report communicates to stakeholders - be clear and complete

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
