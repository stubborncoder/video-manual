"""Main CLI entry point for vDocs."""

import typer
import time
import threading
from pathlib import Path
from typing import Optional, List
from rich.live import Live
from rich.markdown import Markdown

from .console import (
    console,
    print_welcome,
    videos_table,
    manuals_table,
    render_full_status,
    render_completion,
    render_error,
    format_duration,
    NODE_ORDER,
    # Project display
    projects_table,
    project_detail_panel,
    chapters_table,
    project_manuals_table,
    project_tree,
    # Tag display
    tags_table,
    manual_tags_panel,
    # Version display
    versions_table,
    # HITL display
    format_tool_call,
    format_merge_plan,
    get_user_decision,
    render_compiler_status,
)
from ..storage.user_storage import UserStorage
from ..storage.project_storage import ProjectStorage
from ..storage.version_storage import VersionStorage
from ..config import ensure_directories
from ..core.constants import normalize_language_to_code

app = typer.Typer(
    name="vdocs",
    help="AI-powered documentation from video",
    add_completion=False,
    no_args_is_help=True,
)

# Project subcommand group
project_app = typer.Typer(help="Manage projects")
app.add_typer(project_app, name="project")

# Tag subcommand group
tag_app = typer.Typer(help="Manage manual tags")
app.add_typer(tag_app, name="tag")

# Version subcommand group
version_app = typer.Typer(help="Manage manual versions")
app.add_typer(version_app, name="version")


def get_next_node(current_node: str) -> Optional[str]:
    """Get the next node in the workflow."""
    try:
        idx = NODE_ORDER.index(current_node)
        if idx < len(NODE_ORDER) - 1:
            return NODE_ORDER[idx + 1]
    except ValueError:
        pass
    return None


def extract_details(node_name: str, state_update: dict) -> dict:
    """Extract relevant details from state update for display."""
    details = {}

    if node_name == "analyze_video":
        if state_update.get("video_metadata"):
            meta = state_update["video_metadata"]
            if meta.get("duration"):
                details["Duration"] = format_duration(meta["duration"])
            if meta.get("resolution"):
                details["Resolution"] = meta["resolution"]

    elif node_name == "identify_keyframes":
        if state_update.get("total_keyframes"):
            details["Keyframes"] = f"{state_update['total_keyframes']} found"

    elif node_name == "generate_manual":
        if state_update.get("screenshots"):
            details["Screenshots"] = f"{len(state_update['screenshots'])} extracted"

    return details


