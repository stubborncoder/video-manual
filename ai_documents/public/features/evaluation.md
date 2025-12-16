# Manual Evaluation

AI-powered quality assessment for your generated documentation.

## What is Evaluation?

Manual evaluation uses AI to assess your documentation quality across multiple dimensions, providing:
- Overall quality score (1-10)
- Category-specific scores
- Identified strengths
- Areas for improvement
- Actionable recommendations

## How to Evaluate

1. Go to **Manuals** page (`/dashboard/manuals`)
2. Find the manual you want to evaluate
3. Click the **three-dot menu** (⋯) on the manual card
4. Select **Evaluate Quality**
5. Choose the **language** to evaluate (if multiple languages exist)
6. Wait for AI analysis to complete
7. View results with scores and recommendations

**Important:** Evaluation is performed **per language and per version**. Each language version is evaluated separately, and each saved version can have its own evaluation.

**Re-evaluate after changes:** You can evaluate again after making edits to see if your improvements increased the score.

## Target Audience & Objective

**Critical for meaningful evaluation:**

When creating a manual from a video, you can specify:
- **Target Audience** - Who is this manual for? (e.g., "new employees", "IT administrators", "end users")
- **Manual Objective** - What should readers achieve? (e.g., "complete first-time setup", "troubleshoot common issues")

**The evaluation will check whether the AI-generated content aligns with these targets:**
- Does the language match the audience's expertise level?
- Does the content help achieve the stated objective?
- Are prerequisites appropriate for the audience?

If no target audience/objective is set, evaluation uses general documentation best practices instead.

## Evaluation Categories

### Always Evaluated

| Category | What It Measures |
|----------|-----------------|
| Clarity & Completeness | Are instructions clear and complete? Any missing steps? |
| Technical Accuracy | Are UI elements and actions correctly described? |
| Structure & Flow | Is the manual well-organized with logical progression? |

### Context-Aware Categories

When **target audience/objective are defined**:

| Category | What It Measures |
|----------|-----------------|
| Objective Alignment | Does the manual help achieve the stated objective? |
| Audience Appropriateness | Is language/depth appropriate for the audience? |

When **no target context**:

| Category | What It Measures |
|----------|-----------------|
| General Usability | How easy is it for anyone to follow? |

### Format-Specific Categories

For **Step-by-step Manuals**:
- Step Quality - Are steps sequential with one action each?
- Procedural Completeness - Can user complete the task?

For **Knowledge Base**:
- Content Organization - Is information well-categorized?
- Searchability - Can users find what they need?

For **FAQ**:
- Question Quality - Are questions what users actually ask?
- Answer Completeness - Do answers fully address questions?

For **Troubleshooting Guide**:
- Problem Coverage - Are common issues addressed?
- Solution Effectiveness - Are solutions actionable?

## Score Guide

| Score | Meaning |
|-------|---------|
| 10 | Exceptional, professional quality |
| 8-9 | Very good, minor improvements possible |
| 6-7 | Good, some notable areas for improvement |
| 4-5 | Adequate but needs significant improvement |
| 1-3 | Poor, major revisions needed |

## Evaluation Results

### What You Get

- **Overall Score**: Single number summarizing quality
- **Summary**: Brief executive summary of findings
- **Strengths**: What the manual does well
- **Areas for Improvement**: What needs work
- **Category Scores**: Detailed breakdown by category
- **Recommendations**: Specific actionable suggestions

### Using Results

1. Review the overall score for quick assessment
2. Check strengths to understand what works
3. Focus on areas for improvement
4. Implement recommendations one by one
5. Re-evaluate after making changes

## Best Practices

### Before Evaluating
- Complete all manual editing first
- Ensure screenshots are current
- Define target audience/objective if possible

### After Evaluating
- Don't chase perfect 10 scores
- Prioritize high-impact recommendations
- Re-evaluate after significant changes

### When to Re-evaluate
- After major content updates
- When changing target audience
- Before final export/publication
