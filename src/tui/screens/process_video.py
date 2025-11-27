"""Process video screen with streaming progress display."""

from pathlib import Path
from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, Static, Select, DataTable, Label
from textual.binding import Binding
from textual.worker import Worker, get_current_worker

from ..widgets.node_progress import NodeProgressWidget
from ...core.events import (
    NodeStartedEvent,
    NodeCompletedEvent,
    ErrorEvent,
    CompleteEvent,
)
from ...core.runners import VideoManualRunner, VIDEO_MANUAL_NODES


class ProcessVideoScreen(Screen):
    """Screen for processing a video into a manual."""

    BINDINGS = [
        Binding("escape", "go_back", "Back/Cancel", priority=True),
    ]

    def __init__(self, user_id: str, video_path: str | None = None):
        super().__init__()
        self.user_id = user_id
        self.initial_video_path = video_path
        self.selected_video: Path | None = None
        self.is_processing = False
        self._worker: Worker | None = None

    def compose(self) -> ComposeResult:
        with Container(classes="screen-container"):
            with Horizontal(classes="page-header"):
                yield Button("< Back", classes="back-btn", id="btn-back")
                yield Static("Process Video", classes="title")

            # Video selection
            with Vertical(id="selection-area", classes="content-area"):
                yield Static("Select a video:", classes="section-title")
                yield DataTable(id="videos-table", cursor_type="row")

                with Horizontal(id="video-options"):
                    yield Label("Language:")
                    yield Select(
                        [
                            ("English", "English"),
                            ("Spanish", "Spanish"),
                            ("French", "French"),
                            ("German", "German"),
                            ("Portuguese", "Portuguese"),
                        ],
                        id="lang-select",
                        value="English",
                    )

            # Progress section (hidden initially)
            with Vertical(id="progress-area"):
                yield NodeProgressWidget(
                    title="Processing",
                    nodes=VIDEO_MANUAL_NODES,
                    id="node-progress",
                )
                yield Static("", id="status-msg")

            with Horizontal(classes="button-bar"):
                yield Button("Process", id="btn-process", variant="success")
                yield Button("Cancel", id="btn-cancel", variant="error")

    def on_mount(self) -> None:
        self._load_videos()
        self.query_one("#progress-area").display = False

        if self.initial_video_path:
            self.selected_video = Path(self.initial_video_path)
            self._start_processing()

    def _load_videos(self) -> None:
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
        if event.button.id == "btn-back":
            self._go_back()
        elif event.button.id == "btn-process":
            self._start_processing()
        elif event.button.id == "btn-cancel":
            self._cancel()

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        # Double-click to process
        table = self.query_one("#videos-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.selected_video = Path(str(row_key.value))
                self._start_processing()

    def action_go_back(self) -> None:
        self._go_back()

    def _go_back(self) -> None:
        if self.is_processing and self._worker:
            self._worker.cancel()
            self.is_processing = False
        self.app.pop_screen()

    def _cancel(self) -> None:
        self._go_back()

    def _start_processing(self) -> None:
        if self.is_processing:
            return

        # Get selected video
        if not self.selected_video:
            table = self.query_one("#videos-table", DataTable)
            if table.cursor_row is not None:
                row_key = table.get_row_key(table.cursor_row)
                if row_key:
                    self.selected_video = Path(str(row_key.value))

        if not self.selected_video or not self.selected_video.exists():
            self.notify("Please select a video", severity="error")
            return

        language = str(self.query_one("#lang-select", Select).value)

        # Show progress, hide selection
        self.query_one("#selection-area").display = False
        self.query_one("#progress-area").display = True

        progress = self.query_one("#node-progress", NodeProgressWidget)
        progress.reset()

        status = self.query_one("#status-msg", Static)
        status.update(f"Processing: {self.selected_video.name}")
        status.remove_class("success-message", "error-message")

        self.is_processing = True

        self._worker = self.run_worker(
            self._process_video(self.selected_video, language),
            name="process_video",
            exclusive=True,
        )

    async def _process_video(self, video_path: Path, language: str) -> None:
        runner = VideoManualRunner(self.user_id)
        progress = self.query_one("#node-progress", NodeProgressWidget)
        status = self.query_one("#status-msg", Static)

        try:
            for event in runner.run(video_path=video_path, output_language=language):
                worker = get_current_worker()
                if worker.is_cancelled:
                    break

                if isinstance(event, NodeStartedEvent):
                    self.call_from_thread(progress.start_node, event.node_name)

                elif isinstance(event, NodeCompletedEvent):
                    display_details = {}
                    if event.details.get("duration"):
                        display_details["Duration"] = event.details["duration"]
                    if event.details.get("resolution"):
                        display_details["Resolution"] = event.details["resolution"]
                    if event.details.get("keyframes_count"):
                        display_details["Keyframes"] = str(event.details["keyframes_count"])
                    if event.details.get("screenshots_count"):
                        display_details["Screenshots"] = str(event.details["screenshots_count"])

                    self.call_from_thread(progress.complete_node, event.node_name, display_details)

                elif isinstance(event, ErrorEvent):
                    self.call_from_thread(self._show_error, event.error_message)
                    return

                elif isinstance(event, CompleteEvent):
                    self.call_from_thread(self._show_complete, event.result)
                    return

        except Exception as e:
            self.call_from_thread(self._show_error, str(e))

    def _show_error(self, error: str) -> None:
        self.is_processing = False
        status = self.query_one("#status-msg", Static)
        status.update(f"Error: {error}")
        status.add_class("error-message")
        self.notify(f"Processing failed: {error}", severity="error")

    def _show_complete(self, result: dict) -> None:
        self.is_processing = False
        status = self.query_one("#status-msg", Static)
        manual_path = result.get("manual_path", "Unknown")
        screenshot_count = len(result.get("screenshots", []))
        status.update(f"Complete! {screenshot_count} screenshots saved.")
        status.add_class("success-message")
        self.notify("Manual generated successfully!", title="Complete")
