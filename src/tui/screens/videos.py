"""Videos screen for listing and managing videos."""

from pathlib import Path
from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, DataTable, Static
from textual.binding import Binding


class VideosScreen(Screen):
    """Screen for listing available videos."""

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("p", "process_selected", "Process"),
        Binding("escape", "go_back", "Back", priority=True),
    ]

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id

    def compose(self) -> ComposeResult:
        with Container(classes="screen-container"):
            # Header with back button
            with Horizontal(classes="page-header"):
                yield Button("< Back", classes="back-btn", id="btn-back")
                yield Static("Videos", classes="title")

            # Content
            with Vertical(classes="content-area"):
                yield DataTable(id="videos-table", cursor_type="row")

            # Button bar
            with Horizontal(classes="button-bar"):
                yield Button("Process Selected", id="btn-process", variant="success")
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
            from datetime import datetime
            modified_str = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
            table.add_row(video.name, f"{size_mb:.1f} MB", modified_str, key=str(video))

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        if event.button.id == "btn-back":
            self.app.pop_screen()
        elif event.button.id == "btn-process":
            self._process_selected()
        elif event.button.id == "btn-refresh":
            self._load_videos()

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        """Handle double-click to process."""
        self._process_selected()

    def action_refresh(self) -> None:
        self._load_videos()

    def action_go_back(self) -> None:
        self.app.pop_screen()

    def action_process_selected(self) -> None:
        self._process_selected()

    def _process_selected(self) -> None:
        """Process the currently selected video."""
        from .process_video import ProcessVideoScreen

        table = self.query_one("#videos-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.app.push_screen(ProcessVideoScreen(self.user_id, video_path=str(row_key.value)))
