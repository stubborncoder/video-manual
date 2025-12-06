"""Authentication routes."""

from fastapi import APIRouter, Cookie, Response

from ..schemas import LoginRequest, UserSession
from ...storage.user_storage import UserStorage
from ...db.user_management import UserManagement

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(request: LoginRequest, response: Response) -> UserSession:
    """Login with user ID (creates user folder if needed)."""
    user_id = request.user_id

    # Ensure user folders exist
    storage = UserStorage(user_id)
    storage.ensure_user_folders()

    # Ensure user record exists in database
    user = UserManagement.ensure_user_exists(user_id)

    # Update last login timestamp
    UserManagement.update_last_login(user_id)

    # Set session cookie
    response.set_cookie(
        key="session_user_id",
        value=user_id,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )

    # Return session with role information
    session = UserSession(user_id=user_id)
    session.role = user.get("role", "user")

    return session


@router.post("/logout")
async def logout(response: Response) -> dict:
    """Logout current user."""
    response.delete_cookie("session_user_id")
    return {"status": "logged_out"}


@router.get("/me")
async def get_me(
    session_user_id: str | None = Cookie(default=None),
) -> dict:
    """Get current user info including role."""
    if not session_user_id:
        return {"authenticated": False}

    # Get user role from database
    user = UserManagement.get_user(session_user_id)
    role = user.get("role", "user") if user else "user"

    return {"authenticated": True, "user_id": session_user_id, "role": role}