def process_with_streaming(
    video_path: Path,
    user_id: str,
    output_filename: Optional[str],
    use_scene_detection: bool,
    output_language: str = "English",
    project_id: Optional[str] = None,
    chapter_id: Optional[str] = None,
    tags: Optional[List[str]] = None,
):
    """Process video with streaming node events and animated spinner."""
    from ..agents.video_doc_agent import VideoDocAgent
    from ..agents.video_doc_agent.state import VideoDocState

    # Create agent
    agent = VideoDocAgent(use_checkpointer=True)

    # Check for existing manual to enable caching
    storage = UserStorage(user_id)
    storage.ensure_user_folders()
    video_name = output_filename or video_path.name

    # Try to find existing manual for this video (enables caching)
    existing_manual_id = storage.find_existing_doc(video_name)
    if existing_manual_id:
        manual_dir, manual_id = storage.get_doc_dir(doc_id=existing_manual_id)
    else:
        manual_dir, manual_id = storage.get_doc_dir(video_name=video_name)

    # Prepare initial state
    initial_state: VideoDocState = {
        "user_id": user_id,
        "doc_id": manual_id,
        "video_path": str(video_path),
        "output_filename": output_filename,
        "use_scene_detection": use_scene_detection,
        "output_language": output_language,
        "video_metadata": None,
        "video_analysis": None,
        "model_used": None,
        "optimized_video_path": None,
        "gemini_file_uri": None,
        "keyframes": None,
        "scene_changes": None,
        "total_keyframes": None,
        "manual_content": None,
        "doc_path": None,
        "screenshots": None,
        "output_directory": None,
        "status": "pending",
        "error": None,
        "using_cached": None,
    }

    config = {"configurable": {"thread_id": f"{user_id}_{video_path.stem}"}}

    # Shared state for thread communication
    nodes_status = {
        "analyze_video": {"status": "pending", "details": {}},
        "identify_keyframes": {"status": "pending", "details": {}},
        "generate_manual": {"status": "pending", "details": {}},
    }
    nodes_status["analyze_video"]["status"] = "running"

    # Thread-safe storage for results
    result_holder = {"final_state": None, "error": None, "done": False}
    lock = threading.Lock()

    def run_graph():
        """Run the graph in a background thread."""
        try:
            for event in agent.graph.stream(initial_state, config=config, stream_mode="updates"):
                for node_name, state_update in event.items():
                    if node_name.startswith("__"):
                        continue

                    with lock:
                        # Mark current node as complete
                        nodes_status[node_name]["status"] = "complete"
                        nodes_status[node_name]["details"] = extract_details(node_name, state_update)

                        # Mark next node as running
                        next_node = get_next_node(node_name)
                        if next_node:
                            nodes_status[next_node]["status"] = "running"

                        # Store final state
                        result_holder["final_state"] = state_update
        except Exception as e:
            with lock:
                result_holder["error"] = str(e)
        finally:
            with lock:
                result_holder["done"] = True

    # Start graph execution in background thread
    graph_thread = threading.Thread(target=run_graph, daemon=True)
    graph_thread.start()

    # Animate spinner while graph runs
    frame_idx = 0
    try:
        with Live(
            render_full_status(str(video_path), user_id, nodes_status, frame_idx, output_language),
            refresh_per_second=10,
            console=console,
        ) as live:
            while True:
                with lock:
                    done = result_holder["done"]
                    current_status = dict(nodes_status)

                if done:
                    # Final update
                    live.update(render_full_status(str(video_path), user_id, current_status, frame_idx, output_language))
                    break

                # Update display with animated spinner
                live.update(render_full_status(str(video_path), user_id, current_status, frame_idx, output_language))
                frame_idx += 1
                time.sleep(0.1)

        # Wait for thread to finish
        graph_thread.join(timeout=5)

        # Check results
        final_state = result_holder["final_state"]
        error = result_holder["error"]

        if error:
            console.print(render_error(error))
            raise typer.Exit(1)

        if final_state and final_state.get("status") == "error":
            console.print(render_error(final_state.get("error", "Unknown error")))
            raise typer.Exit(1)

        # Show completion
        if final_state:
            manual_id = final_state.get("manual_id")

            # Apply tags if specified
            if tags and manual_id:
                project_storage = ProjectStorage(user_id)
                for tag in tags:
                    project_storage.add_tag_to_manual(manual_id, tag)
                console.print(f"[dim]Added tags: {', '.join(tags)}[/dim]")

            # Add to project if specified
            if project_id and manual_id:
                project_storage = ProjectStorage(user_id)
                try:
                    project_storage.add_manual_to_project(project_id, manual_id, chapter_id)
                    console.print(f"[dim]Added to project: {project_id}[/dim]")
                except Exception as e:
                    console.print(f"[yellow]Warning: Could not add to project: {e}[/yellow]")

            console.print()
            console.print(render_completion(
                manual_path=final_state.get("manual_path", "Unknown"),
                screenshot_count=len(final_state.get("screenshots", [])),
                output_dir=final_state.get("output_directory", "Unknown"),
            ))

    except KeyboardInterrupt:
        console.print("\n[yellow]Cancelled by user[/yellow]")
        raise typer.Exit(0)
    except Exception as e:
        if "Exit" not in str(type(e)):
            console.print(render_error(str(e)))
        raise


@app.command("process")
def process_video(
    video: Optional[Path] = typer.Argument(
        None,
        help="Path to video file. If not provided, lists videos from user folder.",
        exists=False,
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID for storage isolation",
    ),
    output: Optional[str] = typer.Option(
        None,
        "--output", "-o",
        help="Output filename (without extension)",
    ),
    no_scene_detection: bool = typer.Option(
        False,
        "--no-scene-detection",
        help="Disable scene detection for keyframe hints",
    ),
    language: str = typer.Option(
        "English",
        "--language", "-lang",
        help="Output language for the manual (e.g., Spanish, German, 日本語)",
    ),
    list_videos: bool = typer.Option(
        False,
        "--list", "-l",
        help="List available videos from user folder and select",
    ),
    project: Optional[str] = typer.Option(
        None,
        "--project", "-p",
        help="Add generated manual to this project",
    ),
    chapter: Optional[str] = typer.Option(
        None,
        "--chapter", "-c",
        help="Add to specific chapter within project (requires --project)",
    ),
    tags: Optional[str] = typer.Option(
        None,
        "--tags", "-t",
        help="Comma-separated tags to add to the manual",
    ),
):
    """Process a video and generate a user manual.

    You can either provide a direct path to a video file, or use --list
    to select from videos in your user folder.
    """
    ensure_directories()
    storage = UserStorage(user)
    storage.ensure_user_folders()

    # Parse tags if provided
    tag_list = [t.strip() for t in tags.split(",")] if tags else None

    # Validate and normalize language to ISO code
    try:
        language_code = normalize_language_to_code(language)
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)

    # Validate chapter requires project
    if chapter and not project:
        console.print("[red]Error: --chapter requires --project[/red]")
        raise typer.Exit(1)

    # Validate project exists if specified
    if project:
        project_storage = ProjectStorage(user)
        if not project_storage.get_project(project):
            console.print(f"[red]Error: Project not found: {project}[/red]")
            raise typer.Exit(1)

    print_welcome()

    # If video provided and exists, use it directly
    if video is not None and not list_videos:
        if not video.exists():
            console.print(f"[red]Error: Video file not found: {video}[/red]")
            raise typer.Exit(1)
        process_with_streaming(
            video, user, output, not no_scene_detection, language_code,
            project_id=project, chapter_id=chapter, tags=tag_list
        )
        return

    # Otherwise, list videos from user folder
    videos = storage.list_videos()

    if not videos:
        console.print(f"[yellow]No videos found in {storage.videos_dir}[/yellow]")
        console.print()
        console.print("You can either:")
        console.print(f"  1. Place video files in: [cyan]{storage.videos_dir}[/cyan]")
        console.print("  2. Provide a path directly: [cyan]vdocs process /path/to/video.mp4[/cyan]")
        console.print()
        raise typer.Exit(0)

    # Show available videos
    console.print(videos_table(videos))
    console.print()

    # Prompt for selection
    try:
        choice = typer.prompt("Select video number", type=int)
        if choice < 1 or choice > len(videos):
            console.print("[red]Invalid selection[/red]")
            raise typer.Exit(1)
        selected_video = videos[choice - 1]
    except (ValueError, KeyboardInterrupt):
        console.print("\n[yellow]Cancelled[/yellow]")
        raise typer.Exit(0)

    console.print()
    process_with_streaming(
        selected_video, user, output, not no_scene_detection, language_code,
        project_id=project, chapter_id=chapter, tags=tag_list
    )


