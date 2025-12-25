# Docker Commands Reference

## Local Development

### Build
```bash
docker compose build                    # Build all services
docker compose build backend            # Build only backend
docker compose build frontend           # Build only frontend
docker compose build --no-cache         # Force rebuild
```

### Start/Stop
```bash
docker compose up -d                    # Start detached
docker compose up                       # Start with logs
docker compose down                     # Stop and remove containers
docker compose stop                     # Stop without removing
docker compose restart                  # Restart all services
```

### Logs
```bash
docker compose logs -f                  # Follow all logs
docker compose logs -f backend          # Follow backend logs
docker compose logs -f frontend         # Follow frontend logs
docker compose logs --tail=100 backend  # Last 100 lines
```

### Status
```bash
docker compose ps                       # Container status
docker compose top                      # Running processes
docker stats                            # Resource usage
```

### Shell Access
```bash
docker exec -it vdocs-backend bash      # Backend shell
docker exec -it vdocs-frontend sh       # Frontend shell (alpine)
```

### Cleanup
```bash
docker compose down -v                  # Remove volumes too
docker system prune -f                  # Clean unused resources
docker image prune -f                   # Clean unused images
```

## Docker Compose Services

### Backend (`vdocs-backend`)
- **Port**: 8000
- **Health**: `curl http://localhost:8000/health`
- **Volume**: `vdocs-data:/data`
- **Environment**:
  - `VDOCS_DATA_DIR=/data`
  - `ENVIRONMENT=production`
  - `UVICORN_WORKERS=4`

### Frontend (`vdocs-frontend`)
- **Port**: 3000
- **Depends on**: backend (healthy)
- **Build args**:
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
