"""Video preprocessor for optimizing videos before Gemini analysis.

Gemini processes video at 1 FPS, so sending high-bitrate 30fps video is wasteful.
This module creates optimized versions for efficient upload while preserving
the original for high-quality screenshot extraction.
"""

import os
import subprocess
import shutil
from typing import Dict, Any, Optional

from ..config import (
    OPTIMIZATION_SIZE_THRESHOLD,
    OPTIMIZATION_DURATION_THRESHOLD,
    OPTIMIZED_RESOLUTION,
    OPTIMIZED_FPS,
    OPTIMIZED_CRF,
    OPTIMIZED_AUDIO_BITRATE,
)


def check_ffmpeg_available() -> bool:
    """Check if FFmpeg is available in the system PATH."""
    return shutil.which("ffmpeg") is not None


def needs_optimization(video_metadata: Dict[str, Any]) -> bool:
    """Determine if a video needs optimization based on size and duration.

    Args:
        video_metadata: Video metadata dict with 'size_bytes' and 'duration_seconds'

    Returns:
        True if video should be optimized for Gemini upload
    """
    size_bytes = video_metadata.get("size_bytes", 0)
    duration_seconds = video_metadata.get("duration_seconds", 0)

    return (
        size_bytes > OPTIMIZATION_SIZE_THRESHOLD
        or duration_seconds > OPTIMIZATION_DURATION_THRESHOLD
    )


def get_optimization_settings(video_metadata: Dict[str, Any]) -> Dict[str, Any]:
    """Determine optimal compression settings based on video characteristics.

    Args:
        video_metadata: Video metadata dict with resolution and duration info

    Returns:
        Dict with compression settings (resolution, fps, crf, audio_bitrate)
    """
    width = video_metadata.get("width", 1920)
    height = video_metadata.get("height", 1080)

    # Calculate target resolution maintaining aspect ratio
    target_width, target_height = OPTIMIZED_RESOLUTION

    # Only downscale, never upscale
    if width <= target_width and height <= target_height:
        # Video is already smaller than target, keep original resolution
        final_width = width
        final_height = height
    else:
        # Calculate scale factor to fit within target while maintaining aspect ratio
        scale_w = target_width / width
        scale_h = target_height / height
        scale = min(scale_w, scale_h)

        final_width = int(width * scale)
        final_height = int(height * scale)

        # Ensure dimensions are even (required by H.264)
        final_width = final_width - (final_width % 2)
        final_height = final_height - (final_height % 2)

    return {
        "width": final_width,
        "height": final_height,
        "fps": OPTIMIZED_FPS,
        "crf": OPTIMIZED_CRF,
        "audio_bitrate": OPTIMIZED_AUDIO_BITRATE,
    }


def preprocess_video_for_analysis(
    video_path: str,
    output_dir: str,
    video_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create an optimized version of a video for Gemini analysis.

    The optimized video is compressed to reduce file size while maintaining
    sufficient quality for AI content understanding. The original video
    is preserved for high-quality screenshot extraction.

    Args:
        video_path: Path to the original video file
        output_dir: Directory to save the optimized video
        video_metadata: Optional pre-computed video metadata

    Returns:
        Dict with:
            - optimized_path: Path to the optimized video
            - original_size: Original file size in bytes
            - optimized_size: Optimized file size in bytes
            - compression_ratio: Size reduction ratio
            - settings: Compression settings used

    Raises:
        RuntimeError: If FFmpeg is not available or compression fails
    """
    if not check_ffmpeg_available():
        raise RuntimeError(
            "FFmpeg is required for video optimization but was not found. "
            "Please install FFmpeg: https://ffmpeg.org/download.html"
        )

    # Get video metadata if not provided
    if video_metadata is None:
        from .video_tools import get_video_metadata

        video_metadata = get_video_metadata(video_path)

    # Get compression settings
    settings = get_optimization_settings(video_metadata)

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Generate output filename
    output_filename = "video_optimized.mp4"
    output_path = os.path.join(output_dir, output_filename)

    # Build FFmpeg command
    # Using H.264 codec with CRF for quality-based encoding
    ffmpeg_cmd = [
        "ffmpeg",
        "-i",
        video_path,
        "-y",  # Overwrite output file if exists
        "-c:v",
        "libx264",  # H.264 codec
        "-preset",
        "medium",  # Balance between speed and compression
        "-crf",
        str(settings["crf"]),  # Quality level
        "-vf",
        f"scale={settings['width']}:{settings['height']},fps={settings['fps']}",
        "-c:a",
        "aac",  # AAC audio codec
        "-b:a",
        settings["audio_bitrate"],
        "-ac",
        "1",  # Mono audio
        "-movflags",
        "+faststart",  # Enable streaming
        output_path,
    ]

    # Run FFmpeg
    try:
        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg compression failed: {e.stderr}")

    # Calculate compression results
    original_size = os.path.getsize(video_path)
    optimized_size = os.path.getsize(output_path)
    compression_ratio = original_size / optimized_size if optimized_size > 0 else 0

    return {
        "optimized_path": output_path,
        "original_size": original_size,
        "optimized_size": optimized_size,
        "compression_ratio": round(compression_ratio, 2),
        "settings": settings,
    }


def format_size(size_bytes: int) -> str:
    """Format byte size to human readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"