@app.command("list")
def list_manuals_cmd(
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """List generated manuals for a user."""
    ensure_directories()
    storage = UserStorage(user)

    print_welcome()

    manuals = storage.list_docs()

    if not manuals:
        console.print(f"[yellow]No manuals found for user '{user}'[/yellow]")
        console.print()
        console.print("Generate your first manual with:")
        console.print("  [cyan]vdocs process /path/to/video.mp4[/cyan]")
        console.print()
        return

    # Build detailed manual info
    manual_details = []
    for manual_id in manuals:
        languages = storage.list_doc_languages(manual_id)
        # Screenshots are now shared across languages
        screenshots = storage.list_screenshots(manual_id)
        screenshot_count = len(screenshots)

        manual_dir = storage.docs_dir / manual_id
        created = "-"
        if manual_dir.exists():
            import datetime
            mtime = manual_dir.stat().st_mtime
            created = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")

        manual_details.append({
            "id": manual_id,
            "created": created,
            "screenshots": screenshot_count,
            "languages": ", ".join(languages) if languages else "-",
        })

    console.print(manuals_table(manual_details))
    console.print()
    console.print("View a manual with: [cyan]vdocs view <manual_id>[/cyan]")
    console.print()


@app.command("view")
def view_manual(
    manual_id: str = typer.Argument(
        ...,
        help="Manual ID to view",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
    language: str = typer.Option(
        "en",
        "--language", "-lang",
        help="Language code to view (e.g., en, es, de)",
    ),
    raw: bool = typer.Option(
        False,
        "--raw", "-r",
        help="Show raw markdown without formatting",
    ),
):
    """View a generated manual."""
    ensure_directories()
    storage = UserStorage(user)

    # Check available languages
    languages = storage.list_doc_languages(manual_id)
    if languages and language not in languages:
        console.print(f"[yellow]Language '{language}' not found for this manual.[/yellow]")
        console.print(f"Available languages: [cyan]{', '.join(languages)}[/cyan]")
        console.print()
        # Try first available language as fallback
        language = languages[0]
        console.print(f"Showing '{language}' version instead.")
        console.print()

    content = storage.get_doc_content(manual_id, language)

    if content is None:
        console.print(f"[red]Manual not found: {manual_id}[/red]")
        console.print()
        console.print("List available manuals with: [cyan]vdocs list[/cyan]")
        raise typer.Exit(1)

    console.print()
    if raw:
        console.print(content)
    else:
        console.print(Markdown(content))
    console.print()


@app.command("videos")
def list_videos_cmd(
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """List videos in user's videos folder."""
    ensure_directories()
    storage = UserStorage(user)
    storage.ensure_user_folders()

    print_welcome()

    videos = storage.list_videos()

    if not videos:
        console.print(f"[yellow]No videos found in {storage.videos_dir}[/yellow]")
        console.print()
        console.print(f"Place video files in: [cyan]{storage.videos_dir}[/cyan]")
        console.print()
        return

    console.print(videos_table(videos))
    console.print()
    console.print(f"Videos folder: [cyan]{storage.videos_dir}[/cyan]")
    console.print()


@app.callback()
def main():
    """Video Manual Generator - Create user manuals from instructional videos."""
    pass


# ==================== Project Commands ====================


@project_app.command("create")
def project_create(
    name: str = typer.Argument(..., help="Project name"),
    description: str = typer.Option(
        "",
        "--description", "-d",
        help="Project description",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Create a new project."""
    ensure_directories()
    storage = ProjectStorage(user)

    try:
        project_id = storage.create_project(name, description)
        console.print(f"[green]Project created:[/green] {project_id}")
        console.print(f"[dim]Add manuals with: vdocs project add-manual {project_id} MANUAL_ID[/dim]")
    except Exception as e:
        console.print(f"[red]Error creating project: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("list")
def project_list(
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """List all projects."""
    ensure_directories()
    storage = ProjectStorage(user)

    projects = storage.list_projects()

    if not projects:
        console.print(f"[yellow]No projects found for user '{user}'[/yellow]")
        console.print()
        console.print("Create your first project with:")
        console.print("  [cyan]vdocs project create \"My Project\"[/cyan]")
        return

    console.print()
    console.print(projects_table(projects))
    console.print()


@project_app.command("show")
def project_show(
    project_id: str = typer.Argument(..., help="Project ID"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
    tree: bool = typer.Option(
        False,
        "--tree", "-t",
        help="Show as tree view",
    ),
):
    """Show project details."""
    ensure_directories()
    storage = ProjectStorage(user)

    project = storage.get_project(project_id)
    if not project:
        console.print(f"[red]Project not found: {project_id}[/red]")
        raise typer.Exit(1)

    console.print()

    if tree:
        manuals_info = storage.get_project_docs(project_id)
        console.print(project_tree(project, manuals_info))
    else:
        console.print(project_detail_panel(project))

        chapters = storage.list_chapters(project_id)
        if chapters:
            console.print()
            console.print(chapters_table(chapters))

        manuals = storage.get_project_docs(project_id)
        if manuals:
            console.print()
            console.print(project_manuals_table(manuals))

    console.print()


@project_app.command("delete")
def project_delete(
    project_id: str = typer.Argument(..., help="Project ID"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
    keep_manuals: bool = typer.Option(
        True,
        "--keep-manuals/--delete-manuals",
        help="Keep manuals when deleting project",
    ),
    force: bool = typer.Option(
        False,
        "--force", "-f",
        help="Skip confirmation",
    ),
):
    """Delete a project."""
    ensure_directories()
    storage = ProjectStorage(user)

    project = storage.get_project(project_id)
    if not project:
        console.print(f"[red]Project not found: {project_id}[/red]")
        raise typer.Exit(1)

    if not force:
        action = "kept" if keep_manuals else "[red]DELETED[/red]"
        console.print(f"[yellow]This will delete project '{project['name']}'[/yellow]")
        console.print(f"Manuals will be {action}")
        confirm = typer.confirm("Are you sure?")
        if not confirm:
            console.print("[dim]Cancelled[/dim]")
            raise typer.Exit(0)

    try:
        storage.delete_project(project_id, delete_manuals=not keep_manuals)
        console.print(f"[green]Project deleted: {project_id}[/green]")
    except Exception as e:
        console.print(f"[red]Error deleting project: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("chapter-add")
def project_chapter_add(
    project_id: str = typer.Argument(..., help="Project ID"),
    title: str = typer.Argument(..., help="Chapter title"),
    description: str = typer.Option(
        "",
        "--description", "-d",
        help="Chapter description",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Add a chapter to a project."""
    ensure_directories()
    storage = ProjectStorage(user)

    try:
        chapter_id = storage.add_chapter(project_id, title, description)
        console.print(f"[green]Chapter added:[/green] {chapter_id}")
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("chapter-list")
def project_chapter_list(
    project_id: str = typer.Argument(..., help="Project ID"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """List chapters in a project."""
    ensure_directories()
    storage = ProjectStorage(user)

    try:
        chapters = storage.list_chapters(project_id)

        if not chapters:
            console.print(f"[yellow]No chapters in project '{project_id}'[/yellow]")
            console.print()
            console.print("Add a chapter with:")
            console.print(f"  [cyan]vdocs project chapter-add {project_id} \"Chapter Title\"[/cyan]")
            return

        console.print()
        console.print(chapters_table(chapters))
        console.print()
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("chapter-delete")
def project_chapter_delete(
    project_id: str = typer.Argument(..., help="Project ID"),
    chapter_id: str = typer.Argument(..., help="Chapter ID"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Delete a chapter from a project."""
    ensure_directories()
    storage = ProjectStorage(user)

    try:
        storage.delete_chapter(project_id, chapter_id)
        console.print(f"[green]Chapter deleted:[/green] {chapter_id}")
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("add-manual")
def project_add_manual(
    project_id: str = typer.Argument(..., help="Project ID"),
    manual_id: str = typer.Argument(..., help="Manual ID"),
    chapter: Optional[str] = typer.Option(
        None,
        "--chapter", "-c",
        help="Chapter ID to add to (creates chapter from manual title if not specified)",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Add a manual to a project."""
    ensure_directories()
    storage = ProjectStorage(user)

    try:
        storage.add_manual_to_project(project_id, manual_id, chapter)
        console.print(f"[green]Manual '{manual_id}' added to project '{project_id}'[/green]")
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("remove-manual")
def project_remove_manual(
    project_id: str = typer.Argument(..., help="Project ID"),
    manual_id: str = typer.Argument(..., help="Manual ID"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Remove a manual from a project (keeps the manual)."""
    ensure_directories()
    storage = ProjectStorage(user)

    try:
        storage.remove_manual_from_project(project_id, manual_id)
        console.print(f"[green]Manual '{manual_id}' removed from project '{project_id}'[/green]")
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("move-manual")
def project_move_manual(
    project_id: str = typer.Argument(..., help="Project ID"),
    manual_id: str = typer.Argument(..., help="Manual ID"),
    chapter: str = typer.Option(
        ...,
        "--to-chapter", "-c",
        help="Target chapter ID",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Move a manual to a different chapter."""
    ensure_directories()
    storage = ProjectStorage(user)

    try:
        storage.move_manual_to_chapter(project_id, manual_id, chapter)
        console.print(f"[green]Manual '{manual_id}' moved to chapter '{chapter}'[/green]")
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("export")
def project_export(
    project_id: str = typer.Argument(..., help="Project ID"),
    output: Optional[str] = typer.Option(
        None,
        "--output", "-o",
        help="Output file path",
    ),
    format: str = typer.Option(
        "pdf",
        "--format", "-f",
        help="Export format: pdf, word, html",
    ),
    language: str = typer.Option(
        "en",
        "--language", "-lang",
        help="Language code for manual content",
    ),
    no_toc: bool = typer.Option(
        False,
        "--no-toc",
        help="Exclude table of contents",
    ),
    no_chapter_covers: bool = typer.Option(
        False,
        "--no-chapter-covers",
        help="Exclude chapter cover pages",
    ),
    embed_images: bool = typer.Option(
        True,
        "--embed-images/--no-embed-images",
        help="Embed images in HTML output (only for HTML format)",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Export project to PDF, Word, or HTML."""
    ensure_directories()

    format_lower = format.lower()
    format_names = {"pdf": "PDF", "word": "Word", "docx": "Word", "html": "HTML"}

    if format_lower not in format_names:
        console.print(f"[red]Error: Unknown format '{format}'. Use: pdf, word, html[/red]")
        raise typer.Exit(1)

    console.print(f"[cyan]Exporting project '{project_id}' to {format_names[format_lower]}...[/cyan]")

    try:
        if format_lower == "pdf":
            from ..export.project_exporter import ProjectExporter
            exporter = ProjectExporter(user, project_id)
            output_path = exporter.export(
                output_path=output,
                language=language,
                include_toc=not no_toc,
                include_chapter_covers=not no_chapter_covers,
            )
        elif format_lower in ("word", "docx"):
            from ..export.word_exporter import WordExporter
            exporter = WordExporter(user, project_id)
            output_path = exporter.export(
                output_path=output,
                language=language,
                include_toc=not no_toc,
                include_chapter_covers=not no_chapter_covers,
            )
        elif format_lower == "html":
            from ..export.html_exporter import HTMLExporter
            exporter = HTMLExporter(user, project_id)
            output_path = exporter.export(
                output_path=output,
                language=language,
                include_toc=not no_toc,
                include_chapter_covers=not no_chapter_covers,
                embed_images=embed_images,
            )

        console.print(f"[green]{format_names[format_lower]} exported successfully:[/green] {output_path}")
    except ValueError as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)
    except Exception as e:
        console.print(f"[red]Export failed: {e}[/red]")
        raise typer.Exit(1)


@project_app.command("compile")
def project_compile(
    project_id: str = typer.Argument(..., help="Project ID to compile"),
    language: str = typer.Option(
        "en",
        "--language", "-lang",
        help="Language code for manual content",
    ),
    model: Optional[str] = typer.Option(
        None,
        "--model", "-m",
        help="LLM model (anthropic:claude-sonnet-4-5-20250929, google:gemini-2.0-flash). Defaults to Sonnet.",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Compile project manuals into unified document using AI agent.

    This uses the Project Compiler Agent to intelligently merge multiple
    manuals into a single unified document. The agent will:

    1. Analyze project structure and manual contents
    2. Create a merge plan (identifying duplicates, transitions)
    3. Ask for your approval before compiling
    4. Execute the compilation

    You can accept, edit, or reject the merge plan when prompted.
    """
    from langgraph.types import Command

    ensure_directories()

    # Check project exists
    storage = ProjectStorage(user)
    project = storage.get_project(project_id)
    if not project:
        console.print(f"[red]Error: Project not found: {project_id}[/red]")
        raise typer.Exit(1)

    console.print()
    console.print(render_compiler_status("analyzing", f"Project: {project['name']}"))
    console.print()

    try:
        from ..agents.project_compiler_agent import get_compiler_agent

        # Get the compiler agent
        agent = get_compiler_agent(model=model)

        # Create unique thread ID for this compilation
        import uuid
        thread_id = f"{user}_{project_id}_{uuid.uuid4().hex[:8]}"
        config = {"configurable": {"thread_id": thread_id}}

        # Initial message to the agent
        initial_message = f"Compile project '{project_id}' for user '{user}' in language '{language}'"

        console.print(f"[dim]Starting compilation for project: {project_id}[/dim]")
        console.print()

        def display_message(msg):
            """Display a single message from the agent."""
            if not hasattr(msg, "type") or not hasattr(msg, "content"):
                return

            if msg.type == "ai" and msg.content:
                if isinstance(msg.content, str):
                    console.print(Markdown(msg.content))
                    console.print()
                elif isinstance(msg.content, list):
                    for block in msg.content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            console.print(Markdown(block.get("text", "")))
                            console.print()
            elif msg.type == "tool" and msg.content:
                content_str = str(msg.content)
                if len(content_str) > 300:
                    content_str = content_str[:300] + "..."
                console.print(f"[dim]Tool result: {content_str}[/dim]")
                console.print()

        def run_agent_loop(input_data):
            """Run the agent loop as a conversation with HITL support.

            The agent will:
            1. Analyze the project
            2. Present a merge plan (waiting for user approval)
            3. On approval, call compile_manuals (which triggers HITL interrupt)
            4. Complete compilation after HITL approval

            We need to handle both:
            - Conversational turns (user approves the plan)
            - HITL interrupts (tool-level approval for compile_manuals)
            """
            stream_input = input_data
            conversation_turn = 0
            max_turns = 10  # Safety limit

            while conversation_turn < max_turns:
                conversation_turn += 1
                pending_interrupts: dict = {}
                interrupt_occurred = False
                last_ai_content = ""
                spinner_stopped = False

                # Show spinner while agent is thinking
                from rich.status import Status
                status = Status("[bold cyan]Agent thinking...", console=console, spinner="dots")
                status.start()

                # Stream agent response
                for chunk in agent.stream(
                    stream_input,
                    config=config,
                    stream_mode=["messages", "updates"],
                    subgraphs=True,
                ):
                    if not isinstance(chunk, tuple) or len(chunk) != 3:
                        continue

                    namespace, mode, data = chunk

                    # Handle message chunks - collect AI content
                    if mode == "messages":
                        if isinstance(data, tuple) and len(data) >= 1:
                            msg = data[0]
                            # Display AI messages (AIMessageChunk from streaming)
                            # Note: msg.type is "AIMessageChunk" for streaming, not "ai"
                            msg_type = getattr(msg, "type", "") or ""
                            msg_content = getattr(msg, "content", None)

                            # Check for AI message types (includes AIMessageChunk)
                            is_ai_msg = "ai" in msg_type.lower() if isinstance(msg_type, str) else False
                            if is_ai_msg and msg_content:
                                # Content is a list of blocks for streaming
                                if isinstance(msg_content, list):
                                    for block in msg_content:
                                        if isinstance(block, dict):
                                            # Text content block
                                            if block.get("type") == "text":
                                                text = block.get("text", "")
                                                if text:
                                                    # Stop spinner on first text content
                                                    if not spinner_stopped:
                                                        status.stop()
                                                        spinner_stopped = True
                                                    console.print(text, end="", markup=False)
                                                    last_ai_content += text
                                            # Tool use block - show activity message
                                            elif block.get("type") == "tool_use":
                                                tool_name = block.get("name", "")
                                                tool_messages = {
                                                    "analyze_project": "Analyzing project structure...",
                                                    "compile_manuals": "Compiling manuals...",
                                                }
                                                activity_msg = tool_messages.get(tool_name, f"Running {tool_name}...")
                                                # Stop spinner and show tool activity
                                                if not spinner_stopped:
                                                    status.stop()
                                                    spinner_stopped = True
                                                console.print(f"\n[dim]{activity_msg}[/dim]", end="")
                                elif isinstance(msg_content, str) and msg_content:
                                    # Stop spinner on string content
                                    if not spinner_stopped:
                                        status.stop()
                                        spinner_stopped = True
                                    console.print(msg_content, end="", markup=False)
                                    last_ai_content += msg_content

                            # Tool results are not displayed - activity message shown on tool_use instead

                    # Handle update chunks - check for HITL interrupts
                    elif mode == "updates":
                        if not isinstance(data, dict):
                            continue

                        if "__interrupt__" in data:
                            interrupts = data["__interrupt__"]
                            if interrupts:
                                for interrupt_obj in interrupts:
                                    if hasattr(interrupt_obj, "value") and hasattr(interrupt_obj, "id"):
                                        pending_interrupts[interrupt_obj.id] = interrupt_obj.value
                                        interrupt_occurred = True

                # Ensure spinner is stopped after stream ends
                if not spinner_stopped:
                    status.stop()

                # Newline after streaming content
                if last_ai_content:
                    console.print()
                    console.print()

                # Case 1: HITL interrupt - tool needs approval
                if interrupt_occurred and pending_interrupts:
                    all_decisions = []
                    for interrupt_id, interrupt_value in pending_interrupts.items():
                        action_requests = interrupt_value.get("action_requests", [])
                        review_configs = interrupt_value.get("review_configs", [])

                        if not action_requests:
                            continue

                        config_map = {cfg.get("action_name"): cfg for cfg in review_configs}

                        decisions = []
                        for action in action_requests:
                            tool_name = action.get("name", "unknown")
                            tool_args = action.get("args", {})

                            console.print()
                            console.print(format_tool_call({"tool_name": tool_name, "tool_args": tool_args}))

                            review_cfg = config_map.get(tool_name, {})
                            allowed = review_cfg.get("allowed_decisions", ["approve", "reject"])
                            console.print(f"[dim]Allowed actions: {', '.join(allowed)}[/dim]")

                            if tool_name == "compile_manuals":
                                merge_plan = tool_args.get("merge_plan", {})
                                if merge_plan:
                                    console.print()
                                    console.print(format_merge_plan(merge_plan))

                            user_decision = get_user_decision()

                            if user_decision["type"] == "accept":
                                decisions.append({"type": "approve"})
                            else:
                                reject_msg = user_decision.get("args", "User rejected")
                                decisions.append({"type": "reject", "message": str(reject_msg)})

                        all_decisions.extend(decisions)

                    hitl_response = {"decisions": all_decisions}

                    if all_decisions and all_decisions[0].get("type") == "approve":
                        console.print()
                        console.print(render_compiler_status("compiling", "Executing merge plan..."))
                    else:
                        console.print()
                        console.print("[yellow]Tool call rejected. Agent will reconsider...[/yellow]")

                    stream_input = Command(resume=hitl_response)
                    continue

                # Case 2: Agent waiting for conversational input
                # Check if the agent is waiting for user approval of the plan
                if last_ai_content:
                    console.print("[cyan]─" * 60 + "[/cyan]")
                    console.print("[bold]Agent is waiting for your input.[/bold]")
                    console.print("Type your response (or 'approve'/'yes' to proceed, 'quit' to exit):")
                    console.print()

                    try:
                        user_input = typer.prompt("You", default="").strip()
                    except (KeyboardInterrupt, EOFError):
                        console.print("\n[yellow]Cancelled[/yellow]")
                        break

                    if not user_input or user_input.lower() in ("quit", "exit", "q"):
                        console.print("[yellow]Exiting conversation[/yellow]")
                        break

                    # Continue conversation with user input
                    stream_input = {"messages": [{"role": "user", "content": user_input}]}
                    continue

                # Case 3: Agent finished (no content, no interrupt)
                break

        # Run the agent loop
        run_agent_loop({"messages": [{"role": "user", "content": initial_message}]})

        console.print()
        console.print("[green]Compilation process finished![/green]")
        console.print()

    except KeyboardInterrupt:
        console.print("\n[yellow]Compilation cancelled by user[/yellow]")
        raise typer.Exit(0)
    except ImportError as e:
        console.print("[red]Error: Missing dependency. Run 'uv sync' to install.[/red]")
        console.print(f"[dim]{e}[/dim]")
        raise typer.Exit(1)
    except Exception as e:
        console.print(render_compiler_status("error", str(e)))
        raise typer.Exit(1)


# ==================== Tag Commands ====================


@tag_app.command("add")
def tag_add(
    manual_id: str = typer.Argument(..., help="Manual ID"),
    tags: List[str] = typer.Argument(..., help="Tags to add"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Add tags to a manual."""
    ensure_directories()
    storage = ProjectStorage(user)

    for tag in tags:
        storage.add_tag_to_manual(manual_id, tag)

    console.print(f"[green]Added {len(tags)} tag(s) to '{manual_id}'[/green]")


@tag_app.command("remove")
def tag_remove(
    manual_id: str = typer.Argument(..., help="Manual ID"),
    tag: str = typer.Argument(..., help="Tag to remove"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Remove a tag from a manual."""
    ensure_directories()
    storage = ProjectStorage(user)

    storage.remove_tag_from_manual(manual_id, tag)
    console.print(f"[green]Removed tag '{tag}' from '{manual_id}'[/green]")


@tag_app.command("list")
def tag_list(
    manual_id: Optional[str] = typer.Option(
        None,
        "--manual", "-m",
        help="Show tags for a specific manual",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """List all tags or tags for a specific manual."""
    ensure_directories()
    storage = ProjectStorage(user)

    console.print()

    if manual_id:
        # Show tags for specific manual
        metadata = storage._get_manual_metadata(manual_id)
        if metadata is None:
            console.print(f"[red]Manual not found: {manual_id}[/red]")
            raise typer.Exit(1)

        tags = metadata.get("tags", [])
        console.print(manual_tags_panel(manual_id, tags))
    else:
        # Show all tags with counts
        all_tags = storage.list_all_tags()

        if not all_tags:
            console.print("[yellow]No tags found[/yellow]")
            console.print()
            console.print("Add tags with:")
            console.print("  [cyan]vdocs tag add MANUAL_ID tag1 tag2[/cyan]")
            return

        # Get counts for each tag
        tags_with_counts = []
        for tag in all_tags:
            manuals = storage.get_docs_by_tag(tag)
            tags_with_counts.append({"tag": tag, "count": len(manuals)})

        console.print(tags_table(tags_with_counts))

    console.print()


@tag_app.command("search")
def tag_search(
    tag: str = typer.Argument(..., help="Tag to search for"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Find manuals with a specific tag."""
    ensure_directories()
    storage = ProjectStorage(user)

    manuals = storage.get_docs_by_tag(tag)

    console.print()

    if not manuals:
        console.print(f"[yellow]No manuals found with tag '{tag}'[/yellow]")
    else:
        console.print(f"[bold]Manuals with tag '{tag}':[/bold]")
        for manual_id in manuals:
            console.print(f"  [cyan]{manual_id}[/cyan]")

    console.print()


# ==================== Version Commands ====================


@version_app.command("list")
def version_list(
    manual_id: str = typer.Argument(..., help="Manual ID"),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """List version history for a manual."""
    ensure_directories()
    storage = VersionStorage(user, manual_id)

    versions = storage.list_versions()
    current_version = storage.get_current_version()

    if not versions:
        console.print(f"[yellow]No version history for '{manual_id}'[/yellow]")
        return

    console.print()
    console.print(versions_table(versions, current_version))
    console.print()


@version_app.command("bump")
def version_bump(
    manual_id: str = typer.Argument(..., help="Manual ID"),
    minor: bool = typer.Option(
        False,
        "--minor",
        help="Bump minor version (1.0.0 -> 1.1.0)",
    ),
    major: bool = typer.Option(
        False,
        "--major",
        help="Bump major version (1.0.0 -> 2.0.0)",
    ),
    notes: str = typer.Option(
        "",
        "--notes", "-n",
        help="Version notes",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Bump manual version (creates snapshot of current state)."""
    ensure_directories()

    if not minor and not major:
        console.print("[red]Error: Specify --minor or --major[/red]")
        raise typer.Exit(1)

    if minor and major:
        console.print("[red]Error: Cannot specify both --minor and --major[/red]")
        raise typer.Exit(1)

    bump_type = "minor" if minor else "major"

    try:
        storage = VersionStorage(user, manual_id)
        old_version = storage.get_current_version()
        new_version = storage.bump_version(bump_type, notes)
        console.print(f"[green]Version bumped: {old_version} -> {new_version}[/green]")
        if notes:
            console.print(f"[dim]Notes: {notes}[/dim]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        raise typer.Exit(1)


@version_app.command("restore")
def version_restore(
    manual_id: str = typer.Argument(..., help="Manual ID"),
    version: str = typer.Argument(..., help="Version to restore (e.g., 1.0.0)"),
    language: str = typer.Option(
        "en",
        "--language", "-lang",
        help="Language to restore",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Restore manual to a previous version."""
    ensure_directories()

    try:
        storage = VersionStorage(user, manual_id)

        # Confirm restore
        current = storage.get_current_version()
        console.print(f"[yellow]This will restore '{manual_id}' from v{current} to v{version}[/yellow]")
        console.print("[dim]Current state will be auto-saved first.[/dim]")
        confirm = typer.confirm("Continue?")

        if not confirm:
            console.print("[dim]Cancelled[/dim]")
            raise typer.Exit(0)

        success = storage.restore_version(version, language)
        if success:
            console.print(f"[green]Restored to version {version}[/green]")
        else:
            console.print(f"[red]Version {version} not found[/red]")
            raise typer.Exit(1)
    except Exception as e:
        if "Exit" not in str(type(e)):
            console.print(f"[red]Error: {e}[/red]")
        raise


@version_app.command("diff")
def version_diff(
    manual_id: str = typer.Argument(..., help="Manual ID"),
    v1: str = typer.Argument(..., help="First version"),
    v2: str = typer.Argument(..., help="Second version"),
    language: str = typer.Option(
        "en",
        "--language", "-lang",
        help="Language to compare",
    ),
    user: str = typer.Option(
        "default",
        "--user", "-u",
        help="User ID",
    ),
):
    """Compare two versions of a manual."""
    ensure_directories()

    try:
        storage = VersionStorage(user, manual_id)
        diff_result = storage.diff_versions(v1, v2, language)

        if "error" in diff_result:
            console.print(f"[red]Error: {diff_result['error']}[/red]")
            raise typer.Exit(1)

        console.print()
        console.print(f"[bold]Comparing v{v1} with v{v2}[/bold]")
        console.print()
        console.print(f"v{v1}: {diff_result['v1_lines']} lines, {diff_result['v1_chars']} chars")
        console.print(f"v{v2}: {diff_result['v2_lines']} lines, {diff_result['v2_chars']} chars")
        console.print()
        console.print(f"Lines changed: {diff_result['lines_changed']}")
        console.print(f"Characters changed: {diff_result['chars_changed']}")
        console.print()
    except Exception as e:
        if "Exit" not in str(type(e)):
            console.print(f"[red]Error: {e}[/red]")
        raise


if __name__ == "__main__":
    app()
