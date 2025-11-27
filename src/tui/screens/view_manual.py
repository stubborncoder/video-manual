"""View manual screen for displaying manual content."""

from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Button, Markdown, Static, Select
from textual.binding import Binding


class ViewManualScreen(Screen):
    """Screen for viewing a manual's content."""

    BINDINGS = [
        Binding("e", "export", "Export"),
    ]

    CSS = """
    ViewManualScreen {
        padding: 1;
    }

    #header {
        height: auto;
        margin-bottom: 1;
    }

    #title {
        text-style: bold;
    }

    #language-select {
        width: 20;
        margin-left: 2;
    }

    #content {
        height: 1fr;
        border: solid $surface-lighten-2;
        padding: 1;
        overflow-y: auto;
    }

    #actions {
        height: auto;
        margin-top: 1;
    }

    #actions Button {
        margin-right: 1;
    }
    """

    def __init__(self, user_id: str, manual_id: str):
        super().__init__()
        self.user_id = user_id
        self.manual_id = manual_id
        self.current_language = "en"

    def compose(self) -> ComposeResult:
        with Horizontal(id="header"):
            yield Static("Manual", id="title")
            yield Select(
                [(lang, lang) for lang in ["en"]],  # Will be populated
                id="language-select",
                value="en",
            )

        yield Markdown(id="content")

        with Horizontal(id="actions"):
            yield Button("Export PDF", id="btn-export-pdf", variant="primary")
            yield Button("Export Word", id="btn-export-word")
            yield Button("Export HTML", id="btn-export-html")

    def on_mount(self) -> None:
        """Load manual content on mount."""
        self._load_languages()
        self._load_content()

    def _load_languages(self) -> None:
        """Load available languages for this manual."""
        from ...storage.user_storage import UserStorage

        storage = UserStorage(self.user_id)
        languages = storage.get_manual_languages(self.manual_id)

        select = self.query_one("#language-select", Select)
        select.set_options([(lang, lang) for lang in languages])
        if languages:
            self.current_language = languages[0]
            select.value = self.current_language

    def _load_content(self) -> None:
        """Load manual content."""
        from ...storage.user_storage import UserStorage

        storage = UserStorage(self.user_id)
        content = storage.get_manual_content(self.manual_id, self.current_language)

        markdown = self.query_one("#content", Markdown)
        if content:
            markdown.update(content)
            # Update title
            self.query_one("#title", Static).update(f"Manual: {self.manual_id}")
        else:
            markdown.update("*No content available*")

    def on_select_changed(self, event: Select.Changed) -> None:
        """Handle language selection change."""
        if event.select.id == "language-select" and event.value:
            self.current_language = str(event.value)
            self._load_content()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle export button presses."""
        button_id = event.button.id

        if button_id == "btn-export-pdf":
            self._export("pdf")
        elif button_id == "btn-export-word":
            self._export("docx")
        elif button_id == "btn-export-html":
            self._export("html")

    def _export(self, format: str) -> None:
        """Export manual to specified format."""
        from ...export import export_manual

        try:
            output_path = export_manual(
                self.user_id,
                self.manual_id,
                format=format,
                language=self.current_language,
            )
            self.notify(f"Exported to {output_path}", title="Export Complete")
        except Exception as e:
            self.notify(f"Export failed: {e}", title="Error", severity="error")

    def action_export(self) -> None:
        """Export action."""
        self._export("pdf")
