"""Rich console utilities for Video Manual CLI."""

import time
from typing import Dict, Any, Optional, List
from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree
from rich.text import Text
from rich.spinner import Spinner
from rich.live import Live
from rich.markdown import Markdown
from rich import box

# Global console instance
console = Console()

# Node display names
NODE_NAMES = {
    "analyze_video": "Analyzing video",
    "identify_keyframes": "Identifying keyframes",
    "generate_manual": "Generating manual",
}

# Node order for progress tracking
NODE_ORDER = ["analyze_video", "identify_keyframes", "generate_manual"]

# Spinner frames for animation
SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]


def format_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def format_duration(seconds: float) -> str:
    """Format duration in human-readable format."""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    if minutes > 0:
        return f"{minutes}:{secs:02d}"
    return f"{secs}s"


def header_panel(title: str, subtitle: str = "") -> Panel:
    """Create styled header panel."""
    content = f"[bold cyan]{title}[/bold cyan]"
    if subtitle:
        content += f"\n[dim]{subtitle}[/dim]"
    return Panel(
        content,
        box=box.ROUNDED,
        border_style="cyan",
        padding=(0, 2),
    )


def status_icon(status: str, frame_idx: int = 0) -> str:
    """Get status icon for node status."""
    if status == "running":
        # Animated spinner for running status
        spinner = SPINNER_FRAMES[frame_idx % len(SPINNER_FRAMES)]
        return f"[yellow bold]{spinner}[/yellow bold]"
    icons = {
        "pending": "[dim]-[/dim]",
        "complete": "[green bold]#[/green bold]",
        "error": "[red bold]X[/red bold]",
    }
    return icons.get(status, "-")


def render_node_status(
    nodes_status: Dict[str, Dict[str, Any]],
    video_info: Optional[Dict[str, Any]] = None,
    frame_idx: int = 0,
) -> Panel:
    """Render the current processing status as a panel."""
    lines = []

    for node_name in NODE_ORDER:
        status_info = nodes_status.get(node_name, {"status": "pending", "details": {}})
        status = status_info["status"]
        details = status_info.get("details", {})

        icon = status_icon(status, frame_idx)
        name = NODE_NAMES.get(node_name, node_name)

        # Status line
        if status == "running":
            lines.append(f"  {icon} [yellow]{name}...[/yellow]")
        elif status == "complete":
            lines.append(f"  {icon} [green]{name}[/green]")
        elif status == "error":
            lines.append(f"  {icon} [red]{name} - FAILED[/red]")
        else:
            lines.append(f"  {icon} [dim]{name}[/dim]")

        # Detail lines
        if details and status in ("running", "complete"):
            for key, value in details.items():
                if value is not None:
                    lines.append(f"      [dim]{key}:[/dim] {value}")

    content = "\n".join(lines)
    return Panel(
        content,
        title="[bold]Progress[/bold]",
        border_style="blue",
        box=box.ROUNDED,
        padding=(0, 1),
    )


def render_processing_header(video_path: str, user_id: str, language: str = "English") -> Panel:
    """Render the processing header with video and user info."""
    from pathlib import Path
    video_name = Path(video_path).name

    content = f"""[bold]Processing:[/bold] {video_name}
[bold]User:[/bold] {user_id}
[bold]Language:[/bold] {language}"""

    return Panel(
        content,
        title="[bold cyan]VIDEO MANUAL GENERATOR[/bold cyan]",
        border_style="cyan",
        box=box.DOUBLE,
        padding=(0, 2),
    )


def render_full_status(
    video_path: str,
    user_id: str,
    nodes_status: Dict[str, Dict[str, Any]],
    frame_idx: int = 0,
    language: str = "English",
) -> Group:
    """Render the complete status display."""
    return Group(
        render_processing_header(video_path, user_id, language),
        "",
        render_node_status(nodes_status, frame_idx=frame_idx),
    )


def render_completion(
    manual_path: str,
    screenshot_count: int,
    output_dir: str,
) -> Panel:
    """Render completion message."""
    content = f"""[green bold]Manual created successfully![/green bold]

[bold]Manual:[/bold] {manual_path}
[bold]Screenshots:[/bold] {screenshot_count} images
[bold]Output:[/bold] {output_dir}"""

    return Panel(
        content,
        title="[bold green]COMPLETE[/bold green]",
        border_style="green",
        box=box.DOUBLE,
        padding=(0, 2),
    )


def render_error(error_message: str) -> Panel:
    """Render error message."""
    return Panel(
        f"[red]{error_message}[/red]",
        title="[bold red]ERROR[/bold red]",
        border_style="red",
        box=box.DOUBLE,
        padding=(0, 2),
    )


def videos_table(videos: List[Any]) -> Table:
    """Create a table of available videos."""
    table = Table(
        title="Available Videos",
        box=box.ROUNDED,
        border_style="cyan",
    )
    table.add_column("#", style="cyan", justify="right", width=3)
    table.add_column("Filename", style="white")
    table.add_column("Size", style="dim", justify="right")

    for i, video in enumerate(videos, 1):
        size = format_size(video.stat().st_size)
        table.add_row(str(i), video.name, size)

    return table


def manuals_table(manuals: List[Dict[str, Any]]) -> Table:
    """Create a table of generated manuals."""
    table = Table(
        title="Generated Manuals",
        box=box.ROUNDED,
        border_style="cyan",
    )
    table.add_column("ID", style="cyan")
    table.add_column("Languages", style="green")
    table.add_column("Created", style="dim")
    table.add_column("Screenshots", justify="right")

    for manual in manuals:
        table.add_row(
            manual.get("id", "unknown"),
            manual.get("languages", "-"),
            manual.get("created", "-"),
            str(manual.get("screenshots", 0)),
        )

    return table


def print_welcome():
    """Print welcome message."""
    console.print()
    console.print(
        Panel(
            "[bold cyan]Video Manual Generator[/bold cyan]\n"
            "[dim]Generate user manuals from instructional videos[/dim]",
            box=box.DOUBLE,
            border_style="cyan",
            padding=(0, 2),
        )
    )
    console.print()
