# Doc Generation

vDocs uses AI to automatically generate documentation from your videos. The type of document generated depends on your selected **document format**.

## Document Formats

vDocs supports multiple document formats, each optimized for different types of content:

### Instructional Formats

| Format | Best For | Video Content |
|--------|----------|---------------|
| **Step-by-Step Doc** | Tutorials, how-to guides, training | Software demos, procedures, processes |
| **Quick Guide** | Quick reference, cheat sheets | Overview walkthroughs, key features |
| **Reference Document** | Technical documentation | Feature exploration, system tours |
| **Executive Summary** | Decision-maker briefs | High-level overviews, demos |

### Report Formats

| Format | Best For | Video Content |
|--------|----------|---------------|
| **Incident Report** | Issues, damage, problems | Field recordings of damage, issues |
| **Inspection Report** | Condition assessments, compliance | Property/equipment inspections |
| **Progress Report** | Project status, milestones | Construction/project progress |

## Choosing the Right Format

The document format determines how the AI analyzes and structures your video content:

### Step-by-Step Doc (Default)
- **Use when**: Recording a tutorial, training video, or how-to demonstration
- **AI looks for**: Sequential actions, clicks, navigation steps
- **Output**: Numbered steps with one action per step
- **Example**: "How to create a user account in the admin panel"

### Quick Guide
- **Use when**: Need a condensed overview for quick reference
- **AI looks for**: Key concepts and main actions
- **Output**: Bullet points, key takeaways, essential information
- **Example**: "Quick reference for daily backup procedures"

### Reference Document
- **Use when**: Documenting a feature or system comprehensively
- **AI looks for**: Features, options, configurations
- **Output**: Organized sections with definitions and examples
- **Example**: "Settings panel reference guide"

### Executive Summary
- **Use when**: Presenting to stakeholders or decision-makers
- **AI looks for**: Key highlights, main findings, outcomes
- **Output**: High-level overview with recommendations
- **Example**: "New system capabilities overview for management"

### Incident Report
- **Use when**: Documenting issues, damage, or problems with evidence
- **AI looks for**: Issues, damage, evidence, severity indicators
- **Output**: Professional report with findings, severity, and recommendations
- **Example**: "Water damage inspection at 123 Main St"

### Inspection Report
- **Use when**: Condition assessments, compliance checks, or quality inspections
- **AI looks for**: Items to inspect, pass/fail conditions, observations
- **Output**: Systematic checklist with status for each item
- **Example**: "Pre-move property condition report"

### Progress Report
- **Use when**: Documenting project status, milestones, or work progress
- **AI looks for**: Accomplishments, ongoing work, issues, timelines
- **Output**: Status report with achievements, issues, and next steps
- **Example**: "Construction site weekly progress update"

## How It Works

1. **Video Analysis** - AI watches your video with the selected format in mind
2. **Context-Aware Extraction** - Keyframes captured at action moments and UI state changes
3. **Format-Specific Generation** - Content structured according to format
4. **Semantic Tagging** - Content tagged for proper export formatting

## Starting Generation

1. Go to **Videos** page (`/dashboard/videos`)
2. Find your uploaded video
3. Click **Process** on the video card
4. **Select Document Format** - Choose the format that matches your video content
5. **Set Target Audience** (optional but recommended) - e.g., "new employees", "IT administrators"
6. **Set Doc Objective** (optional but recommended) - e.g., "complete first-time setup"
7. Click **Generate**
8. Wait for processing to complete

### Why Set Audience & Objective?

Setting target audience and objective helps:
- AI generates content appropriate for your readers
- Evaluation checks alignment with these targets
- Better quality documentation from the start

## What Gets Generated

### Screenshots
- Automatically captured at key moments
- Before/after action states
- Can be replaced or edited later

### Content Structure

Varies by format:

**Instructional Formats:**
- **Step-by-Step Doc**: Title, Introduction, Numbered Steps, Conclusion, Tips/Notes
- **Quick Guide**: Title, Overview, Key Points, Tips
- **Reference Document**: Title, Sections, Definitions, Examples
- **Executive Summary**: Title, Highlights, Findings, Recommendations

**Report Formats:**
- **Incident Report**: Title, Summary, Location, Findings, Evidence, Severity, Recommendations
- **Inspection Report**: Title, Overview, Inspection Items, Status, Recommendations
- **Progress Report**: Title, Period, Accomplishments, Issues, Next Steps, Timeline

## Processing Time

| Video Length | Approximate Time |
|--------------|-----------------|
| 1-5 minutes | 1-2 minutes |
| 5-15 minutes | 2-5 minutes |
| 15-30 minutes | 5-10 minutes |

## After Generation

Your doc will appear in the **Docs** page (`/dashboard/docs`). From there you can:

- **Edit** - Refine the generated content
- **Export** - Download in various formats (PDF, Word, HTML)
- **Add to Project** - Organize into a collection
- **Evaluate** - Get AI quality assessment

## Improving Results

### Video Recording Tips

- High resolution recordings
- Steady, deliberate mouse movements
- Pause between major steps
- Focus on one workflow per video
- Good lighting improves screenshot quality

### Re-Processing

If results aren't satisfactory:
1. Try a different document format
2. Delete and re-process with audience/objective set
3. Edit the doc directly
4. Consider re-recording with better quality
