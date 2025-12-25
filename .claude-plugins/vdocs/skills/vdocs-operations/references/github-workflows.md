# GitHub Workflows Reference

## Available Workflows

### 1. Deploy (`deploy.yml`)
**Triggers**: Push to main/master, workflow_dispatch

```bash
# Trigger manually
gh workflow run deploy.yml

# Trigger with specific branch
gh workflow run deploy.yml --ref main

# Watch the run
gh run list --workflow=deploy.yml --limit=1
gh run watch $(gh run list --workflow=deploy.yml --limit=1 --json databaseId -q '.[0].databaseId')
```

### 2. CI (`ci.yml`)
**Triggers**: Pull requests to main/master

Checks:
- Frontend: npm install, lint, build
- Backend: uv sync, ruff check

### 3. Release (`release.yml`)
**Triggers**: Push tag matching `v*`

```bash
# Create and push a release tag
git tag v0.2.2
git push origin v0.2.2
```

## GitHub CLI Commands

### Workflow Runs
```bash
# List recent runs
gh run list --limit=10

# List runs for specific workflow
gh run list --workflow=deploy.yml --limit=5

# View run details
gh run view <run_id>

# View run logs
gh run view <run_id> --log

# Re-run failed jobs
gh run rerun <run_id> --failed

# Watch a run in progress
gh run watch <run_id>

# Cancel a run
gh run cancel <run_id>
```

### Pull Requests
```bash
# List PRs
gh pr list

# Create PR
gh pr create --title "Title" --body "Description"

# View PR
gh pr view <number>

# View PR checks
gh pr checks <number>

# Merge PR
gh pr merge <number> --squash

# Checkout PR locally
gh pr checkout <number>
```

### Issues
```bash
# List issues
gh issue list

# Create issue
gh issue create --title "Title" --body "Description"

# View issue
gh issue view <number>

# Close issue
gh issue close <number>
```

### Repository
```bash
# View repo
gh repo view

# Clone
gh repo clone owner/repo

# Sync fork
gh repo sync
```

## Release Process

1. Update version in `pyproject.toml`
2. Update `CHANGELOG.md` with new version section
3. Commit changes
4. Create and push tag:
   ```bash
   git tag v0.2.2
   git push origin v0.2.2
   ```
5. Release workflow creates GitHub release automatically

## CI Status Checks

Before merging PRs, ensure:
- Frontend Checks (lint, build) pass
- Backend Checks (ruff) pass

```bash
# Check PR status
gh pr checks <number>

# View failed check logs
gh run view <run_id> --log-failed
```
