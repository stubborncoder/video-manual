#!/bin/bash
# vDocs Deployment Script
# Run this on your VPS to deploy or update the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== vDocs Deployment ===${NC}"

# Change to app directory
cd /opt/vdocs

# Pull latest code
echo -e "${YELLOW}Pulling latest code...${NC}"
git pull origin main

# Build and restart containers
echo -e "${YELLOW}Building Docker images...${NC}"
docker compose build

echo -e "${YELLOW}Restarting services...${NC}"
docker compose down
docker compose up -d

# Wait for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 10

# Health checks
echo -e "${YELLOW}Running health checks...${NC}"

if curl -sf http://localhost:8000/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    docker compose logs backend --tail=50
    exit 1
fi

if curl -sf http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
    echo -e "${RED}✗ Frontend health check failed${NC}"
    docker compose logs frontend --tail=50
    exit 1
fi

echo -e "${GREEN}=== Deployment complete! ===${NC}"
echo -e "Backend: http://localhost:8000"
echo -e "Frontend: http://localhost:3000"
