"""FastAPI dependencies for authentication and storage access."""

from typing import Annotated
from fastapi import Depends, HTTPException, status, Cookie, Header
import jwt

from ..storage.user_storage import UserStorage
from ..storage.project_storage import ProjectStorage
from ..storage.trash_storage import TrashStorage
from ..config import SUPABASE_JWT_SECRET, USE_SUPABASE_AUTH


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
