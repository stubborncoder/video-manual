"""Project management routes."""

from fastapi import APIRouter, HTTPException

from ..schemas import (
    ProjectCreate,
    ProjectSummary,
    ProjectDetail,
    ProjectListResponse,
    ChapterCreate,
    ChapterInfo,
    ExportRequest,
    ExportResponse,
)
from ..dependencies import CurrentUser, ProjectStorageDep

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def list_projects(
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> ProjectListResponse:
    """List all projects."""
    projects = storage.list_projects()

    summaries = []
    for project in projects:
        manuals = storage.get_project_manuals(project["id"])
        summaries.append(
            ProjectSummary(
                id=project["id"],
                name=project["name"],
                description=project.get("description", ""),
                created_at=project.get("created_at", ""),
                manual_count=len(manuals),
            )
        )

    return ProjectListResponse(projects=summaries)


@router.post("")
async def create_project(
    request: ProjectCreate,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> ProjectSummary:
    """Create a new project."""
    project_id = storage.create_project(request.name, request.description)
    project = storage.get_project(project_id)

    return ProjectSummary(
        id=project_id,
        name=project["name"],
        description=project.get("description", ""),
        created_at=project.get("created_at", ""),
        manual_count=0,
    )


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> ProjectDetail:
    """Get project details."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chapters = storage.list_chapters(project_id)
    manuals = storage.get_project_manuals(project_id)

    return ProjectDetail(
        id=project_id,
        name=project["name"],
        description=project.get("description", ""),
        created_at=project.get("created_at", ""),
        chapters=[
            ChapterInfo(
                id=ch["id"],
                title=ch["title"],
                description=ch.get("description", ""),
                order=ch.get("order", 0),
            )
            for ch in chapters
        ],
        manuals=[
            {"manual_id": m["manual_id"], "chapter_id": m.get("chapter_id"), "order": m.get("order", 0)}
            for m in manuals
        ],
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
    delete_manuals: bool = False,
) -> dict:
    """Delete a project."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    storage.delete_project(project_id, delete_manuals=delete_manuals)
    return {"status": "deleted", "project_id": project_id}


# ==================== Chapters ====================


@router.post("/{project_id}/chapters")
async def add_chapter(
    project_id: str,
    request: ChapterCreate,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> ChapterInfo:
    """Add a chapter to a project."""
    try:
        chapter_id = storage.add_chapter(project_id, request.title, request.description)
        chapters = storage.list_chapters(project_id)
        chapter = next((ch for ch in chapters if ch["id"] == chapter_id), None)

        return ChapterInfo(
            id=chapter_id,
            title=request.title,
            description=request.description,
            order=chapter.get("order", 0) if chapter else 0,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{project_id}/chapters/{chapter_id}")
async def delete_chapter(
    project_id: str,
    chapter_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> dict:
    """Delete a chapter from a project."""
    try:
        storage.delete_chapter(project_id, chapter_id)
        return {"status": "deleted", "chapter_id": chapter_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Manual Assignment ====================


@router.post("/{project_id}/manuals/{manual_id}")
async def add_manual_to_project(
    project_id: str,
    manual_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
    chapter_id: str | None = None,
) -> dict:
    """Add a manual to a project."""
    try:
        storage.add_manual_to_project(project_id, manual_id, chapter_id)
        return {"status": "added", "manual_id": manual_id, "project_id": project_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{project_id}/manuals/{manual_id}")
async def remove_manual_from_project(
    project_id: str,
    manual_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> dict:
    """Remove a manual from a project (keeps the manual)."""
    try:
        storage.remove_manual_from_project(project_id, manual_id)
        return {"status": "removed", "manual_id": manual_id, "project_id": project_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{project_id}/manuals/{manual_id}/chapter")
async def move_manual_to_chapter(
    project_id: str,
    manual_id: str,
    chapter_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> dict:
    """Move a manual to a different chapter."""
    try:
        storage.move_manual_to_chapter(project_id, manual_id, chapter_id)
        return {"status": "moved", "manual_id": manual_id, "chapter_id": chapter_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== Export ====================


@router.post("/{project_id}/export")
async def export_project(
    project_id: str,
    request: ExportRequest,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> ExportResponse:
    """Export project to PDF, Word, or HTML."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if project has manuals
    manuals = storage.get_project_manuals(project_id)
    if not manuals:
        raise HTTPException(
            status_code=400,
            detail="Cannot export empty project. Add manuals first."
        )

    format_lower = request.format.lower()

    try:
        if format_lower == "pdf":
            from ...export.project_exporter import ProjectExporter
            exporter = ProjectExporter(user_id, project_id)
            output_path = exporter.export(
                language=request.language,
                include_toc=request.include_toc,
                include_chapter_covers=request.include_chapter_covers,
            )
        elif format_lower in ("word", "docx"):
            from ...export.word_exporter import WordExporter
            exporter = WordExporter(user_id, project_id)
            output_path = exporter.export(
                language=request.language,
                include_toc=request.include_toc,
                include_chapter_covers=request.include_chapter_covers,
            )
        elif format_lower == "html":
            from ...export.html_exporter import HTMLExporter
            exporter = HTMLExporter(user_id, project_id)
            output_path = exporter.export(
                language=request.language,
                include_toc=request.include_toc,
                include_chapter_covers=request.include_chapter_covers,
                embed_images=request.embed_images,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown format '{request.format}'. Use: pdf, word, html",
            )

        return ExportResponse(output_path=str(output_path), format=format_lower)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
