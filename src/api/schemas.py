"""Pydantic schemas for API requests and responses."""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field


# ==================== Auth ====================


class LoginRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)


class UserSession(BaseModel):
    user_id: str
    created_at: datetime = Field(default_factory=datetime.now)


# ==================== Videos ====================


class VideoInfo(BaseModel):
    name: str
    path: str
    size_bytes: int
    modified_at: datetime


class VideoListResponse(BaseModel):
    videos: list[VideoInfo]


# ==================== Manuals ====================


class ManualSummary(BaseModel):
    id: str
    created_at: Optional[str] = None
    screenshot_count: int = 0
    languages: list[str] = []


class ManualDetail(BaseModel):
    id: str
    content: str
    language: str
    screenshots: list[str] = []


class ManualListResponse(BaseModel):
    manuals: list[ManualSummary]


# ==================== Projects ====================


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = ""


class ChapterCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = ""


class ChapterInfo(BaseModel):
    id: str
    title: str
    description: str
    order: int


class ProjectManualInfo(BaseModel):
    manual_id: str
    chapter_id: Optional[str] = None
    order: int


class ProjectSummary(BaseModel):
    id: str
    name: str
    description: str
    created_at: str
    manual_count: int


class ProjectDetail(BaseModel):
    id: str
    name: str
    description: str
    created_at: str
    chapters: list[ChapterInfo]
    manuals: list[ProjectManualInfo]


class ProjectListResponse(BaseModel):
    projects: list[ProjectSummary]


# ==================== Processing ====================


class ProcessVideoRequest(BaseModel):
    video_path: str
    output_filename: Optional[str] = None
    use_scene_detection: bool = True
    output_language: str = "English"
    project_id: Optional[str] = None
    chapter_id: Optional[str] = None
    tags: list[str] = []


class CompileProjectRequest(BaseModel):
    project_id: str
    language: str = "en"
    model: Optional[str] = None


class HITLDecision(BaseModel):
    approved: bool
    modified_args: Optional[dict[str, Any]] = None
    feedback: Optional[str] = None


# ==================== Events (for WebSocket) ====================


class EventMessage(BaseModel):
    """WebSocket event message format."""

    event_type: str
    timestamp: float
    data: dict[str, Any] = {}


# ==================== Export ====================


class ExportRequest(BaseModel):
    project_id: str
    format: str = "pdf"  # pdf, word, html
    language: str = "en"
    include_toc: bool = True
    include_chapter_covers: bool = True
    embed_images: bool = True  # for HTML


class ExportResponse(BaseModel):
    output_path: str
    format: str
