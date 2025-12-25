"""Tests for admin routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_users_non_admin(client: AsyncClient):
    """Test listing users as non-admin returns 403."""
    response = await client.get("/api/admin/users")
    assert response.status_code == 403
    assert "Admin access required" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_user_stats_non_admin(client: AsyncClient):
    """Test getting user stats as non-admin returns 403."""
    response = await client.get("/api/admin/users/test-user/stats")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_user_usage_non_admin(client: AsyncClient):
    """Test getting user usage as non-admin returns 403."""
    response = await client.get("/api/admin/users/test-user/usage")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_usage_summary_non_admin(client: AsyncClient):
    """Test getting usage summary as non-admin returns 403."""
    response = await client.get("/api/admin/usage/summary")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_daily_usage_non_admin(client: AsyncClient):
    """Test getting daily usage as non-admin returns 403."""
    response = await client.get("/api/admin/usage/daily")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_model_usage_non_admin(client: AsyncClient):
    """Test getting model usage as non-admin returns 403."""
    response = await client.get("/api/admin/usage/models")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_set_user_role_non_admin(client: AsyncClient):
    """Test setting user role as non-admin returns 403."""
    response = await client.post(
        "/api/admin/users/test-user/role",
        json={"role": "admin"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_set_user_tier_non_admin(client: AsyncClient):
    """Test setting user tier as non-admin returns 403."""
    response = await client.post(
        "/api/admin/users/test-user/tier",
        json={"tier": "pro"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_set_user_tester_non_admin(client: AsyncClient):
    """Test setting user tester status as non-admin returns 403."""
    response = await client.post(
        "/api/admin/users/test-user/tester",
        json={"tester": True},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_available_models_non_admin(client: AsyncClient):
    """Test getting available models as non-admin returns 403."""
    response = await client.get("/api/admin/models")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_model_settings_non_admin(client: AsyncClient):
    """Test getting model settings as non-admin returns 403."""
    response = await client.get("/api/admin/settings/models")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_api_keys_status_non_admin(client: AsyncClient):
    """Test getting API keys status as non-admin returns 403."""
    response = await client.get("/api/admin/settings/api-keys")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_model_settings_non_admin(client: AsyncClient):
    """Test updating model settings as non-admin returns 403."""
    response = await client.put(
        "/api/admin/settings/models",
        json={"video_analysis": "some-model"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_doc_usage_non_admin(client: AsyncClient):
    """Test getting doc usage as non-admin returns 403."""
    response = await client.get("/api/admin/usage/docs")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_admin_routes_require_auth(unauthenticated_client: AsyncClient):
    """Test that admin routes require authentication."""
    response = await unauthenticated_client.get("/api/admin/users")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_stats_require_auth(unauthenticated_client: AsyncClient):
    """Test that admin stats require authentication."""
    response = await unauthenticated_client.get("/api/admin/usage/summary")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_settings_require_auth(unauthenticated_client: AsyncClient):
    """Test that admin settings require authentication."""
    response = await unauthenticated_client.get("/api/admin/settings/models")
    assert response.status_code == 401
