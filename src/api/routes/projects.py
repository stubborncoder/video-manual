"""Project management routes."""

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..schemas import (
    ProjectCreate,
    ProjectSummary,
    ProjectDetail,
    ProjectListResponse,
    ChapterCreate,
    ChapterInfo,
    ProjectVideoInfo,
    ExportRequest,
    ExportResponse,
)
from ..dependencies import CurrentUser, ProjectStorageDep, TrashStorageDep, UserStorageDep


class ProjectUpdate(BaseModel):
    """Request to update project details."""
    name: Optional[str] = None
    description: Optional[str] = None


class ChapterUpdate(BaseModel):
    """Request to update chapter details."""
    title: Optional[str] = None
    description: Optional[str] = None


class ReorderRequest(BaseModel):
    """Request to reorder items."""
    order: list[str]  # List of IDs in desired order

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
async def list_projects(
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> dict:
    """List all projects (default project is always first)."""
    projects = storage.list_projects()

    summaries = []
    for project in projects:
        manuals = storage.get_project_manuals(project["id"])
        summaries.append({
            "id": project["id"],
            "name": project["name"],
            "description": project.get("description", ""),
            "created_at": project.get("created_at", ""),
            "is_default": project.get("is_default", False),
            "manual_count": len(manuals),
            "chapter_count": len(project.get("chapters", [])),
        })

    # Sort with default project first
    summaries.sort(key=lambda p: (not p["is_default"], p.get("created_at", "")))

    return {"projects": summaries}


@router.get("/default")
async def get_default_project(
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> dict:
    """Get the user's default project."""
    project = storage.ensure_default_project()
    manuals = storage.get_project_manuals(project["id"])

    return {
        "id": project["id"],
        "name": project["name"],
        "description": project.get("description", ""),
        "created_at": project.get("created_at", ""),
        "is_default": True,
        "manual_count": len(manuals),
        "chapter_count": len(project.get("chapters", [])),
    }


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
    user_storage: UserStorageDep,
) -> ProjectDetail:
    """Get project details."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chapters = storage.list_chapters(project_id)
    manuals = storage.get_project_manuals(project_id)

    # Collect unique videos from manuals
    video_map: dict[str, dict] = {}  # path -> {name, path, exists, manual_count}
    for m in manuals:
        metadata = user_storage.get_manual_metadata(m["id"])
        if metadata:
            source_video = metadata.get("source_video", {})
            video_path = source_video.get("path") or metadata.get("video_path", "")
            if video_path:
                from pathlib import Path
                video_name = source_video.get("name") or Path(video_path).name
                if video_path not in video_map:
                    video_map[video_path] = {
                        "name": video_name,
                        "path": video_path,
                        "exists": source_video.get("exists", True),
                        "manual_count": 0,
                    }
                video_map[video_path]["manual_count"] += 1

    return ProjectDetail(
        id=project_id,
        name=project["name"],
        description=project.get("description", ""),
        created_at=project.get("created_at", ""),
        is_default=storage.is_default_project(project_id),
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
            {"manual_id": m["id"], "chapter_id": m.get("chapter_id"), "order": m.get("order", 0)}
            for m in manuals
        ],
        videos=[
            ProjectVideoInfo(**v) for v in video_map.values()
        ],
    )


@router.put("/{project_id}")
async def update_project(
    project_id: str,
    request: ProjectUpdate,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> dict:
    """Update project name and/or description."""
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = {}
    if request.name is not None:
        updates["name"] = request.name
    if request.description is not None:
        updates["description"] = request.description

    if updates:
        storage.update_project(project_id, updates)

    return {
        "id": project_id,
        "name": request.name or project["name"],
        "description": request.description if request.description is not None else project.get("description", ""),
    }


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
    trash: TrashStorageDep,
    user_storage: UserStorageDep,
    delete_manuals: bool = False,
) -> dict:
    """Delete a project (moves to trash).

    The default project cannot be deleted.
    """
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if default project
    if storage.is_default_project(project_id):
        raise HTTPException(status_code=400, detail="Cannot delete the default project")

    # Get manuals in project
    manuals = storage.get_project_manuals(project_id)
    manual_ids = [m["id"] for m in manuals]

    if delete_manuals and manual_ids:
        # Move manuals to trash
        for manual_id in manual_ids:
            try:
                trash.move_to_trash(
                    item_type="manual",
                    item_name=manual_id,
                    cascade_deleted=True,
                )
            except ValueError:
                pass
    else:
        # Remove project reference from manuals but keep them
        for manual in manuals:
            storage.remove_manual_from_project(project_id, manual["id"])

    # Move project to trash
    trash.move_to_trash(
        item_type="project",
        item_name=project_id,
        related_items=manual_ids if delete_manuals else [],
        metadata={"delete_manuals": delete_manuals},
    )

    return {
        "status": "moved_to_trash",
        "project_id": project_id,
        "manuals_deleted": delete_manuals,
        "affected_manuals": manual_ids if delete_manuals else [],
    }


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


@router.put("/{project_id}/chapters/{chapter_id}")
async def update_chapter(
    project_id: str,
    chapter_id: str,
    request: ChapterUpdate,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> ChapterInfo:
    """Update a chapter's title and/or description."""
    updates = {}
    if request.title is not None:
        updates["title"] = request.title
    if request.description is not None:
        updates["description"] = request.description

    try:
        storage.update_chapter(project_id, chapter_id, updates)
        chapters = storage.list_chapters(project_id)
        chapter = next((ch for ch in chapters if ch["id"] == chapter_id), None)

        return ChapterInfo(
            id=chapter_id,
            title=chapter["title"] if chapter else request.title or "",
            description=chapter.get("description", "") if chapter else request.description or "",
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


@router.put("/{project_id}/chapters/reorder")
async def reorder_chapters(
    project_id: str,
    request: ReorderRequest,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> dict:
    """Reorder chapters in a project."""
    try:
        storage.reorder_chapters(project_id, request.order)
        return {"status": "reordered", "project_id": project_id, "new_order": request.order}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{project_id}/chapters/{chapter_id}/manuals/reorder")
async def reorder_manuals_in_chapter(
    project_id: str,
    chapter_id: str,
    request: ReorderRequest,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> dict:
    """Reorder manuals within a chapter."""
    try:
        storage.reorder_manuals_in_chapter(project_id, chapter_id, request.order)
        return {"status": "reordered", "chapter_id": chapter_id, "new_order": request.order}
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


# ==================== Compile Info ====================


class CompileInfoManual(BaseModel):
    """Manual info for compile coverage."""
    id: str
    title: str
    available_languages: list[str]


class CompileInfoChapter(BaseModel):
    """Chapter info for compile coverage."""
    id: str
    title: str
    manuals: list[CompileInfoManual]


class CompileInfoResponse(BaseModel):
    """Response for compile-info endpoint."""
    project: dict
    chapters: list[CompileInfoChapter]
    all_languages: list[str]
    ready_languages: list[str]
    total_manuals: int


@router.get("/{project_id}/compile-info")
async def get_compile_info(
    project_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
    user_storage: UserStorageDep,
) -> CompileInfoResponse:
    """Get language coverage info for pre-compilation validation.

    Returns detailed information about which manuals have which languages,
    allowing the frontend to validate before starting compilation.
    """
    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chapters_data = []
    all_languages_set: set[str] = set()
    language_coverage: dict[str, int] = {}  # language -> count of manuals with it
    total_manuals = 0

    for chapter in storage.list_chapters(project_id):
        chapter_manuals = []

        for manual_id in chapter.get("manuals", []):
            # Get available languages for this manual
            available_languages = user_storage.list_manual_languages(manual_id)

            # Get manual title from metadata
            metadata = user_storage.get_manual_metadata(manual_id)
            title = manual_id
            if metadata:
                video_meta = metadata.get("video_metadata", {})
                if video_meta.get("filename"):
                    from pathlib import Path
                    title = Path(video_meta["filename"]).stem

            chapter_manuals.append(CompileInfoManual(
                id=manual_id,
                title=title,
                available_languages=available_languages,
            ))

            # Track languages
            all_languages_set.update(available_languages)
            for lang in available_languages:
                language_coverage[lang] = language_coverage.get(lang, 0) + 1
            total_manuals += 1

        chapters_data.append(CompileInfoChapter(
            id=chapter["id"],
            title=chapter["title"],
            manuals=chapter_manuals,
        ))

    # Determine which languages have 100% coverage
    ready_languages = [
        lang for lang, count in language_coverage.items()
        if count == total_manuals
    ] if total_manuals > 0 else []

    return CompileInfoResponse(
        project={"id": project["id"], "name": project["name"]},
        chapters=chapters_data,
        all_languages=sorted(all_languages_set),
        ready_languages=sorted(ready_languages),
        total_manuals=total_manuals,
    )


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


@router.get("/{project_id}/compiled/screenshots/{filename}")
async def get_compiled_screenshot(
    project_id: str,
    filename: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
):
    """Get a screenshot from current compiled project output."""
    from ...storage.compilation_version_storage import CompilationVersionStorage

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    current_dir = compilation_storage.get_current_directory()
    screenshot_path = current_dir / "screenshots" / filename

    if not screenshot_path.exists():
        # Fall back to legacy path for backward compatibility
        legacy_path = storage.projects_dir / project_id / "compiled" / "screenshots" / filename
        if legacy_path.exists():
            return FileResponse(legacy_path)
        raise HTTPException(status_code=404, detail="Screenshot not found")

    return FileResponse(screenshot_path)


# ============================================================================
# Compilation Version Endpoints
# ============================================================================

@router.get("/{project_id}/compilations")
async def list_compilation_versions(
    project_id: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
):
    """List all compilation versions for a project."""
    from ...storage.compilation_version_storage import CompilationVersionStorage

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    versions = compilation_storage.list_versions()

    return {"project_id": project_id, "versions": versions}


@router.get("/{project_id}/compilations/{version}")
async def get_compilation_version(
    project_id: str,
    version: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
):
    """Get details about a specific compilation version."""
    from ...storage.compilation_version_storage import CompilationVersionStorage

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    version_info = compilation_storage.get_version(version)

    if not version_info:
        raise HTTPException(status_code=404, detail="Version not found")

    return version_info


@router.get("/{project_id}/compilations/{version}/content/{language}")
async def get_compilation_version_content(
    project_id: str,
    version: str,
    language: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
):
    """Get compiled markdown content for a specific version and language."""
    from ...storage.compilation_version_storage import CompilationVersionStorage

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    content = compilation_storage.get_version_content(version, language)

    if content is None:
        raise HTTPException(status_code=404, detail="Content not found for this version/language")

    return {"version": version, "language": language, "content": content}


@router.get("/{project_id}/compilations/{version}/screenshots/{filename}")
async def get_compilation_version_screenshot(
    project_id: str,
    version: str,
    filename: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
):
    """Get a screenshot from a specific compilation version."""
    from ...storage.compilation_version_storage import CompilationVersionStorage

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    version_dir = compilation_storage.get_version_directory(version)

    if not version_dir:
        raise HTTPException(status_code=404, detail="Version not found")

    screenshot_path = version_dir / "screenshots" / filename
    if not screenshot_path.exists():
        raise HTTPException(status_code=404, detail="Screenshot not found")

    return FileResponse(screenshot_path)


@router.post("/{project_id}/compilations/{version}/restore")
async def restore_compilation_version(
    project_id: str,
    version: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
):
    """Restore a previous compilation version to current."""
    from ...storage.compilation_version_storage import CompilationVersionStorage

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    success = compilation_storage.restore_version(version)

    if not success:
        raise HTTPException(status_code=404, detail="Version not found or cannot be restored")

    return {"message": f"Restored version {version} to current", "version": version}


@router.delete("/{project_id}/compilations/{version}")
async def delete_compilation_version(
    project_id: str,
    version: str,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
):
    """Delete a specific compilation version (cannot delete current)."""
    from ...storage.compilation_version_storage import CompilationVersionStorage

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    success = compilation_storage.delete_version(version)

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete version. Either it doesn't exist or it's the current version."
        )

    return {"message": f"Deleted version {version}"}


class CompilationVersionUpdate(BaseModel):
    """Request to update compilation version metadata."""
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


@router.patch("/{project_id}/compilations/{version}")
async def update_compilation_version(
    project_id: str,
    version: str,
    update: CompilationVersionUpdate,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
):
    """Update notes or tags for a compilation version."""
    from ...storage.compilation_version_storage import CompilationVersionStorage

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    success = compilation_storage.update_version_metadata(
        version,
        notes=update.notes,
        tags=update.tags,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Version not found")

    return {"message": "Version updated", "version": version}


class CompilationExportRequest(BaseModel):
    """Request to export a compilation version."""
    format: str = "pdf"
    language: str = "en"


@router.post("/{project_id}/compilations/{version}/export")
async def export_compilation_version(
    project_id: str,
    version: str,
    request: CompilationExportRequest,
    user_id: CurrentUser,
    storage: ProjectStorageDep,
) -> ExportResponse:
    """Export a specific compilation version to PDF, Word, or HTML."""
    from ...storage.compilation_version_storage import CompilationVersionStorage
    from ...export.compilation_exporter import export_compilation_markdown

    project = storage.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    compilation_storage = CompilationVersionStorage(user_id, project_id)
    version_info = compilation_storage.get_version(version)

    if not version_info:
        raise HTTPException(status_code=404, detail="Version not found")

    # Check if language exists
    if request.language not in version_info.get("languages", []):
        raise HTTPException(
            status_code=400,
            detail=f"Language '{request.language}' not available for this version"
        )

    # Get compilation content
    content = compilation_storage.get_version_content(version, request.language)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Get screenshots directory for this version
    version_dir = compilation_storage.get_version_directory(version)
    screenshots_dir = version_dir / "screenshots" if version_dir else None

    format_lower = request.format.lower()

    try:
        output_path = export_compilation_markdown(
            content=content,
            format=format_lower,
            project_name=project["name"],
            project_id=project_id,
            version=version,
            language=request.language,
            screenshots_dir=screenshots_dir,
            output_dir=storage.projects_dir / project_id / "exports",
            user_id=user_id,
        )

        return ExportResponse(output_path=str(output_path), format=format_lower)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
