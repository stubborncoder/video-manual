"""Base rules that apply to all format conversions."""

BASE_CONVERSION_RULES = """
CRITICAL RULES FOR ALL CONVERSIONS:

1. PRESERVE ALL SCREENSHOT REFERENCES
   - Keep every ![...](../screenshots/...) EXACTLY as-is
   - Do not modify, remove, or rename any screenshot paths
   - Every screenshot in the source must appear in the output

2. MAINTAIN THE SAME LANGUAGE
   - If the source is in Spanish, output must be in Spanish
   - If the source is in English, output must be in English
   - Preserve the original language throughout

3. USE SEMANTIC TAGS
   - Output must use the target format's specific tags
   - Tags contain valid Markdown inside them
   - Follow the tag structure specified for the target format

4. OUTPUT FORMAT
   - Start DIRECTLY with <title> tag - no preamble, greetings, or explanations
   - End with the content - no closing remarks, summaries, or sign-offs
   - Do NOT add numbering to step titles (e.g., "Step 1:") - templates handle this

5. CONTENT FIDELITY
   - Preserve the core information and meaning
   - Adapt the structure and detail level to match the target format
   - Do not invent new information not present in the source
"""
