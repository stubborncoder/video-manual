"""Tests for trash management routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_trash(client: AsyncClient):
    """Test listing trash items."""
    response = await client.get("/api/trash")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "stats" in data


@pytest.mark.asyncio
async def test_list_trash_filter_invalid_type(client: AsyncClient):
    """Test listing trash with invalid filter type.

    Note: API accepts invalid type and returns empty results, not an error.
    """
    response = await client.get("/api/trash?item_type=invalid")
    # API allows any type and just returns empty if not recognized
    assert response.status_code == 200
    data = response.json()
    assert "items" in data


@pytest.mark.asyncio
async def test_list_trash_filter_valid_types(client: AsyncClient):
    """Test listing trash with valid type filters."""
    for item_type in ["video", "doc", "project"]:
        response = await client.get(f"/api/trash?item_type={item_type}")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data


@pytest.mark.asyncio
async def test_restore_item_not_found(client: AsyncClient):
    """Test restoring non-existent item returns 404."""
    response = await client.post("/api/trash/video/nonexistent-id/restore")
    assert response.status_code == 404
    assert "Item not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_restore_item_invalid_type(client: AsyncClient):
    """Test restoring with invalid item type returns 400."""
    response = await client.post("/api/trash/invalid-type/some-id/restore")
    assert response.status_code == 400
    assert "Invalid item type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_delete_permanently_not_found(client: AsyncClient):
    """Test permanently deleting non-existent item returns 404."""
    response = await client.delete("/api/trash/video/nonexistent-id")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_permanently_invalid_type(client: AsyncClient):
    """Test permanently deleting with invalid type returns 400."""
    response = await client.delete("/api/trash/invalid-type/some-id")
    assert response.status_code == 400
    assert "Invalid item type" in response.json()["detail"]


@pytest.mark.asyncio
async def test_empty_trash(client: AsyncClient):
    """Test emptying trash when empty."""
    response = await client.delete("/api/trash/empty")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "emptied"
    assert "deleted_count" in data


@pytest.mark.asyncio
async def test_trash_stats_structure(client: AsyncClient):
    """Test that trash stats have expected structure."""
    response = await client.get("/api/trash")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["stats"], dict)


@pytest.mark.asyncio
async def test_trash_items_structure(client: AsyncClient):
    """Test that trash items list has expected structure."""
    response = await client.get("/api/trash")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["items"], list)
