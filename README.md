# vDocs

AI-powered documentation from video. A full-stack platform for generating professional step-by-step documentation from instructional videos using Google Gemini and Anthropic Claude.

## Overview

vDocs provides:
- **Video Analysis** - Gemini 2.5 Pro analyzes video content to identify key instructional moments
- **Smart Keyframe Selection** - Automatically identifies the best frames to capture as screenshots
- **Documentation Generation** - Claude generates clear, professional Markdown manuals with embedded screenshots
- **Web Dashboard** - Modern React UI for managing videos, manuals, and projects
- **Async Processing** - Non-blocking video processing with real-time progress tracking

## Tech Stack

### Backend
- **Python 3.12+** with FastAPI
- **LangGraph** for AI workflow orchestration
- **Google Gemini 2.5 Pro** for video understanding
- **Anthropic Claude** for manual generation
- **Supabase** for authentication and PostgreSQL database
- **SQLite** for job persistence
- **FFmpeg** for video processing

### Frontend
- **Next.js 16** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** + **shadcn/ui** components
- **Supabase Auth** for user authentication
- **Zustand** for state management
- **WebSocket** for real-time updates

### Infrastructure
- **Hostinger VPS** for production hosting
- **Docker Compose** for containerized deployment
- **Caddy** as reverse proxy with automatic HTTPS
- **GitHub Actions** for CI/CD

## Architecture

```
vDocs/
├── src/                          # Backend (Python)
│   ├── api/                      # FastAPI application
│   │   ├── routes/               # REST endpoints
│   │   │   ├── jobs.py           # Job tracking API
│   │   │   ├── manuals.py        # Manual CRUD
│   │   │   ├── videos.py         # Video management
│   │   │   └── projects.py       # Project organization
│   │   └── websockets/           # WebSocket handlers
│   │       └── process_video.py  # Real-time processing
│   ├── agents/
│   │   └── video_manual_agent/   # LangGraph workflow
│   │       ├── graph.py          # StateGraph definition
│   │       ├── nodes/            # Processing nodes
│   │       └── prompts/          # AI prompts
│   ├── db/                       # SQLite database
│   │   ├── database.py           # Connection management
│   │   ├── job_storage.py        # Job CRUD operations
│   │   └── vdocs.db              # Database file
│   └── storage/                  # File storage
│       ├── user_storage.py       # Per-user data
│       └── project_storage.py    # Project organization
├── frontend/                     # Frontend (Next.js)
│   └── src/
│       ├── app/dashboard/        # Dashboard pages
│       ├── components/           # UI components
│       ├── hooks/                # React hooks
│       ├── stores/               # Zustand stores
│       └── lib/                  # API client, utilities
└── data/                         # Runtime data (gitignored)
    └── users/{user_id}/
        ├── videos/               # Uploaded videos
        └── manuals/{manual_id}/  # Generated manuals
```

### Processing Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    VideoManualGraph                          │
├─────────────────────────────────────────────────────────────┤
│  START                                                       │
│    │                                                         │
│    ▼                                                         │
│  ┌──────────────────┐                                       │
│  │  analyze_video   │  ← Gemini: analyze content + select   │
│  │                  │    keyframe timestamps                 │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │identify_keyframes│  ← Extract screenshots at timestamps  │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                       │
│  │ generate_manual  │  ← Claude: create Markdown manual     │
│  └────────┬─────────┘                                       │
│           │                                                  │
│           ▼                                                  │
│         END                                                  │
└─────────────────────────────────────────────────────────────┘
```

### Job System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                    │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│  │ useWebSocket.ts │   │ jobsStore.ts    │   │ JobProgressToast.tsx │   │
│  │ (starts job)    │──▶│ (Zustand store) │──▶│ (displays progress) │   │
│  └────────┬────────┘   └────────▲────────┘   └─────────────────────┘   │
│           │                     │                                       │
│           │ WebSocket           │ REST API (polling fallback)          │
│           ▼                     │                                       │
└───────────┼─────────────────────┼───────────────────────────────────────┘
            │                     │
┌───────────┼─────────────────────┼───────────────────────────────────────┐
│           │                     │                Backend                 │
│           ▼                     │                                       │
│  ┌─────────────────────┐   ┌────┴────────────┐   ┌──────────────────┐  │
│  │ process_video.py    │──▶│ routes/jobs.py  │◀──│ job_storage.py   │  │
│  │ (WebSocket handler) │   │ (REST endpoints)│   │ (CRUD operations)│  │
│  └─────────┬───────────┘   └─────────────────┘   └────────▲─────────┘  │
│            │                                               │            │
│            └───────────────────────────────────────────────┘            │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                         SQLite (vdocs.db)                         │ │
│  │  jobs: id, user_id, video_name, status, current_node, ...        │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Python 3.12+
- Node.js 20+
- FFmpeg (for video processing)
- Google Gemini API key
- Anthropic API key
- Supabase project (for authentication)

### Backend Setup

```bash
# Clone and enter directory
cd video-manual

