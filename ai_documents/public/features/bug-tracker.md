# Bug Tracker

The Bug Tracker lets users report issues, request features, and track feedback during the alpha phase. Issues are synced with GitHub for easy management.

## Bug Tracker Page

The Bug Tracker page (`/dashboard/bugs`) shows all user-reported issues from GitHub.

### Page Layout

- **Header**: Title, description, quick stats (open/closed counts), search, and status filter
- **Issue List**: Cards showing each issue with status, title, category, and comment count
- **GitHub Link**: Link to view all issues directly on GitHub

## Issue Categories

Issues are categorized using labels:

| Category | Label | Description | Badge Color |
|----------|-------|-------------|-------------|
| Bug | `vdocs:bug` | Software bugs and errors | Red |
| Feature | `vdocs:feature` | Feature requests | Cyan |
| Feedback | `vdocs:feedback` | General feedback | Blue |
| Question | `vdocs:question` | Questions or help requests | Pink |

All user-reported issues also have the `vdocs:user-report` label.

## Issue List

### Filtering

- **Status Filter**: Open, Closed, or All issues
- **Search**: Search by title or content

### Issue Cards

Each issue card shows:

| Field | Description |
|-------|-------------|
| Status Icon | Green circle (open) or purple checkmark (closed) |
| Title | Issue title (clickable to view details) |
| Number | Issue number (#123) |
| Created | Relative time (e.g., "2 days ago") |
| Comments | Comment count if > 0 |
| Category | Badge showing bug/feature/feedback/question |

## Issue Detail Page

Click on an issue to view full details at `/dashboard/bugs/[id]`.

### Detail Page Layout

- **Header**: Back button, title, status, number, creation date, author
- **Category Badge**: Shows issue category
- **GitHub Link**: Opens issue directly on GitHub
- **Issue Body**: Full description with markdown rendering
- **Comments Section**: All comments with author and timestamp
- **Add Comment Form**: Text area to add new comments

### Adding Comments

1. Scroll to the "Comments" section
2. Type your comment in the text area
3. Click "Add Comment"
4. Comment appears in the list

## Reporting Issues via Guide Agent

Users can report issues by talking to the guide agent. The agent will:

1. **Check for duplicates**: Search existing issues for similar problems
2. **Show matches**: If duplicates exist, offer to add a comment instead
3. **Gather details**: Ask for title, description, and category
4. **Create issue**: Submit the new issue to GitHub

### Guide Agent Tools

The guide agent has these bug reporting tools:

| Tool | Description |
|------|-------------|
| `create_github_issue` | Create a new issue with title, description, and category |
| `get_issues` | Search and list existing issues |
| `add_issue_comment` | Add a comment to an existing issue |
| `get_issue_details` | Get full details of a specific issue |

### Example Conversation

**User**: "I found a bug where videos don't upload"

**Agent**:
1. Searches existing issues for "video upload"
2. If match found: "I found a similar issue (#42). Would you like to add a comment?"
3. If no match: "I'll create a bug report. Can you describe what happens?"

## Tips

- **Check existing issues first** - Your problem might already be reported
- **Be specific** - Include steps to reproduce bugs
- **Choose the right category** - Bug for errors, Feature for new functionality
- **Add comments** - If you have the same issue, comment on existing reports
- **Include context** - Mention which page/feature was affected
