# vDocs Operations

Use this skill when working with the vDocs project infrastructure, deployment, development, or operations. This includes SSH access, Docker management, Supabase database operations, GitHub CI/CD workflows, and local development.

## Project Overview

vDocs is an AI-powered documentation generator that creates step-by-step visual documentation from video content using LangGraph agents.

**Stack**: Python 3.12+, LangGraph, Next.js 14, Supabase, Docker

## Infrastructure

### Remote Server (VPS)
- **Host**: `72.60.186.75`
- **User**: `root`
- **Path**: `/opt/vdocs`
- **Services**: Docker Compose (backend:8000, frontend:3000)

### Docker Services
- `vdocs-backend`: Python API on port 8000, health check at `/health`
- `vdocs-frontend`: Next.js on port 3000

### Supabase
- Used for authentication and can be queried via MCP tools
- Tables: users, jobs, llm_requests, usage_daily
- Check advisors regularly for security/performance issues

## CI/CD Workflows

### Deployment (`deploy.yml`)
- **Trigger**: Push to main/master OR `workflow_dispatch`
- **Action**: SSH to VPS → git pull → docker compose build → up -d → health checks
- **Trigger manually**: `gh workflow run deploy.yml`

### CI (`ci.yml`)
- **Trigger**: Pull requests to main/master
- **Checks**: Frontend (npm lint, build), Backend (ruff check)

### Release (`release.yml`)
- **Trigger**: Push tag `v*`
- **Action**: Creates GitHub release from CHANGELOG.md

## CLI Commands

Run with `uv run vdocs <command>`:

```
vdocs process [VIDEO]     # Process video → generate manual
vdocs list                # List generated manuals
vdocs view <id>           # View manual
vdocs project create|list|show|delete|export|compile
vdocs tag add|remove|list|search
vdocs version list|bump|restore|diff
```

## Development

### Backend
```bash
uv sync                    # Install dependencies
uv run vdocs-api          # Run API server (port 8000)
uv run ruff check .       # Lint
uv run pytest             # Test
```

### Frontend
```bash
cd frontend
npm install               # Install dependencies
npm run dev               # Dev server (port 3000)
npm run build             # Production build
npm run lint              # Lint
npm run test              # Jest tests
```

## References

- See `references/ssh-commands.md` for SSH operation examples
- See `references/docker-commands.md` for Docker operations
- See `references/supabase-operations.md` for database operations
- See `references/github-workflows.md` for CI/CD details
- See `references/environment-vars.md` for configuration
