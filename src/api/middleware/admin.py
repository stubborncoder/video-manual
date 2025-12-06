"""Admin authorization middleware."""

from fastapi import HTTPException, status

from ...db.user_management import UserManagement


async def require_admin(user_id: str) -> str:
    """Dependency to require admin role.

    Args:
        user_id: Current user ID from session

    Returns:
        user_id if user is admin

    Raises:
        HTTPException: If user is not admin
    """
    if not UserManagement.is_admin(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user_id
