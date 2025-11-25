"""State definition for the Video Manual Agent LangGraph workflow."""

from typing import TypedDict, Optional, List, Dict, Any


class VideoManualState(TypedDict):
    """State for the video manual generation workflow.

    This TypedDict defines all state that flows through the LangGraph nodes.
    Each node reads from state and returns a partial state update.
    """

    # User context
    user_id: str  # Required: identifies user folder for output
    manual_id: Optional[str]  # Generated UUID for this manual

    # Input parameters
    video_path: str  # Path to the video file to process
    output_filename: Optional[str]  # Optional custom filename for the manual
    use_scene_detection: bool  # Whether to use scene detection for keyframes

    # Step 1: Video Analysis results
    video_metadata: Optional[Dict[str, Any]]  # FPS, duration, resolution, etc.
    video_analysis: Optional[str]  # Gemini's analysis of video content
    model_used: Optional[str]  # Which Gemini model was used

    # Video optimization (for efficient Gemini upload)
    optimized_video_path: Optional[str]  # Path to compressed video for analysis
    gemini_file_uri: Optional[str]  # Gemini Files API URI if uploaded

    # Step 2: Keyframe Identification results
    keyframes: Optional[List[Dict[str, Any]]]  # List of keyframe info with timestamps
    scene_changes: Optional[List[Dict[str, Any]]]  # Detected scene changes
    total_keyframes: Optional[int]  # Count of keyframes identified

    # Step 3: Manual Generation results
    manual_content: Optional[str]  # Generated markdown content
    manual_path: Optional[str]  # Path where manual was saved
    screenshots: Optional[List[Dict[str, Any]]]  # List of screenshot info
    output_directory: Optional[str]  # Directory containing manual and screenshots

    # Workflow status
    status: str  # "pending", "analyzing", "identifying", "generating", "completed", "error"
    error: Optional[str]  # Error message if status is "error"
