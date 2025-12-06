"""User management service for admin dashboard."""

from datetime import datetime
from typing import Optional

from .database import get_connection


class UserManagement:
    """Service for managing users and roles."""

    @staticmethod
    def create_user(
        user_id: str, display_name: Optional[str] = None, role: str = "user"
    ) -> dict:
        """Create a new user record.

        Args:
            user_id: Unique user identifier
            display_name: Optional display name
            role: User role ('user' or 'admin')

        Returns:
            dict with user information
        """
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO users (id, display_name, role, created_at, last_login)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user_id, display_name, role, datetime.now(), datetime.now()),
            )

        return UserManagement.get_user(user_id)

    @staticmethod
    def get_user(user_id: str) -> Optional[dict]:
        """Get user by ID.

        Args:
            user_id: User identifier

        Returns:
            User dict or None if not found
        """
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT id, display_name, email, role, created_at, last_login
                FROM users
                WHERE id = ?
                """,
                (user_id,),
            )
            row = cursor.fetchone()

            if row:
                return dict(row)
            return None

    @staticmethod
    def list_users() -> list[dict]:
        """List all users.

        Returns:
            List of user dicts
        """
        with get_connection() as conn:
            cursor = conn.execute(
                """
                SELECT id, display_name, email, role, created_at, last_login
                FROM users
                ORDER BY created_at DESC
                """
            )
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def update_user(user_id: str, **fields) -> bool:
        """Update user fields.

        Args:
            user_id: User identifier
            **fields: Fields to update (display_name, email, role)

        Returns:
            True if user was updated
        """
        allowed_fields = {"display_name", "email", "role"}
        update_fields = {k: v for k, v in fields.items() if k in allowed_fields}

        if not update_fields:
            return False

        set_clause = ", ".join(f"{field} = ?" for field in update_fields)
        values = list(update_fields.values()) + [user_id]

        with get_connection() as conn:
            cursor = conn.execute(
                f"UPDATE users SET {set_clause} WHERE id = ?", values
            )
            return cursor.rowcount > 0

    @staticmethod
    def set_role(user_id: str, role: str) -> bool:
        """Set user role.

        Args:
            user_id: User identifier
            role: Role to set ('user' or 'admin')

        Returns:
            True if role was updated
        """
        return UserManagement.update_user(user_id, role=role)

    @staticmethod
    def is_admin(user_id: str) -> bool:
        """Check if user is an admin.

        Args:
            user_id: User identifier

        Returns:
            True if user is admin
        """
        user = UserManagement.get_user(user_id)
        return user is not None and user.get("role") == "admin"

    @staticmethod
    def update_last_login(user_id: str) -> None:
        """Update user's last login timestamp.

        Args:
            user_id: User identifier
        """
        with get_connection() as conn:
            conn.execute(
                "UPDATE users SET last_login = ? WHERE id = ?",
                (datetime.now(), user_id),
            )

    @staticmethod
    def ensure_user_exists(
        user_id: str, display_name: Optional[str] = None
    ) -> dict:
        """Ensure user exists, create if not.

        Args:
            user_id: User identifier
            display_name: Optional display name

        Returns:
            User dict
        """
        user = UserManagement.get_user(user_id)
        if not user:
            user = UserManagement.create_user(user_id, display_name)
        return user
