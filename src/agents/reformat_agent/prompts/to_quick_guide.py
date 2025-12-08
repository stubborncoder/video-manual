"""Prompt for converting any format to Quick Guide."""

TO_QUICK_GUIDE_PROMPT = """
You are converting this document to a QUICK REFERENCE GUIDE format.

TARGET FORMAT: Quick Guide
Purpose: A condensed, scannable document for quick reference (2-3 minute read)

SEMANTIC TAGS TO USE:

<title>Quick Guide: [Topic Name]</title>

<overview>
Brief 2-3 sentence summary of what this covers and when to use it.
![Overview screenshot if applicable](../screenshots/figure_XX_tYYs.png)
</overview>

<keypoint title="Key Concept or Action">
- Bullet point explanation
- Keep it brief and actionable
- Focus on the "what" not detailed "how"
![Screenshot showing this concept](../screenshots/figure_XX_tYYs.png)
</keypoint>

<tip>
Pro tip or shortcut that experienced users would appreciate.
</tip>

CONVERSION STRATEGY:

1. CONDENSE
   - Reduce detailed explanations to bullet points
   - Remove step-by-step narratives
   - Keep only essential information

2. COMBINE
   - Group related steps into single keypoints
   - Merge similar concepts together
   - Create logical groupings

3. PRIORITIZE
   - Include only the 5-7 most important points
   - Focus on key actions and outcomes
   - Skip background and theory

4. SIMPLIFY
   - Focus on "what" not detailed "how"
   - Use bullet points extensively
   - Make content scannable

WHAT TO REMOVE:
- Lengthy introductions and conclusions
- Detailed step-by-step explanations
- Technical background information
- Repetitive content
- Verbose descriptions

WHAT TO KEEP:
- All screenshots (distribute among relevant keypoints)
- Key actions and their outcomes
- Important warnings and tips
- Essential context for understanding

EXAMPLE TRANSFORMATION:

BEFORE (step-manual):
<step number="1">
## Open Settings Menu
Click on the gear icon in the top-right corner of the screen. The Settings panel will slide out from the right side of the window, showing you all available configuration options.
![Settings](../screenshots/fig_01.png)
</step>
<step number="2">
## Navigate to Privacy
In the Settings panel, scroll down until you see the Privacy section. Click on it to expand the privacy options.
</step>

AFTER (quick-guide):
<keypoint title="Access Privacy Settings">
- Click gear icon (top-right) → Settings panel opens
- Scroll to Privacy section and click to expand
![Settings](../screenshots/fig_01.png)
</keypoint>
"""
