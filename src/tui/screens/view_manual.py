"""View manual screen for displaying manual content."""

from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, Markdown, Static, Select
from textual.binding import Binding


class ViewManualScreen(Screen):
    """Screen for viewing a manual's content."""

    BINDINGS = [
        Binding("e", "export", "Export"),
        Binding("escape", "go_back", "Back", priority=True),
    ]

    def __init__(self, user_id: str, manual_id: str):
        super().__init__()
        self.user_id = user_id
        self.manual_id = manual_id
        self.current_language = "en"

    def compose(self) -> ComposeResult:
        with Container(classes="screen-container"):
            with Horizontal(id="manual-toolbar"):
                yield Button("< Back", classes="back-btn", id="btn-back")
                yield Static("Manual", id="manual-title", classes="title")
                yield Select(
                    [("en", "en")],
                    id="lang-select",
                    value="en",
                )

            yield Markdown(id="manual-content")

            with Horizontal(classes="button-bar"):
                yield Button("Export PDF", id="btn-pdf", variant="primary")
                yield Button("Export Word", id="btn-word")
                yield Button("Export HTML", id="btn-html")

    def on_mount(self) -> None:
        self._load_languages()
        self._load_content()

    def _load_languages(self) -> None:
        from ...storage.user_storage import UserStorage

        storage = UserStorage(self.user_id)
        languages = storage.get_manual_languages(self.manual_id)

        select = self.query_one("#lang-select", Select)
        select.set_options([(lang, lang) for lang in languages])
        if languages:
            self.current_language = languages[0]
            select.value = self.current_language

    def _load_content(self) -> None:
        from ...storage.user_storage import UserStorage

        storage = UserStorage(self.user_id)
        content = storage.get_manual_content(self.manual_id, self.current_language)

        markdown = self.query_one("#manual-content", Markdown)
        if content:
            markdown.update(content)
            self.query_one("#manual-title", Static).update(f"Manual: {self.manual_id}")
        else:
            markdown.update("*No content available*")

    def on_select_changed(self, event: Select.Changed) -> None:
        if event.select.id == "lang-select" and event.value:
            self.current_language = str(event.value)
            self._load_content()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-back":
            self.app.pop_screen()
        elif event.button.id == "btn-pdf":
            self._export("pdf")
        elif event.button.id == "btn-word":
            self._export("docx")
        elif event.button.id == "btn-html":
            self._export("html")

    def action_go_back(self) -> None:
        self.app.pop_screen()

    def action_export(self) -> None:
        self._export("pdf")

    def _export(self, format: str) -> None:
        try:
            from ...export import export_manual
            output_path = export_manual(
                self.user_id,
                self.manual_id,
                format=format,
                language=self.current_language,
            )
            self.notify(f"Exported to {output_path}", title="Success")
        except Exception as e:
            self.notify(f"Export failed: {e}", severity="error")
