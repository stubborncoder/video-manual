"""Projects screen for listing and managing projects."""

from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, DataTable, Static, Input
from textual.binding import Binding


class ProjectsScreen(Screen):
    """Screen for listing and managing projects."""

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("n", "new_project", "New"),
        Binding("enter", "view_selected", "View"),
        Binding("escape", "go_back", "Back", priority=True),
    ]

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id
        self._show_new_form = False

    def compose(self) -> ComposeResult:
        with Container(classes="screen-container"):
            with Horizontal(classes="page-header"):
                yield Button("< Back", classes="back-btn", id="btn-back")
                yield Static("Projects", classes="title")

            with Vertical(classes="content-area"):
                yield DataTable(id="projects-table", cursor_type="row")

                # New project form (hidden by default)
                with Vertical(id="new-form", classes="card"):
                    yield Static("Create New Project", classes="card-title")
                    yield Input(placeholder="Project name...", id="new-name")
                    yield Button("Create", id="btn-create", variant="success")

            with Horizontal(classes="button-bar"):
                yield Button("View", id="btn-view", variant="primary")
                yield Button("Compile", id="btn-compile", variant="success")
                yield Button("New Project", id="btn-new")
                yield Button("Refresh", id="btn-refresh")

    def on_mount(self) -> None:
        self._load_projects()
        self.query_one("#new-form").display = False

    def _load_projects(self) -> None:
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
        if event.button.id == "btn-back":
            self.app.pop_screen()
        elif event.button.id == "btn-view":
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
        self._view_selected()

    def action_refresh(self) -> None:
        self._load_projects()

    def action_go_back(self) -> None:
        self.app.pop_screen()

    def action_new_project(self) -> None:
        self._toggle_new_form()

    def action_view_selected(self) -> None:
        self._view_selected()

    def _toggle_new_form(self) -> None:
        form = self.query_one("#new-form")
        form.display = not form.display
        if form.display:
            self.query_one("#new-name", Input).focus()

    def _create_project(self) -> None:
        from ...storage.project_storage import ProjectStorage

        name = self.query_one("#new-name", Input).value.strip()
        if not name:
            self.notify("Please enter a project name", severity="error")
            return

        storage = ProjectStorage(self.user_id)
        storage.create_project(name)

        self.query_one("#new-name", Input).value = ""
        self._toggle_new_form()
        self._load_projects()
        self.notify(f"Project '{name}' created")

    def _view_selected(self) -> None:
        from .project_detail import ProjectDetailScreen

        table = self.query_one("#projects-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.app.push_screen(ProjectDetailScreen(self.user_id, str(row_key.value)))

    def _compile_selected(self) -> None:
        from .compile_project import CompileProjectScreen

        table = self.query_one("#projects-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.app.push_screen(CompileProjectScreen(self.user_id, str(row_key.value)))
