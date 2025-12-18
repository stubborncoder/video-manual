# Navigation

Reference for app pages and navigation commands.

## App Pages

| Path | Name | Purpose |
|------|------|---------|
| `/dashboard` | Dashboard | Main overview, recent activity |
| `/dashboard/videos` | Videos | Upload and manage source videos |
| `/dashboard/manuals` | Manuals | View and edit generated documentation |
| `/dashboard/manuals/[id]/edit` | Manual Editor | Edit a specific manual |
| `/dashboard/projects` | Projects | Organize manuals into collections |
| `/dashboard/templates` | Templates | Manage export templates |
| `/dashboard/bugs` | Bug Tracker | Report issues and request features |
| `/dashboard/bugs/[id]` | Issue Detail | View issue details and comments |
| `/dashboard/trash` | Trash | Recover deleted items |

## Important: Modal/Panel Views (No Direct URLs)

Some views open as **modals or side panels** from the main page. They do NOT have their own URLs.

| View | Opens From | How to Open |
|------|------------|-------------|
| Project Details | `/dashboard/projects` | Click "View Project" button → opens side panel |
| Process Video | `/dashboard/videos` | Click "Process" button → opens modal |
| Export Manual | `/dashboard/manuals` | Click ⋯ menu → Export → opens modal |
| Compile Project | `/dashboard/projects` (inside project panel) | Click "Compile" button → opens modal |

**NEVER navigate to URLs like `/dashboard/project-name` or `/dashboard/videos/process`** - these don't exist. Always navigate to the parent page first, then instruct the user to click the appropriate button.

## Navigation Tool

Use `navigate_to_page(path)` to move users to a different page.

### Syntax
```
navigate_to_page("/dashboard/videos")
```

### Parameters
- `path` (string): Target page path

### Return Value
```json
{"action": "navigate", "to": "/dashboard/videos"}
```

## When to Navigate

### Navigate BEFORE highlighting
If the user needs to click something on a different page:
1. First navigate to the target page
2. Then highlight the element

**Example:**
User on `/dashboard` asks "How do I upload a video?"
1. `navigate_to_page("/dashboard/videos")`
2. `highlight_element("upload-video-btn")`

### Don't navigate unnecessarily
If user is already on the correct page, just highlight.

## Page Context

The current page is provided in the system prompt as `{current_page}`.
Always check this before deciding to navigate.

## Navigation Sidebar

Users can also navigate using the sidebar. Sidebar elements:
- `nav-dashboard` - Dashboard link
- `nav-videos` - Videos link
- `nav-manuals` - Manuals link
- `nav-projects` - Projects link
- `nav-templates` - Templates link
- `nav-bugs` - Bug Tracker link
- `nav-trash` - Trash link

You can highlight these to show where to click.
