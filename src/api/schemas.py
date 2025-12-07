"""Pydantic schemas for API requests and responses."""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator

from ..core.constants import (
    MAX_TARGET_AUDIENCE_LENGTH,
    MAX_TARGET_OBJECTIVE_LENGTH,
    SUPPORTED_LANGUAGES,
    normalize_language_to_code,
    EVALUATION_SCORE_MIN,
    EVALUATION_SCORE_MAX,
)


# ==================== Auth ====================


class LoginRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=64)


class UserSession(BaseModel):
    user_id: str
    role: str = "user"
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


class SourceVideoInfo(BaseModel):
    """Information about the source video for a manual."""
    name: str
    exists: bool = True


class LanguageEvaluation(BaseModel):
    """Evaluation status for a language."""
    score: Optional[int] = None  # None if not evaluated
    evaluated: bool = False


class ManualSummary(BaseModel):
    id: str
    title: str = ""  # Display title (derived from video name or manual content)
    created_at: Optional[str] = None
    screenshot_count: int = 0
    languages: list[str] = []
    evaluations: dict[str, LanguageEvaluation] = {}  # lang -> evaluation status
    source_video: Optional[SourceVideoInfo] = None
    project_id: Optional[str] = None
    target_audience: Optional[str] = None
    target_objective: Optional[str] = None


class ManualDetail(BaseModel):
    id: str
    title: str = ""  # Display title
    content: str
    language: str
    screenshots: list[str] = []
    source_video: Optional[SourceVideoInfo] = None


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


class ProjectVideoInfo(BaseModel):
    """Video information for a project."""
    name: str
    path: str
    exists: bool = True
    manual_count: int = 0  # Number of manuals from this video


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
    is_default: bool = False
    chapters: list[ChapterInfo]
    manuals: list[ProjectManualInfo]
    videos: list[ProjectVideoInfo] = []


class ProjectListResponse(BaseModel):
    projects: list[ProjectSummary]


# ==================== Jobs ====================


class JobInfo(BaseModel):
    """Information about a video processing job."""
    id: str
    user_id: str
    video_name: str
    manual_id: Optional[str] = None
    status: str  # 'pending', 'processing', 'complete', 'error'
    current_node: Optional[str] = None
    node_index: Optional[int] = None
    total_nodes: Optional[int] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    seen: bool = False


class JobListResponse(BaseModel):
    """Response for listing jobs."""
    jobs: list[JobInfo]


# ==================== Processing ====================


class ProcessVideoRequest(BaseModel):
    video_path: str
    output_filename: Optional[str] = None
    use_scene_detection: bool = True
    output_language: str = "English"
    project_id: Optional[str] = None
    chapter_id: Optional[str] = None
    tags: list[str] = []
    target_audience: Optional[str] = Field(
        None,
        max_length=MAX_TARGET_AUDIENCE_LENGTH,
        description="Target audience for the generated manual"
    )
    target_objective: Optional[str] = Field(
        None,
        max_length=MAX_TARGET_OBJECTIVE_LENGTH,
        description="Objective the manual should help readers accomplish"
    )

    @field_validator('output_language')
    @classmethod
    def validate_output_language(cls, v: str) -> str:
        """Validate and normalize output language to ISO code.

        Accepts both language names ("English") and codes ("en").
        Returns the ISO 639-1 code.
        """
        return normalize_language_to_code(v)


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


# ==================== Trash ====================


class TrashItemInfo(BaseModel):
    """Information about an item in trash."""
    trash_id: str
    item_type: str  # "video", "manual", "project"
    original_name: str
    deleted_at: str
    expires_at: str
    cascade_deleted: bool = False
    related_items: list[str] = []


class TrashListResponse(BaseModel):
    """Response for listing trash items."""
    items: list[TrashItemInfo]
    stats: dict[str, int]


class RestoreResponse(BaseModel):
    """Response for restoring an item."""
    restored_path: str
    item_type: str
    original_name: str


class VideoWithManuals(BaseModel):
    """Video info including associated manuals."""
    name: str
    path: str
    size_bytes: int
    modified_at: datetime
    manual_count: int
    manuals: list[dict[str, Any]] = []


# ==================== Export ====================


class ExportRequest(BaseModel):
    project_id: str
    format: str = "pdf"  # pdf, word, html
    language: str = "en"
    include_toc: bool = True
    include_chapter_covers: bool = True
    embed_images: bool = True  # for HTML
    template_name: str | None = None  # For Word template-based export


class ExportResponse(BaseModel):
    output_path: str
    format: str


# ==================== Evaluation ====================


class EvaluationScoreCategory(BaseModel):
    """Score for a specific evaluation category."""
    score: int = Field(..., ge=EVALUATION_SCORE_MIN, le=EVALUATION_SCORE_MAX)
    explanation: str = ""


class EvaluationScoreRange(BaseModel):
    """Score range for evaluations."""
    min: int = EVALUATION_SCORE_MIN
    max: int = EVALUATION_SCORE_MAX


class ManualEvaluation(BaseModel):
    """Schema for manual evaluation data.

    Used to validate stored evaluations when loading from disk.
    """
    manual_id: str
    language: str
    overall_score: int = Field(..., ge=EVALUATION_SCORE_MIN, le=EVALUATION_SCORE_MAX)
    summary: str = ""
    strengths: list[str] = []
    areas_for_improvement: list[str] = []
    recommendations: list[str] = []
    objective_alignment: Optional[EvaluationScoreCategory] = None
    audience_appropriateness: Optional[EvaluationScoreCategory] = None
    general_usability: Optional[EvaluationScoreCategory] = None  # Used when no target context
    clarity_and_completeness: Optional[EvaluationScoreCategory] = None
    technical_accuracy: Optional[EvaluationScoreCategory] = None
    structure_and_flow: Optional[EvaluationScoreCategory] = None
    evaluated_at: str = ""
    stored_at: Optional[str] = None
    version: Optional[str] = None
    target_audience: Optional[str] = None
    target_objective: Optional[str] = None
    score_range: Optional[EvaluationScoreRange] = None

    @field_validator('language')
    @classmethod
    def validate_language(cls, v: str) -> str:
        """Validate language is a supported ISO code."""
        return normalize_language_to_code(v)


# ==================== Admin ====================


class UserInfo(BaseModel):
    """User information for admin dashboard."""
    id: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    created_at: str
    last_login: Optional[str] = None
    total_cost_usd: float = 0.0


class UsageRecord(BaseModel):
    """LLM usage record."""
    timestamp: str
    operation: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    manual_id: Optional[str] = None


class DailyUsage(BaseModel):
    """Daily usage summary."""
    user_id: str
    date: str
    operations: dict[str, int]  # operation -> request_count
    total_tokens: int
    total_cost_usd: float


class UsageSummary(BaseModel):
    """Usage summary for a time period."""
    user_id: str
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_cached_tokens: int = 0
    total_cache_read_tokens: int = 0
    total_cost_usd: float


class SetRoleRequest(BaseModel):
    """Request to set user role."""
    role: str = Field(..., pattern="^(user|admin)$")
