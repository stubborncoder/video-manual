---
description: Start vDocs development servers
argument-hint: "[backend|frontend|both]"
allowed-tools: ["Bash"]
---

# Development Servers

Start local development servers for vDocs.

## Commands

### `backend` (default)
Start the Python API server with auto-reload.

```bash
uv run vdocs-api --reload --port 8000
```

Or run directly:
```bash
uv run uvicorn src.api.serve:app --reload --port 8000
```

### `frontend`
Start the Next.js development server.

```bash
cd frontend && npm run dev
```

This starts on port 3000 with hot reload.

### `both`
Start both servers. Recommend using two terminals or running backend in background:

```bash
# Terminal 1 - Backend
uv run vdocs-api --reload --port 8000

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Or use Docker for both:
```bash
docker compose up
```

## Prerequisites

### Backend
```bash
uv sync  # Install Python dependencies
```

### Frontend
```bash
cd frontend && npm install  # Install Node dependencies
```

## Environment Setup

Ensure `.env` file exists with required variables:
- `GOOGLE_API_KEY`
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL` (if using auth)
- `SUPABASE_ANON_KEY`

See `references/environment-vars.md` for full list.

## Useful URLs

- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Health Check: http://localhost:8000/health
