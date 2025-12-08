"""Prompt for converting any format to Step-by-Step Manual."""

TO_STEP_MANUAL_PROMPT = """
You are converting this document to a STEP-BY-STEP MANUAL format.

TARGET FORMAT: Step-by-Step Manual
Purpose: Detailed procedural instructions with numbered steps

SEMANTIC TAGS TO USE:

<title>Clear, descriptive title of what this manual teaches</title>

<introduction>
1-2 paragraphs explaining:
- What task/process this manual covers
- What the user will be able to do after completing it
- Any prerequisites or requirements
</introduction>

<step number="N">
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

CONVERSION STRATEGY:

1. EXPAND
   - Add detailed explanations for each action
   - Describe what the user should see
   - Provide context for why each step matters

2. SEQUENCE
   - Organize into logical step order
   - Ensure steps flow naturally
   - Add transitions where helpful

3. ATOMIZE
   - One distinct action per step
   - Don't bundle multiple actions together
   - Each step should be completable independently

4. DETAIL
   - Describe exactly what user should see/do
   - Include specific UI element names
   - Mention expected outcomes

CRITICAL - STEP TITLE FORMAT:
The template adds "Step 1:", "Step 2:", etc. automatically.
You must NEVER include numbering in your step titles.

CORRECT:
<step number="1">
## Open the Settings Menu
...
</step>

INCORRECT (DO NOT DO THIS):
<step number="1">
## Step 1: Open the Settings Menu   ← WRONG! Numbering will be duplicated
## 1. Open the Settings Menu        ← WRONG! No numbers at all
</step>

WHAT TO ADD:
- Clear action verbs (Click, Select, Enter, Navigate, Open, etc.)
- Descriptions of expected outcomes
- Context for why each step matters
- Warnings before risky actions
- Tips for efficiency

WHAT TO KEEP:
- All screenshots (place in appropriate steps)
- Important warnings and tips
- Core procedural content

EXAMPLE TRANSFORMATION:

BEFORE (quick-guide):
<keypoint title="Configure Export">
- Set quality (Low/Medium/High)
- Choose format (PDF/PNG/DOCX)
- Click Export
![Export](../screenshots/fig_03.png)
</keypoint>

AFTER (step-manual):
<step number="5">
## Select Export Quality

In the Export dialog, locate the Quality dropdown at the top of the panel. Click on it to expand the options.

Choose from the following quality settings:
- **Low**: Best for email attachments (smaller file size)
- **Medium**: Balanced quality and size (recommended for most uses)
- **High**: Best for printing (larger file size)

Select the option that matches your intended use case.
</step>

<step number="6">
## Choose Output Format

Below the quality setting, find the Format dropdown. Click to expand it and select your preferred output format:

- **PDF**: Best for sharing - preserves layout on all devices
- **PNG**: Best for inserting into presentations as an image
- **DOCX**: Best for further editing in Microsoft Word

![Export Settings](../screenshots/fig_03.png)
</step>

<step number="7">
## Start the Export

Click the blue "Export" button at the bottom of the dialog.

A progress bar will appear while your file is being generated. Wait for the export to complete before closing the window.

<note type="info">
Export time depends on document size and selected quality. High quality exports may take longer to process.
</note>
</step>

GUIDELINES:
- Create a separate <step> for EACH distinct action
- Every screenshot MUST be embedded in the appropriate step
- Start each step with an action verb
- Describe what the user will see after each action
- Add warnings BEFORE potentially problematic actions
"""
