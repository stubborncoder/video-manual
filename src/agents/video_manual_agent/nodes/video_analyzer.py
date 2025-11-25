"""Video analyzer node using Gemini for video understanding."""

import os
import base64
from typing import Dict, Any
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

from ..config import DEFAULT_GEMINI_MODEL
from ..prompts.system import VIDEO_ANALYZER_PROMPT
from ..tools.video_tools import get_video_metadata
from ..state import VideoManualState


def analyze_video_node(state: VideoManualState) -> Dict[str, Any]:
    """Analyze video content using Gemini via LangChain.

    This is a LangGraph node that reads from state and returns a partial state update.

    Args:
        state: Current workflow state containing video_path

    Returns:
        Partial state update with video_metadata, video_analysis, model_used, and status
    """
    # Load environment variables
    load_dotenv()

    # Get API key
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return {
            "status": "error",
            "error": "GOOGLE_API_KEY not found in environment variables",
        }

    video_path = state["video_path"]

    # Get video metadata
    try:
        metadata = get_video_metadata(video_path)
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to extract video metadata: {str(e)}",
        }

    # Read and encode video file
    try:
        with open(video_path, "rb") as video_file:
            video_data = base64.standard_b64encode(video_file.read()).decode("utf-8")
    except Exception as e:
        return {
            "status": "error",
            "error": f"Failed to read video file: {str(e)}",
        }

    # Create LLM model
    llm = ChatGoogleGenerativeAI(
        model=DEFAULT_GEMINI_MODEL,
        google_api_key=api_key,
    )

    # Use LangChain's multimodal message format
    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": VIDEO_ANALYZER_PROMPT,
            },
            {
                "type": "media",
                "mime_type": f"video/{metadata['filename'].split('.')[-1]}",
                "data": video_data,
            },
        ]
    )

    try:
        response = llm.invoke([message])
    except Exception as e:
        return {
            "status": "error",
            "error": f"Video analysis API error: {str(e)}",
        }

    # Return partial state update
    return {
        "video_metadata": metadata,
        "video_analysis": response.content,
        "model_used": DEFAULT_GEMINI_MODEL,
        "status": "analyzing_complete",
    }
