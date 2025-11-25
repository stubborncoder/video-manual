"""Configuration for Video Manual Agent."""

# Gemini Model Configuration
DEFAULT_GEMINI_MODEL = "gemini-2.5-pro"  # Best for video understanding
FALLBACK_GEMINI_MODEL = "gemini-2.5-flash"  # Cost-effective alternative

# Video Processing Configuration
MAX_VIDEO_DURATION = 7200  # 2 hours in seconds
DEFAULT_FPS = 1  # Frames per second for analysis
KEYFRAME_MIN_INTERVAL = 1  # Minimum seconds between keyframes (let Gemini's criteria prevail)

# Screenshot Configuration
SCREENSHOT_FORMAT = "PNG"
SCREENSHOT_QUALITY = 95
SCREENSHOT_MAX_WIDTH = 1920

# Output Configuration
# Note: Output is now managed by UserStorage - manuals go to data/users/{user_id}/manuals/
MANUAL_FORMAT = "markdown"  # Can be extended to HTML, PDF

# Scene Detection Thresholds
SCENE_THRESHOLD = 27.0  # Sensitivity for scene change detection
MIN_SCENE_LENGTH = 3  # Minimum scene length in seconds
