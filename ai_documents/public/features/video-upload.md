# Video Upload

Upload source videos that vDocs will analyze to generate documentation.

## Videos Page

The Videos page (`/dashboard/videos`) shows all uploaded videos.

### Video Card Buttons

Each video card has three buttons:
- **Show Video** - Preview the video
- **Process** - Generate a manual from the video
- **Delete** - Move video to trash (30 days)

## Supported Formats

- MP4 (recommended)
- WebM
- MOV
- AVI
- MKV

## How to Upload

1. Navigate to **Videos** page (`/dashboard/videos`)
2. Click the **Upload Video** button (`upload-video-btn`)
3. Select your video file from your computer
4. Wait for the upload progress to complete

## Processing a Video

Click **Process** on a video card to open the generation window.

### Generation Window Layout

| Section | Content |
|---------|---------|
| Left | Video preview |
| Center | Generation settings |
| Right | Context settings (optional but recommended) |

### Center: Generation Settings

**Document Format** (dropdown):
- Step-by-step Manual - Detailed numbered instructions
- Quick Guide - Condensed overview
- Reference Document - Technical reference
- Executive Summary - High-level overview

**Language**: Enter language name (converted to ISO format automatically)

**Project**: Assign to a project (defaults to "My Manuals")

### Right: Context Settings (Recommended)

Two optional text areas with checkboxes to enable:

**Target Audience** (up to 500 characters):
- Who is this manual for?
- Examples: "junior developers", "general users", "technical personnel", "new employees"

**Manual Objective**:
- What should readers achieve?
- Example: "The manual will show the ingestion process for the agentic RAG pipeline"

**Important:** These context settings are used during **manual evaluation**. Providing target audience and objective helps the AI generate more appropriate content and results in better evaluation scores.

### Starting Generation

1. Configure your settings
2. Click **Generate**
3. Toast confirmation appears at the top
4. Progress toast shows in the lower-right corner
5. Generation runs asynchronously - you can continue using the app

## After Upload

Once uploaded, your video will appear in the video list. From there you can:

1. **Process** - Start AI analysis to generate a manual
2. **Delete** - Remove the video (moves to Trash for 30 days)
3. **View** - Preview the video content

## Video Guidelines

### For Best Results

- **Resolution**: 1080p or higher recommended
- **Frame rate**: 30fps or higher
- **Duration**: 1-30 minutes optimal
- **Content**: Clear, focused workflow demonstrations

### Tips

- Record at a steady pace - don't rush through steps
- Keep mouse movements deliberate and visible
- Avoid excessive scrolling or rapid navigation
- If using voice narration, speak clearly

## Video Status

| Status | Meaning |
|--------|---------|
| Uploaded | Ready for processing |
| Processing | AI is analyzing the video |
| Completed | Manual has been generated |
| Failed | Processing encountered an error |

## Troubleshooting

**Upload fails:**
- Check file size (max 500MB recommended)
- Ensure video format is supported
- Try a different browser if issues persist

**Processing takes too long:**
- Long videos take more time
- Complex content may require more analysis
- Typical: 2-5 minutes for 10-minute video
