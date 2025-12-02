# vDocs

AI-powered documentation from video. Generates step-by-step visual documentation from video content using LangGraph.

## Stack
- Python 3.12+, LangGraph, LangChain
- Google Gemini (video analysis), Anthropic Claude (manual generation)
- UV package manager

## Commands
- `uv run python -m src.cli.main` - Run CLI
- `uv sync` - Install dependencies
- `uv run pytest` - Run tests

## Structure
- `src/agents/video_manual_agent/` - LangGraph agent with nodes for video analysis
- `src/storage/` - User storage handling
- `src/cli/` - Command-line interface
