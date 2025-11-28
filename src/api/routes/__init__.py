"""API routes."""

from .auth import router as auth_router
from .videos import router as videos_router
from .manuals import router as manuals_router
from .projects import router as projects_router

__all__ = ["auth_router", "videos_router", "manuals_router", "projects_router"]
