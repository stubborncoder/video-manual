"""Event types for streaming progress from agents."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class EventType(str, Enum):
    """Types of progress events emitted by runners."""

    NODE_STARTED = "node_started"
    NODE_COMPLETED = "node_completed"
    LLM_TOKEN = "llm_token"
    TOOL_CALL = "tool_call"
    HITL_REQUIRED = "hitl_required"
    PENDING_CHANGE = "pending_change"
    ERROR = "error"
    COMPLETE = "complete"


@dataclass
class ProgressEvent:
    """Base class for all progress events."""

    event_type: EventType
    timestamp: float = field(default_factory=lambda: __import__("time").time())


@dataclass
class NodeStartedEvent(ProgressEvent):
    """Emitted when a graph node starts execution."""

    event_type: EventType = field(default=EventType.NODE_STARTED, init=False)
    node_name: str = ""
    node_index: int = 0
    total_nodes: int = 0


@dataclass
class NodeCompletedEvent(ProgressEvent):
    """Emitted when a graph node completes execution."""

    event_type: EventType = field(default=EventType.NODE_COMPLETED, init=False)
    node_name: str = ""
    node_index: int = 0
    total_nodes: int = 0
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMTokenEvent(ProgressEvent):
    """Emitted for each token streamed from LLM."""

    event_type: EventType = field(default=EventType.LLM_TOKEN, init=False)
    token: str = ""
    is_first: bool = False
    is_last: bool = False


@dataclass
class ToolCallEvent(ProgressEvent):
    """Emitted when the agent calls a tool."""

    event_type: EventType = field(default=EventType.TOOL_CALL, init=False)
    tool_name: str = ""
    tool_id: str = ""
    arguments: dict[str, Any] = field(default_factory=dict)


@dataclass
class HITLRequiredEvent(ProgressEvent):
    """Emitted when human-in-the-loop approval is required."""

    event_type: EventType = field(default=EventType.HITL_REQUIRED, init=False)
    interrupt_id: str = ""
    tool_name: str = ""
    tool_args: dict[str, Any] = field(default_factory=dict)
    message: str = ""


@dataclass
class ErrorEvent(ProgressEvent):
    """Emitted when an error occurs."""

    event_type: EventType = field(default=EventType.ERROR, init=False)
    error_message: str = ""
    node_name: str | None = None
    recoverable: bool = False


@dataclass
class PendingChangeEvent(ProgressEvent):
    """Emitted when the agent creates a pending document change."""

    event_type: EventType = field(default=EventType.PENDING_CHANGE, init=False)
    change_id: str = ""
    change_type: str = ""  # text_replace, text_insert, text_delete, caption_update
    change_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class CompleteEvent(ProgressEvent):
    """Emitted when processing completes successfully."""

    event_type: EventType = field(default=EventType.COMPLETE, init=False)
    result: dict[str, Any] = field(default_factory=dict)
    message: str = ""
