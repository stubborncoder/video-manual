"""Tests for video management routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_videos_empty(client: AsyncClient):
    """Test listing videos when none exist."""
    response = await client.get("/api/videos")
    assert response.status_code == 200
    data = response.json()
    assert "videos" in data
    assert isinstance(data["videos"], list)


@pytest.mark.asyncio
async def test_get_video_info_not_found(client: AsyncClient):
    """Test getting video info for non-existent video."""
    response = await client.get("/api/videos/nonexistent.mp4/manuals")
    assert response.status_code == 404
    assert "Video not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_video_not_found(client: AsyncClient):
    """Test deleting non-existent video returns 404."""
    response = await client.delete("/api/videos/nonexistent.mp4")
    assert response.status_code == 404
    assert "Video not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_stream_video_not_found(client: AsyncClient):
    """Test streaming non-existent video returns 404."""
    response = await client.get("/api/videos/nonexistent.mp4/stream")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_document_formats(client: AsyncClient):
    """Test getting available document formats."""
    response = await client.get("/api/videos/formats")
    assert response.status_code == 200
    data = response.json()
    assert "formats" in data


@pytest.mark.asyncio
async def test_upload_video_invalid_extension(client: AsyncClient):
    """Test uploading a file with invalid extension."""
    files = {"file": ("test.txt", b"not a video", "text/plain")}
    response = await client.post("/api/videos/upload", files=files)
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_videos_endpoint_structure(client: AsyncClient):
    """Test that videos list endpoint returns proper structure."""
    response = await client.get("/api/videos")
    assert response.status_code == 200
    data = response.json()
    assert "videos" in data
    assert isinstance(data["videos"], list)
