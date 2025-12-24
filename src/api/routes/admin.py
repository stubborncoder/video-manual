"""Admin API routes."""

from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..dependencies import CurrentUser
from ..middleware.admin import require_admin
from ..schemas import UserInfo, UsageSummary, SetRoleRequest, SetTierRequest, SetTesterRequest, UserStats
from ...db.user_management import UserManagement
from ...db.usage_tracking import UsageTracking
from ...db.admin_settings import AdminSettings
from ...storage.user_storage import UserStorage
from ...storage.project_storage import ProjectStorage
from ...storage.template_storage import TemplateStorage
from ...storage.trash_storage import TrashStorage
from ...core.models import (
    TaskType,
    MODEL_REGISTRY,
    MODELS_BY_TASK,
    get_model,
    get_models_for_task,
    validate_api_key_for_model,
    get_api_key_status,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def get_admin_user(user_id: CurrentUser) -> str:
    """Dependency to ensure user is admin."""
    return await require_admin(user_id)


AdminUser = Annotated[str, Depends(get_admin_user)]


@router.get("/users")
async def list_users(admin_user: AdminUser) -> list[UserInfo]:
    """List all users with usage statistics.

    Requires admin role.
    Fetches users directly from Supabase Auth.
    """
    users = UserManagement.list_users()

    # Fetch usage summary once and create lookup dictionary for O(1) access
    usage_summaries = UsageTracking.get_all_users_usage()
    usage_by_user = {s["user_id"]: s.get("total_cost_usd", 0.0) for s in usage_summaries}

    user_infos = []
    for user in users:
        user_infos.append(
            UserInfo(
                id=user["id"],
                display_name=user.get("display_name"),
                email=user.get("email"),
                role=user["role"],
                tier=user.get("tier", "free"),
                tester=user.get("tester", False),
                created_at=str(user["created_at"]),
                last_login=str(user["last_login"]) if user.get("last_login") else None,
                total_cost_usd=usage_by_user.get(user["id"], 0.0),
            )
        )

    return user_infos


@router.get("/users/{user_id}/usage")
async def get_user_usage(
    user_id: str,
    admin_user: AdminUser,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    """Get usage records for a specific user.

    Requires admin role.

    Args:
        user_id: User to get usage for
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
    """
    # Check user exists
    user = UserManagement.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UsageTracking.get_user_usage(user_id, start_date, end_date)


@router.get("/users/{user_id}/stats")
async def get_user_stats(user_id: str, admin_user: AdminUser) -> UserStats:
    """Get comprehensive statistics for a specific user.

    Requires admin role.

    Returns user info plus counts of videos, manuals, projects, templates, trash items,
    and usage statistics.
    """
    # Get user info
    user = UserManagement.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get content counts using storage classes
    user_storage = UserStorage(user_id)
    project_storage = ProjectStorage(user_id)
    template_storage = TemplateStorage(user_id)
    trash_storage = TrashStorage(user_id)

    # Count items
    video_count = len(user_storage.list_videos())
    manual_count = len(user_storage.list_docs())
    project_count = len(project_storage.list_projects())
    template_count = len(template_storage.list_user_templates())
    trash_count = len(trash_storage.list_trash())

    # Get usage statistics
    usage_summary = UsageTracking.get_user_usage_summary(user_id)

    return UserStats(
        user_id=user_id,
        email=user.get("email"),
        display_name=user.get("display_name"),
        role=user["role"],
        tier=user.get("tier", "free"),
        tester=user.get("tester", False),
        created_at=str(user["created_at"]) if user.get("created_at") else None,
        last_login=str(user["last_login"]) if user.get("last_login") else None,
        video_count=video_count,
        manual_count=manual_count,
        project_count=project_count,
        template_count=template_count,
        trash_count=trash_count,
        total_requests=usage_summary.get("total_requests", 0),
        total_input_tokens=usage_summary.get("total_input_tokens", 0),
        total_output_tokens=usage_summary.get("total_output_tokens", 0),
        total_cached_tokens=usage_summary.get("total_cached_tokens", 0),
        total_cost_usd=usage_summary.get("total_cost_usd", 0.0),
    )


@router.get("/usage/summary")
async def get_usage_summary(
    admin_user: AdminUser,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[UsageSummary]:
    """Get usage summary for all users.

    Requires admin role.

    Args:
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
    """
    summaries = UsageTracking.get_all_users_usage(start_date, end_date)

    return [
        UsageSummary(
            user_id=s["user_id"],
            total_requests=s["total_requests"],
            total_input_tokens=s["total_input_tokens"],
            total_output_tokens=s["total_output_tokens"],
            total_cached_tokens=s.get("total_cached_tokens", 0),
            total_cache_read_tokens=s.get("total_cache_read_tokens", 0),
            total_cost_usd=s["total_cost_usd"],
        )
        for s in summaries
    ]


@router.get("/usage/daily")
async def get_daily_usage(
    admin_user: AdminUser,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    """Get daily usage breakdown.

    Requires admin role.

    Args:
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
    """
    return UsageTracking.get_daily_summary(start_date, end_date)


@router.get("/usage/models")
async def get_model_usage(
    admin_user: AdminUser,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    """Get usage breakdown by model/API.

    Requires admin role.

    Args:
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
    """
    return UsageTracking.get_model_summary(start_date, end_date)


@router.get("/usage/manuals")
async def get_manual_usage(
    admin_user: AdminUser,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> list[dict]:
    """Get usage breakdown by manual.

    Requires admin role.

    Args:
        start_date: Optional start date (YYYY-MM-DD)
        end_date: Optional end date (YYYY-MM-DD)
    """
    return UsageTracking.get_manual_usage(start_date, end_date)


@router.post("/users/{user_id}/role")
async def set_user_role(
    user_id: str,
    request: SetRoleRequest,
    admin_user: AdminUser,
) -> dict:
    """Set user role.

    Requires admin role.

    Args:
        user_id: User to update
        request: Role to set
    """
    # Check user exists
    user = UserManagement.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update role
    try:
        success = UserManagement.set_role(user_id, request.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update role")

    return {"user_id": user_id, "role": request.role}


@router.post("/users/{user_id}/tier")
async def set_user_tier(
    user_id: str,
    request: SetTierRequest,
    admin_user: AdminUser,
) -> dict:
    """Set user tier.

    Requires admin role.

    Args:
        user_id: User to update
        request: Tier to set (free, basic, pro, enterprise)
    """
    # Check user exists
    user = UserManagement.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update tier
    try:
        success = UserManagement.set_tier(user_id, request.tier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update tier")

    return {"user_id": user_id, "tier": request.tier}


@router.post("/users/{user_id}/tester")
async def set_user_tester(
    user_id: str,
    request: SetTesterRequest,
    admin_user: AdminUser,
) -> dict:
    """Set user tester status.

    Requires admin role.

    Args:
        user_id: User to update
        request: Tester status to set
    """
    # Check user exists
    user = UserManagement.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Update tester status
    success = UserManagement.set_tester(user_id, request.tester)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update tester status")

    return {"user_id": user_id, "tester": request.tester}


# ============================================
# MODEL SETTINGS ENDPOINTS
# ============================================


class ModelSettingsRequest(BaseModel):
    """Request body for updating model settings."""
    video_analysis: Optional[str] = None
    manual_generation: Optional[str] = None
    manual_evaluation: Optional[str] = None
    manual_editing: Optional[str] = None


class ModelInfo(BaseModel):
    """Model information for API responses."""
    id: str
    name: str
    provider: str
    input_cost_per_million: float
    output_cost_per_million: float
    supports_video: bool
    supports_vision: bool
    description: Optional[str] = None


class ModelsResponse(BaseModel):
    """Response containing available models by task."""
    video_analysis: list[ModelInfo]
    manual_generation: list[ModelInfo]
    manual_evaluation: list[ModelInfo]
    manual_editing: list[ModelInfo]
    guide_assistant: list[ModelInfo]


@router.get("/models")
async def get_available_models(admin_user: AdminUser) -> ModelsResponse:
    """Get available models for each task type.

    Requires admin role.
    """
    def to_model_info(model) -> ModelInfo:
        return ModelInfo(
            id=model.id,
            name=model.name,
            provider=model.provider.value,
            input_cost_per_million=model.input_cost_per_million,
            output_cost_per_million=model.output_cost_per_million,
            supports_video=model.supports_video,
            supports_vision=model.supports_vision,
            description=model.description,
        )

    return ModelsResponse(
        video_analysis=[to_model_info(m) for m in get_models_for_task(TaskType.VIDEO_ANALYSIS)],
        manual_generation=[to_model_info(m) for m in get_models_for_task(TaskType.MANUAL_GENERATION)],
        manual_evaluation=[to_model_info(m) for m in get_models_for_task(TaskType.MANUAL_EVALUATION)],
        manual_editing=[to_model_info(m) for m in get_models_for_task(TaskType.MANUAL_EDITING)],
        guide_assistant=[to_model_info(m) for m in get_models_for_task(TaskType.GUIDE_ASSISTANT)],
    )


@router.get("/settings/models")
async def get_model_settings(admin_user: AdminUser) -> dict:
    """Get current model settings for all tasks.

    Requires admin role.

    Returns a simple dict mapping task names to model IDs.
    """
    return AdminSettings.get_all_model_settings()


@router.put("/settings/models")
async def update_model_settings(
    request: ModelSettingsRequest,
    admin_user: AdminUser,
) -> dict:
    """Update model settings for tasks.

    Requires admin role.

    Only provided fields will be updated.
    Validates that the required API key is configured for each model.
    """
    settings_to_update = {}

    if request.video_analysis:
        settings_to_update["video_analysis"] = request.video_analysis
    if request.manual_generation:
        settings_to_update["manual_generation"] = request.manual_generation
    if request.manual_evaluation:
        settings_to_update["manual_evaluation"] = request.manual_evaluation
    if request.manual_editing:
        settings_to_update["manual_editing"] = request.manual_editing

    if not settings_to_update:
        raise HTTPException(status_code=400, detail="No settings provided")

    # Validate API keys for all selected models
    api_key_errors = []
    for task, model_id in settings_to_update.items():
        is_valid, error = validate_api_key_for_model(model_id)
        if not is_valid:
            api_key_errors.append(f"{task}: {error}")

    if api_key_errors:
        raise HTTPException(
            status_code=400,
            detail=f"Missing API keys: {'; '.join(api_key_errors)}"
        )

    results = AdminSettings.set_all_model_settings(settings_to_update, admin_user)

    # Check for failures
    failures = [k for k, v in results.items() if not v]
    if failures:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid models for tasks: {', '.join(failures)}"
        )

    return {"success": True, "updated": list(settings_to_update.keys())}


@router.get("/settings/api-keys")
async def get_api_keys_status(admin_user: AdminUser) -> dict:
    """Get the status of configured API keys.

    Requires admin role.

    Returns which providers have their API keys configured.
    """
    return get_api_key_status()
