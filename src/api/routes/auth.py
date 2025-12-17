"""Authentication routes."""

from fastapi import APIRouter, Cookie, Response, Header
import jwt

from ..schemas import LoginRequest, UserSession
from ...storage.user_storage import UserStorage
from ...db.user_management import UserManagement
from ...config import SUPABASE_JWT_SECRET

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(request: LoginRequest, response: Response) -> UserSession:
    """Login with user ID (creates user folder if needed).

    This is the legacy login endpoint for cookie-based auth.
    For Supabase auth, use the Supabase client directly.
    """
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
    response: Response,
    session_user_id: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """Get current user info including role.

    Supports both JWT tokens and legacy session cookies.
    Also syncs session cookie for JWT auth to support media streaming.
    """
    user_id = None
    email = None
    display_name = None
    from_jwt = False

    # Try JWT authentication first (Supabase)
    if authorization and authorization.startswith("Bearer ") and SUPABASE_JWT_SECRET:
        token = authorization.split(" ")[1]
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
            user_id = payload.get("sub")
            email = payload.get("email")
            from_jwt = True
            # Get display name from user_metadata (Google OAuth provides this)
            user_metadata = payload.get("user_metadata", {})
            display_name = user_metadata.get("full_name") or user_metadata.get("name")
        except jwt.InvalidTokenError:
            pass

    # Fall back to cookie auth
    if not user_id and session_user_id:
        user_id = session_user_id

    if not user_id:
        return {"authenticated": False}

    # Ensure user folders exist for file storage
    storage = UserStorage(user_id)
    storage.ensure_user_folders()

    # Sync session cookie if authenticated via JWT but cookie is missing/different
    # This allows <video> and <img> tags to work (they can't send Authorization headers)
    if from_jwt and session_user_id != user_id:
        response.set_cookie(
            key="session_user_id",
            value=user_id,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,  # 7 days
        )

    # Get user role from Supabase
    user = UserManagement.get_user(user_id)
    role = user.get("role", "user") if user else "user"

    return {"authenticated": True, "user_id": user_id, "role": role}
