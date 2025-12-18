"""Tools for the Guide Agent.

These tools provide real context awareness and action capabilities.
The agent can query actual user data and trigger UI actions.
"""

import logging
from typing import Any

import httpx
from langchain_core.tools import tool

from ...storage.user_storage import UserStorage
from ...storage.project_storage import ProjectStorage
from ...config import GITHUB_TOKEN, GITHUB_REPO
from ...api.dependencies import (
    rate_limiter,
    RATE_LIMIT_ISSUES_PER_HOUR,
    RATE_LIMIT_COMMENTS_PER_HOUR,
)

logger = logging.getLogger(__name__)


# Element registry - maps pages to available highlightable elements
# Static elements are always available, dynamic elements depend on user data
PAGE_ELEMENT_REGISTRY: dict[str, dict[str, Any]] = {
    "/dashboard": {
        "static": [
            {"id": "nav-videos", "description": "Videos navigation link"},
            {"id": "nav-manuals", "description": "Manuals navigation link"},
            {"id": "nav-projects", "description": "Projects navigation link"},
            {"id": "nav-templates", "description": "Templates navigation link"},
        ],
    },
    "/dashboard/videos": {
        "static": [
            {"id": "upload-video-btn", "description": "Upload Video button"},
            {"id": "nav-videos", "description": "Videos navigation link"},
        ],
        "dynamic": {
            "pattern": "video-card-{name}",
            "description": "Video card for '{name}'",
            "data_source": "videos",
        },
    },
    "/dashboard/manuals": {
        "static": [
            {"id": "first-manual-card", "description": "First manual card"},
            {"id": "first-manual-edit-btn", "description": "Edit button on first manual"},
            {"id": "nav-manuals", "description": "Manuals navigation link"},
        ],
        "dynamic": {
            "pattern": "manual-card-{id}",
            "description": "Manual card for '{title}'",
            "data_source": "manuals",
            "also": [
                {"pattern": "manual-edit-btn-{id}", "description": "Edit button for '{title}'"},
            ],
        },
    },
    "/dashboard/projects": {
        "static": [
            {"id": "create-project-btn", "description": "Create Project button"},
            {"id": "nav-projects", "description": "Projects navigation link"},
        ],
        "dynamic": {
            "pattern": "project-card-{id}",
            "description": "Project card for '{name}'",
            "data_source": "projects",
            "also": [
                {"pattern": "view-project-btn-{id}", "description": "View button for '{name}'"},
            ],
        },
    },
    "/dashboard/templates": {
        "static": [
            {"id": "upload-template-btn", "description": "Upload Template button"},
            {"id": "nav-templates", "description": "Templates navigation link"},
        ],
    },
    "/dashboard/trash": {
        "static": [
            {"id": "empty-trash-btn", "description": "Empty Trash button"},
            {"id": "nav-trash", "description": "Trash navigation link"},
        ],
    },
}


