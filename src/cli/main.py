"""Main CLI entry point for Video Manual Platform."""

import typer
import time
import threading
from pathlib import Path
from typing import Optional
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
)
from ..storage.user_storage import UserStorage
from ..config import ensure_directories

app = typer.Typer(
    name="video-manual",
    help="Generate user manuals from instructional videos",
    add_completion=False,
    no_args_is_help=True,
)


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
):
    """Process video with streaming node events and animated spinner."""
    from ..agents.video_manual_agent import VideoManualAgent
    from ..agents.video_manual_agent.state import VideoManualState

    # Create agent
    agent = VideoManualAgent(use_checkpointer=True)

    # Generate manual_id upfront so all nodes can use it
    # (needed for storing optimized video in correct location)
    storage = UserStorage(user_id)
    storage.ensure_user_folders()
    video_name = output_filename or video_path.name
    manual_dir, manual_id = storage.get_manual_dir(video_name=video_name)

    # Prepare initial state
    initial_state: VideoManualState = {
        "user_id": user_id,
        "manual_id": manual_id,
        "video_path": str(video_path),
        "output_filename": output_filename,
        "use_scene_detection": use_scene_detection,
        "video_metadata": None,
        "video_analysis": None,
        "model_used": None,
        "optimized_video_path": None,
        "gemini_file_uri": None,
        "keyframes": None,
        "scene_changes": None,
        "total_keyframes": None,
        "manual_content": None,
        "manual_path": None,
        "screenshots": None,
        "output_directory": None,
        "status": "pending",
        "error": None,
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
            render_full_status(str(video_path), user_id, nodes_status, frame_idx),
            refresh_per_second=10,
            console=console,
        ) as live:
            while True:
                with lock:
                    done = result_holder["done"]
                    current_status = dict(nodes_status)

                if done:
                    # Final update
                    live.update(render_full_status(str(video_path), user_id, current_status, frame_idx))
                    break

                # Update display with animated spinner
                live.update(render_full_status(str(video_path), user_id, current_status, frame_idx))
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
    list_videos: bool = typer.Option(
        False,
        "--list", "-l",
        help="List available videos from user folder and select",
    ),
):
    """Process a video and generate a user manual.

    You can either provide a direct path to a video file, or use --list
    to select from videos in your user folder.
    """
    ensure_directories()
    storage = UserStorage(user)
    storage.ensure_user_folders()

    print_welcome()

    # If video provided and exists, use it directly
    if video is not None and not list_videos:
        if not video.exists():
            console.print(f"[red]Error: Video file not found: {video}[/red]")
            raise typer.Exit(1)
        process_with_streaming(video, user, output, not no_scene_detection)
        return

    # Otherwise, list videos from user folder
    videos = storage.list_videos()

    if not videos:
        console.print(f"[yellow]No videos found in {storage.videos_dir}[/yellow]")
        console.print()
        console.print("You can either:")
        console.print(f"  1. Place video files in: [cyan]{storage.videos_dir}[/cyan]")
        console.print("  2. Provide a path directly: [cyan]video-manual process /path/to/video.mp4[/cyan]")
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
    process_with_streaming(selected_video, user, output, not no_scene_detection)


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

    manuals = storage.list_manuals()

    if not manuals:
        console.print(f"[yellow]No manuals found for user '{user}'[/yellow]")
        console.print()
        console.print("Generate your first manual with:")
        console.print("  [cyan]video-manual process /path/to/video.mp4[/cyan]")
        console.print()
        return

    # Build detailed manual info
    manual_details = []
    for manual_id in manuals:
        screenshots = storage.list_screenshots(manual_id)
        manual_dir = storage.manuals_dir / manual_id
        created = "-"
        if manual_dir.exists():
            import datetime
            mtime = manual_dir.stat().st_mtime
            created = datetime.datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M")

        manual_details.append({
            "id": manual_id,
            "created": created,
            "screenshots": len(screenshots),
        })

    console.print(manuals_table(manual_details))
    console.print()
    console.print("View a manual with: [cyan]video-manual view <manual_id>[/cyan]")
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
    raw: bool = typer.Option(
        False,
        "--raw", "-r",
        help="Show raw markdown without formatting",
    ),
):
    """View a generated manual."""
    ensure_directories()
    storage = UserStorage(user)

    content = storage.get_manual_content(manual_id)

    if content is None:
        console.print(f"[red]Manual not found: {manual_id}[/red]")
        console.print()
        console.print("List available manuals with: [cyan]video-manual list[/cyan]")
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


if __name__ == "__main__":
    app()
