"""Gemini Files API integration for uploading large videos.

When videos exceed 20MB (even after optimization), they must be uploaded
via Google's Files API rather than sent inline as base64. This module
handles the upload process and file URI management.

Files uploaded to Gemini are automatically deleted after 48 hours.

Uses the newer google-genai SDK (from google import genai).
"""

import os
import time
from typing import Optional, Dict, Any

from google import genai
from google.genai import types

from ..config import INLINE_SIZE_THRESHOLD


def get_genai_client(api_key: Optional[str] = None) -> genai.Client:
    """Get a configured Google GenAI client.

    Args:
        api_key: Optional API key. If not provided, uses GOOGLE_API_KEY env var.

    Returns:
        Configured genai.Client instance
    """
    if api_key is None:
        api_key = os.getenv("GOOGLE_API_KEY")

    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in environment variables")

    return genai.Client(api_key=api_key)


def needs_files_api(video_path: str) -> bool:
    """Check if a video needs to be uploaded via Files API.

    Args:
        video_path: Path to the video file

    Returns:
        True if file exceeds inline size threshold (20MB)
    """
    return os.path.getsize(video_path) >= INLINE_SIZE_THRESHOLD


def upload_video_to_gemini(
    video_path: str,
    display_name: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Upload a video to Gemini Files API.

    Args:
        video_path: Path to the video file to upload
        display_name: Optional display name for the file in Gemini
        api_key: Optional API key (uses env var if not provided)

    Returns:
        Dict with:
            - uri: The Gemini file URI for referencing in requests
            - name: The file name in Gemini
            - display_name: The display name
            - size_bytes: File size
            - state: Processing state (ACTIVE when ready)
            - mime_type: The file's MIME type

    Raises:
        RuntimeError: If upload fails or file processing times out
    """
    client = get_genai_client(api_key)

    if display_name is None:
        display_name = os.path.basename(video_path)

    # Determine MIME type from extension
    ext = os.path.splitext(video_path)[1].lower()
    mime_types = {
        ".mp4": "video/mp4",
        ".mpeg": "video/mpeg",
        ".mpg": "video/mpeg",
        ".mov": "video/mov",
        ".avi": "video/avi",
        ".webm": "video/webm",
        ".wmv": "video/wmv",
        ".flv": "video/x-flv",
        ".3gp": "video/3gpp",
    }
    mime_type = mime_types.get(ext, "video/mp4")

    # Upload the file using the new SDK
    uploaded_file = client.files.upload(
        file=video_path,
        config=types.UploadFileConfig(
            display_name=display_name,
            mime_type=mime_type,
        ),
    )

    # Wait for processing to complete
    # Gemini processes videos asynchronously after upload
    max_wait_seconds = 300  # 5 minutes max wait
    wait_interval = 5  # Check every 5 seconds
    elapsed = 0

    while uploaded_file.state.name == "PROCESSING":
        if elapsed >= max_wait_seconds:
            raise RuntimeError(
                f"Video processing timed out after {max_wait_seconds} seconds. "
                f"File: {uploaded_file.name}"
            )

        time.sleep(wait_interval)
        elapsed += wait_interval

        # Refresh file status
        uploaded_file = client.files.get(name=uploaded_file.name)

    if uploaded_file.state.name == "FAILED":
        raise RuntimeError(
            f"Video processing failed. File: {uploaded_file.name}, "
            f"Error: {getattr(uploaded_file, 'error', 'Unknown error')}"
        )

    return {
        "uri": uploaded_file.uri,
        "name": uploaded_file.name,
        "display_name": uploaded_file.display_name,
        "size_bytes": uploaded_file.size_bytes,
        "state": uploaded_file.state.name,
        "mime_type": uploaded_file.mime_type,
    }


def get_file_status(
    file_name: str, api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Get the current status of an uploaded file.

    Args:
        file_name: The Gemini file name (from upload response)
        api_key: Optional API key

    Returns:
        Dict with file status information
    """
    client = get_genai_client(api_key)

    try:
        file_info = client.files.get(name=file_name)
        return {
            "uri": file_info.uri,
            "name": file_info.name,
            "state": file_info.state.name,
            "size_bytes": file_info.size_bytes,
            "exists": True,
        }
    except Exception as e:
        return {
            "exists": False,
            "error": str(e),
        }


def delete_uploaded_file(file_name: str, api_key: Optional[str] = None) -> bool:
    """Delete an uploaded file from Gemini.

    Args:
        file_name: The Gemini file name to delete
        api_key: Optional API key

    Returns:
        True if deletion was successful
    """
    client = get_genai_client(api_key)

    try:
        client.files.delete(name=file_name)
        return True
    except Exception:
        return False


def list_uploaded_files(api_key: Optional[str] = None) -> list:
    """List all files currently uploaded to Gemini.

    Args:
        api_key: Optional API key

    Returns:
        List of file information dicts
    """
    client = get_genai_client(api_key)

    files = []
    for f in client.files.list():
        files.append(
            {
                "uri": f.uri,
                "name": f.name,
                "display_name": f.display_name,
                "state": f.state.name,
                "size_bytes": f.size_bytes,
            }
        )

    return files
