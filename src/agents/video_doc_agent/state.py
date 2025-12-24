"""State definition for the Video Manual Agent LangGraph workflow."""

from typing import TypedDict, Optional, List, Dict, Any


class VideoDocState(TypedDict):
    """State for the video manual generation workflow.

    This TypedDict defines all state that flows through the LangGraph nodes.
    Each node reads from state and returns a partial state update.
    """

    # User context
    user_id: str  # Required: identifies user folder for output
    doc_id: Optional[str]  # Generated UUID for this manual

    # Input parameters
    video_path: str  # Path to the video file to process
    output_filename: Optional[str]  # Optional custom filename for the manual
    use_scene_detection: bool  # Whether to use scene detection for keyframes
    output_language: Optional[str]  # Target language for manual (default: English)
    document_format: Optional[str]  # Document format type (default: step-manual)

    # Manual context (immutable across language versions)
    target_audience: Optional[str]  # Who is the manual for (e.g., "beginners", "IT professionals")
    target_objective: Optional[str]  # What the manual aims to accomplish

    # Step 1: Video Analysis results
    video_metadata: Optional[Dict[str, Any]]  # FPS, duration, resolution, etc.
    video_analysis: Optional[str]  # Gemini's analysis of video content
    model_used: Optional[str]  # Which Gemini model was used
    source_languages: Optional[Dict[str, Any]]  # Detected languages: {audio, ui_text, confidence}

    # Video optimization (for efficient Gemini upload)
    optimized_video_path: Optional[str]  # Path to compressed video for analysis
    gemini_file_uri: Optional[str]  # Gemini Files API URI if uploaded

    # Step 2: Keyframe Identification results
    keyframes: Optional[List[Dict[str, Any]]]  # List of keyframe info with timestamps
    scene_changes: Optional[List[Dict[str, Any]]]  # Detected scene changes
    total_keyframes: Optional[int]  # Count of keyframes identified

    # Step 3: Manual Generation results
    manual_content: Optional[str]  # Generated markdown content
    doc_path: Optional[str]  # Path where manual was saved
    screenshots: Optional[List[Dict[str, Any]]]  # List of screenshot info
    output_directory: Optional[str]  # Directory containing manual and screenshots

    # Workflow status
    status: str  # "pending", "analyzing", "identifying", "generating", "completed", "error"
    error: Optional[str]  # Error message if status is "error"
    using_cached: Optional[bool]  # Whether using cached analysis/keyframes from metadata.json
