"""SQLite database connection and schema management."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from ..config import DATABASE_URL

# Database file location - use DATABASE_URL from config, fallback to local
if DATABASE_URL and DATABASE_URL.startswith("sqlite:///"):
    # Extract path from sqlite:/// URL (handle both 3 and 4 slashes)
    db_path = DATABASE_URL.replace("sqlite:///", "")
    DATABASE_PATH = Path(db_path)
else:
    DATABASE_PATH = Path(__file__).parent / "vdocs.db"


def init_db() -> None:
    """Initialize the database with required tables."""
    with get_connection() as conn:
        # Users table for user management
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                display_name TEXT,
                email TEXT,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        """)

        # Jobs table for tracking video processing jobs
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                video_name TEXT NOT NULL,
                manual_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                current_node TEXT,
                node_index INTEGER,
                total_nodes INTEGER,
                error TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                seen BOOLEAN DEFAULT FALSE
            )
        """)

        # LLM requests table for tracking token usage per request
        conn.execute("""
            CREATE TABLE IF NOT EXISTS llm_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                operation TEXT NOT NULL,
                model TEXT NOT NULL,
                input_tokens INTEGER,
                output_tokens INTEGER,
                total_tokens INTEGER,
                cached_tokens INTEGER DEFAULT 0,
                cache_creation_tokens INTEGER DEFAULT 0,
                cache_read_tokens INTEGER DEFAULT 0,
                cost_usd REAL,
                manual_id TEXT,
                job_id TEXT
            )
        """)

        # Daily usage aggregates for fast queries
        conn.execute("""
            CREATE TABLE IF NOT EXISTS usage_daily (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                date TEXT NOT NULL,
                operation TEXT NOT NULL,
                model TEXT NOT NULL,
                request_count INTEGER DEFAULT 0,
                total_input_tokens INTEGER DEFAULT 0,
                total_output_tokens INTEGER DEFAULT 0,
                total_cached_tokens INTEGER DEFAULT 0,
                total_cache_read_tokens INTEGER DEFAULT 0,
                total_cost_usd REAL DEFAULT 0,
                UNIQUE(user_id, date, operation, model)
            )
        """)

        # Index for efficient user job lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_jobs_user_status ON jobs(user_id, status)"
        )

        # Index for cleanup queries
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_jobs_completed_at ON jobs(completed_at)"
        )

        # Index for unseen jobs query (used for notifications)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_jobs_user_seen ON jobs(user_id, seen, started_at)"
        )

        # Index for LLM requests by user and date
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_llm_requests_user_date ON llm_requests(user_id, timestamp)"
        )

        # Index for daily usage lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_usage_daily_user_date ON usage_daily(user_id, date)"
        )


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    """Get a database connection with automatic commit/close."""
    # Ensure parent directory exists
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DATABASE_PATH), timeout=30)
    conn.row_factory = sqlite3.Row

    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
