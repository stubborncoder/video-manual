"""Streaming output widget for displaying LLM token output."""

from textual.widgets import RichLog
from textual.reactive import reactive


class StreamingOutputWidget(RichLog):
    """Widget for displaying streaming LLM output."""

    DEFAULT_CSS = """
    StreamingOutputWidget {
        height: 1fr;
        border: solid $surface-lighten-2;
        padding: 1;
        background: $surface-darken-1;
    }

    StreamingOutputWidget.thinking {
        border: solid $warning;
    }

    StreamingOutputWidget.complete {
        border: solid $success;
    }

    StreamingOutputWidget.error {
        border: solid $error;
    }
    """

    is_streaming: reactive[bool] = reactive(False)

    def __init__(self, **kwargs):
        super().__init__(highlight=True, markup=True, wrap=True, **kwargs)
        self._current_line = ""

    def append_token(self, token: str, is_first: bool = False, is_last: bool = False) -> None:
        """Append a token to the output."""
        if is_first:
            self.is_streaming = True
            self.add_class("thinking")
            self._current_line = ""

        self._current_line += token

        # Write complete lines
        if "\n" in self._current_line:
            lines = self._current_line.split("\n")
            for line in lines[:-1]:
                self.write(line)
            self._current_line = lines[-1]

        if is_last:
            if self._current_line:
                self.write(self._current_line)
                self._current_line = ""
            self.is_streaming = False
            self.remove_class("thinking")
            self.add_class("complete")

    def append_system_message(self, message: str, style: str = "dim") -> None:
        """Append a system message."""
        self.write(f"[{style}]{message}[/{style}]")

    def append_tool_call(self, tool_name: str, tool_args: dict | None = None) -> None:
        """Append a tool call notification."""
        self.write(f"[bold cyan]Tool: {tool_name}[/bold cyan]")
        if tool_args:
            import json
            args_str = json.dumps(tool_args, indent=2)
            self.write(f"[dim]{args_str}[/dim]")

    def show_error(self, error: str) -> None:
        """Display an error message."""
        self.remove_class("thinking", "complete")
        self.add_class("error")
        self.write(f"[bold red]Error:[/bold red] {error}")

    def clear_output(self) -> None:
        """Clear all output."""
        self.clear()
        self._current_line = ""
        self.is_streaming = False
        self.remove_class("thinking", "complete", "error")
