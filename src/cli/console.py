"""Rich console utilities for vDocs CLI."""

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
        title="[bold cyan]VDOCS[/bold cyan]",
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
            "[bold cyan]vDocs[/bold cyan]\n"
            "[dim]AI-powered documentation from video[/dim]",
            box=box.DOUBLE,
            border_style="cyan",
            padding=(0, 2),
        )
    )
    console.print()


# ==================== Project Display ====================


def projects_table(projects: List[Dict[str, Any]]) -> Table:
    """Create a table of projects."""
    table = Table(
        title="Projects",
        box=box.ROUNDED,
        border_style="cyan",
    )
    table.add_column("ID", style="cyan")
    table.add_column("Name", style="white")
    table.add_column("Chapters", justify="right")
    table.add_column("Manuals", justify="right")
    table.add_column("Updated", style="dim")

    for project in projects:
        # Format updated date
        updated = project.get("updated_at", "")
        if updated:
            updated = updated[:10]  # Just the date part

        table.add_row(
            project.get("id", "unknown"),
            project.get("name", "Untitled"),
            str(project.get("total_chapters", 0)),
            str(project.get("total_manuals", 0)),
            updated,
        )

    return table


def project_detail_panel(project: Dict[str, Any]) -> Panel:
    """Create a detailed project view panel."""
    content_lines = [
        f"[bold]Name:[/bold] {project.get('name', 'Untitled')}",
        f"[bold]Description:[/bold] {project.get('description', '-') or '-'}",
        f"[bold]Default Language:[/bold] {project.get('default_language', 'en')}",
        f"[bold]Created:[/bold] {project.get('created_at', '-')[:10] if project.get('created_at') else '-'}",
        f"[bold]Updated:[/bold] {project.get('updated_at', '-')[:10] if project.get('updated_at') else '-'}",
    ]

    tags = project.get("tags", [])
    if tags:
        content_lines.append(f"[bold]Tags:[/bold] {', '.join(tags)}")

    content = "\n".join(content_lines)

    return Panel(
        content,
        title=f"[bold cyan]Project: {project.get('id', 'unknown')}[/bold cyan]",
        border_style="cyan",
        box=box.ROUNDED,
        padding=(0, 2),
    )


def chapters_table(chapters: List[Dict[str, Any]]) -> Table:
    """Create a table of chapters within a project."""
    table = Table(
        title="Chapters",
        box=box.ROUNDED,
        border_style="blue",
    )
    table.add_column("#", style="dim", justify="right", width=3)
    table.add_column("ID", style="cyan")
    table.add_column("Title", style="white")
    table.add_column("Manuals", justify="right")

    for chapter in chapters:
        table.add_row(
            str(chapter.get("order", 0)),
            chapter.get("id", "unknown"),
            chapter.get("title", "Untitled"),
            str(len(chapter.get("manuals", []))),
        )

    return table


def project_manuals_table(manuals: List[Dict[str, Any]]) -> Table:
    """Create a table of manuals within a project."""
    table = Table(
        title="Project Manuals",
        box=box.ROUNDED,
        border_style="green",
    )
    table.add_column("Manual ID", style="cyan")
    table.add_column("Chapter", style="blue")
    table.add_column("Version", style="yellow")
    table.add_column("Languages", style="green")
    table.add_column("Tags", style="dim")

    for manual in manuals:
        languages = ", ".join(manual.get("languages", [])) or "-"
        tags = ", ".join(manual.get("tags", [])) or "-"

        table.add_row(
            manual.get("id", "unknown"),
            manual.get("chapter_title", "-"),
            manual.get("version", "1.0.0"),
            languages,
            tags,
        )

    return table


def project_tree(project: Dict[str, Any], manuals_info: List[Dict[str, Any]] = None) -> Tree:
    """Create a tree view of project structure."""
    tree = Tree(
        f"[bold cyan]{project.get('name', 'Untitled')}[/bold cyan] ({project.get('id', 'unknown')})"
    )

    # Build manual lookup
    manual_lookup = {}
    if manuals_info:
        for m in manuals_info:
            manual_lookup[m.get("id")] = m

    chapters = project.get("chapters", [])
    for chapter in sorted(chapters, key=lambda c: c.get("order", 0)):
        chapter_branch = tree.add(
            f"[blue]{chapter.get('title', 'Untitled')}[/blue] ({chapter.get('id')})"
        )

        for manual_id in chapter.get("manuals", []):
            manual_info = manual_lookup.get(manual_id, {})
            version = manual_info.get("version", "1.0.0")
            languages = manual_info.get("languages", [])
            lang_str = f" [{', '.join(languages)}]" if languages else ""

            chapter_branch.add(
                f"[green]{manual_id}[/green] v{version}{lang_str}"
            )

    return tree


