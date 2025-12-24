#!/usr/bin/env python3
"""Migration script to rename manual_id to doc_id in database tables.

This script renames the column in both the jobs and llm_requests tables.
SQLite 3.25.0+ supports ALTER TABLE RENAME COLUMN directly.
"""

import sqlite3
import sys
from pathlib import Path


def get_db_path() -> Path:
    """Get the database path from environment or default location."""
    import os
    data_dir = os.environ.get("VDOCS_DATA_DIR", "data")
    return Path(data_dir) / "vdocs.db"


def migrate(db_path: Path) -> None:
    """Run the migration."""
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        sys.exit(1)

    print(f"Migrating database at {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check SQLite version
        version = sqlite3.sqlite_version
        print(f"SQLite version: {version}")

        # Check if migration is needed for jobs table
        cursor.execute("PRAGMA table_info(jobs)")
        jobs_columns = {row[1] for row in cursor.fetchall()}

        if "manual_id" in jobs_columns and "doc_id" not in jobs_columns:
            print("Renaming manual_id to doc_id in jobs table...")
            cursor.execute("ALTER TABLE jobs RENAME COLUMN manual_id TO doc_id")
            print("  Done.")
        elif "doc_id" in jobs_columns:
            print("jobs table already has doc_id column, skipping.")
        else:
            print("jobs table has neither manual_id nor doc_id, skipping.")

        # Check if migration is needed for llm_requests table
        cursor.execute("PRAGMA table_info(llm_requests)")
        llm_columns = {row[1] for row in cursor.fetchall()}

        if "manual_id" in llm_columns and "doc_id" not in llm_columns:
            print("Renaming manual_id to doc_id in llm_requests table...")
            cursor.execute("ALTER TABLE llm_requests RENAME COLUMN manual_id TO doc_id")
            print("  Done.")
        elif "doc_id" in llm_columns:
            print("llm_requests table already has doc_id column, skipping.")
        else:
            print("llm_requests table has neither manual_id nor doc_id, skipping.")

        conn.commit()
        print("Migration complete!")

    except sqlite3.OperationalError as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    db_path = get_db_path()

    # Allow override via command line
    if len(sys.argv) > 1:
        db_path = Path(sys.argv[1])

    migrate(db_path)
