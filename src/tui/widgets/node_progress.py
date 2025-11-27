"""Node progress widget for displaying agent node execution status."""

from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Static
from textual.reactive import reactive
from typing import Any


class NodeProgressWidget(Static):
    """Widget for displaying progress through agent nodes."""

    DEFAULT_CSS = """
    NodeProgressWidget {
        height: auto;
        border: solid $primary;
        padding: 1 2;
        margin-bottom: 1;
    }

    NodeProgressWidget .progress-title {
        text-style: bold;
        margin-bottom: 1;
    }

    NodeProgressWidget .node-row {
        height: 1;
    }

    NodeProgressWidget .node-pending {
        color: $text-muted;
    }

    NodeProgressWidget .node-running {
        color: $warning;
        text-style: bold;
    }

    NodeProgressWidget .node-complete {
        color: $success;
    }

    NodeProgressWidget .node-error {
        color: $error;
    }

    NodeProgressWidget .node-details {
        color: $text-muted;
        margin-left: 4;
    }
    """

    SPINNER_FRAMES = ["", "", "", "", "", "", "", ""]

    # Reactive attributes for status tracking
    current_node: reactive[int] = reactive(0)
    frame_index: reactive[int] = reactive(0)

    def __init__(
        self,
        title: str = "Processing",
        nodes: list[str] | None = None,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.title = title
        self.nodes = nodes or []
        self.node_status: dict[str, str] = {n: "pending" for n in self.nodes}
        self.node_details: dict[str, dict[str, Any]] = {n: {} for n in self.nodes}
        self._timer = None

    def compose(self) -> ComposeResult:
        yield Static(self.title, classes="progress-title")
        for node in self.nodes:
            yield Static(self._render_node(node), classes="node-row", id=f"node-{node}")

    def on_mount(self) -> None:
        """Start the spinner animation."""
        self._timer = self.set_interval(0.1, self._animate)

    def on_unmount(self) -> None:
        """Stop the timer."""
        if self._timer:
            self._timer.stop()

    def _animate(self) -> None:
        """Animate the spinner for running nodes."""
        self.frame_index = (self.frame_index + 1) % len(self.SPINNER_FRAMES)
        self._update_display()

    def _get_status_icon(self, status: str) -> str:
        """Get icon for node status."""
        if status == "pending":
            return "[ ]"
        elif status == "running":
            return f"[{self.SPINNER_FRAMES[self.frame_index]}]"
        elif status == "complete":
            return "[#]"
        elif status == "error":
            return "[X]"
        return "[ ]"

    def _render_node(self, node: str) -> str:
        """Render a single node row."""
        status = self.node_status.get(node, "pending")
        icon = self._get_status_icon(status)
        details = self.node_details.get(node, {})

        # Format node name nicely
        display_name = node.replace("_", " ").title()

        # Build details string
        details_str = ""
        if details:
            details_parts = [f"{k}: {v}" for k, v in details.items() if not k.startswith("_")]
            if details_parts:
                details_str = f"  ({', '.join(details_parts)})"

        return f"{icon} {display_name}{details_str}"

    def _update_display(self) -> None:
        """Update all node displays."""
        for node in self.nodes:
            node_widget = self.query_one(f"#node-{node}", Static)
            node_widget.update(self._render_node(node))

            # Update CSS class based on status
            status = self.node_status.get(node, "pending")
            node_widget.remove_class("node-pending", "node-running", "node-complete", "node-error")
            node_widget.add_class(f"node-{status}")

    def set_node_status(self, node: str, status: str, details: dict[str, Any] | None = None) -> None:
        """Update the status of a node."""
        if node in self.node_status:
            self.node_status[node] = status
            if details:
                self.node_details[node] = details
            self._update_display()

    def start_node(self, node: str) -> None:
        """Mark a node as running."""
        self.set_node_status(node, "running")

    def complete_node(self, node: str, details: dict[str, Any] | None = None) -> None:
        """Mark a node as complete."""
        self.set_node_status(node, "complete", details)

    def error_node(self, node: str, error: str | None = None) -> None:
        """Mark a node as having an error."""
        details = {"error": error} if error else None
        self.set_node_status(node, "error", details)

    def reset(self) -> None:
        """Reset all nodes to pending."""
        self.node_status = {n: "pending" for n in self.nodes}
        self.node_details = {n: {} for n in self.nodes}
        self._update_display()
