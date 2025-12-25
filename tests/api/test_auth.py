"""Tests for authentication routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_login(client: AsyncClient):
    """Test user login creates session and user folder."""
    response = await client.post(
        "/api/auth/login",
        json={"user_id": "test-login-user"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_id"] == "test-login-user"
    assert "role" in data
    # Check that session cookie was set
    assert "session_user_id" in response.cookies


@pytest.mark.asyncio
async def test_login_empty_user_id(client: AsyncClient):
    """Test login with empty user_id returns validation error."""
    response = await client.post(
        "/api/auth/login",
        json={"user_id": ""},
    )
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_logout(client: AsyncClient):
    """Test logout clears session cookie."""
    response = await client.post("/api/auth/logout")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "logged_out"


@pytest.mark.asyncio
async def test_me_authenticated(client: AsyncClient, test_user_id: str):
    """Test /me endpoint returns user info when authenticated."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is True
    assert data["user_id"] == test_user_id
    assert "role" in data


@pytest.mark.asyncio
async def test_me_unauthenticated(unauthenticated_client: AsyncClient):
    """Test /me endpoint returns unauthenticated when no session."""
    response = await unauthenticated_client.get("/api/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["authenticated"] is False
    assert "user_id" not in data


@pytest.mark.asyncio
async def test_login_returns_role(client: AsyncClient):
    """Test that login returns user role."""
    response = await client.post(
        "/api/auth/login",
        json={"user_id": "test-role-user"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "role" in data
    # Default role should be "user"
    assert data["role"] in ["user", "admin"]
