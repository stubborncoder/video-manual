# Operations

Guide for helping users perform common operations.

## Data Query Tools

Before guiding users, always check their current context.

### get_user_videos()
Check what videos user has uploaded.

**Returns:**
```json
[
  {
    "filename": "tutorial.mp4",
    "size_mb": 45.2,
    "has_docs": true
  }
]
```

**Use when:**
- User asks about uploading
- User asks about processing
- Need to know if they have content

### get_user_docs()
Check what docs user has created.

**Returns:**
```json
[
  {
    "id": "doc-123",
    "title": "Getting Started Guide",
    "languages": ["en", "es"],
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

**Use when:**
- User asks about editing
- User asks about exporting
- Need to know their documentation

### get_user_projects()
Check what projects user has organized.

**Returns:**
```json
[
  {
    "id": "proj-456",
    "name": "User Guide",
    "description": "Complete user documentation",
    "chapter_count": 3,
    "doc_count": 8
  }
]
```

**Use when:**
- User asks about organizing
- User asks about compiling
- Need to know project structure

## Operation Guides

### Upload Video
1. Query: `get_user_videos()` - check current videos
2. Navigate: `navigate_to_page("/dashboard/videos")` if needed
3. Highlight: `highlight_element("upload-video-btn")`
4. Explain: "Click Upload Video and select your file"

### Process Video / Choose Document Format
When user wants to generate a doc from a video:

1. Query: `get_user_videos()` - check if they have uploaded videos
2. Navigate: `navigate_to_page("/dashboard/videos")` if needed
3. Highlight: `highlight_element("video-process-btn-{video_filename}")` - highlight the Process button for the specific video
4. Explain: "Click **Process** on your video card"
5. **Help them choose the right document format:**

**Ask about their video content and goal to recommend a format:**

| Video Content | Recommended Format | Why |
|--------------|-------------------|-----|
| Software tutorial, how-to, training | **Step-by-Step Doc** | Sequential actions, numbered steps |
| Quick overview, feature demo | **Quick Guide** | Condensed key points |
| Feature walkthrough, settings tour | **Reference Document** | Technical details, definitions |
| Executive demo, stakeholder presentation | **Executive Summary** | High-level highlights |
| Field recording of damage/issues | **Incident Report** | Evidence, severity, recommendations |
| Property/equipment inspection | **Inspection Report** | Pass/fail assessments, status |
| Construction/project progress | **Progress Report** | Milestones, accomplishments, issues |

**Example questions to ask:**
- "What kind of video did you record?"
- "What's the goal of this document?"
- "Who will be reading this?"

**Example responses:**
- "I recorded showing water damage at a property" → Recommend **Incident Report**
- "It's a tutorial for new users" → Recommend **Step-by-Step Doc**
- "I walked through the construction site to show progress" → Recommend **Progress Report**
- "Just need a quick reference for my team" → Recommend **Quick Guide**

6. Remind them to set **Target Audience** and **Objective** for better results

### Edit Doc
1. Query: `get_user_docs()` - check if docs exist
2. Navigate: `navigate_to_page("/dashboard/docs")` if needed
3. Highlight: `highlight_element("first-doc-edit-btn")`
4. Explain: "Click the Edit button on the doc card"

**In the editor, users can:**
- Interact with the AI editor agent to modify content
- Select text to contextualize the agent
- Select images to give the agent visual context
- Hover over images and left-click for contextual menu (replace, annotate, delete, etc.)
- Save changes (each save creates a new version)
- View version history and restore previous versions
- Export the doc

### View Doc
1. Query: `get_user_docs()` - check if docs exist
2. Navigate: `navigate_to_page("/dashboard/docs")` if needed
3. Explain: "Click the View button on the doc card to preview"
4. Note: From preview, user can evaluate the doc quality

### Export Doc
1. Query: `get_user_docs()` - check if docs exist
2. Navigate: `navigate_to_page("/dashboard/docs")` if needed
3. Explain: "Click the three-dot menu (⋯) on the doc card, then select Export Doc"
4. Explain formats:
   - **PDF** - For printing and sharing
   - **Word** - Editable, supports templates
   - **HTML** - Single file with embedded images (good for Teams Spaces)
   - **Chunks** - ZIP with JSON and images for RAG ingestion

### Evaluate Doc Quality
1. Query: `get_user_docs()` - check if docs exist
2. Navigate: `navigate_to_page("/dashboard/docs")` if needed
3. Explain: "Click the three-dot menu (⋯) on the doc card, then select Evaluate Quality"
4. Note: Evaluation is **per language and per version** - each language version evaluated separately
5. Tip: If target audience/objective were set during creation, evaluation checks alignment with those
6. User can **re-evaluate after making changes** to see if score improved

### Add Language to Doc
1. Query: `get_user_docs()` - check if docs exist
2. Navigate: `navigate_to_page("/dashboard/docs")` if needed
3. Explain: "Click the three-dot menu (⋯) on the doc card, then select Add Language"
4. Explain process:
   - Popup shows language selector and existing languages
   - Generation skips video analysis (reuses original keyframes)
   - Only text is regenerated in new language
   - **Screenshots stay the same** - must be replaced manually if needed
5. For localized screenshots: "In editor, click image → Replace from video → Add a video → upload video in target language"

### Clone Doc to Different Format *(Experimental)*
1. Query: `get_user_docs()` - check if docs exist
2. Navigate: `navigate_to_page("/dashboard/docs")` if needed
3. Explain: "Click the three-dot menu (⋯) on the doc card, then select Clone to Format"
4. Note: This feature is **experimental/in development**
5. Will allow converting between formats (e.g., step-by-step doc → quick guide)

### Manage Tags
1. Query: `get_user_docs()` - check if docs exist
2. Navigate: `navigate_to_page("/dashboard/docs")` if needed
3. Explain: "Click the three-dot menu (⋯) on the doc card, then select Manage Tags"
4. Explain: Tags are freeform - user can add any text as a tag
5. Note: Tags can be used to **filter docs** in the Docs page

### Assign Doc to Project
1. Query: `get_user_docs()` - check if docs exist
2. Query: `get_user_projects()` - check if projects exist
3. Navigate: `navigate_to_page("/dashboard/docs")` if needed
4. Explain: "Click the three-dot menu (⋯) on the doc card, then select Assign to Project"
5. Note: Can assign to a new project or **reassign** to a different project

### Delete doc
1. Query: `get_user_docs()` - check if docs exist
2. Navigate: `navigate_to_page("/dashboard/docs")` if needed
3. Explain: "Click the three-dot menu (⋯) on the doc card, then select Delete doc"
4. Important notes:
   - Doc moves to **Trash for 30 days** (can be recovered)
   - **Deletes ALL languages** of that doc
   - Does NOT delete the project it was assigned to
   - Does NOT delete the source videos

### Create Project
1. Query: `get_user_projects()` - check current projects
2. Navigate: `navigate_to_page("/dashboard/projects")` if needed
3. Highlight: `highlight_element("create-project-btn")`
4. Explain: "Click Create Project to start a new collection"

### View Project
1. Query: `get_user_projects()` - check if projects exist
2. Navigate: `navigate_to_page("/dashboard/projects")` if needed
3. Explain: "Click **View Project** button on the project card"
4. A **side panel** opens (NOT a new page) with tabs: Chapters, Docs, Videos, Export Settings, Compilations
5. **Important**: Projects do NOT have their own URLs - always navigate to `/dashboard/projects` first

### Organize Project Structure (Add Section)
1. Navigate: `navigate_to_page("/dashboard/projects")` if needed
2. Click **View Project** to open the project side panel
3. In the Chapters tab, click **Add Section**
4. Explain structure:
   - **Sections** can be nested (for major divisions)
   - **Chapters** contain docs (can be nested)
   - Structure defines final compiled document layout

### Compile Project
1. Query: `get_user_projects()` - check if project exists with 2+ docs
2. Navigate: `navigate_to_page("/dashboard/projects")` if needed
3. Click **View Project** to open the project side panel
4. Explain requirements:
   - **Minimum 2 docs** required (Compile button disabled otherwise)
   - **Same language** only - docs must share a language
5. Explain process:
   - Click **Compile** button in the project panel header
   - Popup shows available languages
   - Select language, options (TOC, page numbers)
   - **Compilation Agent** proposes structure with chapters, sections, transitions
   - User can interact with agent to refine
   - **User must accept** proposal for compilation to complete
6. After completion: Available in Compilations tab, exportable, has version history per language

### Delete Project
1. Query: `get_user_projects()` - check if projects exist
2. Navigate: `navigate_to_page("/dashboard/projects")` if needed
3. Explain: "Click Delete Project on the project card"
4. Popup shows project tree structure with two options:
   - **Keep docs** - Moves docs to default project "My Docs"
   - **Delete docs** - Deletes docs along with the project
5. Note: Does NOT delete the source videos in either case

### Process Video
1. Query: `get_user_videos()` - check if unprocessed videos exist
2. Navigate: `navigate_to_page("/dashboard/videos")` if needed
3. Highlight: `highlight_element("video-process-btn-{video_filename}")` - highlight the Process button
4. Explain: "Click Process on the video card"
5. Process window shows:
   - **Left**: Video preview
   - **Center**: Document format (step-by-step, quick guide, reference, executive summary), language, project
   - **Right**: Target audience & objective (recommended for better evaluation)
6. Tip: Setting **target audience** and **objective** improves AI content and evaluation scores
7. After clicking Generate: Toast confirmations show progress

### Delete Video
1. Query: `get_user_videos()` - check if videos exist
2. Navigate: `navigate_to_page("/dashboard/videos")` if needed
3. Explain: "Click Delete on the video card"
4. Note: Video moves to **Trash for 30 days** (can be recovered)

### Upload Template
1. Navigate: `navigate_to_page("/dashboard/templates")` if needed
2. Explain: "Click the **Upload Template** button"
3. File picker opens - select your `.docx` template file
4. Enter a name for your template
5. Template is now available when exporting docs to Word format

### View Trash
1. Navigate: `navigate_to_page("/dashboard/trash")` if needed
2. Explain: "The Trash page shows all deleted items organized by type: Videos, Docs, Projects"
3. Note: Items are automatically deleted permanently after **30 days**

### Restore Item from Trash
1. Navigate: `navigate_to_page("/dashboard/trash")` if needed
2. Explain: "Find the item you want to restore and click the **Restore** button"
3. Note: Item returns to its original location (Videos, Docs, or Projects page)

### Permanently Delete from Trash
1. Navigate: `navigate_to_page("/dashboard/trash")` if needed
2. Explain: "Click **Delete** on the item you want to permanently remove"
3. Important: **This cannot be undone** - confirmation dialog will appear
4. Alternative: "Empty Trash" button deletes all items at once

## Response Patterns

### User has no content
```
Query shows empty results → Guide to create content first
"I see you don't have any docs yet. Let's start by uploading a video."
```

### User has content
```
Query shows results → Reference their actual data
"I see you have 3 docs. Would you like to edit 'Getting Started Guide'?"
```

### User on wrong page
```
Check current_page context → Navigate first, then help
"Let me take you to the Videos page where you can upload."
```

## Error Handling

### No videos uploaded
Guide user to upload first before asking about processing.

### No docs created
Guide user to process a video first before asking about editing.

### No projects created
Guide user to create project first before asking about organizing.
