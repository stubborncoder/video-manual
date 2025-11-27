"""Project detail screen for viewing project structure."""

from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Button, DataTable, Static, Tree
from textual.widgets.tree import TreeNode
from textual.binding import Binding


class ProjectDetailScreen(Screen):
    """Screen for viewing project details and structure."""

    BINDINGS = [
        Binding("c", "compile", "Compile"),
        Binding("r", "refresh", "Refresh"),
    ]

    CSS = """
    ProjectDetailScreen {
        padding: 1;
    }

    #header {
        height: auto;
        margin-bottom: 1;
    }

    #title {
        text-style: bold;
    }

    #project-info {
        color: $text-muted;
        margin-left: 2;
    }

    #content {
        height: 1fr;
    }

    #structure-tree {
        width: 1fr;
        border: solid $surface-lighten-2;
        padding: 1;
    }

    #manuals-panel {
        width: 1fr;
        margin-left: 1;
    }

    #manuals-title {
        text-style: bold;
        margin-bottom: 1;
    }

    #manuals-table {
        height: 1fr;
        border: solid $surface-lighten-2;
    }

    #actions {
        height: auto;
        margin-top: 1;
    }

    #actions Button {
        margin-right: 1;
    }
    """

    def __init__(self, user_id: str, project_id: str):
        super().__init__()
        self.user_id = user_id
        self.project_id = project_id
        self.project = None

    def compose(self) -> ComposeResult:
        with Horizontal(id="header"):
            yield Static("Project", id="title")
            yield Static("", id="project-info")

        with Horizontal(id="content"):
            yield Tree("Chapters", id="structure-tree")
            with Vertical(id="manuals-panel"):
                yield Static("Manuals in Project", id="manuals-title")
                yield DataTable(id="manuals-table", cursor_type="row")

        with Horizontal(id="actions"):
            yield Button("Compile", id="btn-compile", variant="success")
            yield Button("Add Manual", id="btn-add-manual")
            yield Button("Add Chapter", id="btn-add-chapter")
            yield Button("Refresh", id="btn-refresh")

    def on_mount(self) -> None:
        """Load project data on mount."""
        self._load_project()

    def _load_project(self) -> None:
        """Load project data."""
        from ...storage.project_storage import ProjectStorage

        storage = ProjectStorage(self.user_id)
        self.project = storage.get_project(self.project_id)

        if not self.project:
            self.notify("Project not found", severity="error")
            self.app.pop_screen()
            return

        # Update header
        self.query_one("#title", Static).update(f"Project: {self.project['name']}")
        self.query_one("#project-info", Static).update(
            f"ID: {self.project_id} | Created: {self.project.get('created_at', '')[:10]}"
        )

        # Load structure tree
        self._load_structure()

        # Load manuals table
        self._load_manuals()

    def _load_structure(self) -> None:
        """Load project structure into tree."""
        tree = self.query_one("#structure-tree", Tree)
        tree.clear()

        if not self.project:
            return

        tree.root.label = self.project["name"]
        tree.root.expand()

        for chapter in self.project.get("chapters", []):
            chapter_node = tree.root.add(chapter.get("name", "Unnamed Chapter"))
            chapter_node.data = {"type": "chapter", "id": chapter.get("id")}

            for manual_id in chapter.get("manuals", []):
                manual_node = chapter_node.add(manual_id)
                manual_node.data = {"type": "manual", "id": manual_id}
                manual_node.allow_expand = False

    def _load_manuals(self) -> None:
        """Load manuals into table."""
        from ...storage.user_storage import UserStorage

        table = self.query_one("#manuals-table", DataTable)
        table.clear(columns=True)
        table.add_columns("Manual", "Chapter", "Language")

        if not self.project:
            return

        storage = UserStorage(self.user_id)

        for chapter in self.project.get("chapters", []):
            for manual_id in chapter.get("manuals", []):
                # Get manual info
                manual_info = storage.get_manual_info(manual_id)
                table.add_row(
                    manual_info.get("name", manual_id) if manual_info else manual_id,
                    chapter.get("name", "Unknown"),
                    manual_info.get("language", "en") if manual_info else "-",
                    key=manual_id,
                )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        if event.button.id == "btn-compile":
            self._compile()
        elif event.button.id == "btn-refresh":
            self._load_project()

    def action_compile(self) -> None:
        """Compile the project."""
        self._compile()

    def action_refresh(self) -> None:
        """Refresh project data."""
        self._load_project()

    def _compile(self) -> None:
        """Navigate to compile screen."""
        from .compile_project import CompileProjectScreen
        self.app.push_screen(CompileProjectScreen(self.user_id, self.project_id))
