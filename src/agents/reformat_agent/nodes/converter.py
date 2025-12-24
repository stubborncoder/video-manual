"""Node for converting manual content to a different format."""

from typing import Any, Dict

from langchain_anthropic import ChatAnthropic

from ..state import ReformatState
from ..config import DEFAULT_REFORMAT_MODEL, LLM_TIMEOUT
from ..prompts import get_conversion_prompt
from ....db.usage_tracking import UsageTracking


def convert_manual(state: ReformatState) -> Dict[str, Any]:
    """Convert the entire manual to the target format in a single pass.

    Uses Claude to transform the manual content from one document format
    to another, preserving screenshots and adapting the structure.

    Args:
        state: Current workflow state with source_content, source_format, target_format

    Returns:
        Dict with converted_content and updated status
    """
    # Check for errors from previous node
    if state.get("status") == "error":
        return {}  # Pass through error state

    source_content = state.get("source_content")
    if not source_content:
        return {
            "status": "error",
            "error": "No source content available for conversion"
        }

    source_format = state["source_format"]
    target_format = state["target_format"]

    # Don't convert if formats are the same
    if source_format == target_format:
        return {
            "converted_content": source_content,
            "status": "completed"
        }

    try:
        # Build the conversion prompt
        prompt = get_conversion_prompt(source_format, target_format)

        # Parse model config (format: "provider:model_name")
        model_spec = DEFAULT_REFORMAT_MODEL
        if ":" in model_spec:
            _, model_name = model_spec.split(":", 1)
        else:
            model_name = model_spec

        # Create LLM client - NO max_tokens limit to allow full output
        llm = ChatAnthropic(
            model=model_name,
            timeout=LLM_TIMEOUT,
        )

        # Build the full prompt with the manual content attached
        full_prompt = f"""{prompt}

---

SOURCE MANUAL TO CONVERT:

{source_content}

---

Now convert the above manual to {target_format} format. Start directly with the <title> tag:"""

        # Invoke the LLM
        response = llm.invoke(full_prompt)

        converted_content = response.content

        # Log token usage
        try:
            usage = response.usage_metadata if hasattr(response, 'usage_metadata') else {}
            if usage:
                user_id = state.get("user_id")
                doc_id = state.get("source_doc_id")

                # Extract cache tokens for Claude
                cache_read_tokens = 0
                cache_creation_tokens = 0
                input_details = usage.get("input_token_details", {})
                if input_details:
                    cache_read_tokens = input_details.get("cache_read", 0)
                    cache_creation_tokens = input_details.get("cache_creation", 0)

                UsageTracking.log_request(
                    user_id=user_id,
                    operation="doc_reformat",
                    model=model_name,
                    input_tokens=usage.get("input_tokens", 0),
                    output_tokens=usage.get("output_tokens", 0),
                    cached_tokens=0,  # Gemini only
                    cache_read_tokens=cache_read_tokens,
                    cache_creation_tokens=cache_creation_tokens,
                    doc_id=doc_id,
                )
        except Exception as usage_error:
            # Don't fail the whole operation if usage tracking fails
            print(f"Warning: Failed to log token usage for reformat: {usage_error}")

        # Basic validation - check that output has expected structure
        if not converted_content or len(converted_content.strip()) < 50:
            return {
                "status": "error",
                "error": "Conversion produced empty or too short output"
            }

        return {
            "converted_content": converted_content,
            "status": "completed"
        }

    except Exception as e:
        return {
            "status": "error",
            "error": f"Conversion failed: {str(e)}"
        }
