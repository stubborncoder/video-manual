---
description: Deploy vDocs to production via GitHub Actions CI/CD
argument-hint: "[--watch] [--hotfix]"
allowed-tools: ["Bash", "Read"]
---

# Deploy to Production

Deploy the vDocs application to production using GitHub Actions.

## Default Behavior (CI/CD)

Trigger the GitHub Actions deploy workflow and monitor its progress:

1. First, check if there are uncommitted changes:
   ```bash
   git status --porcelain
   ```

2. Trigger the deploy workflow:
   ```bash
   gh workflow run deploy.yml --ref $(git branch --show-current)
   ```

3. Wait a moment for the run to start, then get the run ID:
   ```bash
   sleep 3
   gh run list --workflow=deploy.yml --limit=1 --json databaseId,status,conclusion -q '.[0]'
   ```

4. If `--watch` flag is provided, watch the run:
   ```bash
   gh run watch $(gh run list --workflow=deploy.yml --limit=1 --json databaseId -q '.[0].databaseId')
   ```

5. After completion, verify deployment:
   ```bash
   ssh root@72.60.186.75 "curl -s http://localhost:8000/health"
   ```

## Hotfix Mode (--hotfix)

For urgent fixes that bypass CI/CD, use direct SSH deployment:

1. Push changes to the current branch first
2. SSH deploy directly:
   ```bash
   ssh root@72.60.186.75 "cd /opt/vdocs && git pull && docker compose build && docker compose up -d"
   ```

3. Wait for services and verify:
   ```bash
   sleep 15
   ssh root@72.60.186.75 "curl -s http://localhost:8000/health && curl -s http://localhost:3000"
   ```

## Post-Deploy Verification

Always verify after deployment:
- Check backend health: `ssh root@72.60.186.75 "curl -s http://localhost:8000/health"`
- Check frontend: `ssh root@72.60.186.75 "curl -s http://localhost:3000 | head -20"`
- Check container status: `ssh root@72.60.186.75 "cd /opt/vdocs && docker compose ps"`

## Troubleshooting

If deployment fails:
1. Check workflow logs: `gh run view <run_id> --log-failed`
2. Check container logs: `ssh root@72.60.186.75 "cd /opt/vdocs && docker compose logs --tail=50"`
3. Restart services: `ssh root@72.60.186.75 "cd /opt/vdocs && docker compose restart"`
