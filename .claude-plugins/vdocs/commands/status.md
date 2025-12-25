---
description: Check health status of vDocs services
argument-hint: "[local|remote|all]"
allowed-tools: ["Bash"]
---

# Service Status

Check the health and status of vDocs services.

## Commands

### `local`
Check local development services.

```bash
echo "=== Local Docker Containers ==="
docker compose ps 2>/dev/null || echo "Docker Compose not running"

echo ""
echo "=== Backend Health ==="
curl -s http://localhost:8000/health 2>/dev/null || echo "Backend not running"

echo ""
echo "=== Frontend ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000 2>/dev/null || echo "Frontend not running"
```

### `remote`
Check production services on VPS.

```bash
echo "=== VPS Container Status ==="
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose ps"

echo ""
echo "=== Backend Health ==="
ssh root@72.60.186.75 "curl -s http://localhost:8000/health"

echo ""
echo "=== Frontend ==="
ssh root@72.60.186.75 "curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3000"

echo ""
echo "=== System Resources ==="
ssh root@72.60.186.75 "echo 'Disk:' && df -h / | tail -1 && echo 'Memory:' && free -h | grep Mem"
```

### `all`
Check both local and remote services.

Run both `local` and `remote` checks.

## Quick Health Check

One-liner for quick verification:

**Local:**
```bash
curl -s http://localhost:8000/health && curl -s -o /dev/null -w " Frontend: %{http_code}\n" http://localhost:3000
```

**Remote:**
```bash
ssh root@72.60.186.75 "curl -s http://localhost:8000/health && curl -s -o /dev/null -w ' Frontend: %{http_code}\n' http://localhost:3000"
```

## Troubleshooting

If services are down:
1. Check logs: `/vdocs:ssh logs`
2. Restart: `/vdocs:ssh restart`
3. Check Docker: `/vdocs:docker status`
