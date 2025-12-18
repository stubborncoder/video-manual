"""Tools for the Guide Agent.

These tools provide real context awareness and action capabilities.
The agent can query actual user data and trigger UI actions.
"""

from typing import Any
from langchain_core.tools import tool

from ...storage.user_storage import UserStorage
from ...storage.project_storage import ProjectStorage


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


def create_guide_tools(user_id: str) -> list:
    """Create guide tools bound to a specific user.

    Args:
        user_id: The user ID to bind tools to

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

                    metadata = json.loads(metadata_file.read_text())
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
                                metadata = json.loads(metadata_file.read_text())
                                items.append({
                                    "id": manual_dir.name,
                                    "title": metadata.get("title", manual_dir.name),
                                })

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

    return [
        get_user_manuals,
        get_user_videos,
        get_user_projects,
        highlight_element,
        navigate_to_page,
        get_page_elements,
    ]
