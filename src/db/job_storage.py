"""Job storage service for tracking video processing jobs."""

import uuid
from datetime import datetime, timedelta
from typing import Optional

from .database import get_connection


class JobStorage:
    """Service for managing video processing jobs in SQLite."""

    @staticmethod
    def create_job(user_id: str, video_name: str) -> str:
        """Create a new job and return its ID."""
        job_id = str(uuid.uuid4())

        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO jobs (id, user_id, video_name, status, started_at)
                VALUES (?, ?, ?, 'pending', ?)
                """,
                (job_id, user_id, video_name, datetime.now().isoformat()),
            )

        return job_id

    @staticmethod
    def update_job(job_id: str, **updates) -> bool:
        """
        Update a job with the given fields.

        Supported fields:
        - status: str
        - current_node: str
        - node_index: int
        - total_nodes: int
        - manual_id: str
        - error: str
        - completed_at: str (ISO format)
        """
        if not updates:
            return False

        # Build SET clause dynamically
        allowed_fields = {
            "status",
            "current_node",
            "node_index",
            "total_nodes",
            "manual_id",
            "error",
            "completed_at",
            "seen",
        }

        fields = []
        values = []
        for key, value in updates.items():
            if key in allowed_fields:
                fields.append(f"{key} = ?")
                values.append(value)

        if not fields:
            return False

        values.append(job_id)

        with get_connection() as conn:
            cursor = conn.execute(
                f"UPDATE jobs SET {', '.join(fields)} WHERE id = ?",
                values,
            )
            return cursor.rowcount > 0

    @staticmethod
    def get_job(job_id: str) -> Optional[dict]:
        """Get a job by ID."""
        with get_connection() as conn:
            cursor = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_user_jobs(
        user_id: str, status: Optional[str] = None, include_seen: bool = True
    ) -> list[dict]:
        """
        Get all jobs for a user, optionally filtered by status.

        Args:
            user_id: The user ID to filter by
            status: Optional status filter ('pending', 'processing', 'complete', 'error')
            include_seen: Whether to include jobs marked as seen (default True)
        """
        query = "SELECT * FROM jobs WHERE user_id = ?"
        params: list = [user_id]

        if status:
            query += " AND status = ?"
            params.append(status)

        if not include_seen:
            query += " AND seen = FALSE"

        query += " ORDER BY started_at DESC"

        with get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_active_jobs(user_id: str) -> list[dict]:
        """Get all non-completed, non-error jobs for a user."""
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT * FROM jobs
                WHERE user_id = ? AND status IN ('pending', 'processing')
                ORDER BY started_at DESC
                """,
                (user_id,),
            )
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def mark_seen(job_id: str) -> bool:
        """Mark a job as seen."""
        return JobStorage.update_job(job_id, seen=True)

    @staticmethod
    def cleanup_old_jobs(hours: int = 24) -> int:
        """
        Delete jobs older than the specified hours.

        Returns the number of deleted jobs.
        """
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()

        with get_connection() as conn:
            # Only delete completed or errored jobs
            cursor = conn.execute(
                """
                DELETE FROM jobs
                WHERE completed_at < ? AND status IN ('complete', 'error')
                """,
                (cutoff,),
            )
            return cursor.rowcount

    @staticmethod
    def mark_complete(job_id: str, manual_id: str) -> bool:
        """Mark a job as complete with the resulting manual ID."""
        return JobStorage.update_job(
            job_id,
            status="complete",
            manual_id=manual_id,
            completed_at=datetime.now().isoformat(),
        )

    @staticmethod
    def mark_error(job_id: str, error: str) -> bool:
        """Mark a job as failed with an error message."""
        return JobStorage.update_job(
            job_id,
            status="error",
            error=error,
            completed_at=datetime.now().isoformat(),
        )
