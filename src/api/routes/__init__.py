"""API routes."""

from .auth import router as auth_router
from .videos import router as videos_router
from .docs import router as docs_router
from .projects import router as projects_router
from .trash import router as trash_router
from .compile_stream import router as compile_stream_router
from .jobs import router as jobs_router
from .admin import router as admin_router
from .templates import router as templates_router
from .guide import router as guide_router
from .bugs import router as bugs_router
from .share import router as share_router
from .share_view import router as share_view_router
from .project_share import router as project_share_router
from .project_share_view import router as project_share_view_router

__all__ = [
    "auth_router",
    "videos_router",
    "docs_router",
    "projects_router",
    "trash_router",
    "compile_stream_router",
    "jobs_router",
    "admin_router",
    "templates_router",
    "guide_router",
    "bugs_router",
    "share_router",
    "share_view_router",
    "project_share_router",
    "project_share_view_router",
]
