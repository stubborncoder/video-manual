---
description: Run tests and linting for vDocs
argument-hint: "[backend|frontend|lint|all]"
allowed-tools: ["Bash"]
---

# Testing and Linting

Run tests and code quality checks for vDocs.

## Commands

### `backend`
Run Python tests with pytest.

```bash
uv run pytest
```

With verbose output:
```bash
uv run pytest -v
```

With coverage:
```bash
uv run pytest --cov=src
```

### `frontend`
Run Jest tests for the Next.js frontend.

```bash
cd frontend && npm run test
```

Watch mode:
```bash
cd frontend && npm run test:watch
```

With coverage:
```bash
cd frontend && npm run test:coverage
```

### `lint`
Run all linters.

**Backend (Ruff):**
```bash
uv run ruff check .
```

Auto-fix issues:
```bash
uv run ruff check . --fix
```

**Frontend (ESLint):**
```bash
cd frontend && npm run lint
```

### `all`
Run all tests and linting:

```bash
# Backend lint
uv run ruff check .

# Backend tests
uv run pytest

# Frontend lint
cd frontend && npm run lint

# Frontend tests
cd frontend && npm run test
```

## CI Checks

The CI pipeline runs these checks on PRs:
1. Frontend: `npm ci`, `npm run lint`, `npm run build`
2. Backend: `uv sync --group dev`, `uv run ruff check .`

Run these locally before pushing to ensure CI passes.

## Pre-commit Checks

Quick check before committing:
```bash
uv run ruff check . && cd frontend && npm run lint
```