# ==================== Tag Display ====================


def tags_table(tags_with_counts: List[Dict[str, Any]]) -> Table:
    """Create a table of tags with manual counts."""
    table = Table(
        title="Tags",
        box=box.ROUNDED,
        border_style="yellow",
    )
    table.add_column("Tag", style="yellow")
    table.add_column("Manuals", justify="right")

    for tag_info in tags_with_counts:
        table.add_row(
            tag_info.get("tag", "unknown"),
            str(tag_info.get("count", 0)),
        )

    return table


def manual_tags_panel(manual_id: str, tags: List[str]) -> Panel:
    """Create a panel showing tags for a manual."""
    if tags:
        content = ", ".join(f"[yellow]{tag}[/yellow]" for tag in tags)
    else:
        content = "[dim]No tags[/dim]"

    return Panel(
        content,
        title=f"[bold]Tags for {manual_id}[/bold]",
        border_style="yellow",
        box=box.ROUNDED,
        padding=(0, 2),
    )


# ==================== Version Display ====================


def versions_table(versions: List[Dict[str, Any]], current_version: str) -> Table:
    """Create a table of version history."""
    table = Table(
        title="Version History",
        box=box.ROUNDED,
        border_style="magenta",
    )
    table.add_column("Version", style="magenta")
    table.add_column("Created", style="dim")
    table.add_column("Notes", style="white")
    table.add_column("", style="green", width=8)

    # versions list already includes current version with is_current=True
    for v in versions:
        created = v.get("created_at", "")[:10] if v.get("created_at") else "-"
        is_current = v.get("is_current", False)
        table.add_row(
            v.get("version", "?"),
            "-" if is_current else created,
            v.get("notes", "-") or "-",
            "[green]CURRENT[/green]" if is_current else "",
        )

    return table


# ==================== HITL (Human-in-the-Loop) Display ====================


def format_tool_call(interrupt_data: dict) -> Panel:
    """Format a tool call for display during HITL interrupts.

    Args:
        interrupt_data: The interrupt data from deepagents containing tool call info

    Returns:
        Rich Panel with formatted tool call display
    """
    tool_name = interrupt_data.get("tool_name", "Unknown Tool")
    tool_args = interrupt_data.get("tool_args", {})
    tool_id = interrupt_data.get("tool_call_id", "")[:8]

    lines = []
    lines.append(f"[bold cyan]Tool:[/bold cyan] {tool_name}")

    if tool_id:
        lines.append(f"[dim]ID: {tool_id}...[/dim]")

    lines.append("")
    lines.append("[bold]Arguments:[/bold]")

    for key, value in tool_args.items():
        if isinstance(value, dict):
            # Format nested dicts nicely (like merge_plan)
            import json
            formatted = json.dumps(value, indent=2)
            lines.append(f"  [cyan]{key}:[/cyan]")
            for line in formatted.split("\n"):
                lines.append(f"    [dim]{line}[/dim]")
        elif isinstance(value, list):
            lines.append(f"  [cyan]{key}:[/cyan] [{len(value)} items]")
        else:
            lines.append(f"  [cyan]{key}:[/cyan] {value}")

    content = "\n".join(lines)
    return Panel(
        content,
        title="[bold yellow]APPROVAL REQUIRED[/bold yellow]",
        border_style="yellow",
        box=box.DOUBLE,
        padding=(1, 2),
    )


