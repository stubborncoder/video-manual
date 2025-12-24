"""Video processing tools for extracting keyframes and metadata."""

import os
from pathlib import Path
from typing import Dict, List, Optional
import cv2
from PIL import Image
from scenedetect import detect, AdaptiveDetector
from ..config import (
    SCREENSHOT_FORMAT,
    SCREENSHOT_QUALITY,
    SCREENSHOT_MAX_WIDTH,
    SCENE_THRESHOLD,
    MIN_SCENE_LENGTH,
)


def get_video_metadata(video_path: str) -> Dict[str, any]:
    """Extract metadata from video file.

    Args:
        video_path: Path to video file

    Returns:
        Dictionary containing video metadata
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    cap = cv2.VideoCapture(video_path)

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        metadata = {
            "path": video_path,
            "filename": os.path.basename(video_path),
            "fps": fps,
            "frame_count": frame_count,
            "duration_seconds": duration,
            "duration_formatted": f"{int(duration // 60)}:{int(duration % 60):02d}",
            "resolution": f"{width}x{height}",
            "width": width,
            "height": height,
            "size_bytes": os.path.getsize(video_path),
        }

        return metadata
    finally:
        cap.release()


def extract_screenshot_at_timestamp(
    video_path: str,
    timestamp_seconds: float,
    output_path: str,
    max_width: int = SCREENSHOT_MAX_WIDTH,
) -> str:
    """Extract a screenshot from video at specific timestamp.

    Args:
        video_path: Path to video file
        timestamp_seconds: Timestamp in seconds
        output_path: Path to save screenshot
        max_width: Maximum width for screenshot (maintains aspect ratio)

    Returns:
        Path to saved screenshot
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    cap = cv2.VideoCapture(video_path)

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_number = int(timestamp_seconds * fps)

        # Set position to specific frame
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)

        # Read frame
        success, frame = cap.read()

        if not success:
            raise ValueError(f"Could not read frame at timestamp {timestamp_seconds}s")

        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Create PIL Image
        image = Image.fromarray(frame_rgb)

        # Resize if needed
        if image.width > max_width:
            ratio = max_width / image.width
            new_height = int(image.height * ratio)
            image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)

        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Save screenshot
        image.save(output_path, format=SCREENSHOT_FORMAT, quality=SCREENSHOT_QUALITY)

        print(f"Screenshot saved: {output_path}")
        return output_path

    finally:
        cap.release()


def detect_scene_changes(
    video_path: str,
    threshold: float = SCENE_THRESHOLD,
    min_scene_length: float = MIN_SCENE_LENGTH,
) -> List[Dict[str, float]]:
    """Detect scene changes in video using PySceneDetect.

    Args:
        video_path: Path to video file
        threshold: Sensitivity threshold for scene detection
        min_scene_length: Minimum scene length in seconds

    Returns:
        List of scene change timestamps with metadata
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    print(f"Detecting scene changes in: {video_path}")

    # Detect scenes using adaptive detector for better results
    scene_list = detect(
        video_path,
        AdaptiveDetector(
            adaptive_threshold=threshold,
            min_scene_len=int(min_scene_length * 30)  # Convert to frames (assuming ~30fps)
        )
    )

    scenes = []
    for i, (start_time, end_time) in enumerate(scene_list):
        scenes.append({
            "scene_number": i + 1,
            "start_seconds": start_time.get_seconds(),
            "end_seconds": end_time.get_seconds(),
            "duration_seconds": (end_time - start_time).get_seconds(),
            "start_formatted": str(start_time),
            "end_formatted": str(end_time),
        })

    print(f"Detected {len(scenes)} scenes")
    return scenes
