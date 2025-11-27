"""HITL approval widget for human-in-the-loop interactions."""

from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.widgets import Static, Button, TextArea
from textual.widget import Widget
from textual.message import Message
from typing import Any
import json


class HITLApprovalWidget(Widget):
    """Widget for displaying HITL approval requests."""

    DEFAULT_CSS = """
    HITLApprovalWidget {
        height: auto;
        border: solid $warning;
        padding: 1 2;
        margin: 1 0;
        display: none;
    }

    HITLApprovalWidget.visible {
        display: block;
    }

    HITLApprovalWidget #hitl-title {
        text-style: bold;
        color: $warning;
        margin-bottom: 1;
    }

    HITLApprovalWidget #tool-info {
        margin-bottom: 1;
    }

    HITLApprovalWidget #tool-name {
        text-style: bold;
        color: $primary;
    }

    HITLApprovalWidget #args-editor {
        height: 15;
        margin-bottom: 1;
    }

    HITLApprovalWidget #button-row {
        height: auto;
    }

    HITLApprovalWidget #button-row Button {
        margin-right: 1;
    }

    HITLApprovalWidget #feedback-input {
        display: none;
        margin-top: 1;
    }

    HITLApprovalWidget #feedback-input.visible {
        display: block;
    }
    """

    class Approved(Message):
        """Message sent when the user approves."""

        def __init__(self, modified_args: dict[str, Any] | None = None):
            super().__init__()
            self.modified_args = modified_args

    class Rejected(Message):
        """Message sent when the user rejects."""

        def __init__(self, feedback: str = ""):
            super().__init__()
            self.feedback = feedback

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.tool_name = ""
        self.tool_args: dict[str, Any] = {}
        self.interrupt_id = ""

    def compose(self) -> ComposeResult:
        yield Static("Approval Required", id="hitl-title")

        with Vertical(id="tool-info"):
            yield Static("", id="tool-name")
            yield TextArea(id="args-editor", language="json")

        with Horizontal(id="button-row"):
            yield Button("Approve", id="btn-approve", variant="success")
            yield Button("Edit & Approve", id="btn-edit-approve", variant="primary")
            yield Button("Reject", id="btn-reject", variant="error")

        yield TextArea(placeholder="Feedback (why rejecting)...", id="feedback-input")
        yield Button("Submit Rejection", id="btn-submit-reject", variant="error")

    def show_approval(
        self,
        tool_name: str,
        tool_args: dict[str, Any],
        interrupt_id: str = "",
        message: str = "",
    ) -> None:
        """Show the approval widget with tool details."""
        self.tool_name = tool_name
        self.tool_args = tool_args
        self.interrupt_id = interrupt_id

        # Update display
        self.query_one("#tool-name", Static).update(f"Tool: {tool_name}")
        self.query_one("#args-editor", TextArea).text = json.dumps(tool_args, indent=2)

        if message:
            self.query_one("#hitl-title", Static).update(message)

        self.add_class("visible")

    def hide_approval(self) -> None:
        """Hide the approval widget."""
        self.remove_class("visible")
        self.query_one("#feedback-input").remove_class("visible")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        button_id = event.button.id

        if button_id == "btn-approve":
            self._approve(use_original=True)
        elif button_id == "btn-edit-approve":
            self._approve(use_original=False)
        elif button_id == "btn-reject":
            self.query_one("#feedback-input").add_class("visible")
            self.query_one("#feedback-input", TextArea).focus()
        elif button_id == "btn-submit-reject":
            self._reject()

    def _approve(self, use_original: bool = True) -> None:
        """Send approval message."""
        if use_original:
            self.post_message(self.Approved())
        else:
            # Parse modified args from editor
            try:
                editor = self.query_one("#args-editor", TextArea)
                modified_args = json.loads(editor.text)
                self.post_message(self.Approved(modified_args=modified_args))
            except json.JSONDecodeError as e:
                self.notify(f"Invalid JSON: {e}", severity="error")
                return

        self.hide_approval()

    def _reject(self) -> None:
        """Send rejection message."""
        feedback_input = self.query_one("#feedback-input", TextArea)
        feedback = feedback_input.text.strip()
        self.post_message(self.Rejected(feedback=feedback))
        self.hide_approval()
