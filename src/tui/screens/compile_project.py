"""Compile project screen with HITL support."""

from textual.app import ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, Static, Input, Select, DataTable
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
        Binding("escape", "go_back", "Back/Cancel", priority=True),
    ]

    def __init__(self, user_id: str, project_id: str | None = None):
        super().__init__()
        self.user_id = user_id
        self.project_id = project_id
        self.is_processing = False
        self._runner: ProjectCompilerRunner | None = None
        self._worker: Worker | None = None

    def compose(self) -> ComposeResult:
        with Container(classes="screen-container"):
            with Horizontal(classes="page-header"):
                yield Button("< Back", classes="back-btn", id="btn-back")
                yield Static("Compile Project", classes="title")
                yield Static("", id="project-info")

            # Project selection (if no project_id)
            with Vertical(id="selection-area"):
                yield Static("Select a project:", classes="section-title")
                yield DataTable(id="projects-table", cursor_type="row")

            # Compilation area
            with Vertical(id="compile-area"):
                yield StreamingOutputWidget(id="output")
                yield HITLApprovalWidget(id="hitl")

            with Horizontal(id="chat-input-area"):
                yield Input(placeholder="Message the agent...", id="chat-input")
                yield Button("Send", id="btn-send", variant="primary")

            with Horizontal(classes="button-bar"):
                yield Button("Start", id="btn-start", variant="success")
                yield Button("Cancel", id="btn-cancel", variant="error")

            yield Static("Ready", id="status", classes="status-bar")

    def on_mount(self) -> None:
        if self.project_id:
            self._load_project_info()
            self.query_one("#selection-area").display = False
            self._start_compilation()
        else:
            self._load_projects()
            self.query_one("#compile-area").display = False
            self.query_one("#chat-input-area").display = False

    def _load_projects(self) -> None:
        from ...storage.project_storage import ProjectStorage

        table = self.query_one("#projects-table", DataTable)
        table.clear(columns=True)
        table.add_columns("Name", "Chapters", "Manuals")

        storage = ProjectStorage(self.user_id)
        projects = storage.list_projects()

        for project in projects:
            table.add_row(
                project.get("name", "Unknown"),
                str(len(project.get("chapters", []))),
                str(project.get("manual_count", 0)),
                key=project.get("id", ""),
            )

    def _load_project_info(self) -> None:
        from ...storage.project_storage import ProjectStorage

        storage = ProjectStorage(self.user_id)
        project = storage.get_project(self.project_id)

        if project:
            info = self.query_one("#project-info", Static)
            info.update(f"Project: {project['name']}")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-back":
            self._go_back()
        elif event.button.id == "btn-start":
            self._start_compilation()
        elif event.button.id == "btn-send":
            self._send_message()
        elif event.button.id == "btn-cancel":
            self._go_back()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "chat-input":
            self._send_message()

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        table = self.query_one("#projects-table", DataTable)
        if table.cursor_row is not None:
            row_key = table.get_row_key(table.cursor_row)
            if row_key:
                self.project_id = str(row_key.value)
                self._load_project_info()
                self.query_one("#selection-area").display = False
                self.query_one("#compile-area").display = True
                self.query_one("#chat-input-area").display = True
                self._start_compilation()

    def on_hitl_approval_widget_approved(self, event: HITLApprovalWidget.Approved) -> None:
        self._resume_with_decision({"approved": True, "modified_args": event.modified_args})

    def on_hitl_approval_widget_rejected(self, event: HITLApprovalWidget.Rejected) -> None:
        self._resume_with_decision({"approved": False, "feedback": event.feedback})

    def action_go_back(self) -> None:
        self._go_back()

    def _go_back(self) -> None:
        if self.is_processing and self._worker:
            self._worker.cancel()
            self.is_processing = False
        self.app.pop_screen()

    def _update_status(self, text: str) -> None:
        self.query_one("#status", Static).update(text)

    def _start_compilation(self) -> None:
        if self.is_processing or not self.project_id:
            return

        self.is_processing = True
        self._runner = ProjectCompilerRunner(self.user_id)

        output = self.query_one("#output", StreamingOutputWidget)
        output.clear_output()
        output.append_system_message("Starting compilation agent...")

        self._update_status("Compiling...")

        self._worker = self.run_worker(
            self._run_compilation(),
            name="compile",
            exclusive=True,
        )

    async def _run_compilation(self) -> None:
        output = self.query_one("#output", StreamingOutputWidget)
        hitl = self.query_one("#hitl", HITLApprovalWidget)

        try:
            for event in self._runner.run(self.project_id):
                worker = get_current_worker()
                if worker.is_cancelled:
                    break

                if isinstance(event, LLMTokenEvent):
                    self.call_from_thread(output.append_token, event.token, event.is_first, event.is_last)

                elif isinstance(event, ToolCallEvent):
                    self.call_from_thread(output.append_tool_call, event.tool_name, event.arguments)

                elif isinstance(event, HITLRequiredEvent):
                    self.call_from_thread(hitl.show_approval, event.tool_name, event.tool_args, event.interrupt_id, event.message)
                    self.call_from_thread(self._update_status, "Waiting for approval...")
                    return

                elif isinstance(event, ErrorEvent):
                    self.call_from_thread(output.show_error, event.error_message)
                    self.call_from_thread(self._update_status, "Error")
                    self.is_processing = False
                    return

                elif isinstance(event, CompleteEvent):
                    self.call_from_thread(output.append_system_message, event.message or "Complete!", "bold green")
                    self.call_from_thread(self._update_status, "Complete")
                    self.call_from_thread(self.notify, "Compilation complete!")
                    self.is_processing = False
                    return

        except Exception as e:
            self.call_from_thread(output.show_error, str(e))
            self.call_from_thread(self._update_status, "Error")
            self.is_processing = False

    def _resume_with_decision(self, decision: dict) -> None:
        if not self._runner:
            return

        output = self.query_one("#output", StreamingOutputWidget)

        if decision.get("approved"):
            output.append_system_message("Approved - continuing...", "green")
        else:
            output.append_system_message(f"Rejected: {decision.get('feedback', '')}", "red")

        self._update_status("Continuing...")

        self._worker = self.run_worker(
            self._run_resume(decision),
            name="resume",
            exclusive=True,
        )

    async def _run_resume(self, decision: dict) -> None:
        output = self.query_one("#output", StreamingOutputWidget)
        hitl = self.query_one("#hitl", HITLApprovalWidget)

        try:
            for event in self._runner.resume(decision):
                worker = get_current_worker()
                if worker.is_cancelled:
                    break

                if isinstance(event, LLMTokenEvent):
                    self.call_from_thread(output.append_token, event.token, event.is_first, event.is_last)

                elif isinstance(event, HITLRequiredEvent):
                    self.call_from_thread(hitl.show_approval, event.tool_name, event.tool_args, event.interrupt_id, event.message)
                    self.call_from_thread(self._update_status, "Waiting for approval...")
                    return

                elif isinstance(event, ErrorEvent):
                    self.call_from_thread(output.show_error, event.error_message)
                    self.call_from_thread(self._update_status, "Error")
                    self.is_processing = False
                    return

                elif isinstance(event, CompleteEvent):
                    self.call_from_thread(output.append_system_message, event.message or "Complete!", "bold green")
                    self.call_from_thread(self._update_status, "Complete")
                    self.is_processing = False
                    return

        except Exception as e:
            self.call_from_thread(output.show_error, str(e))
            self.is_processing = False

    def _send_message(self) -> None:
        if not self._runner:
            self.notify("No active session", severity="error")
            return

        input_widget = self.query_one("#chat-input", Input)
        message = input_widget.value.strip()

        if not message:
            return

        input_widget.value = ""

        output = self.query_one("#output", StreamingOutputWidget)
        output.append_system_message(f"You: {message}", "bold")

        self._worker = self.run_worker(
            self._run_send_message(message),
            name="send_msg",
            exclusive=True,
        )

    async def _run_send_message(self, message: str) -> None:
        output = self.query_one("#output", StreamingOutputWidget)
        hitl = self.query_one("#hitl", HITLApprovalWidget)

        try:
            for event in self._runner.send_message(message):
                worker = get_current_worker()
                if worker.is_cancelled:
                    break

                if isinstance(event, LLMTokenEvent):
                    self.call_from_thread(output.append_token, event.token, event.is_first, event.is_last)

                elif isinstance(event, HITLRequiredEvent):
                    self.call_from_thread(hitl.show_approval, event.tool_name, event.tool_args, event.interrupt_id, event.message)
                    return

                elif isinstance(event, ErrorEvent):
                    self.call_from_thread(output.show_error, event.error_message)
                    return

        except Exception as e:
            self.call_from_thread(output.show_error, str(e))
