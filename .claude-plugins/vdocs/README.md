# vDocs Plugin

Project management plugin for the vDocs application. Provides commands for deployment, SSH operations, Docker management, Supabase database, GitHub CI/CD, and development workflows.

## Commands

| Command | Description |
|---------|-------------|
| `/vdocs:deploy` | Deploy to production via GitHub Actions CI/CD |
| `/vdocs:ssh` | SSH operations on VPS (logs, status, restart, health) |
| `/vdocs:docker` | Local Docker operations (build, up, down, logs) |
| `/vdocs:supabase` | Supabase database operations (query, tables, logs, advisors) |
| `/vdocs:dev` | Start development servers (backend, frontend) |
| `/vdocs:test` | Run tests and linting (pytest, jest, ruff) |
| `/vdocs:status` | Check health of all services (local/remote) |
| `/vdocs:release` | Create release (version bump, changelog, tag) |
| `/vdocs:gh-pr` | GitHub PR operations (create, list, view, merge) |
| `/vdocs:gh-runs` | GitHub Actions runs (list, view, watch, rerun) |

## Skill

The `vdocs-operations` skill provides knowledge about:
- Project infrastructure (VPS, Docker, Supabase)
- CI/CD workflows (deploy, CI, release)
- CLI commands and API endpoints
- Environment configuration
- Development workflows

## Agent

`deployment-verifier` - Automatically verifies deployments are healthy after `/vdocs:deploy`.

## Quick Start

### Deploy to Production
```
/vdocs:deploy
```
Triggers GitHub Actions workflow and monitors deployment.

### Hotfix Deploy (bypasses CI)
```
/vdocs:deploy --hotfix
```
Direct SSH deployment for urgent fixes.

### Check Status
```
/vdocs:status remote
```
Checks VPS services health.

### View Logs
```
/vdocs:ssh logs backend
```
View backend container logs.

### Create Release
```
/vdocs:release minor --notes "New feature X"
```
Bumps version, updates changelog, creates tag.

## Infrastructure

- **VPS**: `72.60.186.75` (root@)
- **Path**: `/opt/vdocs`
- **Backend**: Port 8000
- **Frontend**: Port 3000

## Requirements

- `gh` CLI installed and authenticated
- SSH access to VPS configured
- Supabase MCP server configured (for `/vdocs:supabase`)
