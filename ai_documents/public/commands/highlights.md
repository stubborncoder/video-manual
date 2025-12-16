# Highlights

Complete reference for highlightable UI elements.

## Highlight Tool

Use `highlight_element(element_id, duration_ms)` to make UI elements pulse with a yellow border.

### Syntax
```
highlight_element("upload-video-btn", 5000)
```

### Parameters
- `element_id` (string): The data-guide-id of the element
- `duration_ms` (int, optional): Duration in milliseconds (default 5000)

### Return Value
```json
{"action": "highlight", "target": "upload-video-btn", "duration": 5000}
```

## Elements by Page

### /dashboard
| Element ID | Description | Use When |
|------------|-------------|----------|
| `nav-videos` | Videos navigation link | User wants to go to videos |
| `nav-manuals` | Manuals navigation link | User wants to see manuals |
| `nav-projects` | Projects navigation link | User wants to see projects |

### /dashboard/videos
| Element ID | Description | Use When |
|------------|-------------|----------|
| `upload-video-btn` | Upload Video button | User wants to upload |
| `nav-videos` | Videos navigation link | Show current section |

### /dashboard/manuals
| Element ID | Description | Use When |
|------------|-------------|----------|
| `first-manual-card` | First manual card | User wants to select a manual |
| `first-manual-edit-btn` | Edit button on first manual | User wants to edit |
| `nav-manuals` | Manuals navigation link | Show current section |

**Manual Card Buttons** (not all highlightable):
- **View** - Preview the manual (read-only)
- **Edit** - Open the manual editor (highlightable: `first-manual-edit-btn`)
- **⋯ Menu** - Opens dropdown with:
  - Export Manual
  - Add Language
  - Clone to Format *(experimental)*
  - Evaluate Quality
  - Assign to Project
  - Manage Tags
  - Delete Manual

### /dashboard/projects
| Element ID | Description | Use When |
|------------|-------------|----------|
| `create-project-btn` | Create Project button | User wants to create project |
| `nav-projects` | Projects navigation link | Show current section |

## Discovering Elements

Use `get_page_elements(page_path)` to discover available elements:

```
get_page_elements("/dashboard/videos")
```

Returns:
```json
[
  {"id": "upload-video-btn", "description": "Upload Video button"},
  {"id": "nav-videos", "description": "Videos navigation link"}
]
```

## When to Highlight

### DO highlight for:
- "Where is the upload button?" → `highlight_element("upload-video-btn")`
- "How do I create a project?" → `highlight_element("create-project-btn")`
- "Show me where to edit" → `highlight_element("first-manual-edit-btn")`

### DON'T highlight for:
- "What formats are supported?" → Just answer, no highlight
- "How does AI processing work?" → Explain, no highlight
- Informational questions that don't require clicking

## Navigation + Highlight Pattern

When user asks about something on a different page:

1. Check current page context
2. Navigate if needed
3. Highlight the element

**Example flow:**
```
# User on /dashboard asks "How do I upload a video?"

1. navigate_to_page("/dashboard/videos")
2. highlight_element("upload-video-btn")
3. Explain: "Click the Upload Video button to select a video file"
```

## Element Naming Convention

Elements use `data-guide-id` attribute with these patterns:
- `{action}-{noun}-btn` - Action buttons (upload-video-btn)
- `nav-{page}` - Navigation links (nav-videos)
- `first-{type}-{action}` - First item actions (first-manual-edit-btn)
