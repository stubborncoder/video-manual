"""Tests for template management routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_templates(client: AsyncClient):
    """Test listing templates."""
    response = await client.get("/api/templates")
    assert response.status_code == 200
    data = response.json()
    assert "templates" in data
    assert "user_count" in data
    assert "global_count" in data


@pytest.mark.asyncio
async def test_get_template_not_found(client: AsyncClient):
    """Test getting non-existent template returns 404."""
    response = await client.get("/api/templates/nonexistent-template")
    assert response.status_code == 404
    assert "Template not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_template_info_not_found(client: AsyncClient):
    """Test getting info for non-existent template returns 404."""
    response = await client.get("/api/templates/nonexistent-template/info")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_template_not_found(client: AsyncClient):
    """Test deleting non-existent template returns 404."""
    response = await client.delete("/api/templates/nonexistent-template")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upload_template_invalid_type(client: AsyncClient):
    """Test uploading non-docx file fails."""
    files = {"file": ("test.txt", b"not a docx file", "text/plain")}
    response = await client.post("/api/templates", files=files)
    assert response.status_code == 400
    assert "must be a .docx" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_template_invalid_format(client: AsyncClient):
    """Test uploading with invalid document_format fails."""
    # Create a minimal docx-like file
    docx_content = b"PK\x03\x04" + b"\x00" * 100
    files = {"file": ("test.docx", docx_content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    data = {"document_format": "invalid-format"}

    response = await client.post("/api/templates", files=files, data=data)
    assert response.status_code == 400
    assert "Invalid document format" in response.json()["detail"]


@pytest.mark.asyncio
async def test_templates_list_structure(client: AsyncClient):
    """Test that templates list returns proper structure."""
    response = await client.get("/api/templates")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["templates"], list)
    assert isinstance(data["user_count"], int)
    assert isinstance(data["global_count"], int)
