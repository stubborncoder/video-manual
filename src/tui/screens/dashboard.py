"""Dashboard screen with overview and navigation."""

from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, Static, DataTable
from textual.binding import Binding


class DashboardScreen(Screen):
    """Main dashboard with overview and navigation."""

    BINDINGS = [
        Binding("v", "go_videos", "Videos"),
        Binding("m", "go_manuals", "Manuals"),
        Binding("p", "go_projects", "Projects"),
        Binding("n", "new_video", "Process Video"),
    ]

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id

    def compose(self) -> ComposeResult:
        """Compose the dashboard layout."""
        with Container(classes="screen-container"):
            # Welcome section
            with Vertical(id="welcome-section"):
                yield Static(f"Welcome, {self.user_id}", id="welcome-text")

                with Horizontal(id="stats-grid"):
                    with Vertical(classes="stat-card"):
                        yield Static("0", id="stat-videos-val", classes="stat-value")
                        yield Static("Videos", classes="stat-label")
                    with Vertical(classes="stat-card"):
                        yield Static("0", id="stat-manuals-val", classes="stat-value")
                        yield Static("Manuals", classes="stat-label")
                    with Vertical(classes="stat-card"):
                        yield Static("0", id="stat-projects-val", classes="stat-value")
                        yield Static("Projects", classes="stat-label")

            # Main content area
            with Horizontal(id="main-content"):
                # Navigation panel
                with Vertical(id="nav-panel"):
                    yield Static("Navigation", classes="section-title")
                    yield Button("Videos", id="btn-videos", variant="primary")
                    yield Button("Manuals", id="btn-manuals", variant="primary")
                    yield Button("Projects", id="btn-projects", variant="primary")
                    yield Static("", classes="spacer")
                    yield Static("Actions", classes="section-title")
                    yield Button("Process Video", id="btn-process", variant="success")
                    yield Button("Compile Project", id="btn-compile", variant="success")

                # Recent manuals panel
                with Vertical(id="recent-panel"):
                    yield Static("Recent Manuals", classes="section-title")
                    yield DataTable(id="recent-table")

    def on_mount(self) -> None:
        """Load dashboard data."""
        self._load_stats()
        self._load_recent_manuals()

    def _load_stats(self) -> None:
        """Load and display statistics."""
        from ...storage.user_storage import UserStorage
        from ...storage.project_storage import ProjectStorage
        from pathlib import Path

        storage = UserStorage(self.user_id)

        # Count videos
        videos_dir = Path(f"data/users/{self.user_id}/videos")
        video_count = len(list(videos_dir.glob("*.*"))) if videos_dir.exists() else 0
        self.query_one("#stat-videos-val", Static).update(str(video_count))

        # Count manuals
        manuals = storage.list_manuals()
        self.query_one("#stat-manuals-val", Static).update(str(len(manuals)))

        # Count projects
        project_storage = ProjectStorage(self.user_id)
        projects = project_storage.list_projects()
        self.query_one("#stat-projects-val", Static).update(str(len(projects)))

    def _load_recent_manuals(self) -> None:
        """Load recent manuals into the table."""
        from ...storage.user_storage import UserStorage

        table = self.query_one("#recent-table", DataTable)
        table.add_columns("Manual", "Language", "Created")
        table.cursor_type = "row"

        storage = UserStorage(self.user_id)
        manuals = storage.list_manuals()

        sorted_manuals = sorted(
            manuals, key=lambda x: x.get("created_at", ""), reverse=True
        )[:10]

        for manual in sorted_manuals:
            table.add_row(
                manual.get("name", "Unknown"),
                manual.get("language", "en"),
                manual.get("created_at", "")[:10] if manual.get("created_at") else "-",
                key=manual.get("id", ""),
            )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle navigation button presses."""
        button_id = event.button.id

        if button_id == "btn-videos":
            self.action_go_videos()
        elif button_id == "btn-manuals":
            self.action_go_manuals()
        elif button_id == "btn-projects":
            self.action_go_projects()
        elif button_id == "btn-process":
            self.action_new_video()
        elif button_id == "btn-compile":
            from .compile_project import CompileProjectScreen
            self.app.push_screen(CompileProjectScreen(self.user_id))

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        """Handle manual selection."""
        from .view_manual import ViewManualScreen
        row_key = event.row_key
        if row_key:
            self.app.push_screen(ViewManualScreen(self.user_id, str(row_key.value)))

    def action_go_videos(self) -> None:
        """Navigate to videos screen."""
        from .videos import VideosScreen
        self.app.push_screen(VideosScreen(self.user_id))

    def action_go_manuals(self) -> None:
        """Navigate to manuals screen."""
        from .manuals import ManualsScreen
        self.app.push_screen(ManualsScreen(self.user_id))

    def action_go_projects(self) -> None:
        """Navigate to projects screen."""
        from .projects import ProjectsScreen
        self.app.push_screen(ProjectsScreen(self.user_id))

    def action_new_video(self) -> None:
        """Navigate to process video screen."""
        from .process_video import ProcessVideoScreen
        self.app.push_screen(ProcessVideoScreen(self.user_id))
