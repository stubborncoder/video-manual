"""Guide agent chat routes."""

import logging
from typing import AsyncGenerator
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ...config import get_chat_model
from ..dependencies import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/guide", tags=["guide"])


class GuideChatRequest(BaseModel):
    """Request body for guide chat."""

    message: str
    page_context: dict | None = None
    thread_id: str | None = None


class GuideResponse(BaseModel):
    """Response from guide chat."""

    content: str
    thread_id: str | None = None


# System prompt for the guide agent
GUIDE_SYSTEM_PROMPT = """You are a helpful documentation assistant for vDocs, an AI-powered application that creates step-by-step documentation from videos.

## Your Role
- Help users navigate the application
- Explain features and workflows
- Guide users through tasks step-by-step
- Answer questions about the app and its capabilities

## Available Pages
- Dashboard: Overview of recent activity and statistics
- Videos: Upload and manage source videos for documentation
- Manuals: View and edit generated documentation
- Projects: Organize manuals into collections
- Templates: Manage export templates for different formats
- Trash: Recover deleted items

## Core Workflows
1. **Creating Documentation from Video:**
   - Upload a video file (MP4, MOV, AVI formats)
   - Process the video to generate step-by-step documentation
   - Review and edit the generated manual
   - Export in various formats (PDF, Markdown, etc.)

2. **Managing Projects:**
   - Create a project to organize related manuals
   - Add manuals to projects as chapters
   - Compile the project into a complete documentation package

3. **Editing Documentation:**
   - Use the manual editor to review AI-generated content
   - Edit text, captions, and structure
   - Add additional languages for multilingual documentation
   - Evaluate documentation quality

## Guidelines
- Be concise but helpful
- Provide clear step-by-step instructions when needed
- Use friendly, conversational language
- If you don't know something, be honest about it
- Suggest relevant next steps based on the user's current page

## Current Context
{context}"""


async def generate_guide_response(
    request: GuideChatRequest, user_id: str
) -> AsyncGenerator[str, None]:
    """Generate streaming response from the guide agent.

    Args:
        request: The chat request with message and context
        user_id: The current user ID

    Yields:
        Server-sent event formatted chunks
    """
    try:
        # Build context string from page context
        context_str = "No specific page context available."
        if request.page_context:
            page_title = request.page_context.get("pageTitle", "Unknown")
            current_page = request.page_context.get("currentPage", "")
            available_actions = request.page_context.get("availableActions", [])

            context_str = f"Current Page: {page_title} ({current_page})\n"
            if available_actions:
                context_str += f"Available Actions: {', '.join(available_actions)}"

        # Format system prompt with context
        system_prompt = GUIDE_SYSTEM_PROMPT.format(context=context_str)

        # Get chat model
        model = get_chat_model()

        # Create messages
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": request.message},
        ]

        # Stream response
        accumulated_content = ""
        async for chunk in model.astream(messages):
            if hasattr(chunk, "content") and chunk.content:
                accumulated_content += chunk.content
                # Send as server-sent event
                yield f"data: {chunk.content}\n\n"

        # Send done signal
        yield "data: [DONE]\n\n"

    except Exception as e:
        logger.error(f"Error generating guide response: {e}", exc_info=True)
        yield f"data: I apologize, but I encountered an error. Please try again.\n\n"
        yield "data: [DONE]\n\n"


@router.post("/chat")
async def guide_chat(
    request: GuideChatRequest,
    user_id: str = Depends(get_current_user_id),
) -> StreamingResponse:
    """Stream guide agent responses.

    Args:
        request: The chat request
        user_id: Current user ID from auth

    Returns:
        Streaming response with SSE format
    """
    return StreamingResponse(
        generate_guide_response(request, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
