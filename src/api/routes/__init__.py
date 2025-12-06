"""API routes."""

from .auth import router as auth_router
from .videos import router as videos_router
from .manuals import router as manuals_router
from .projects import router as projects_router
from .trash import router as trash_router
from .compile_stream import router as compile_stream_router
from .jobs import router as jobs_router
from .admin import router as admin_router

__all__ = [
    "auth_router",
    "videos_router",
    "manuals_router",
    "projects_router",
    "trash_router",
    "compile_stream_router",
    "jobs_router",
    "admin_router",
]
