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

# Video Optimization Settings (for Gemini upload efficiency)
# Gemini processes video at 1 FPS anyway, so high-bitrate video is wasteful
OPTIMIZATION_SIZE_THRESHOLD = 15 * 1024 * 1024  # 15MB - optimize if larger
OPTIMIZATION_DURATION_THRESHOLD = 120  # 2 minutes - optimize if longer
OPTIMIZED_RESOLUTION = (1280, 720)  # 720p - sufficient for content understanding
OPTIMIZED_FPS = 5  # Gemini samples at 1 FPS, 5 gives flexibility
OPTIMIZED_CRF = 28  # H.264 quality (lower = better quality, higher size)
OPTIMIZED_AUDIO_BITRATE = "64k"  # Mono audio for voiceover analysis

# Gemini Upload Thresholds
INLINE_SIZE_THRESHOLD = 20 * 1024 * 1024  # 20MB - use Files API if larger
GEMINI_FILES_API_EXPIRY = 48 * 60 * 60  # 48 hours in seconds
