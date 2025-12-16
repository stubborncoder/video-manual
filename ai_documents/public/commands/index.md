# Commands Reference

Reference documentation for navigating and operating vDocs.

## Sections

- [Navigation](navigation.md) - App pages and how to navigate between them
- [Highlights](highlights.md) - UI elements that can be highlighted
- [Operations](operations.md) - CRUD operations and how to guide users

## Quick Reference

### Navigation Commands
Use `navigate_to_page(path)` to move users between pages:
- `/dashboard` - Main dashboard
- `/dashboard/videos` - Videos page
- `/dashboard/manuals` - Manuals page
- `/dashboard/projects` - Projects page

### Highlight Commands
Use `highlight_element(element_id, duration_ms)` to highlight UI elements:
- `upload-video-btn` - Upload button on videos page
- `create-project-btn` - Create button on projects page
- `first-manual-edit-btn` - Edit button on manuals page

### Data Query Commands
Use these tools to understand user context:
- `get_user_videos()` - List uploaded videos
- `get_user_manuals()` - List created manuals
- `get_user_projects()` - List projects
- `get_page_elements(page)` - Get highlightable elements for a page
