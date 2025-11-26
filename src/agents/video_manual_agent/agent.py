"""Video Manual Creator Agent.

This agent analyzes instructional videos and generates user manuals with screenshots.
Uses LangGraph for workflow orchestration with SQLite checkpointing for persistence.
"""

import os
import sqlite3
from typing import Dict, Any, Optional
from dotenv import load_dotenv
from langgraph.checkpoint.sqlite import SqliteSaver

from .graph import create_video_manual_graph, AGENT_NAME
from .state import VideoManualState
from .config import DEFAULT_GEMINI_MODEL
from ...config import get_checkpoint_db_path, ensure_directories
from ...storage.user_storage import UserStorage


class VideoManualAgent:
    """Video Manual Creator Agent.

    This agent analyzes instructional videos and generates comprehensive
    user manuals with screenshots from key moments.

    Uses LangGraph StateGraph for workflow orchestration with:
    - analyze_video: Analyzes video content using Gemini
    - identify_keyframes: Identifies key moments for screenshots
    - generate_manual: Extracts screenshots and generates markdown manual

    Outputs are stored in user-specific folders:
    data/users/{user_id}/manuals/{manual_id}/
    """

    def __init__(self, model_name: str = DEFAULT_GEMINI_MODEL, use_checkpointer: bool = True):
        """Initialize Video Manual Agent.

        Args:
            model_name: Gemini model to use for analysis
            use_checkpointer: Whether to enable SQLite checkpointing for persistence
        """
        load_dotenv()
        ensure_directories()

        self.model_name = model_name
        self.api_key = os.getenv("GOOGLE_API_KEY")

        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment variables")

        # Setup graph with optional checkpointer
        if use_checkpointer:
            db_path = get_checkpoint_db_path(AGENT_NAME)
            self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
            self.checkpointer = SqliteSaver(self._conn)
            self.graph = create_video_manual_graph(checkpointer=self.checkpointer)
        else:
            self._conn = None
            self.checkpointer = None
            self.graph = create_video_manual_graph()

    def create_manual(
        self,
        video_path: str,
        user_id: str,
        output_filename: Optional[str] = None,
        use_scene_detection: bool = True,
        output_language: str = "English",
        thread_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create user manual from video.

        Args:
            video_path: Path to video file
            user_id: User identifier for output folder location
            output_filename: Optional output filename
            use_scene_detection: Whether to use scene detection for keyframe hints
            output_language: Target language for the manual (default: English)
            thread_id: Optional thread ID for checkpointing (enables resumption)

        Returns:
            Dictionary containing workflow results including:
            - status: "completed" or "error"
            - manual_path: Path to generated manual
            - manual_content: Markdown content of manual
            - screenshots: List of screenshot info
            - output_directory: Directory containing all output
            - video_metadata: Video file information
            - total_keyframes: Number of keyframes extracted
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

        # Check for existing manual to enable caching
        from pathlib import Path
        storage = UserStorage(user_id)
        storage.ensure_user_folders()
        video_name = output_filename or Path(video_path).name

        # Try to find existing manual for this video (enables caching)
        existing_manual_id = storage.find_existing_manual(video_name)
        if existing_manual_id:
            manual_dir, manual_id = storage.get_manual_dir(manual_id=existing_manual_id)
        else:
            manual_dir, manual_id = storage.get_manual_dir(video_name=video_name)

        # Prepare initial state
        initial_state: VideoManualState = {
            "user_id": user_id,
            "manual_id": manual_id,  # Pre-generated for consistent output paths
            "video_path": video_path,
            "output_filename": output_filename,
            "use_scene_detection": use_scene_detection,
            "output_language": output_language,
            "video_metadata": None,
            "video_analysis": None,
            "model_used": None,
            "optimized_video_path": None,
            "gemini_file_uri": None,
            "keyframes": None,
            "scene_changes": None,
            "total_keyframes": None,
            "manual_content": None,
            "manual_path": None,
            "screenshots": None,
            "output_directory": None,
            "status": "pending",
            "error": None,
            "using_cached": None,
        }

        # Run graph
        config = {"configurable": {"thread_id": thread_id or f"{user_id}_default"}}
        result = self.graph.invoke(initial_state, config=config)

        return result

    def get_user_manuals(self, user_id: str) -> list:
        """Get list of manuals for a user.

        Args:
            user_id: User identifier

        Returns:
            List of manual IDs
        """
        storage = UserStorage(user_id)
        return storage.list_manuals()

    def get_manual_content(self, user_id: str, manual_id: str) -> Optional[str]:
        """Get content of a specific manual.

        Args:
            user_id: User identifier
            manual_id: Manual identifier

        Returns:
            Manual content as string, or None if not found
        """
        storage = UserStorage(user_id)
        return storage.get_manual_content(manual_id)


def create_video_manual_agent(
    model_name: str = DEFAULT_GEMINI_MODEL,
    use_checkpointer: bool = True
) -> VideoManualAgent:
    """Create a Video Manual Agent instance.

    Args:
        model_name: Gemini model to use
        use_checkpointer: Whether to enable checkpointing

    Returns:
        VideoManualAgent instance
    """
    return VideoManualAgent(model_name=model_name, use_checkpointer=use_checkpointer)


# For use with DeepAgents Tool integration
def create_manual_from_video_tool(
    video_path: str,
    user_id: str,
    output_filename: Optional[str] = None,
    output_language: str = "English",
) -> str:
    """Tool function for creating manual from video.

    This can be used as a tool in a DeepAgent.

    Args:
        video_path: Path to video file
        user_id: User identifier for output folder location
        output_filename: Optional output filename
        output_language: Target language for the manual (default: English)

    Returns:
        Summary of the manual creation process
    """
    agent = create_video_manual_agent()
    result = agent.create_manual(video_path, user_id, output_filename, output_language=output_language)

    if result.get("status") == "error":
        return f"Error creating manual: {result.get('error')}"

    summary = f"""Manual created successfully!

Video: {result.get('video_metadata', {}).get('filename', 'Unknown')}
Duration: {result.get('video_metadata', {}).get('duration_formatted', 'Unknown')}
Keyframes extracted: {result.get('total_keyframes', 0)}
Screenshots saved: {len(result.get('screenshots', []))}

Manual saved to: {result.get('manual_path')}
Output directory: {result.get('output_directory')}
"""
    return summary
