"""LangGraph definition for the Reformat Agent workflow."""

from langgraph.graph import StateGraph, START, END

from .state import ReformatState
from .nodes import load_content, convert_manual


def create_reformat_graph(checkpointer=None):
    """Create the reformat workflow graph.

    The graph has a simple 2-node structure:
    1. load_content: Load the source manual markdown
    2. convert: Convert to target format using LLM

    Args:
        checkpointer: Optional checkpointer for state persistence

    Returns:
        Compiled LangGraph
    """
    builder = StateGraph(ReformatState)

    # Add nodes
    builder.add_node("load_content", load_content)
    builder.add_node("convert", convert_manual)

    # Define flow: START -> load_content -> convert -> END
    builder.add_edge(START, "load_content")
    builder.add_edge("load_content", "convert")
    builder.add_edge("convert", END)

    # Compile with optional checkpointer
    if checkpointer:
        return builder.compile(checkpointer=checkpointer)

    return builder.compile()
