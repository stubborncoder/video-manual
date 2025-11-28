"""Authentication routes."""

from fastapi import APIRouter, Response

from ..schemas import LoginRequest, UserSession
from ...storage.user_storage import UserStorage

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(request: LoginRequest, response: Response) -> UserSession:
    """Login with user ID (creates user folder if needed)."""
    user_id = request.user_id

    # Ensure user folders exist
    storage = UserStorage(user_id)
    storage.ensure_user_folders()

    # Set session cookie
    response.set_cookie(
        key="session_user_id",
        value=user_id,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
    )

    return UserSession(user_id=user_id)


@router.post("/logout")
async def logout(response: Response) -> dict:
    """Logout current user."""
    response.delete_cookie("session_user_id")
    return {"status": "logged_out"}


@router.get("/me")
async def get_me(
    session_user_id: str | None = None,
) -> dict:
    """Get current user info."""
    from fastapi import Cookie
    # This will be handled by the dependency in actual use
    if not session_user_id:
        return {"authenticated": False}
    return {"authenticated": True, "user_id": session_user_id}