# Install Python dependencies with uv
uv sync

# Copy environment template
cp .env.example .env

# Add your API keys to .env
GOOGLE_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Usage

### Running the Application

```bash
# Terminal 1: Start backend API
uv run vdocs-api

# Terminal 2: Start frontend
cd frontend && npm run dev
```

Then open http://localhost:3000 in your browser.

### CLI Usage

```bash
# Process a video directly
uv run vdocs process /path/to/video.mp4 --output my-manual

# List manuals
uv run vdocs list

# Get help
uv run vdocs --help
```

### Programmatic Usage

```python
from src.agents.video_manual_agent import VideoManualAgent

agent = VideoManualAgent()

result = agent.create_manual(
    video_path="/path/to/tutorial.mp4",
    user_id="user_123",
    output_filename="my_manual",
    use_scene_detection=True,
    output_language="English",
)

print(f"Manual saved to: {result['manual_path']}")
```

## API Endpoints

### Videos
- `GET /api/videos` - List user's videos
- `POST /api/videos/upload` - Upload a video
- `DELETE /api/videos/{name}` - Delete a video

### Manuals
- `GET /api/manuals` - List user's manuals
- `GET /api/manuals/{id}` - Get manual content
- `PUT /api/manuals/{id}/content` - Update manual content
- `POST /api/manuals/{id}/evaluate` - AI quality evaluation
- `POST /api/manuals/{id}/export/{format}` - Export to PDF/Word/HTML

### Jobs
- `GET /api/jobs` - List processing jobs
- `GET /api/jobs/active` - List active jobs
- `GET /api/jobs/{id}` - Get job status
- `POST /api/jobs/{id}/seen` - Mark job as seen

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `PUT /api/projects/{id}` - Update project
- `DELETE /api/projects/{id}` - Delete project

### WebSocket
- `WS /api/ws/process` - Real-time video processing with progress events

## Configuration

### Environment Variables

```bash
# Required - AI Services
GOOGLE_API_KEY=           # Gemini API key
ANTHROPIC_API_KEY=        # Claude API key

# Required - Supabase Authentication
SUPABASE_URL=             # Your Supabase project URL
SUPABASE_ANON_KEY=        # Supabase anonymous/public key
SUPABASE_SERVICE_ROLE_KEY= # Supabase service role key (backend only)
SUPABASE_JWT_SECRET=      # JWT secret for token verification
DATABASE_URL=             # PostgreSQL connection string

# Frontend (Next.js public vars)
NEXT_PUBLIC_API_URL=      # Backend API URL (e.g., http://localhost:8000)
NEXT_PUBLIC_SUPABASE_URL= # Same as SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Same as SUPABASE_ANON_KEY

# Optional
VDOCS_DATA_DIR=          # Data directory (default: ./data)
CORS_ORIGINS=            # Allowed CORS origins (comma-separated)
```

### Agent Configuration

See `src/agents/video_manual_agent/config.py`:

```python
DEFAULT_GEMINI_MODEL = "gemini-2.5-pro"
MAX_VIDEO_DURATION = 7200  # 2 hours
SCREENSHOT_FORMAT = "PNG"
SCREENSHOT_MAX_WIDTH = 1920
```