def create_guide_tools(user_id: str, user_email: str | None = None) -> list:
    """Create guide tools bound to a specific user.

    Args:
        user_id: The user ID to bind tools to
        user_email: The user's email address (for bug reporting context)

    Returns:
        List of tools with user context
    """

    @tool
    def get_user_manuals() -> list[dict[str, Any]]:
        """Get list of user's manuals with titles, ids, and languages.

        Returns a list of manuals the user has created, including:
        - id: Manual identifier
        - title: Display title
        - languages: Available language codes
        - created_at: Creation timestamp

        Use this to check if the user has any documentation before
        giving advice about editing or exporting.
        """
        storage = UserStorage(user_id)
        manuals = []
        for manual_dir in storage.manuals_dir.iterdir():
            if manual_dir.is_dir():
                metadata_file = manual_dir / "metadata.json"
                if metadata_file.exists():
                    import json

                    try:
                        metadata = json.loads(metadata_file.read_text())
                    except (json.JSONDecodeError, OSError):
                        # Skip corrupted or unreadable metadata
                        continue

                    # Get available languages
                    languages = []
                    for f in manual_dir.iterdir():
                        if f.suffix == ".md" and f.stem.startswith("content_"):
                            lang = f.stem.replace("content_", "")
                            languages.append(lang)
                    if not languages and (manual_dir / "content.md").exists():
                        languages = ["en"]

                    manuals.append(
                        {
                            "id": manual_dir.name,
                            "title": metadata.get("title", manual_dir.name),
                            "languages": languages,
                            "created_at": metadata.get("created_at"),
                        }
                    )
        return manuals

    @tool
    def get_user_videos() -> list[dict[str, Any]]:
        """Get list of user's uploaded videos.

        Returns a list of videos the user has uploaded, including:
        - filename: Video filename
        - size_mb: File size in megabytes
        - has_manuals: Whether manuals have been generated

        Use this to check if the user has videos to process or
        needs to upload new ones.
        """
        storage = UserStorage(user_id)
        videos = []
        if storage.videos_dir.exists():
            for video_file in storage.videos_dir.iterdir():
                if video_file.is_file() and video_file.suffix.lower() in (
                    ".mp4",
                    ".mov",
                    ".avi",
                    ".webm",
                ):
                    # Check if manuals exist for this video
                    has_manuals = any(
                        (storage.manuals_dir / d).exists()
                        for d in storage.manuals_dir.iterdir()
                        if d.is_dir()
                        and video_file.stem.lower() in d.name.lower()
                    ) if storage.manuals_dir.exists() else False

                    videos.append(
                        {
                            "filename": video_file.name,
                            "size_mb": round(video_file.stat().st_size / (1024 * 1024), 2),
                            "has_manuals": has_manuals,
                        }
                    )
        return videos

    @tool
    def get_user_projects() -> list[dict[str, Any]]:
        """Get list of user's projects with chapter information.

        Returns a list of projects the user has created, including:
        - id: Project identifier
        - name: Project display name
        - description: Project description
        - chapter_count: Number of chapters
        - manual_count: Total manuals in project

        Use this to understand the user's project organization
        and suggest next steps.
        """
        storage = ProjectStorage(user_id)
        projects = storage.list_projects()
        result = []
        for project in projects:
            chapters = project.get("chapters", [])
            manual_count = sum(len(ch.get("manuals", [])) for ch in chapters)
            result.append(
                {
                    "id": project.get("id"),
                    "name": project.get("name"),
                    "description": project.get("description", ""),
                    "chapter_count": len(chapters),
                    "manual_count": manual_count,
                }
            )
        return result

    @tool
    def highlight_element(element_id: str, duration_ms: int = 5000) -> dict[str, Any]:
        """Highlight a UI element to help the user find it.

        This will cause a yellow pulsing border to appear around
        the specified element in the UI.

        Args:
            element_id: The data-guide-id of the element to highlight.
                       Static IDs (always available):
                       - upload-video-btn: Upload Video button
                       - upload-template-btn: Upload Template button
                       - create-project-btn: Create Project button
                       - empty-trash-btn: Empty Trash button
                       - first-manual-card: First manual in the list
                       - first-manual-edit-btn: Edit button on first manual
                       - nav-videos, nav-manuals, nav-projects, nav-templates, nav-trash

                       Dynamic IDs (based on user data):
                       - video-card-{filename}: Specific video card
                       - manual-card-{id}: Specific manual card
                       - manual-edit-btn-{id}: Edit button for specific manual
                       - project-card-{id}: Specific project card
                       - view-project-btn-{id}: View button for specific project

                       Use get_page_elements() to discover available elements.
            duration_ms: How long to highlight in milliseconds (default 5000)

        Returns:
            Action object for the frontend to execute

        Only use this for ACTION questions where the user needs to find
        and click something. Don't highlight for informational questions.
        """
        return {"action": "highlight", "target": element_id, "duration": duration_ms}

    @tool
    def navigate_to_page(path: str) -> dict[str, Any]:
        """Navigate the user to a different page in the application.

        Use this when the user needs to be on a different page to
        complete their task.

        Args:
            path: The path to navigate to. Common paths:
                  - /dashboard: Main dashboard
                  - /dashboard/videos: Videos page
                  - /dashboard/manuals: Manuals page
                  - /dashboard/projects: Projects page
                  - /dashboard/projects/{id}: Specific project

        Returns:
            Action object for the frontend to execute
        """
        return {"action": "navigate", "to": path}

    @tool
    def get_page_elements(page_path: str) -> list[dict[str, str]]:
        """Get available highlightable elements for a page.

        Use this to discover what elements can be highlighted on
        a specific page before deciding what to highlight.

        Returns both static elements (always available) and dynamic
        elements based on user's actual data (videos, manuals, projects).

        Args:
            page_path: The page path (e.g., /dashboard/videos)

        Returns:
            List of element info with id and description
        """
        # Normalize path
        if not page_path.startswith("/"):
            page_path = "/" + page_path

        result: list[dict[str, str]] = []

        # Find matching page (handle nested routes)
        page_config = None
        for registered_path, config in PAGE_ELEMENT_REGISTRY.items():
            if page_path.startswith(registered_path):
                page_config = config
                break

        if not page_config:
            return []

        # Add static elements
        result.extend(page_config.get("static", []))

        # Add dynamic elements based on user data
        dynamic = page_config.get("dynamic")
        if dynamic:
            data_source = dynamic.get("data_source")
            items: list[dict[str, Any]] = []

            if data_source == "videos":
                storage = UserStorage(user_id)
                if storage.videos_dir.exists():
                    for video_file in storage.videos_dir.iterdir():
                        if video_file.is_file() and video_file.suffix.lower() in (
                            ".mp4", ".mov", ".avi", ".webm"
                        ):
                            items.append({"name": video_file.name})

            elif data_source == "manuals":
                storage = UserStorage(user_id)
                if storage.manuals_dir.exists():
                    for manual_dir in storage.manuals_dir.iterdir():
                        if manual_dir.is_dir():
                            metadata_file = manual_dir / "metadata.json"
                            if metadata_file.exists():
                                import json
                                try:
                                    metadata = json.loads(metadata_file.read_text())
                                    items.append({
                                        "id": manual_dir.name,
                                        "title": metadata.get("title", manual_dir.name),
                                    })
                                except (json.JSONDecodeError, OSError):
                                    # Skip corrupted or unreadable metadata
                                    continue

            elif data_source == "projects":
                storage = ProjectStorage(user_id)
                for project in storage.list_projects():
                    items.append({
                        "id": project.get("id"),
                        "name": project.get("name", project.get("id")),
                    })

            # Generate dynamic element IDs from items
            for item in items:
                # Main dynamic element
                pattern = dynamic.get("pattern", "")
                desc_pattern = dynamic.get("description", "")
                element_id = pattern.format(**item)
                description = desc_pattern.format(**item)
                result.append({"id": element_id, "description": description})

                # Additional related elements (e.g., edit buttons)
                for also in dynamic.get("also", []):
                    also_id = also.get("pattern", "").format(**item)
                    also_desc = also.get("description", "").format(**item)
                    result.append({"id": also_id, "description": also_desc})

        return result

    # ===========================================
    # GitHub Issue Tools (Bug Tracker)
    # ===========================================

    @tool
    def create_github_issue(
        title: str,
        description: str,
        category: str = "bug"
    ) -> dict[str, Any]:
        """Create a GitHub issue for user feedback or bug reports.

        Use this when a user wants to report a bug, request a feature,
        or provide feedback about vDocs. Before creating, use get_issues()
        to check if a similar issue already exists.

        Args:
            title: Brief summary of the issue (will be truncated to 100 chars)
            description: Detailed description including:
                - What the user was trying to do
                - What happened vs what was expected
                - Steps to reproduce (if applicable)
            category: One of "bug", "feature", "feedback", "question"

        Returns:
            Dict with issue URL and number if successful, or error message
        """
        if not GITHUB_TOKEN or not GITHUB_REPO:
            return {"error": "GitHub integration not configured. Please set GITHUB_TOKEN and GITHUB_REPO."}

        # Check rate limit
        if not rate_limiter.check_rate_limit(
            user_id, "create_issue", RATE_LIMIT_ISSUES_PER_HOUR
        ):
            return {
                "error": f"Rate limit exceeded. You can create {RATE_LIMIT_ISSUES_PER_HOUR} issues per hour. Please try again later."
            }

        # Map category to labels
        label_map = {
            "bug": ["vdocs:user-report", "vdocs:bug"],
            "feature": ["vdocs:user-report", "vdocs:feature"],
            "feedback": ["vdocs:user-report", "vdocs:feedback"],
            "question": ["vdocs:user-report", "vdocs:question"],
        }
        labels = label_map.get(category, ["vdocs:user-report"])

        # Build issue body with context
        user_info = f"- User ID: `{user_id}`"
        if user_email:
            user_info += f"\n- Email: `{user_email}`"

        body = f"""## Description
{description}

---
**Reported via vDocs Guide Agent**
{user_info}
"""

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"https://api.github.com/repos/{GITHUB_REPO}/issues",
                    headers={
                        "Authorization": f"Bearer {GITHUB_TOKEN}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                    json={
                        "title": title[:100],  # Truncate if too long
                        "body": body,
                        "labels": labels,
                    },
                )
                response.raise_for_status()
                data = response.json()

                # Record successful request for rate limiting
                rate_limiter.record_request(user_id, "create_issue")

                return {
                    "success": True,
                    "issue_number": data["number"],
                    "issue_url": data["html_url"],
                    "message": f"Issue #{data['number']} created successfully",
                }
        except httpx.HTTPStatusError as e:
            logger.error(f"GitHub API error creating issue: {e.response.text}")
            return {"error": "Failed to communicate with issue tracker. Please try again later."}
        except Exception as e:
            logger.error(f"Failed to create issue: {str(e)}")
            return {"error": "Failed to create issue. Please try again later."}

    @tool
    def get_issues(
        status: str = "open",
        search: str | None = None
    ) -> dict[str, Any]:
        """Get list of issues reported through vDocs.

        Use this to check if an issue has already been reported before
        creating a new one. Show the user existing similar issues so they
        can add comments instead of creating duplicates.

        Args:
            status: Filter by issue status - "open", "closed", or "all"
            search: Optional search term to filter issues by title/body

        Returns:
            Dict with list of issues including number, title, url, and state
        """
        if not GITHUB_TOKEN or not GITHUB_REPO:
            return {"error": "GitHub integration not configured. Please set GITHUB_TOKEN and GITHUB_REPO."}

        try:
            params: dict[str, Any] = {
                "labels": "vdocs:user-report",
                "state": status if status in ("open", "closed", "all") else "open",
                "per_page": 20,
                "sort": "created",
                "direction": "desc",
            }

            with httpx.Client(timeout=30.0) as client:
                response = client.get(
                    f"https://api.github.com/repos/{GITHUB_REPO}/issues",
                    headers={
                        "Authorization": f"Bearer {GITHUB_TOKEN}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                    params=params,
                )
                response.raise_for_status()
                issues = response.json()

                # Filter by search term if provided
                if search:
                    search_lower = search.lower()
                    issues = [
                        i for i in issues
                        if search_lower in i["title"].lower()
                        or search_lower in (i.get("body") or "").lower()
                    ]

                return {
                    "success": True,
                    "count": len(issues),
                    "issues": [
                        {
                            "number": i["number"],
                            "title": i["title"],
                            "url": i["html_url"],
                            "state": i["state"],
                            "created_at": i["created_at"],
                            "labels": [label["name"] for label in i.get("labels", [])],
                            "comments_count": i.get("comments", 0),
                        }
                        for i in issues[:10]  # Limit to 10 most recent
                    ],
                }
        except httpx.HTTPStatusError as e:
            logger.error(f"GitHub API error fetching issues: {e.response.text}")
            return {"error": "Failed to communicate with issue tracker. Please try again later."}
        except Exception as e:
            logger.error(f"Failed to fetch issues: {str(e)}")
            return {"error": "Failed to fetch issues. Please try again later."}

    @tool
    def add_issue_comment(
        issue_number: int,
        comment: str
    ) -> dict[str, Any]:
        """Add a comment to an existing GitHub issue.

        Use this when the user wants to add additional information
        to an existing issue, or when they found a duplicate and
        want to add their experience.

        Args:
            issue_number: The issue number to comment on
            comment: The comment text to add

        Returns:
            Dict with success status and comment URL
        """
        if not GITHUB_TOKEN or not GITHUB_REPO:
            return {"error": "GitHub integration not configured. Please set GITHUB_TOKEN and GITHUB_REPO."}

        # Validate comment is not empty
        if not comment or not comment.strip():
            return {"error": "Comment cannot be empty."}

        # Check rate limit
        if not rate_limiter.check_rate_limit(
            user_id, "add_comment", RATE_LIMIT_COMMENTS_PER_HOUR
        ):
            return {
                "error": f"Rate limit exceeded. You can add {RATE_LIMIT_COMMENTS_PER_HOUR} comments per hour. Please try again later."
            }

        # Add user context to comment
        user_info = f"*User ID: `{user_id}`*"
        if user_email:
            user_info += f"\n*Email: `{user_email}`*"

        body = f"""{comment}

---
*Comment added via vDocs Guide Agent*
{user_info}
"""

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    f"https://api.github.com/repos/{GITHUB_REPO}/issues/{issue_number}/comments",
                    headers={
                        "Authorization": f"Bearer {GITHUB_TOKEN}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                    json={"body": body},
                )
                response.raise_for_status()
                data = response.json()

                # Record successful request for rate limiting
                rate_limiter.record_request(user_id, "add_comment")

                return {
                    "success": True,
                    "comment_url": data["html_url"],
                    "message": f"Comment added to issue #{issue_number}",
                }
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {"error": f"Issue #{issue_number} not found"}
            logger.error(f"GitHub API error adding comment to #{issue_number}: {e.response.text}")
            return {"error": "Failed to communicate with issue tracker. Please try again later."}
        except Exception as e:
            logger.error(f"Failed to add comment to #{issue_number}: {str(e)}")
            return {"error": "Failed to add comment. Please try again later."}

    @tool
    def get_issue_details(issue_number: int) -> dict[str, Any]:
        """Get detailed information about a specific GitHub issue.

        Use this to show the user the full details of an issue,
        including its description and all comments.

        Args:
            issue_number: The issue number to get details for

        Returns:
            Dict with full issue details including comments
        """
        if not GITHUB_TOKEN or not GITHUB_REPO:
            return {"error": "GitHub integration not configured. Please set GITHUB_TOKEN and GITHUB_REPO."}

        try:
            with httpx.Client(timeout=30.0) as client:
                # Get issue details
                issue_response = client.get(
                    f"https://api.github.com/repos/{GITHUB_REPO}/issues/{issue_number}",
                    headers={
                        "Authorization": f"Bearer {GITHUB_TOKEN}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                )
                issue_response.raise_for_status()
                issue = issue_response.json()

                # Get comments
                comments_response = client.get(
                    f"https://api.github.com/repos/{GITHUB_REPO}/issues/{issue_number}/comments",
                    headers={
                        "Authorization": f"Bearer {GITHUB_TOKEN}",
                        "Accept": "application/vnd.github+json",
                        "X-GitHub-Api-Version": "2022-11-28",
                    },
                    params={"per_page": 50},
                )
                comments_response.raise_for_status()
                comments = comments_response.json()

                return {
                    "success": True,
                    "issue": {
                        "number": issue["number"],
                        "title": issue["title"],
                        "body": issue.get("body", ""),
                        "state": issue["state"],
                        "url": issue["html_url"],
                        "created_at": issue["created_at"],
                        "updated_at": issue["updated_at"],
                        "labels": [label["name"] for label in issue.get("labels", [])],
                        "author": issue["user"]["login"],
                    },
                    "comments": [
                        {
                            "id": c["id"],
                            "body": c["body"],
                            "author": c["user"]["login"],
                            "created_at": c["created_at"],
                        }
                        for c in comments
                    ],
                }
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {"error": f"Issue #{issue_number} not found"}
            logger.error(f"GitHub API error fetching issue #{issue_number}: {e.response.text}")
            return {"error": "Failed to communicate with issue tracker. Please try again later."}
        except Exception as e:
            logger.error(f"Failed to get issue details #{issue_number}: {str(e)}")
            return {"error": "Failed to get issue details. Please try again later."}

    return [
        get_user_manuals,
        get_user_videos,
        get_user_projects,
        highlight_element,
        navigate_to_page,
        get_page_elements,
        # GitHub issue tools
        create_github_issue,
        get_issues,
        add_issue_comment,
        get_issue_details,
    ]
