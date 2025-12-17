# vDocs

AI-powered documentation from video. Generates step-by-step visual documentation from video content using LangGraph.

## Stack
- Python 3.12+, LangGraph, LangChain
- Google Gemini (video analysis), Anthropic Claude (manual generation)
- UV package manager

## Commands
- `uv run vdocs` - Run CLI (recommended)
- `uv run vdocs-api` - Run API server
- `uv sync` - Install dependencies
- `uv run pytest` - Run tests
- `uv run python -m src.cli.main` - Alternative: direct module execution

## Structure
- `src/agents/video_manual_agent/` - LangGraph agent with nodes for video analysis
- `src/storage/` - User storage handling
- `src/cli/` - Command-line interface

## Development
- To see images use always WSL path in first place
- You are not allowed to make significant changes without requesting permision, a significant change include removing already working functionality.
- You MUST make use of extensive use of your frontend-design skill in order to make changes to the UI/UX

## Localization and I18N
- The current site UI is in Spanish and English, ALWAYS be sure that there is a translation for any ui component that the user may need
