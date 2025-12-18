"""FastAPI dependencies for authentication and storage access."""

import logging
import time
from collections import defaultdict
from typing import Annotated, NamedTuple

import jwt
from fastapi import Depends, HTTPException, status, Cookie, Header

from ..storage.user_storage import UserStorage
from ..storage.project_storage import ProjectStorage
from ..storage.trash_storage import TrashStorage
from ..config import SUPABASE_JWT_SECRET, USE_SUPABASE_AUTH

logger = logging.getLogger(__name__)


# ===========================================
# Rate Limiter
# ===========================================


class RateLimiter:
    """Simple in-memory rate limiter with sliding window.

    For production, consider using Redis for distributed rate limiting.
    """

    def __init__(self):
        # Structure: {action: {user_id: [timestamp, ...]}}
        self._requests: dict[str, dict[str, list[float]]] = defaultdict(
            lambda: defaultdict(list)
        )

    def _cleanup_old_requests(
        self, user_requests: list[float], window_seconds: int
    ) -> list[float]:
        """Remove requests older than the window."""
        cutoff = time.time() - window_seconds
        return [ts for ts in user_requests if ts > cutoff]

    def check_rate_limit(
        self,
        user_id: str,
        action: str,
        max_requests: int,
        window_seconds: int = 3600,
    ) -> bool:
        """Check if user is within rate limit.

        Args:
            user_id: User identifier
            action: Action name (e.g., "create_issue", "add_comment")
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds (default: 1 hour)

        Returns:
            True if within limit, False if exceeded
        """
        user_requests = self._requests[action][user_id]
        user_requests = self._cleanup_old_requests(user_requests, window_seconds)
        self._requests[action][user_id] = user_requests

        return len(user_requests) < max_requests

    def record_request(self, user_id: str, action: str) -> None:
        """Record a request for rate limiting."""
        self._requests[action][user_id].append(time.time())

    def get_remaining(
        self,
        user_id: str,
        action: str,
        max_requests: int,
        window_seconds: int = 3600,
    ) -> int:
        """Get remaining requests in current window."""
        user_requests = self._requests[action][user_id]
        user_requests = self._cleanup_old_requests(user_requests, window_seconds)
        return max(0, max_requests - len(user_requests))


# Global rate limiter instance
rate_limiter = RateLimiter()

# Rate limit constants
RATE_LIMIT_ISSUES_PER_HOUR = 5
RATE_LIMIT_COMMENTS_PER_HOUR = 20


# ===========================================
# User Authentication
# ===========================================


class UserInfo(NamedTuple):
    """User information extracted from JWT token."""
    user_id: str
    email: str | None = None


async def get_current_user(
    session_user_id: Annotated[str | None, Cookie()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    """Get current user from JWT token or session cookie.

    Supports both:
    - Supabase JWT tokens (Authorization: Bearer <token>)
    - Legacy session cookies (session_user_id)
    """
    # Try JWT authentication first (Supabase)
    if authorization and authorization.startswith("Bearer "):
        if not SUPABASE_JWT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase JWT secret not configured",
            )

        token = authorization.split(" ")[1]
        try:
            # Decode and validate Supabase JWT
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            # Supabase stores user ID in 'sub' claim
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing user ID",
                )
            return user_id
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}",
            )

    # Fall back to cookie-based auth (legacy)
    if session_user_id:
        return session_user_id

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


CurrentUser = Annotated[str, Depends(get_current_user)]


async def get_current_user_info(
    session_user_id: Annotated[str | None, Cookie()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> UserInfo:
    """Get current user info including email from JWT token or session cookie.

    Returns UserInfo with user_id and email (if available from JWT).
    """
    # Try JWT authentication first (Supabase)
    if authorization and authorization.startswith("Bearer "):
        if not SUPABASE_JWT_SECRET:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase JWT secret not configured",
            )

        token = authorization.split(" ")[1]
        try:
            # Decode and validate Supabase JWT
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            # Supabase stores user ID in 'sub' claim
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing user ID",
                )
            # Extract email from JWT payload
            email = payload.get("email")
            return UserInfo(user_id=user_id, email=email)
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token: {str(e)}",
            )

    # Fall back to cookie-based auth (legacy) - no email available
    if session_user_id:
        return UserInfo(user_id=session_user_id, email=None)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
    )


CurrentUserInfo = Annotated[UserInfo, Depends(get_current_user_info)]


def get_user_storage(user_id: CurrentUser) -> UserStorage:
    """Get UserStorage for current user."""
    storage = UserStorage(user_id)
    storage.ensure_user_folders()
    return storage


def get_project_storage(user_id: CurrentUser) -> ProjectStorage:
    """Get ProjectStorage for current user."""
    storage = ProjectStorage(user_id)
    # Ensure default project exists
    storage.ensure_default_project()
    return storage


def get_trash_storage(user_id: CurrentUser) -> TrashStorage:
    """Get TrashStorage for current user."""
    storage = TrashStorage(user_id)
    storage.ensure_trash_dirs()
    return storage


UserStorageDep = Annotated[UserStorage, Depends(get_user_storage)]
ProjectStorageDep = Annotated[ProjectStorage, Depends(get_project_storage)]
TrashStorageDep = Annotated[TrashStorage, Depends(get_trash_storage)]
