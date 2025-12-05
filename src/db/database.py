"""SQLite database connection and schema management."""

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

# Database file location
DATABASE_PATH = Path(__file__).parent / "vdocs.db"


def init_db() -> None:
    """Initialize the database with required tables."""
    with get_connection() as conn:
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
