---
description: Local Docker operations for vDocs development
argument-hint: "<build|up|down|logs|restart|status> [service]"
allowed-tools: ["Bash"]
---

# Docker Operations

Manage local Docker containers for vDocs development.

## Commands

### `build [service]`
Build Docker images.

```bash
# Build all
docker compose build

# Build specific service
docker compose build backend
docker compose build frontend

# Force rebuild (no cache)
docker compose build --no-cache
```

### `up`
Start services in detached mode.

```bash
docker compose up -d
```

To start with logs visible:
```bash
docker compose up
```

### `down`
Stop and remove containers.

```bash
docker compose down

# Also remove volumes
docker compose down -v
```

### `logs [service]`
View container logs.

```bash
# All logs
docker compose logs -f --tail=100

# Specific service
docker compose logs -f backend --tail=100
docker compose logs -f frontend --tail=100
```

### `restart [service]`
Restart services.

```bash
# Restart all
docker compose restart

# Restart specific
docker compose restart backend
```

### `status`
Show container status and resource usage.

```bash
docker compose ps
docker stats --no-stream
```

## Useful Combinations

### Full Rebuild and Start
```bash
docker compose down && docker compose build --no-cache && docker compose up -d
```

### Rebuild Single Service
```bash
docker compose up -d --build backend
```

### Shell into Container
```bash
docker exec -it vdocs-backend bash
docker exec -it vdocs-frontend sh
```

### Clean Up
```bash
docker system prune -f
docker image prune -f
```

## Health Checks

```bash
curl http://localhost:8000/health
curl http://localhost:3000
```
