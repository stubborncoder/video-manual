# Video Manual Platform

A multi-agent platform for generating user manuals from instructional videos using Google's Gemini AI and LangGraph workflows.

## Overview

The Video Manual Platform provides intelligent agents that:
- **Analyze video content** using Gemini 2.5 Pro's advanced video understanding
- **Identify key moments** where important instructions occur
- **Extract screenshots** from critical timestamps
- **Generate documentation** with step-by-step instructions and visual aids

Built with **LangGraph v1** for workflow orchestration and **SQLite checkpointing** for persistence.

## Architecture

```
video-manual/
├── src/
│   ├── config.py                    # Global configuration
│   ├── storage/                     # User data management
│   │   └── user_storage.py          # Per-user folder structure
│   └── agents/
│       └── video_manual_agent/      # LangGraph video manual agent
│           ├── state.py             # Workflow state definition
│           ├── graph.py             # LangGraph StateGraph
│           ├── agent.py             # Main agent class
│           ├── nodes/               # Graph nodes
│           ├── prompts/             # System prompts
│           └── tools/               # Video processing utilities
├── data/                            # Runtime data (gitignored)
│   ├── users/{user_id}/             # Per-user storage
│   │   ├── videos/                  # Uploaded videos
│   │   └── manuals/{manual_id}/     # Generated manuals
│   └── checkpoints/                 # Per-agent SQLite DBs
└── tests/
```

### LangGraph Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    VideoManualGraph                          │
├─────────────────────────────────────────────────────────────┤
│  START                                                       │
│    │                                                         │
│    ▼                                                         │
│  ┌──────────────────┐                                       │
│  │  analyze_video   │  ← Gemini video analysis              │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │identify_keyframes│  ← Scene detection + Gemini           │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │ generate_manual  │  ← Screenshots + Markdown             │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│         END                                                  │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Python 3.13+
- Google Gemini API key
- FFmpeg (for video processing)

### Setup

```bash
# Clone and enter directory
cd /path/to/video-manual

# Install dependencies with uv
uv sync

# Copy environment template
cp .env.example .env

# Add your Gemini API key to .env
echo "GOOGLE_API_KEY=your_key_here" >> .env
```

## Usage

### Basic Usage

```python
from src.agents.video_manual_agent import VideoManualAgent

# Create agent (with SQLite checkpointing enabled by default)
agent = VideoManualAgent()

# Generate manual from video
result = agent.create_manual(
    video_path="/path/to/tutorial.mp4",
    user_id="user_123",                # Required: identifies output folder
    output_filename="my_manual",       # Optional
    use_scene_detection=True,          # Enable intelligent scene detection
)

print(f"Manual saved to: {result['manual_path']}")
print(f"Screenshots: {len(result['screenshots'])}")
```

### Factory Function

```python
from src.agents.video_manual_agent import create_video_manual_agent

agent = create_video_manual_agent(
    model_name="gemini-2.5-pro",
    use_checkpointer=True
)
```

### Direct Graph Access

```python
from src.agents.video_manual_agent import get_video_manual_graph

# Get compiled graph with checkpointer
graph = get_video_manual_graph()

# Run with custom thread_id for resumability
result = graph.invoke(
    initial_state,
    config={"configurable": {"thread_id": "my_session"}}
)
```

### Access User Manuals

```python
from src.storage.user_storage import UserStorage

storage = UserStorage("user_123")

# List all manuals for user
manuals = storage.list_manuals()

# Read a specific manual
content = storage.get_manual_content("abc12345")
```

## Output Structure

```
data/users/user_123/
├── videos/                          # Uploaded video files
│   └── tutorial.mp4
└── manuals/
    └── abc12345/                    # Generated manual
        ├── manual.md                # Markdown manual
        └── screenshots/
            ├── figure_01_t15s.png   # Screenshot at 15 seconds
            ├── figure_02_t42s.png   # Screenshot at 42 seconds
            └── ...
```

## Configuration

### Global Config (`src/config.py`)

```python
# Data directories
DATA_DIR = PROJECT_ROOT / "data"
USERS_DIR = DATA_DIR / "users"
CHECKPOINTS_DIR = DATA_DIR / "checkpoints"

# Per-agent checkpoint databases
get_checkpoint_db_path("video_manual_agent")  # Returns: data/checkpoints/video_manual_agent.db
```

### Agent Config (`src/agents/video_manual_agent/config.py`)

```python
# Model Selection
DEFAULT_GEMINI_MODEL = "gemini-2.5-pro"  # Best for video understanding

# Video Processing
MAX_VIDEO_DURATION = 7200  # 2 hours max
KEYFRAME_MIN_INTERVAL = 1  # Minimum seconds between keyframes

# Screenshot Settings
SCREENSHOT_FORMAT = "PNG"
SCREENSHOT_QUALITY = 95
SCREENSHOT_MAX_WIDTH = 1920

# Scene Detection
SCENE_THRESHOLD = 27.0
MIN_SCENE_LENGTH = 3  # seconds
```

## State Management

The workflow uses a typed state definition (`VideoManualState`):

```python
class VideoManualState(TypedDict):
    # User context
    user_id: str
    manual_id: Optional[str]

    # Input
    video_path: str
    use_scene_detection: bool

    # Results from each node
    video_metadata: Optional[Dict]
    video_analysis: Optional[str]
    keyframes: Optional[List[Dict]]
    manual_content: Optional[str]
    manual_path: Optional[str]
    screenshots: Optional[List[Dict]]

    # Status
    status: str  # "pending", "completed", "error"
    error: Optional[str]
```

## Checkpointing

Each agent has its own SQLite database for checkpointing:

```
data/checkpoints/
├── video_manual_agent.db    # Video manual agent checkpoints
└── future_agent.db          # Future agents get their own DBs
```

This enables:
- **Resumability**: Resume interrupted workflows
- **Debugging**: Inspect state at each step
- **Independence**: Agents don't interfere with each other

## Dependencies

### Core
- `langchain>=1.0.3` - LangChain core
- `langchain-google-genai>=2.1.0` - Gemini integration
- `langgraph>=0.5.0` - Graph-based workflows
- `langgraph-checkpoint-sqlite>=1.0.0` - SQLite checkpointing
- `deepagents>=0.2.7` - For future DeepAgent integration

### Video Processing
- `opencv-python>=4.10.0` - Frame extraction
- `moviepy>=2.1.0` - Video manipulation
- `scenedetect[opencv]>=0.6.4` - Scene detection
- `ffmpeg-python>=0.2.0` - Video operations

### Image Processing
- `pillow>=11.0.0` - Image optimization
- `numpy>=2.0.0` - Numerical operations

## Future Roadmap

This platform is designed to support multiple agents:

- **Video Manual Agent** (this one) - LangGraph-based
- **Manual Editor Agent** (future) - For user editing of generated manuals
- **DeepAgent** (future) - Using the DeepAgents framework
- **Additional agents** - Each with independent checkpointing

## License

MIT License
