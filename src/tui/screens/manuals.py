"""Manuals screen for listing generated manuals."""

from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, DataTable, Static
from textual.binding import Binding


class ManualsScreen(Screen):
    """Screen for listing generated manuals."""

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("enter", "view_selected", "View"),
        Binding("escape", "go_back", "Back", priority=True),
    ]

    def __init__(self, user_id: str):
        super().__init__()
        self.user_id = user_id

    def compose(self) -> ComposeResult:
        with Container(classes="screen-container"):
            with Horizontal(classes="page-header"):
                yield Button("< Back", classes="back-btn", id="btn-back")
                yield Static("Manuals", classes="title")

            with Vertical(classes="content-area"):
                yield DataTable(id="manuals-table", cursor_type="row")

            with Horizontal(classes="button-bar"):
                yield Button("View", id="btn-view", variant="primary")
                yield Button("Refresh", id="btn-refresh")

    def on_mount(self) -> None:
        self._load_manuals()

    def _load_manuals(self) -> None:
        """Load manuals into the table."""
        from ...storage.user_storage import UserStorage

        table = self.query_one("#manuals-table", DataTable)
        table.clear(columns=True)
        table.add_columns("Name", "Language", "Screenshots", "Created")

        storage = UserStorage(self.user_id)
        manuals = storage.list_manuals()

        for manual in sorted(manuals, key=lambda x: x.get("created_at", ""), reverse=True):
            table.add_row(
                manual.get("name", "Unknown"),
                manual.get("language", "en"),
                str(manual.get("screenshot_count", 0)),
                manual.get("created_at", "")[:10] if manual.get("created_at") else "-",
                key=manual.get("id", ""),
            )

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-back":
            self.app.pop_screen()
        elif event.button.id == "btn-view":
            self._view_selected()
        elif event.button.id == "btn-refresh":
            self._load_manuals()

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        self._view_selected()

    def action_refresh(self) -> None:
        self._load_manuals()

    def action_go_back(self) -> None:
        self.app.pop_screen()

    def action_view_selected(self) -> None:
        self._view_selected()

    def _view_selected(self) -> None:
        from .view_manual import ViewManualScreen

        table = self.query_one("#manuals-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.app.push_screen(ViewManualScreen(self.user_id, str(row_key.value)))