## Output Structure

```
data/users/{user_id}/
├── videos/
│   └── tutorial.mp4
└── manuals/
    └── my-manual/
        ├── en/
        │   └── manual.md          # English manual
        ├── es/
        │   └── manual.md          # Spanish manual (if generated)
        ├── screenshots/
        │   ├── figure_01_t15s.png  # Screenshot at 15s
        │   ├── figure_02_t42s.png  # Screenshot at 42s
        │   └── ...
        └── metadata.json          # Manual metadata
```

## Features

### Video Processing
- Supports MP4, WebM, AVI, MOV formats
- Automatic video optimization for AI processing
- Scene detection for intelligent keyframe selection

### Manual Generation
- Multi-language support
- Markdown output with embedded screenshots
- AI-powered quality evaluation
- Version history with restore capability

### Project Organization
- Group manuals into projects
- Organize with chapters
- Tag-based filtering
- Compile project documentation

### Editor
- Live Markdown preview
- AI copilot for editing assistance
- Image replacement from video frames
- Undo/redo with keyboard shortcuts
- Auto-save

### Authentication & Users
- Email/password authentication via Supabase
- Google OAuth integration
- Role-based access control (user/admin)
- Admin dashboard for user management
- Invite-only registration (alpha phase)

## Production Deployment

vDocs is deployed on a **Hostinger VPS** at [https://vdocs.ai](https://vdocs.ai)

### Infrastructure
```
┌─────────────────────────────────────────────────────────┐
│                    Hostinger VPS                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                    Caddy                         │   │
│  │         (Reverse Proxy + Auto HTTPS)            │   │
│  │                vdocs.ai:443                      │   │
│  └──────────────────┬──────────────────────────────┘   │
│                     │                                   │
│         ┌───────────┴───────────┐                      │
│         ▼                       ▼                      │
│  ┌─────────────┐         ┌─────────────┐              │
│  │  Frontend   │         │  Backend    │              │
│  │  (Next.js)  │         │  (FastAPI)  │              │
│  │  :3000      │         │  :8000      │              │
│  └─────────────┘         └─────────────┘              │
│                                 │                      │
│                                 ▼                      │
│                          ┌─────────────┐              │
│                          │  Supabase   │              │
│                          │  (Auth/DB)  │              │
│                          └─────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Deployment Process
Deployment is automated via GitHub Actions:
1. Push/merge to `main` branch
2. CI runs linting and build checks
3. On success, CD deploys to VPS via SSH
4. Docker images are rebuilt and containers restarted
5. Health checks verify the deployment

## Development

### Git Workflow

We use GitHub Flow with the following branch conventions:

- `main` / `master` - Production-ready code (auto-deploys)
- `feature/*` - New functionality
- `fix/*` - Bug fixes
- `hotfix/*` - Urgent production fixes

**All changes go through Pull Requests.**

### CI/CD Pipeline

**On every Pull Request:**
- **Frontend**: ESLint + Next.js build verification
- **Backend**: Ruff linting
- **Claude Code Review**: AI-powered code review

**On merge to main:**
- Automatic deployment to production VPS
- Docker images rebuilt
- Health checks verified

#### GitHub Secrets Setup

For auto-deploy to work, add these secrets in GitHub → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | Your VPS IP address |
| `VPS_SSH_KEY` | SSH private key (full content including BEGIN/END lines) |

### Running Tests

```bash
# Backend tests
uv run pytest

# Frontend tests
cd frontend && npm test
```

### Linting

```bash
# Backend (Python)
uv run ruff check .        # Find issues
uv run ruff check . --fix  # Auto-fix issues

# Frontend (TypeScript)
cd frontend && npm run lint
```

### Building for Production

```bash
# Frontend
cd frontend && npm run build

# The backend runs directly with uvicorn
uv run vdocs-api --host 0.0.0.0 --port 8000
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker compose build
docker compose up -d

# Check logs
docker compose logs -f
```

## License

MIT License
