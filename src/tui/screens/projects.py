"""Projects screen for listing and managing projects."""

from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Button, DataTable, Static, Input
from textual.binding import Binding


class ProjectsScreen(Screen):
    """Screen for listing and managing projects."""

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("n", "new_project", "New"),
        Binding("enter", "view_selected", "View"),
    ]

    CSS = """
    ProjectsScreen {
        padding: 1;
    }

    #title {
        text-style: bold;
        margin-bottom: 1;
    }

    #projects-table {
        height: 1fr;
    }

    #actions {
        height: auto;
        margin-top: 1;
    }

    #actions Button {
        margin-right: 1;
    }

    #new-project-form {
        display: none;
        height: auto;
        margin-top: 1;
        padding: 1;
        border: solid $primary;
    }

    #new-project-form.visible {
        display: block;
    }

    #new-project-input {
        width: 50;
    }
    """

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id

    def compose(self) -> ComposeResult:
        yield Static("Projects", id="title")
        yield DataTable(id="projects-table", cursor_type="row")

        with Horizontal(id="actions"):
            yield Button("View", id="btn-view", variant="primary")
            yield Button("Compile", id="btn-compile", variant="success")
            yield Button("New Project", id="btn-new")
            yield Button("Refresh", id="btn-refresh")

        with Vertical(id="new-project-form"):
            yield Static("New Project")
            yield Input(placeholder="Project name...", id="new-project-input")
            yield Button("Create", id="btn-create", variant="primary")

    def on_mount(self) -> None:
        """Load projects on mount."""
        self._load_projects()

    def _load_projects(self) -> None:
        """Load projects into the table."""
        from ...storage.project_storage import ProjectStorage

        table = self.query_one("#projects-table", DataTable)
        table.clear(columns=True)
        table.add_columns("Name", "Chapters", "Manuals", "Created")

        storage = ProjectStorage(self.user_id)
        projects = storage.list_projects()

        for project in sorted(projects, key=lambda x: x.get("created_at", ""), reverse=True):
            table.add_row(
                project.get("name", "Unknown"),
                str(len(project.get("chapters", []))),
                str(project.get("manual_count", 0)),
                project.get("created_at", "")[:10] if project.get("created_at") else "-",
                key=project.get("id", ""),
            )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        if event.button.id == "btn-view":
            self._view_selected()
        elif event.button.id == "btn-compile":
            self._compile_selected()
        elif event.button.id == "btn-new":
            self._toggle_new_form()
        elif event.button.id == "btn-create":
            self._create_project()
        elif event.button.id == "btn-refresh":
            self._load_projects()

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        """Handle row double-click."""
        self._view_selected()

    def action_refresh(self) -> None:
        """Refresh the project list."""
        self._load_projects()

    def action_new_project(self) -> None:
        """Show new project form."""
        self._toggle_new_form()

    def action_view_selected(self) -> None:
        """View the selected project."""
        self._view_selected()

    def _toggle_new_form(self) -> None:
        """Toggle the new project form visibility."""
        form = self.query_one("#new-project-form", Vertical)
        form.toggle_class("visible")
        if form.has_class("visible"):
            self.query_one("#new-project-input", Input).focus()

    def _create_project(self) -> None:
        """Create a new project."""
        from ...storage.project_storage import ProjectStorage

        input_widget = self.query_one("#new-project-input", Input)
        name = input_widget.value.strip()

        if not name:
            self.notify("Please enter a project name", severity="error")
            return

        storage = ProjectStorage(self.user_id)
        project_id = storage.create_project(name)

        input_widget.value = ""
        self._toggle_new_form()
        self._load_projects()
        self.notify(f"Project '{name}' created", title="Success")

    def _view_selected(self) -> None:
        """View the currently selected project."""
        from .project_detail import ProjectDetailScreen

        table = self.query_one("#projects-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.app.push_screen(ProjectDetailScreen(self.user_id, str(row_key)))

    def _compile_selected(self) -> None:
        """Compile the selected project."""
        from .compile_project import CompileProjectScreen

        table = self.query_one("#projects-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.app.push_screen(CompileProjectScreen(self.user_id, str(row_key)))
