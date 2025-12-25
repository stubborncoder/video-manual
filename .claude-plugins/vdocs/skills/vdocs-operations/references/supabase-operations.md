# Supabase Operations Reference

## MCP Tools Available

Use these Supabase MCP tools for database operations:

### Query Data
```
mcp__supabase__execute_sql - Run SELECT queries
mcp__supabase__list_tables - List all tables
```

### Schema Management
```
mcp__supabase__apply_migration - Apply DDL migrations
mcp__supabase__list_migrations - List applied migrations
mcp__supabase__list_extensions - List enabled extensions
mcp__supabase__generate_typescript_types - Generate TS types
```

### Monitoring
```
mcp__supabase__get_logs - Get service logs (api, postgres, auth, storage, realtime)
mcp__supabase__get_advisors - Security/performance advisors
```

### Edge Functions
```
mcp__supabase__list_edge_functions - List functions
mcp__supabase__get_edge_function - Get function code
mcp__supabase__deploy_edge_function - Deploy function
```

### Project Info
```
mcp__supabase__get_project_url - Get API URL
mcp__supabase__get_publishable_keys - Get API keys
```

### Branching (Dev)
```
mcp__supabase__create_branch - Create dev branch
mcp__supabase__list_branches - List branches
mcp__supabase__merge_branch - Merge to production
mcp__supabase__delete_branch - Delete branch
```

## Common Queries

### Check Users
```sql
SELECT id, display_name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 10;
```

### Check Recent Jobs
```sql
SELECT id, user_id, video_name, status, current_node, started_at, completed_at
FROM jobs
ORDER BY started_at DESC
LIMIT 20;
```

### Check Failed Jobs
```sql
SELECT id, user_id, video_name, error, started_at
FROM jobs
WHERE status = 'error'
ORDER BY started_at DESC;
```

### Usage Statistics
```sql
SELECT
  date,
  operation,
  model,
  SUM(request_count) as requests,
  SUM(total_cost_usd) as cost
FROM usage_daily
WHERE date >= date('now', '-7 days')
GROUP BY date, operation, model
ORDER BY date DESC;
```

### LLM Token Usage
```sql
SELECT
  model,
  COUNT(*) as requests,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(cost_usd) as total_cost
FROM llm_requests
WHERE timestamp >= datetime('now', '-24 hours')
GROUP BY model;
```

## Database Schema

### users
- id, display_name, email, role, created_at, last_login

### jobs
- id, user_id, video_name, doc_id, status, current_node, node_index, total_nodes, error, started_at, completed_at, seen

### llm_requests
- id, user_id, timestamp, operation, model, input_tokens, output_tokens, total_tokens, cached_tokens, cost_usd, doc_id, job_id

### usage_daily
- id, user_id, date, operation, model, request_count, total_input_tokens, total_output_tokens, total_cost_usd
