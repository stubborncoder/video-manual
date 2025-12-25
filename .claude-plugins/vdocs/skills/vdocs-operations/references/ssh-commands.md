# SSH Commands Reference

## Connection
```bash
ssh root@72.60.186.75
```

## Common Operations

### Check Service Status
```bash
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose ps"
```

### View Logs
```bash
# Backend logs
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose logs -f backend --tail=100"

# Frontend logs
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose logs -f frontend --tail=100"

# All logs
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose logs -f --tail=50"
```

### Health Checks
```bash
ssh root@72.60.186.75 "curl -s http://localhost:8000/health"
ssh root@72.60.186.75 "curl -s http://localhost:3000"
```

### Restart Services
```bash
# Restart all
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose restart"

# Restart specific service
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose restart backend"
ssh root@72.60.186.75 "cd /opt/vdocs && docker compose restart frontend"
```

### Hotfix Deployment (Manual)
```bash
# Pull and rebuild specific service
ssh root@72.60.186.75 "cd /opt/vdocs && git pull && docker compose build backend && docker compose up -d backend"

# Full redeploy
ssh root@72.60.186.75 "cd /opt/vdocs && git pull && docker compose build && docker compose up -d"
```

### Shell Access
```bash
# Backend container shell
ssh root@72.60.186.75 "docker exec -it vdocs-backend bash"

# Check disk space
ssh root@72.60.186.75 "df -h"

# Check memory
ssh root@72.60.186.75 "free -h"
```

### Git Operations on VPS
```bash
ssh root@72.60.186.75 "cd /opt/vdocs && git status"
ssh root@72.60.186.75 "cd /opt/vdocs && git log --oneline -5"
ssh root@72.60.186.75 "cd /opt/vdocs && git fetch origin"
```