def format_merge_plan(merge_plan: dict) -> Panel:
    """Format a merge plan for detailed review.

    Args:
        merge_plan: The merge plan dict with chapters, duplicates, transitions

    Returns:
        Rich Panel with formatted merge plan
    """
    lines = []

    # Chapters section
    chapters = merge_plan.get("chapters", [])
    lines.append("[bold cyan]Chapters to compile:[/bold cyan]")
    for i, chapter in enumerate(chapters, 1):
        lines.append(f"  {i}. [bold]{chapter.get('title', 'Untitled')}[/bold]")
        sources = chapter.get("sources", [])
        lines.append(f"     Sources: [green]{', '.join(sources)}[/green]")
        strategy = chapter.get("merge_strategy", "sequential")
        lines.append(f"     Strategy: [yellow]{strategy}[/yellow]")
        if chapter.get("notes"):
            lines.append(f"     Notes: [dim]{chapter['notes']}[/dim]")

    # Duplicates section
    duplicates = merge_plan.get("duplicates_detected", [])
    if duplicates:
        lines.append("")
        lines.append(f"[bold red]Duplicates detected ({len(duplicates)}):[/bold red]")
        for dup in duplicates:
            lines.append(f"  - {dup.get('content', 'Unknown')}")
            lines.append(f"    Keep from: [green]{dup.get('keep_from')}[/green]")
            lines.append(f"    Remove from: [red]{dup.get('remove_from')}[/red]")

    # Transitions section
    transitions = merge_plan.get("transitions_needed", [])
    if transitions:
        lines.append("")
        lines.append(f"[bold blue]Transitions needed ({len(transitions)}):[/bold blue]")
        for trans in transitions:
            lines.append(f"  - {trans.get('from')} -> {trans.get('to')}")
            if trans.get("suggested"):
                lines.append(f"    [dim]\"{trans['suggested']}\"[/dim]")

    content = "\n".join(lines)
    return Panel(
        content,
        title="[bold]Merge Plan Preview[/bold]",
        border_style="cyan",
        box=box.ROUNDED,
        padding=(1, 2),
    )


def get_user_decision() -> dict:
    """Get user decision for HITL interrupt.

    Returns:
        dict with 'type' key: 'accept', 'edit', or 'respond'
        For 'edit' and 'respond', includes additional data
    """
    console.print()
    console.print("[bold]Choose an action:[/bold]")
    console.print("  [green]1[/green] - Accept (approve and execute)")
    console.print("  [yellow]2[/yellow] - Edit (modify the plan)")
    console.print("  [red]3[/red] - Reject (provide feedback)")
    console.print()

    while True:
        try:
            choice = console.input("[bold]Enter choice (1/2/3):[/bold] ").strip()

            if choice == "1":
                return {"type": "accept"}

            elif choice == "2":
                console.print()
                console.print("[yellow]Enter your modifications (JSON format, or 'cancel' to go back):[/yellow]")
                console.print("[dim]Tip: You can modify chapter order, remove sources, change strategies[/dim]")

                import json
                edit_input = console.input("[bold]Modified plan:[/bold] ").strip()

                if edit_input.lower() == "cancel":
                    continue

                try:
                    edited_args = json.loads(edit_input)
                    return {"type": "edit", "args": {"merge_plan": edited_args}}
                except json.JSONDecodeError:
                    console.print("[red]Invalid JSON. Please try again.[/red]")
                    continue

            elif choice == "3":
                console.print()
                feedback = console.input("[bold]Enter your feedback:[/bold] ").strip()
                if feedback:
                    return {"type": "respond", "args": feedback}
                console.print("[red]Feedback cannot be empty.[/red]")
                continue

            else:
                console.print("[red]Invalid choice. Enter 1, 2, or 3.[/red]")

        except KeyboardInterrupt:
            console.print("\n[yellow]Cancelled[/yellow]")
            return {"type": "respond", "args": "User cancelled the operation"}


def render_compiler_status(status: str, message: str = "") -> Panel:
    """Render compiler agent status panel.

    Args:
        status: Current status ('analyzing', 'planning', 'waiting', 'compiling', 'complete', 'error')
        message: Optional status message
    """
    status_styles = {
        "analyzing": ("[yellow]Analyzing...[/yellow]", "yellow"),
        "planning": ("[yellow]Creating merge plan...[/yellow]", "yellow"),
        "waiting": ("[bold yellow]Waiting for approval[/bold yellow]", "yellow"),
        "compiling": ("[cyan]Compiling manuals...[/cyan]", "cyan"),
        "complete": ("[green]Compilation complete![/green]", "green"),
        "error": ("[red]Error[/red]", "red"),
    }

    content, border = status_styles.get(status, ("[dim]Unknown status[/dim]", "white"))

    if message:
        content = f"{content}\n[dim]{message}[/dim]"

    return Panel(
        content,
        title="[bold]Project Compiler[/bold]",
        border_style=border,
        box=box.ROUNDED,
        padding=(0, 2),
    )
