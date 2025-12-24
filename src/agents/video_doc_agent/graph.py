"""LangGraph workflow definition for the Video Manual Agent."""

import sqlite3
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite import SqliteSaver

from .state import VideoDocState
from .nodes.video_analyzer import analyze_video_node
from .nodes.keyframe_identifier import identify_keyframes_node
from .nodes.doc_generator import generate_doc_node
from ...config import get_checkpoint_db_path, ensure_directories

# Agent identifier for checkpoint database
AGENT_NAME = "video_doc_agent"


def create_video_doc_graph(checkpointer=None):
    """Create the video doc LangGraph workflow.

    The workflow consists of three sequential nodes:
    1. analyze_video - Analyzes video content using Gemini
    2. identify_keyframes - Identifies key moments for screenshots
    3. generate_doc - Extracts screenshots and generates markdown manual

    Args:
        checkpointer: Optional checkpointer for state persistence.
                     If provided, enables resuming interrupted workflows.

    Returns:
        Compiled LangGraph workflow
    """
    # Build the state graph
    builder = StateGraph(VideoDocState)

    # Add nodes
    builder.add_node("analyze_video", analyze_video_node)
    builder.add_node("identify_keyframes", identify_keyframes_node)
    builder.add_node("generate_doc", generate_doc_node)

    # Define edges (linear flow)
    builder.add_edge(START, "analyze_video")
    builder.add_edge("analyze_video", "identify_keyframes")
    builder.add_edge("identify_keyframes", "generate_doc")
    builder.add_edge("generate_doc", END)

    # Compile with optional checkpointer
    if checkpointer:
        return builder.compile(checkpointer=checkpointer)
    return builder.compile()


def get_video_doc_graph():
    """Get graph with agent-specific SQLite checkpointer for persistence.

    This is a convenience function that creates a graph with SQLite-based
    checkpointing enabled. The checkpoint database is stored at:
    data/checkpoints/video_doc_agent.db

    Returns:
        Compiled LangGraph workflow with SQLite checkpointer
    """
    ensure_directories()
    db_path = get_checkpoint_db_path(AGENT_NAME)
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    checkpointer = SqliteSaver(conn)
    return create_video_doc_graph(checkpointer=checkpointer)
