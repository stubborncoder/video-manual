"""Main FastAPI application for vDocs."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import auth_router, videos_router, manuals_router, projects_router, trash_router, compile_stream_router, jobs_router
from .websockets import process_video_router, compile_project_router, editor_copilot_router
from ..config import ensure_directories
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

    # CORS middleware
    if cors_origins is None:
        cors_origins = [
            "http://localhost:3000",  # Next.js dev server
            "http://localhost:3001",  # Next.js dev server (alt port)
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
