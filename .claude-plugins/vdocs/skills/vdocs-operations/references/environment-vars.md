# Environment Variables Reference

## Core Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `VDOCS_DATA_DIR` | Data directory path | Yes (production) |
| `ENVIRONMENT` | `development` or `production` | No |
| `UVICORN_WORKERS` | Number of API workers | No (default: 1) |

## API Keys

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_API_KEY` | Gemini API for video analysis | Yes |
| `ANTHROPIC_API_KEY` | Claude API for manual generation | Yes |
| `LANGSMITH_API_KEY` | LangSmith tracing | No |
| `LANGSMITH_PROJECT` | LangSmith project name | No |
| `TAVILY_API_KEY` | Web search (optional) | No |

## Supabase

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes (auth) |
| `SUPABASE_ANON_KEY` | Public anon key | Yes (auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Yes (backend) |
| `SUPABASE_JWT_SECRET` | JWT secret for validation | Yes (auth) |

## Frontend Build Args

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

## GitHub Integration

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub API token (bug tracking) |
| `GITHUB_REPO` | Target repo for issues |

## CORS

| Variable | Description |
|----------|-------------|
| `CORS_ORIGINS` | Comma-separated allowed origins |

## GitHub Actions Secrets

Required secrets for CI/CD:

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS hostname/IP |
| `VPS_SSH_KEY` | SSH private key |
| `GITHUB_TOKEN` | Auto-provided by GitHub |

## Example .env

```bash
# Core
VDOCS_DATA_DIR=./data
ENVIRONMENT=development

# API Keys
GOOGLE_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key
LANGSMITH_API_KEY=your-langsmith-key

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```
