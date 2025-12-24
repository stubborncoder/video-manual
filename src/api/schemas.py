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


class AdditionalVideoInfo(BaseModel):
    """Information about an additional video source for screenshot replacement."""
    id: str
    filename: str
    label: str
    language: Optional[str] = None  # ISO 639-1 code
    duration_seconds: float = 0
    size_bytes: int = 0
    added_at: Optional[str] = None
    exists: bool = True  # False if file was deleted from disk


class DocVideosResponse(BaseModel):
    """Response for listing all videos for a manual."""
    primary: dict  # Primary video info (id, filename, label, duration, exists)
    additional: list[AdditionalVideoInfo] = []


class AdditionalVideoUploadResponse(BaseModel):
    """Response after uploading an additional video."""
    id: str
    filename: str
    label: str
    language: Optional[str] = None
    duration_seconds: float = 0
    size_bytes: int = 0


class LanguageEvaluation(BaseModel):
    """Evaluation status for a language."""
    score: Optional[int] = None  # None if not evaluated
    evaluated: bool = False


class DocSummary(BaseModel):
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
    document_format: Optional[str] = None  # Document format type (step-manual, quick-guide, etc.)


class SourceLanguages(BaseModel):
    """Detected languages from the source video."""
    audio: Optional[str] = None  # ISO 639-1 code or None if silent
    ui_text: str  # ISO 639-1 code for on-screen text
    confidence: str = "medium"  # high, medium, low


class DocDetail(BaseModel):
    id: str
    title: str = ""  # Display title
    content: str
    language: str
    screenshots: list[str] = []
    source_video: Optional[SourceVideoInfo] = None
    document_format: Optional[str] = None  # e.g., "step-manual", "quick-guide"
    source_languages: Optional[SourceLanguages] = None  # Detected video/audio languages


class DocListResponse(BaseModel):
    docs: list[DocSummary]


class CloneDocRequest(BaseModel):
    """Request to clone a doc to a different document format."""
    document_format: str  # "step-manual", "quick-guide", "reference", "summary"
    title: Optional[str] = None  # Custom title, defaults to "Original Title (Format)"
    reformat_content: bool = False  # If true, use AI to adapt content to new format style

    @field_validator('document_format')
    @classmethod
    def validate_document_format(cls, v: str) -> str:
        """Validate document format is a known format type."""
        from ..agents.video_doc_agent.prompts import DOCUMENT_FORMATS
        if v not in DOCUMENT_FORMATS:
            valid_formats = list(DOCUMENT_FORMATS.keys())
            raise ValueError(f"Invalid document format '{v}'. Valid formats: {valid_formats}")
        return v


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


class SectionCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = ""


class SectionInfo(BaseModel):
    id: str
    title: str
    description: str
    order: int
    chapters: list[str] = []  # List of chapter IDs in this section


class ProjectManualInfo(BaseModel):
    doc_id: str
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
    sections: list[SectionInfo] = []
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
    doc_id: Optional[str] = None
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
    document_format: str = "step-manual"
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

    @field_validator('document_format')
    @classmethod
    def validate_document_format(cls, v: str) -> str:
        """Validate document format is a known format type."""
        from ..agents.video_doc_agent.prompts import DOCUMENT_FORMATS
        if v not in DOCUMENT_FORMATS:
            valid_formats = list(DOCUMENT_FORMATS.keys())
            raise ValueError(f"Invalid document format '{v}'. Valid formats: {valid_formats}")
        return v


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


class DocEvaluation(BaseModel):
    """Schema for doc evaluation data.

    Used to validate stored evaluations when loading from disk.
    """
    doc_id: str
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
    tier: str = "free"
    tester: bool = False
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
    doc_id: Optional[str] = None


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


class SetTierRequest(BaseModel):
    """Request to set user tier."""
    tier: str = Field(..., pattern="^(free|basic|pro|enterprise)$")


class SetTesterRequest(BaseModel):
    """Request to set user tester status."""
    tester: bool


class UserStats(BaseModel):
    """User statistics for admin user detail page."""
    user_id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: str = "user"
    tier: str = "free"
    tester: bool = False
    created_at: Optional[str] = None
    last_login: Optional[str] = None
    # Content statistics
    video_count: int = 0
    manual_count: int = 0
    project_count: int = 0
    template_count: int = 0
    trash_count: int = 0
    # Usage statistics
    total_requests: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cached_tokens: int = 0
    total_cost_usd: float = 0.0
