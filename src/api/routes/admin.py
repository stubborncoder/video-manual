"""Admin API routes."""

from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import CurrentUser
from ..middleware.admin import require_admin
from ..schemas import UserInfo, UsageSummary, SetRoleRequest
from ...db.user_management import UserManagement
from ...db.usage_tracking import UsageTracking

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def get_admin_user(user_id: CurrentUser) -> str:
    """Dependency to ensure user is admin."""
    return await require_admin(user_id)


AdminUser = Annotated[str, Depends(get_admin_user)]


@router.get("/users")
async def list_users(admin_user: AdminUser) -> list[UserInfo]:
    """List all users with usage statistics.

    Requires admin role.
    """
    users = UserManagement.list_users()
    user_infos = []

    for user in users:
        # Get total cost for user
        usage_summary = UsageTracking.get_all_users_usage()
        total_cost = 0.0
        for summary in usage_summary:
            if summary["user_id"] == user["id"]:
                total_cost = summary.get("total_cost_usd", 0.0)
                break

        user_infos.append(
            UserInfo(
                id=user["id"],
                display_name=user.get("display_name"),
                email=user.get("email"),
                role=user["role"],
                created_at=str(user["created_at"]),
                last_login=str(user["last_login"]) if user.get("last_login") else None,
                total_cost_usd=total_cost,
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
    success = UserManagement.set_role(user_id, request.role)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update role")

    return {"user_id": user_id, "role": request.role}
