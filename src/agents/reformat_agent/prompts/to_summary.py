"""Prompt for converting any format to Executive Summary."""

TO_SUMMARY_PROMPT = """
You are converting this document to an EXECUTIVE SUMMARY format.

TARGET FORMAT: Executive Summary
Purpose: High-level overview for decision-makers (readable in under 5 minutes)

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
- Supporting evidence

![Screenshot supporting this finding](../screenshots/figure_XX_tYYs.png)
</finding>

<recommendation title="Recommendation Title">
Specific, actionable recommendation based on the findings.
Include:
- What action to take
- Expected benefit or outcome
- Priority level if applicable
</recommendation>

CONVERSION STRATEGY:

1. ABSTRACT
   - Extract high-level outcomes, not procedures
   - Focus on WHAT was accomplished, not HOW
   - Distill to key insights

2. BUSINESS FOCUS
   - Emphasize impact, benefits, implications
   - Use business language, not technical jargon
   - Lead with conclusions

3. ELIMINATE DETAIL
   - Remove all how-to instructions
   - Skip technical implementation details
   - Reduce screenshots to 2-3 most impactful ones

4. SYNTHESIZE
   - Combine observations into strategic insights
   - Create actionable recommendations
   - Keep findings objective and evidence-based

WHAT TO REMOVE:
- All step-by-step instructions
- Technical implementation details
- Procedural explanations
- Most screenshots (keep only 2-3 key ones)
- Verbose descriptions

WHAT TO KEEP:
- Main purpose/goal of the process
- Key outcomes and benefits
- Important findings/observations
- Actionable recommendations
- 2-3 most impactful screenshots

TONE SHIFT:
- FROM: "Click the Export button and select PDF format"
- TO: "The system supports multiple export formats including PDF for distribution"

EXAMPLE TRANSFORMATION:

BEFORE (step-manual with 15 steps about configuring user permissions):
[Many detailed steps about clicking, selecting, configuring...]

AFTER (summary):
<title>Summary: User Permission Configuration</title>

<highlights>
## Key Highlights

- User permissions can be configured at individual and group levels
- Role-based access control enables scalable permission management
- Audit logging tracks all permission changes for compliance

![Permissions Dashboard](../screenshots/fig_01.png)
</highlights>

<finding title="Granular Permission Control">
The system offers fine-grained permission settings at both user and group levels, enabling organizations to implement least-privilege access policies effectively.
</finding>

<recommendation title="Implement Role-Based Access">
Adopt role-based permission templates for teams to reduce administrative overhead and ensure consistent access policies across the organization.
</recommendation>

GUIDELINES:
- Maximum 3-4 findings
- Maximum 2-3 recommendations
- Lead with conclusions, not background
- Make recommendations specific and actionable
"""
