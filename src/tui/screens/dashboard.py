"""Dashboard screen with overview and navigation."""

from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical, Grid
from textual.screen import Screen
from textual.widgets import Button, Label, Static, DataTable
from textual.binding import Binding


class StatCard(Static):
    """A card displaying a statistic."""

    DEFAULT_CSS = """
    StatCard {
        width: 1fr;
        height: 7;
        border: solid $primary-darken-2;
        padding: 1 2;
    }

    StatCard .stat-value {
        text-style: bold;
        color: $primary;
        text-align: center;
    }

    StatCard .stat-label {
        color: $text-muted;
        text-align: center;
    }
    """

    def __init__(self, label: str, value: str | int, **kwargs):
        super().__init__(**kwargs)
        self.label = label
        self.value = str(value)

    def compose(self) -> ComposeResult:
        yield Static(self.value, classes="stat-value")
        yield Static(self.label, classes="stat-label")

    def update_value(self, value: str | int) -> None:
        """Update the displayed value."""
        self.value = str(value)
        self.query_one(".stat-value", Static).update(self.value)


class DashboardScreen(Screen):
    """Main dashboard with overview and navigation."""

    BINDINGS = [
        Binding("v", "go_videos", "Videos"),
        Binding("m", "go_manuals", "Manuals"),
        Binding("p", "go_projects", "Projects"),
        Binding("n", "new_video", "New Video"),
    ]

    CSS = """
    DashboardScreen {
        padding: 1;
    }

    #welcome {
        text-style: bold;
        margin-bottom: 1;
    }

    #stats-row {
        height: auto;
        margin-bottom: 2;
    }

    #stats-row > StatCard {
        margin-right: 1;
    }

    #nav-grid {
        grid-size: 3;
        grid-gutter: 1;
        height: auto;
        margin-bottom: 2;
    }

    .nav-button {
        height: 5;
    }

    #recent-section {
        height: 1fr;
    }

    #recent-title {
        text-style: bold;
        margin-bottom: 1;
    }

    #recent-table {
        height: 1fr;
    }
    """

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id

    def compose(self) -> ComposeResult:
        """Compose the dashboard layout."""
        yield Static(f"Welcome, {self.user_id}", id="welcome")

        # Stats row
        with Horizontal(id="stats-row"):
            yield StatCard("Videos", "0", id="stat-videos")
            yield StatCard("Manuals", "0", id="stat-manuals")
            yield StatCard("Projects", "0", id="stat-projects")

        # Navigation buttons
        with Grid(id="nav-grid"):
            yield Button("Videos", id="btn-videos", classes="nav-button", variant="primary")
            yield Button("Manuals", id="btn-manuals", classes="nav-button", variant="primary")
            yield Button("Projects", id="btn-projects", classes="nav-button", variant="primary")
            yield Button("Process Video", id="btn-process", classes="nav-button", variant="success")
            yield Button("Compile Project", id="btn-compile", classes="nav-button", variant="success")
            yield Button("Settings", id="btn-settings", classes="nav-button")

        # Recent activity
        with Vertical(id="recent-section"):
            yield Static("Recent Manuals", id="recent-title")
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
        self.query_one("#stat-videos", StatCard).update_value(video_count)

        # Count manuals
        manuals = storage.list_manuals()
        self.query_one("#stat-manuals", StatCard).update_value(len(manuals))

        # Count projects
        project_storage = ProjectStorage(self.user_id)
        projects = project_storage.list_projects()
        self.query_one("#stat-projects", StatCard).update_value(len(projects))

    def _load_recent_manuals(self) -> None:
        """Load recent manuals into the table."""
        from ...storage.user_storage import UserStorage

        table = self.query_one("#recent-table", DataTable)
        table.add_columns("Manual", "Language", "Created")

        storage = UserStorage(self.user_id)
        manuals = storage.list_manuals()

        # Sort by date (newest first) and take top 10
        sorted_manuals = sorted(
            manuals, key=lambda x: x.get("created_at", ""), reverse=True
        )[:10]

        for manual in sorted_manuals:
            table.add_row(
                manual.get("name", "Unknown"),
                manual.get("language", "en"),
                manual.get("created_at", "")[:10] if manual.get("created_at") else "-",
            )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle navigation button presses."""
        from .videos import VideosScreen
        from .manuals import ManualsScreen
        from .projects import ProjectsScreen
        from .process_video import ProcessVideoScreen
        from .compile_project import CompileProjectScreen

        button_id = event.button.id

        if button_id == "btn-videos":
            self.app.push_screen(VideosScreen(self.user_id))
        elif button_id == "btn-manuals":
            self.app.push_screen(ManualsScreen(self.user_id))
        elif button_id == "btn-projects":
            self.app.push_screen(ProjectsScreen(self.user_id))
        elif button_id == "btn-process":
            self.app.push_screen(ProcessVideoScreen(self.user_id))
        elif button_id == "btn-compile":
            self.app.push_screen(CompileProjectScreen(self.user_id))

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
