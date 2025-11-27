"""Compile project screen with HITL support."""

from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.screen import Screen
from textual.widgets import Button, Static, Input, Select
from textual.binding import Binding
from textual.worker import Worker, get_current_worker

from ..widgets.streaming_output import StreamingOutputWidget
from ..widgets.hitl_approval import HITLApprovalWidget
from ...core.events import (
    LLMTokenEvent,
    ToolCallEvent,
    HITLRequiredEvent,
    ErrorEvent,
    CompleteEvent,
)
from ...core.runners import ProjectCompilerRunner


class CompileProjectScreen(Screen):
    """Screen for compiling a project with agent assistance."""

    BINDINGS = [
        Binding("escape", "cancel", "Cancel"),
    ]

    CSS = """
    CompileProjectScreen {
        padding: 1;
    }

    #title {
        text-style: bold;
        margin-bottom: 1;
    }

    #project-info {
        color: $text-muted;
        margin-bottom: 1;
    }

    #output-section {
        height: 1fr;
        margin-bottom: 1;
    }

    #streaming-output {
        height: 1fr;
    }

    #hitl-approval {
        height: auto;
    }

    #input-section {
        height: auto;
        margin-top: 1;
    }

    #user-input {
        width: 1fr;
    }

    #actions {
        height: auto;
        margin-top: 1;
    }

    #actions Button {
        margin-right: 1;
    }

    #status {
        color: $text-muted;
        margin-top: 1;
    }
    """

    def __init__(self, user_id: str, project_id: str | None = None):
        super().__init__()
        self.user_id = user_id
        self.project_id = project_id
        self.is_processing = False
        self._runner: ProjectCompilerRunner | None = None
        self._worker: Worker | None = None

    def compose(self) -> ComposeResult:
        yield Static("Compile Project", id="title")
        yield Static("", id="project-info")

        with Vertical(id="output-section"):
            yield StreamingOutputWidget(id="streaming-output")
            yield HITLApprovalWidget(id="hitl-approval")

        with Horizontal(id="input-section"):
            yield Input(placeholder="Type a message to the agent...", id="user-input")
            yield Button("Send", id="btn-send", variant="primary")

        with Horizontal(id="actions"):
            yield Button("Start Compilation", id="btn-start", variant="success")
            yield Button("Cancel", id="btn-cancel", variant="error")

        yield Static("Ready", id="status")

    def on_mount(self) -> None:
        """Load project info on mount."""
        if self.project_id:
            self._load_project_info()
            # Auto-start compilation
            self._start_compilation()

    def _load_project_info(self) -> None:
        """Load and display project information."""
        from ...storage.project_storage import ProjectStorage

        storage = ProjectStorage(self.user_id)
        project = storage.get_project(self.project_id)

        if project:
            info = self.query_one("#project-info", Static)
            chapters = len(project.get("chapters", []))
            info.update(f"Project: {project['name']} | {chapters} chapters")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        if event.button.id == "btn-start":
            self._start_compilation()
        elif event.button.id == "btn-send":
            self._send_message()
        elif event.button.id == "btn-cancel":
            self._cancel()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle enter in input field."""
        if event.input.id == "user-input":
            self._send_message()

    def on_hitl_approval_widget_approved(self, event: HITLApprovalWidget.Approved) -> None:
        """Handle HITL approval."""
        self._resume_with_decision({"approved": True, "modified_args": event.modified_args})

    def on_hitl_approval_widget_rejected(self, event: HITLApprovalWidget.Rejected) -> None:
        """Handle HITL rejection."""
        self._resume_with_decision({"approved": False, "feedback": event.feedback})

    def _start_compilation(self) -> None:
        """Start the compilation process."""
        if self.is_processing:
            return

        if not self.project_id:
            self.notify("No project selected", severity="error")
            return

        self.is_processing = True
        self._runner = ProjectCompilerRunner(self.user_id)

        # Clear output
        output = self.query_one("#streaming-output", StreamingOutputWidget)
        output.clear_output()
        output.append_system_message("Starting compilation agent...")

        # Update status
        self._update_status("Compiling...")

        # Start worker
        self._worker = self.run_worker(
            self._run_compilation(),
            name="compile_project",
            exclusive=True,
        )

    async def _run_compilation(self) -> None:
        """Run compilation in background worker."""
        output = self.query_one("#streaming-output", StreamingOutputWidget)
        hitl = self.query_one("#hitl-approval", HITLApprovalWidget)

        try:
            for event in self._runner.run(self.project_id):
                worker = get_current_worker()
                if worker.is_cancelled:
                    break

                if isinstance(event, LLMTokenEvent):
                    self.call_from_thread(
                        output.append_token,
                        event.token,
                        event.is_first,
                        event.is_last,
                    )

                elif isinstance(event, ToolCallEvent):
                    self.call_from_thread(
                        output.append_tool_call,
                        event.tool_name,
                        event.arguments,
                    )

                elif isinstance(event, HITLRequiredEvent):
                    self.call_from_thread(
                        hitl.show_approval,
                        event.tool_name,
                        event.tool_args,
                        event.interrupt_id,
                        event.message,
                    )
                    self.call_from_thread(
                        self._update_status,
                        "Waiting for approval...",
                    )
                    return  # Stop until approval

                elif isinstance(event, ErrorEvent):
                    self.call_from_thread(output.show_error, event.error_message)
                    self.call_from_thread(self._update_status, "Error occurred")
                    self.is_processing = False
                    return

                elif isinstance(event, CompleteEvent):
                    self.call_from_thread(
                        output.append_system_message,
                        event.message or "Compilation complete!",
                        "bold green",
                    )
                    self.call_from_thread(self._update_status, "Complete")
                    self.call_from_thread(
                        self.notify,
                        "Compilation complete!",
                        title="Success",
                    )
                    self.is_processing = False
                    return

        except Exception as e:
            self.call_from_thread(output.show_error, str(e))
            self.call_from_thread(self._update_status, "Error")
            self.is_processing = False

    def _resume_with_decision(self, decision: dict) -> None:
        """Resume compilation after HITL decision."""
        if not self._runner:
            return

        output = self.query_one("#streaming-output", StreamingOutputWidget)

        if decision.get("approved"):
            output.append_system_message("Approved - continuing...", "green")
        else:
            output.append_system_message(
                f"Rejected: {decision.get('feedback', 'No feedback')}", "red"
            )

        self._update_status("Continuing...")

        # Resume in worker
        self._worker = self.run_worker(
            self._run_resume(decision),
            name="resume_compile",
            exclusive=True,
        )

    async def _run_resume(self, decision: dict) -> None:
        """Run resume in background worker."""
        output = self.query_one("#streaming-output", StreamingOutputWidget)
        hitl = self.query_one("#hitl-approval", HITLApprovalWidget)

        try:
            for event in self._runner.resume(decision):
                worker = get_current_worker()
                if worker.is_cancelled:
                    break

                if isinstance(event, LLMTokenEvent):
                    self.call_from_thread(
                        output.append_token,
                        event.token,
                        event.is_first,
                        event.is_last,
                    )

                elif isinstance(event, ToolCallEvent):
                    self.call_from_thread(
                        output.append_tool_call,
                        event.tool_name,
                        event.arguments,
                    )

                elif isinstance(event, HITLRequiredEvent):
                    self.call_from_thread(
                        hitl.show_approval,
                        event.tool_name,
                        event.tool_args,
                        event.interrupt_id,
                        event.message,
                    )
                    self.call_from_thread(
                        self._update_status,
                        "Waiting for approval...",
                    )
                    return

                elif isinstance(event, ErrorEvent):
                    self.call_from_thread(output.show_error, event.error_message)
                    self.call_from_thread(self._update_status, "Error occurred")
                    self.is_processing = False
                    return

                elif isinstance(event, CompleteEvent):
                    self.call_from_thread(
                        output.append_system_message,
                        event.message or "Compilation complete!",
                        "bold green",
                    )
                    self.call_from_thread(self._update_status, "Complete")
                    self.call_from_thread(
                        self.notify,
                        "Compilation complete!",
                        title="Success",
                    )
                    self.is_processing = False
                    return

        except Exception as e:
            self.call_from_thread(output.show_error, str(e))
            self.call_from_thread(self._update_status, "Error")
            self.is_processing = False

    def _send_message(self) -> None:
        """Send a message to the agent."""
        if not self._runner:
            self.notify("No active session", severity="error")
            return

        input_widget = self.query_one("#user-input", Input)
        message = input_widget.value.strip()

        if not message:
            return

        input_widget.value = ""

        output = self.query_one("#streaming-output", StreamingOutputWidget)
        output.append_system_message(f"You: {message}", "bold")

        # Send message in worker
        self._worker = self.run_worker(
            self._run_send_message(message),
            name="send_message",
            exclusive=True,
        )

    async def _run_send_message(self, message: str) -> None:
        """Send message in background worker."""
        output = self.query_one("#streaming-output", StreamingOutputWidget)
        hitl = self.query_one("#hitl-approval", HITLApprovalWidget)

        try:
            for event in self._runner.send_message(message):
                worker = get_current_worker()
                if worker.is_cancelled:
                    break

                if isinstance(event, LLMTokenEvent):
                    self.call_from_thread(
                        output.append_token,
                        event.token,
                        event.is_first,
                        event.is_last,
                    )

                elif isinstance(event, HITLRequiredEvent):
                    self.call_from_thread(
                        hitl.show_approval,
                        event.tool_name,
                        event.tool_args,
                        event.interrupt_id,
                        event.message,
                    )
                    return

                elif isinstance(event, ErrorEvent):
                    self.call_from_thread(output.show_error, event.error_message)
                    return

                elif isinstance(event, CompleteEvent):
                    return

        except Exception as e:
            self.call_from_thread(output.show_error, str(e))

    def _update_status(self, status: str) -> None:
        """Update status display."""
        self.query_one("#status", Static).update(status)

    def _cancel(self) -> None:
        """Cancel and go back."""
        if self.is_processing and self._worker:
            self._worker.cancel()
            self.is_processing = False

        self.app.pop_screen()

    def action_cancel(self) -> None:
        """Cancel action."""
        self._cancel()
