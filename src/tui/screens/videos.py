"""Videos screen for listing and managing videos."""

from pathlib import Path
from textual.app import ComposeResult
from textual.containers import Vertical
from textual.screen import Screen
from textual.widgets import Button, DataTable, Label, Static
from textual.binding import Binding


class VideosScreen(Screen):
    """Screen for listing available videos."""

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("p", "process_selected", "Process"),
    ]

    CSS = """
    VideosScreen {
        padding: 1;
    }

    #title {
        text-style: bold;
        margin-bottom: 1;
    }

    #videos-table {
        height: 1fr;
    }

    #actions {
        height: auto;
        margin-top: 1;
    }

    #actions Button {
        margin-right: 1;
    }
    """

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id

    def compose(self) -> ComposeResult:
        yield Static("Videos", id="title")
        yield DataTable(id="videos-table", cursor_type="row")
        with Vertical(id="actions"):
            yield Button("Process Selected", id="btn-process", variant="primary")
            yield Button("Refresh", id="btn-refresh")

    def on_mount(self) -> None:
        """Load videos on mount."""
        self._load_videos()

    def _load_videos(self) -> None:
        """Load videos into the table."""
        table = self.query_one("#videos-table", DataTable)
        table.clear(columns=True)
        table.add_columns("Name", "Size", "Modified")

        videos_dir = Path(f"data/users/{self.user_id}/videos")
        if not videos_dir.exists():
            return

        video_extensions = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
        videos = [f for f in videos_dir.iterdir() if f.suffix.lower() in video_extensions]

        for video in sorted(videos, key=lambda x: x.stat().st_mtime, reverse=True):
            stat = video.stat()
            size_mb = stat.st_size / (1024 * 1024)
            modified = Path(video).stat().st_mtime
            from datetime import datetime
            modified_str = datetime.fromtimestamp(modified).strftime("%Y-%m-%d %H:%M")

            table.add_row(video.name, f"{size_mb:.1f} MB", modified_str, key=str(video))

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        if event.button.id == "btn-process":
            self._process_selected()
        elif event.button.id == "btn-refresh":
            self._load_videos()

    def action_refresh(self) -> None:
        """Refresh the video list."""
        self._load_videos()

    def action_process_selected(self) -> None:
        """Process the selected video."""
        self._process_selected()

    def _process_selected(self) -> None:
        """Process the currently selected video."""
        from .process_video import ProcessVideoScreen

        table = self.query_one("#videos-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_at(table.cursor_row)
            if row_key:
                # Get the video path from the row key
                video_path = table.get_row_key(table.cursor_row)
                if video_path:
                    self.app.push_screen(ProcessVideoScreen(self.user_id, video_path=video_path))
