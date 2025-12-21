"""User management service using Supabase Auth as the source of truth."""

import logging
from typing import Optional

import httpx

from ..config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

logger = logging.getLogger(__name__)


class UserManagement:
    """Service for managing users via Supabase Auth.

    Uses Supabase Auth admin API for user management.
    Roles are stored in Supabase's app_metadata.
    """

    @staticmethod
    def _get_local_last_login(user_id: str) -> Optional[str]:
        """Get last_login from local database.

        This tracks actual app access, not just sign-in events.
        """
        from .database import get_connection

        with get_connection() as conn:
            cursor = conn.execute(
                "SELECT last_login FROM users WHERE id = ?",
                (user_id,),
            )
            row = cursor.fetchone()
            if row and row["last_login"]:
                return str(row["last_login"])
        return None

    @staticmethod
    def _get_all_local_last_logins() -> dict[str, str]:
        """Get all last_login values from local database.

        Returns a dict mapping user_id to last_login timestamp.
        """
        from .database import get_connection

        result = {}
        with get_connection() as conn:
            cursor = conn.execute(
                "SELECT id, last_login FROM users WHERE last_login IS NOT NULL"
            )
            for row in cursor.fetchall():
                result[row["id"]] = str(row["last_login"])
        return result

    @staticmethod
    def _get_headers() -> dict:
        """Get headers for Supabase Admin API requests."""
        return {
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": "application/json",
        }

    @staticmethod
    def _is_configured() -> bool:
        """Check if Supabase is configured."""
        return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

    @staticmethod
    def get_user(user_id: str) -> Optional[dict]:
        """Get user by ID from Supabase.

        Args:
            user_id: User identifier

        Returns:
            User dict or None if not found
        """
        if not UserManagement._is_configured():
            logger.warning("Supabase not configured")
            return None

        try:
            response = httpx.get(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers=UserManagement._get_headers(),
                timeout=30.0,
            )

            if response.status_code == 404:
                return None

            response.raise_for_status()
            user = response.json()

            # Extract role from app_metadata
            app_metadata = user.get("app_metadata", {})
            user_metadata = user.get("user_metadata", {})

            user_id = user.get("id")

            # Use local last_login (tracks actual access) over Supabase's last_sign_in_at
            local_last_login = UserManagement._get_local_last_login(user_id)

            return {
                "id": user_id,
                "email": user.get("email"),
                "display_name": (
                    user_metadata.get("full_name")
                    or user_metadata.get("name")
                    or user_metadata.get("display_name")
                ),
                "role": app_metadata.get("role", "user"),
                "tier": app_metadata.get("tier", "free"),
                "tester": app_metadata.get("tester", False),
                "created_at": user.get("created_at"),
                "last_login": local_last_login or user.get("last_sign_in_at"),
            }

        except httpx.HTTPError as e:
            logger.error(f"Failed to get user from Supabase: {e}")
            return None

    @staticmethod
    def list_users() -> list[dict]:
        """List all users from Supabase.

        Returns:
            List of user dicts
        """
        if not UserManagement._is_configured():
            logger.warning("Supabase not configured")
            return []

        all_users = []
        page = 1
        per_page = 100

        # Get all local last_login values in one query for efficiency
        local_last_logins = UserManagement._get_all_local_last_logins()

        try:
            while True:
                response = httpx.get(
                    f"{SUPABASE_URL}/auth/v1/admin/users",
                    params={"page": page, "per_page": per_page},
                    headers=UserManagement._get_headers(),
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                # Handle both array and object responses
                users = data.get("users", []) if isinstance(data, dict) else data

                if not users:
                    break

                for user in users:
                    app_metadata = user.get("app_metadata", {})
                    user_metadata = user.get("user_metadata", {})
                    user_id = user.get("id")

                    # Use local last_login (tracks actual access) over Supabase's last_sign_in_at
                    last_login = local_last_logins.get(user_id) or user.get("last_sign_in_at")

                    all_users.append({
                        "id": user_id,
                        "email": user.get("email"),
                        "display_name": (
                            user_metadata.get("full_name")
                            or user_metadata.get("name")
                            or user_metadata.get("display_name")
                        ),
                        "role": app_metadata.get("role", "user"),
                        "tier": app_metadata.get("tier", "free"),
                        "tester": app_metadata.get("tester", False),
                        "created_at": user.get("created_at"),
                        "last_login": last_login,
                    })

                # Check if there are more pages
                if len(users) < per_page:
                    break
                page += 1

            # Sort by created_at descending
            all_users.sort(key=lambda u: u.get("created_at") or "", reverse=True)
            return all_users

        except httpx.HTTPError as e:
            logger.error(f"Failed to list users from Supabase: {e}")
            return []

    @staticmethod
    def set_role(user_id: str, role: str) -> bool:
        """Set user role in Supabase app_metadata.

        Args:
            user_id: User identifier
            role: Role to set ('user' or 'admin')

        Returns:
            True if role was updated

        Raises:
            ValueError: If role is not valid
        """
        if not UserManagement._is_configured():
            logger.warning("Supabase not configured")
            return False

        valid_roles = ("user", "admin")
        if role not in valid_roles:
            raise ValueError(f"Invalid role: {role}. Must be one of {valid_roles}")

        try:
            response = httpx.put(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers=UserManagement._get_headers(),
                json={"app_metadata": {"role": role}},
                timeout=30.0,
            )
            response.raise_for_status()
            logger.info(f"Set role '{role}' for user {user_id}")
            return True

        except httpx.HTTPError as e:
            logger.error(f"Failed to set role in Supabase: {e}")
            return False

    @staticmethod
    def set_tier(user_id: str, tier: str) -> bool:
        """Set user tier in Supabase app_metadata.

        Args:
            user_id: User identifier
            tier: Tier to set ('free', 'basic', 'pro', 'enterprise')

        Returns:
            True if tier was updated

        Raises:
            ValueError: If tier is not valid
        """
        if not UserManagement._is_configured():
            logger.warning("Supabase not configured")
            return False

        valid_tiers = ("free", "basic", "pro", "enterprise")
        if tier not in valid_tiers:
            raise ValueError(f"Invalid tier: {tier}. Must be one of {valid_tiers}")

        try:
            response = httpx.put(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers=UserManagement._get_headers(),
                json={"app_metadata": {"tier": tier}},
                timeout=30.0,
            )
            response.raise_for_status()
            logger.info(f"Set tier '{tier}' for user {user_id}")
            return True

        except httpx.HTTPError as e:
            logger.error(f"Failed to set tier in Supabase: {e}")
            return False

    @staticmethod
    def set_tester(user_id: str, is_tester: bool) -> bool:
        """Set user tester status in Supabase app_metadata.

        Args:
            user_id: User identifier
            is_tester: Whether the user is a tester

        Returns:
            True if tester status was updated
        """
        if not UserManagement._is_configured():
            logger.warning("Supabase not configured")
            return False

        try:
            response = httpx.put(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers=UserManagement._get_headers(),
                json={"app_metadata": {"tester": is_tester}},
                timeout=30.0,
            )
            response.raise_for_status()
            logger.info(f"Set tester={is_tester} for user {user_id}")
            return True

        except httpx.HTTPError as e:
            logger.error(f"Failed to set tester status in Supabase: {e}")
            return False

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
    def get_role(user_id: str) -> str:
        """Get user's role.

        Args:
            user_id: User identifier

        Returns:
            Role string ('user' or 'admin'), defaults to 'user'
        """
        user = UserManagement.get_user(user_id)
        if user:
            return user.get("role", "user")
        return "user"

    # Legacy methods kept for backwards compatibility
    # These are no-ops since Supabase manages users

    @staticmethod
    def ensure_user_exists(user_id: str, display_name: Optional[str] = None) -> dict:
        """Get user from Supabase (users are managed by Supabase Auth).

        Args:
            user_id: User identifier
            display_name: Ignored (managed by Supabase)

        Returns:
            User dict or empty dict if not found
        """
        user = UserManagement.get_user(user_id)
        return user or {"id": user_id, "role": "user"}

    # In-memory cache to throttle last_login updates (user_id -> last_update_time)
    _last_login_cache: dict[str, float] = {}
    _LAST_LOGIN_THROTTLE_SECONDS = 300  # 5 minutes

    @staticmethod
    def update_last_login(user_id: str) -> None:
        """Update last_access timestamp in local database.

        This tracks actual app access, not just sign-in events.
        Supabase's last_sign_in_at only updates on actual sign-in,
        not when using a persisted session.

        Throttled to avoid excessive writes - only updates if last update
        was more than 5 minutes ago.
        """
        import sqlite3
        import time
        from .database import get_connection
        from datetime import datetime, timezone

        # Throttle: skip if updated recently (within 5 minutes)
        now = time.time()
        last_update = UserManagement._last_login_cache.get(user_id, 0)
        if now - last_update < UserManagement._LAST_LOGIN_THROTTLE_SECONDS:
            return

        try:
            with get_connection() as conn:
                # Use BEGIN IMMEDIATE for proper write locking
                conn.execute("BEGIN IMMEDIATE")
                # Use UPSERT to avoid race condition
                conn.execute(
                    """
                    INSERT INTO users (id, last_login) VALUES (?, ?)
                    ON CONFLICT(id) DO UPDATE SET last_login = excluded.last_login
                    """,
                    (user_id, datetime.now(timezone.utc)),
                )
            # Update cache only after successful write
            UserManagement._last_login_cache[user_id] = now
        except sqlite3.Error as e:
            # Log but don't raise - this is a non-critical update
            logger.warning(f"Failed to update last_login for {user_id}: {e}")

    @staticmethod
    def update_user(user_id: str, **fields) -> bool:
        """Update user metadata in Supabase.

        Args:
            user_id: User identifier
            **fields: Fields to update (role, tier, tester supported via app_metadata)

        Returns:
            True if user was updated
        """
        success = True

        if "role" in fields:
            success = UserManagement.set_role(user_id, fields["role"]) and success

        if "tier" in fields:
            success = UserManagement.set_tier(user_id, fields["tier"]) and success

        if "tester" in fields:
            success = UserManagement.set_tester(user_id, fields["tester"]) and success

        # Check for unsupported fields
        supported = {"role", "tier", "tester"}
        unsupported = set(fields.keys()) - supported
        if unsupported:
            logger.warning(f"Unsupported fields for update: {list(unsupported)}")

        return success
