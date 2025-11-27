"""Project detail screen for viewing project structure."""

from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, DataTable, Static, Tree
from textual.binding import Binding


class ProjectDetailScreen(Screen):
    """Screen for viewing project details and structure."""

    BINDINGS = [
        Binding("c", "compile", "Compile"),
        Binding("r", "refresh", "Refresh"),
        Binding("escape", "go_back", "Back", priority=True),
    ]

    def __init__(self, user_id: str, project_id: str):
        super().__init__()
        self.user_id = user_id
        self.project_id = project_id
        self.project = None

    def compose(self) -> ComposeResult:
        with Container(classes="screen-container"):
            with Horizontal(classes="page-header"):
                yield Button("< Back", classes="back-btn", id="btn-back")
                yield Static("Project Details", id="project-title", classes="title")

            with Horizontal(classes="content-area"):
                with Vertical(id="tree-panel"):
                    yield Static("Structure", classes="section-title")
                    yield Tree("Project", id="project-tree")

                with Vertical(id="manuals-panel"):
                    yield Static("Manuals", classes="section-title")
                    yield DataTable(id="manuals-table", cursor_type="row")

            with Horizontal(classes="button-bar"):
                yield Button("Compile", id="btn-compile", variant="success")
                yield Button("Add Manual", id="btn-add-manual")
                yield Button("Refresh", id="btn-refresh")

    def on_mount(self) -> None:
        self._load_project()

    def _load_project(self) -> None:
        from ...storage.project_storage import ProjectStorage

        storage = ProjectStorage(self.user_id)
        self.project = storage.get_project(self.project_id)

        if not self.project:
            self.notify("Project not found", severity="error")
            self.app.pop_screen()
            return

        self.query_one("#project-title", Static).update(f"Project: {self.project['name']}")
        self._load_structure()
        self._load_manuals()

    def _load_structure(self) -> None:
        tree = self.query_one("#project-tree", Tree)
        tree.clear()

        if not self.project:
            return

        tree.root.label = self.project["name"]
        tree.root.expand()

        for chapter in self.project.get("chapters", []):
            chapter_node = tree.root.add(chapter.get("name", "Unnamed"))
            for manual_id in chapter.get("manuals", []):
                chapter_node.add_leaf(manual_id)

    def _load_manuals(self) -> None:
        from ...storage.user_storage import UserStorage

        table = self.query_one("#manuals-table", DataTable)
        table.clear(columns=True)
        table.add_columns("Manual", "Chapter")

        if not self.project:
            return

        storage = UserStorage(self.user_id)

        for chapter in self.project.get("chapters", []):
            for manual_id in chapter.get("manuals", []):
                manual_info = storage.get_manual_info(manual_id)
                table.add_row(
                    manual_info.get("name", manual_id) if manual_info else manual_id,
                    chapter.get("name", "Unknown"),
                    key=manual_id,
                )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-back":
            self.app.pop_screen()
        elif event.button.id == "btn-compile":
            self._compile()
        elif event.button.id == "btn-refresh":
            self._load_project()

    def action_go_back(self) -> None:
        self.app.pop_screen()

    def action_compile(self) -> None:
        self._compile()

    def action_refresh(self) -> None:
        self._load_project()

    def _compile(self) -> None:
        from .compile_project import CompileProjectScreen
        self.app.push_screen(CompileProjectScreen(self.user_id, self.project_id))
