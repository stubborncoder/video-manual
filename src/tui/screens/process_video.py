"""Process video screen with streaming progress display."""

from pathlib import Path
from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Button, Input, Static, Select, DataTable
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
        Binding("escape", "cancel", "Cancel"),
    ]

    CSS = """
    ProcessVideoScreen {
        padding: 1;
    }

    #title {
        text-style: bold;
        margin-bottom: 1;
    }

    #video-selection {
        height: auto;
        margin-bottom: 1;
    }

    #video-selection.hidden {
        display: none;
    }

    #videos-table {
        height: 15;
        margin-bottom: 1;
    }

    #options-row {
        height: auto;
        margin-bottom: 1;
    }

    #options-row Label {
        margin-right: 1;
    }

    #language-select {
        width: 20;
        margin-right: 2;
    }

    #progress-section {
        display: none;
        height: auto;
    }

    #progress-section.visible {
        display: block;
    }

    #node-progress {
        margin-bottom: 1;
    }

    #status-message {
        height: auto;
        margin-top: 1;
    }

    #status-message.success {
        color: $success;
    }

    #status-message.error {
        color: $error;
    }

    #actions {
        height: auto;
        margin-top: 1;
    }

    #actions Button {
        margin-right: 1;
    }
    """

    def __init__(self, user_id: str, video_path: str | None = None):
        super().__init__()
        self.user_id = user_id
        self.initial_video_path = video_path
        self.selected_video: Path | None = None
        self.is_processing = False
        self._worker: Worker | None = None

    def compose(self) -> ComposeResult:
        yield Static("Process Video", id="title")

        with Vertical(id="video-selection"):
            yield Static("Select a video to process:")
            yield DataTable(id="videos-table", cursor_type="row")

            with Horizontal(id="options-row"):
                yield Static("Language:")
                yield Select(
                    [
                        ("English", "English"),
                        ("Spanish", "Spanish"),
                        ("French", "French"),
                        ("German", "German"),
                        ("Portuguese", "Portuguese"),
                    ],
                    id="language-select",
                    value="English",
                )

        with Vertical(id="progress-section"):
            yield NodeProgressWidget(
                title="Processing Video",
                nodes=VIDEO_MANUAL_NODES,
                id="node-progress",
            )
            yield Static("", id="status-message")

        with Horizontal(id="actions"):
            yield Button("Process", id="btn-process", variant="success")
            yield Button("Cancel", id="btn-cancel", variant="error")

    def on_mount(self) -> None:
        """Load videos and set initial selection."""
        self._load_videos()

        if self.initial_video_path:
            self.selected_video = Path(self.initial_video_path)
            self._start_processing()

    def _load_videos(self) -> None:
        """Load available videos."""
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
        if event.button.id == "btn-process":
            self._start_processing()
        elif event.button.id == "btn-cancel":
            self._cancel_processing()

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        """Handle video selection."""
        table = self.query_one("#videos-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.selected_video = Path(str(row_key))

    def _start_processing(self) -> None:
        """Start video processing."""
        if self.is_processing:
            return

        # Get selected video
        if not self.selected_video:
            table = self.query_one("#videos-table", DataTable)
            if table.cursor_row is not None:
                row_key = table.get_row_key(table.cursor_row)
                if row_key:
                    self.selected_video = Path(str(row_key))

        if not self.selected_video or not self.selected_video.exists():
            self.notify("Please select a video", severity="error")
            return

        # Get language
        language = str(self.query_one("#language-select", Select).value)

        # Show progress section
        self.query_one("#video-selection").add_class("hidden")
        self.query_one("#progress-section").add_class("visible")

        # Reset progress widget
        progress = self.query_one("#node-progress", NodeProgressWidget)
        progress.reset()

        # Update status
        status = self.query_one("#status-message", Static)
        status.update(f"Processing: {self.selected_video.name}")
        status.remove_class("success", "error")

        self.is_processing = True

        # Start worker
        self._worker = self.run_worker(
            self._process_video(self.selected_video, language),
            name="process_video",
            exclusive=True,
        )

    async def _process_video(self, video_path: Path, language: str) -> None:
        """Process video in background worker."""
        runner = VideoManualRunner(self.user_id)
        progress = self.query_one("#node-progress", NodeProgressWidget)
        status = self.query_one("#status-message", Static)

        try:
            for event in runner.run(
                video_path=video_path,
                output_language=language,
            ):
                worker = get_current_worker()
                if worker.is_cancelled:
                    break

                if isinstance(event, NodeStartedEvent):
                    self.call_from_thread(progress.start_node, event.node_name)

                elif isinstance(event, NodeCompletedEvent):
                    # Format details for display
                    display_details = {}
                    if event.details.get("duration"):
                        display_details["Duration"] = event.details["duration"]
                    if event.details.get("resolution"):
                        display_details["Resolution"] = event.details["resolution"]
                    if event.details.get("keyframes_count"):
                        display_details["Keyframes"] = str(event.details["keyframes_count"])
                    if event.details.get("screenshots_count"):
                        display_details["Screenshots"] = str(event.details["screenshots_count"])

                    self.call_from_thread(
                        progress.complete_node, event.node_name, display_details
                    )

                elif isinstance(event, ErrorEvent):
                    self.call_from_thread(self._show_error, event.error_message)
                    return

                elif isinstance(event, CompleteEvent):
                    self.call_from_thread(self._show_complete, event.result)
                    return

        except Exception as e:
            self.call_from_thread(self._show_error, str(e))

    def _show_error(self, error: str) -> None:
        """Show error state."""
        self.is_processing = False
        status = self.query_one("#status-message", Static)
        status.update(f"Error: {error}")
        status.add_class("error")
        self.notify(f"Processing failed: {error}", severity="error")

    def _show_complete(self, result: dict) -> None:
        """Show completion state."""
        self.is_processing = False
        status = self.query_one("#status-message", Static)

        manual_path = result.get("manual_path", "Unknown")
        screenshot_count = len(result.get("screenshots", []))

        status.update(f"Complete! Manual saved to {manual_path} ({screenshot_count} screenshots)")
        status.add_class("success")
        self.notify("Manual generated successfully!", title="Complete")

    def _cancel_processing(self) -> None:
        """Cancel processing or go back."""
        if self.is_processing and self._worker:
            self._worker.cancel()
            self.is_processing = False
            self.notify("Processing cancelled")

        self.app.pop_screen()

    def action_cancel(self) -> None:
        """Cancel action."""
        self._cancel_processing()
