---
description: GitHub Actions workflow run operations
argument-hint: "<list|view|watch|rerun|cancel> [run_id]"
allowed-tools: ["Bash"]
---

# GitHub Actions Runs

Monitor and manage GitHub Actions workflow runs.

## Commands

### `list`
List recent workflow runs.

```bash
gh run list --limit=10
```

List by workflow:
```bash
gh run list --workflow=deploy.yml --limit=5
gh run list --workflow=ci.yml --limit=5
gh run list --workflow=release.yml --limit=5
```

List failed runs:
```bash
gh run list --status=failure --limit=5
```

### `view <run_id>`
View details of a specific run.

```bash
gh run view <run_id>
```

View with logs:
```bash
gh run view <run_id> --log
```

View only failed job logs:
```bash
gh run view <run_id> --log-failed
```

### `watch <run_id>`
Watch a run in progress.

```bash
gh run watch <run_id>
```

Watch the latest run:
```bash
gh run watch $(gh run list --limit=1 --json databaseId -q '.[0].databaseId')
```

### `rerun <run_id>`
Re-run a failed workflow.

```bash
gh run rerun <run_id>
```

Re-run only failed jobs:
```bash
gh run rerun <run_id> --failed
```

### `cancel <run_id>`
Cancel a running workflow.

```bash
gh run cancel <run_id>
```

## Useful Queries

### Get Latest Deploy Run ID
```bash
gh run list --workflow=deploy.yml --limit=1 --json databaseId -q '.[0].databaseId'
```

### Check if Latest CI Passed
```bash
gh run list --workflow=ci.yml --limit=1 --json conclusion -q '.[0].conclusion'
```

### Get Run Status as JSON
```bash
gh run list --limit=5 --json databaseId,displayTitle,status,conclusion,createdAt
```

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR to main | Lint + build checks |
| `deploy.yml` | Push to main, manual | Deploy to VPS |
| `release.yml` | Tag v* | Create GitHub release |

## Manual Workflow Trigger

Trigger deploy manually:
```bash
gh workflow run deploy.yml
```

Then watch:
```bash
sleep 3 && gh run watch $(gh run list --workflow=deploy.yml --limit=1 --json databaseId -q '.[0].databaseId')
```
