---
description: SSH operations on the vDocs VPS server
argument-hint: "<logs|status|restart|shell|health> [service]"
allowed-tools: ["Bash"]
---

# SSH Operations

Perform operations on the vDocs VPS server at `72.60.186.75`.

## Commands

### `logs [service]`
View container logs. Service can be `backend`, `frontend`, or omit for all.

```bash
# All logs
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose logs -f --tail=100"

# Backend only
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose logs -f backend --tail=100"

# Frontend only
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose logs -f frontend --tail=100"
```

### `status`
Check container and system status.

```bash
# Container status
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose ps"

# System resources
ssh root@72.60.186.75 "echo '=== Disk ===' && df -h / && echo '=== Memory ===' && free -h && echo '=== Docker ===' && docker stats --no-stream"
```

### `restart [service]`
Restart Docker services.

```bash
# Restart all
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose restart"

# Restart specific service
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose restart backend"
```

### `health`
Run health checks on all services.

```bash
ssh root@72.60.186.75 "echo 'Backend:' && curl -s http://localhost:8000/health && echo '' && echo 'Frontend:' && curl -s -o /dev/null -w '%{http_code}' http://localhost:3000"
```

### `shell`
Get an interactive shell (inform user this requires manual execution).

```bash
ssh root@72.60.186.75
# Then: docker exec -it vdocs-backend bash
```

## Additional Operations

### View Git Status on VPS
```bash
ssh root@72.60.186.75 "cd /opt/vdocs && git status && git log --oneline -5"
```

### Pull Latest Code (without rebuild)
```bash
ssh root@72.60.186.75 "cd /opt/vdocs && git pull"
```

### Check Disk Usage
```bash
ssh root@72.60.186.75 "df -h && du -sh /opt/vdocs/data/*"
```
