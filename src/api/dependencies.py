"""FastAPI dependencies for authentication and storage access."""

from typing import Annotated
from fastapi import Depends, HTTPException, status, Cookie

from ..storage.user_storage import UserStorage
from ..storage.project_storage import ProjectStorage


async def get_current_user(
    session_user_id: Annotated[str | None, Cookie()] = None
) -> str:
    """Get current user from session cookie."""
    if not session_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return session_user_id


CurrentUser = Annotated[str, Depends(get_current_user)]


def get_user_storage(user_id: CurrentUser) -> UserStorage:
    """Get UserStorage for current user."""
    storage = UserStorage(user_id)
    storage.ensure_user_folders()
    return storage


def get_project_storage(user_id: CurrentUser) -> ProjectStorage:
    """Get ProjectStorage for current user."""
    return ProjectStorage(user_id)


UserStorageDep = Annotated[UserStorage, Depends(get_user_storage)]
ProjectStorageDep = Annotated[ProjectStorage, Depends(get_project_storage)]
