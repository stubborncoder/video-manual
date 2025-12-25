"""Tests for job management routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_jobs(client: AsyncClient):
    """Test listing all jobs for user."""
    response = await client.get("/api/jobs")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data
    assert isinstance(data["jobs"], list)


@pytest.mark.asyncio
async def test_list_jobs_with_status_filter(client: AsyncClient):
    """Test listing jobs with status filter."""
    response = await client.get("/api/jobs?status=complete")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data


@pytest.mark.asyncio
async def test_list_jobs_exclude_seen(client: AsyncClient):
    """Test listing jobs excluding seen ones."""
    response = await client.get("/api/jobs?include_seen=false")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data


@pytest.mark.asyncio
async def test_list_active_jobs(client: AsyncClient):
    """Test listing active jobs (pending/processing)."""
    response = await client.get("/api/jobs/active")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data


@pytest.mark.asyncio
async def test_get_job_not_found(client: AsyncClient):
    """Test getting non-existent job returns 404."""
    response = await client.get("/api/jobs/nonexistent-job")
    assert response.status_code == 404
    assert "Job not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mark_job_seen_not_found(client: AsyncClient):
    """Test marking non-existent job as seen returns 404."""
    response = await client.post("/api/jobs/nonexistent-job/seen")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_jobs_endpoint_structure(client: AsyncClient):
    """Test that jobs endpoint returns proper structure."""
    response = await client.get("/api/jobs")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data
    assert isinstance(data["jobs"], list)


@pytest.mark.asyncio
async def test_active_jobs_endpoint_structure(client: AsyncClient):
    """Test that active jobs endpoint returns proper structure."""
    response = await client.get("/api/jobs/active")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data
    assert isinstance(data["jobs"], list)
