---
description: Supabase database operations for vDocs
argument-hint: "<query|tables|logs|advisors|migrations|types>"
allowed-tools: ["Bash", "Read", "mcp__supabase__execute_sql", "mcp__supabase__list_tables", "mcp__supabase__list_migrations", "mcp__supabase__apply_migration", "mcp__supabase__get_logs", "mcp__supabase__get_advisors", "mcp__supabase__generate_typescript_types", "mcp__supabase__get_project_url", "mcp__supabase__search_docs"]
---

# Supabase Operations

Manage the Supabase database for vDocs.

## Commands

### `query`
Execute SQL queries using the Supabase MCP tool.

Use `mcp__supabase__execute_sql` for SELECT queries:

Common queries:
- Recent users: `SELECT * FROM users ORDER BY created_at DESC LIMIT 10`
- Recent jobs: `SELECT * FROM jobs ORDER BY started_at DESC LIMIT 20`
- Failed jobs: `SELECT * FROM jobs WHERE status = 'error' ORDER BY started_at DESC`
- Usage stats: `SELECT date, operation, model, SUM(total_cost_usd) FROM usage_daily GROUP BY date, operation, model ORDER BY date DESC`

### `tables`
List all database tables.

Use `mcp__supabase__list_tables` to show all tables in the public schema.

### `logs <service>`
Get service logs. Services: `api`, `postgres`, `auth`, `storage`, `realtime`.

Use `mcp__supabase__get_logs` with the service parameter.

### `advisors <type>`
Get security or performance advisors. Type: `security` or `performance`.

Use `mcp__supabase__get_advisors` - this identifies issues like missing RLS policies.

**Run this regularly, especially after DDL changes!**

### `migrations`
List applied migrations.

Use `mcp__supabase__list_migrations` to see migration history.

To apply a new migration, use `mcp__supabase__apply_migration` with:
- `name`: Migration name in snake_case
- `query`: The SQL DDL to apply

### `types`
Generate TypeScript types for the database schema.

Use `mcp__supabase__generate_typescript_types` to get updated types.

## Database Schema

### users
- id, display_name, email, role, created_at, last_login

### jobs
- id, user_id, video_name, doc_id, status, current_node, node_index, total_nodes, error, started_at, completed_at, seen

### llm_requests
- id, user_id, timestamp, operation, model, input_tokens, output_tokens, total_tokens, cached_tokens, cost_usd, doc_id, job_id

### usage_daily
- id, user_id, date, operation, model, request_count, total_input_tokens, total_output_tokens, total_cost_usd

## Tips

- Always check `advisors security` after schema changes
- Use `logs postgres` to debug query issues
- Generate fresh types after migrations
