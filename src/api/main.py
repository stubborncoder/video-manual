"""Main FastAPI application for vDocs."""

import logging
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

from .routes import auth_router, videos_router, manuals_router, projects_router, trash_router, compile_stream_router, jobs_router, admin_router, templates_router, guide_router
from .websockets import process_video_router, compile_project_router, editor_copilot_router
from ..config import ensure_directories, CORS_ORIGINS
from ..db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    ensure_directories()
    init_db()  # Initialize SQLite database
    yield
    # Shutdown (cleanup if needed)


def create_app(
    cors_origins: list[str] | None = None,
    debug: bool = False,
) -> FastAPI:
    """Create and configure the FastAPI application."""

    app = FastAPI(
        title="vDocs",
        description="AI-powered documentation from video",
        version="0.1.0",
        lifespan=lifespan,
        debug=debug,
    )

    # CORS middleware - use config values which can be overridden via environment
    if cors_origins is None:
        cors_origins = CORS_ORIGINS + [
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # REST API routes
    app.include_router(auth_router, prefix="/api")
    app.include_router(videos_router, prefix="/api")
    app.include_router(manuals_router, prefix="/api")
    app.include_router(projects_router, prefix="/api")
    app.include_router(trash_router, prefix="/api")
    app.include_router(jobs_router, prefix="/api")
    app.include_router(templates_router, prefix="/api")
    app.include_router(guide_router, prefix="/api")
    app.include_router(admin_router)  # Admin routes already have /api/admin prefix
    app.include_router(compile_stream_router, prefix="/api/assistant")

    # WebSocket routes
    app.include_router(process_video_router, prefix="/api")
    app.include_router(compile_project_router, prefix="/api")
    app.include_router(editor_copilot_router, prefix="/api")

    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "name": "vDocs API",
            "version": "0.1.0",
            "docs": "/docs",
        }

    @app.get("/health")
    async def health():
        """Health check endpoint."""
        return {"status": "healthy"}

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Log all unhandled exceptions with full traceback."""
        tb = traceback.format_exc()
        logger.error(f"Unhandled exception on {request.method} {request.url}:\n{tb}")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

    return app


# Default app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
