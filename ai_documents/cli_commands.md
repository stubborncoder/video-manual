# Video Manual CLI Commands

**Important**: All commands require `--user <user_id>` to ensure data isolation between users.

## Main Commands

### video-manual process
Generate a manual from a video file for the specified user.
- `video-manual process <video_path> --user <user_id>` - Process a video file
- `video-manual process --list --user <user_id>` - List and select from user's videos folder
- Options: `--output`, `--language`, `--project`, `--chapter`, `--tags`

### video-manual list
List all manuals belonging to the specified user.
- `video-manual list --user <user_id>`

### video-manual view
View a manual belonging to the specified user.
- `video-manual view <manual_id> --user <user_id> --language <lang>`

### video-manual videos
List videos in the specified user's videos folder.
- `video-manual videos --user <user_id>`

## Project Commands

### video-manual project create
Create a new project for the specified user.
- `video-manual project create "Project Name" --user <user_id> --description "desc"`

### video-manual project list
List all projects belonging to the specified user.
- `video-manual project list --user <user_id>`

### video-manual project show
Show details of a user's project.
- `video-manual project show <project_id> --user <user_id> --tree`

### video-manual project delete
Delete a user's project.
- `video-manual project delete <project_id> --user <user_id>`

### video-manual project chapter-add
Add a chapter to a user's project.
- `video-manual project chapter-add <project_id> "Chapter Title" --user <user_id>`

### video-manual project chapter-list
List chapters in a user's project.
- `video-manual project chapter-list <project_id> --user <user_id>`

### video-manual project chapter-delete
Delete a chapter from a user's project.
- `video-manual project chapter-delete <project_id> <chapter_id> --user <user_id>`

### video-manual project add-manual
Add a manual to a user's project.
- `video-manual project add-manual <project_id> <manual_id> --user <user_id> --chapter <chapter_id>`

### video-manual project remove-manual
Remove a manual from a user's project (keeps the manual).
- `video-manual project remove-manual <project_id> <manual_id> --user <user_id>`

### video-manual project move-manual
Move a manual to a different chapter in a user's project.
- `video-manual project move-manual <project_id> <manual_id> --user <user_id> --to-chapter <chapter_id>`

### video-manual project export
Export a user's project to PDF, Word, or HTML.
- `video-manual project export <project_id> --user <user_id> --format pdf|word|html --language <lang>`

### video-manual project compile
Compile a user's project manuals into unified document using AI agent.
- `video-manual project compile <project_id> --user <user_id> --language <lang>`

## Tag Commands

### video-manual tag add
Add tags to a user's manual.
- `video-manual tag add <manual_id> tag1 tag2 --user <user_id>`

### video-manual tag remove
Remove a tag from a user's manual.
- `video-manual tag remove <manual_id> <tag> --user <user_id>`

### video-manual tag list
List all tags or tags for a specific manual belonging to the user.
- `video-manual tag list --user <user_id>`
- `video-manual tag list --user <user_id> --manual <manual_id>`

### video-manual tag search
Find manuals with a specific tag belonging to the user.
- `video-manual tag search <tag_name> --user <user_id>`

## Version Commands

### video-manual version list
List version history for a user's manual.
- `video-manual version list <manual_id> --user <user_id>`

### video-manual version bump
Bump version of a user's manual (creates snapshot).
- `video-manual version bump <manual_id> --user <user_id> --minor|--major --notes "description"`

### video-manual version restore
Restore a user's manual to a previous version.
- `video-manual version restore <manual_id> <version> --user <user_id>`

### video-manual version diff
Compare two versions of a user's manual.
- `video-manual version diff <manual_id> <v1> <v2> --user <user_id>`
