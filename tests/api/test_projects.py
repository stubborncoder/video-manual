"""Tests for project management routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_projects(client: AsyncClient):
    """Test listing projects (includes default project)."""
    response = await client.get("/api/projects")
    assert response.status_code == 200
    data = response.json()
    assert "projects" in data
    # Should have at least the default project
    assert len(data["projects"]) >= 1


@pytest.mark.asyncio
async def test_create_project(client: AsyncClient):
    """Test creating a new project."""
    response = await client.post(
        "/api/projects",
        json={"name": "New Project", "description": "Test description"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "New Project"
    assert data["description"] == "Test description"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_create_project_empty_name(client: AsyncClient):
    """Test creating project with empty name fails."""
    response = await client.post(
        "/api/projects",
        json={"name": "", "description": "Test"},
    )
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_get_project_not_found(client: AsyncClient):
    """Test getting non-existent project returns 404."""
    response = await client.get("/api/projects/nonexistent-project")
    assert response.status_code == 404
    assert "Project not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_project_not_found(client: AsyncClient):
    """Test updating non-existent project returns 404."""
    response = await client.put(
        "/api/projects/nonexistent-project",
        json={"name": "Test"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_project_not_found(client: AsyncClient):
    """Test deleting non-existent project returns 404."""
    response = await client.delete("/api/projects/nonexistent-project")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_default_project(client: AsyncClient):
    """Test getting the default project."""
    response = await client.get("/api/projects/default")
    assert response.status_code == 200
    data = response.json()
    assert data["is_default"] is True
    assert "id" in data
    assert "name" in data


@pytest.mark.asyncio
async def test_delete_default_project_fails(client: AsyncClient):
    """Test that deleting the default project fails."""
    # First get the default project
    response = await client.get("/api/projects/default")
    assert response.status_code == 200
    default_id = response.json()["id"]

    # Try to delete it
    response = await client.delete(f"/api/projects/{default_id}")
    assert response.status_code == 400
    assert "Cannot delete the default project" in response.json()["detail"]


@pytest.mark.asyncio
async def test_add_chapter_to_nonexistent_project(client: AsyncClient):
    """Test adding chapter to non-existent project fails."""
    response = await client.post(
        "/api/projects/nonexistent-project/chapters",
        json={"title": "Chapter 1", "description": "First chapter"},
    )
    # Returns 400 (bad request) when project not found
    assert response.status_code in [400, 404]


@pytest.mark.asyncio
async def test_add_section_to_nonexistent_project(client: AsyncClient):
    """Test adding section to non-existent project fails."""
    response = await client.post(
        "/api/projects/nonexistent-project/sections",
        json={"title": "Section 1", "description": "First section"},
    )
    # Returns 400 (bad request) when project not found
    assert response.status_code in [400, 404]


@pytest.mark.asyncio
async def test_project_crud_flow(client: AsyncClient):
    """Test complete project CRUD flow."""
    # Create
    create_response = await client.post(
        "/api/projects",
        json={"name": "CRUD Test Project", "description": "Testing CRUD"},
    )
    assert create_response.status_code == 200
    project_id = create_response.json()["id"]

    # Read
    get_response = await client.get(f"/api/projects/{project_id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "CRUD Test Project"

    # Update
    update_response = await client.put(
        f"/api/projects/{project_id}",
        json={"name": "Updated Name", "description": "Updated description"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Name"

    # Delete
    delete_response = await client.delete(f"/api/projects/{project_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "moved_to_trash"


@pytest.mark.asyncio
async def test_chapter_flow(client: AsyncClient):
    """Test chapter create/update/delete flow."""
    # First create a project
    project_response = await client.post(
        "/api/projects",
        json={"name": "Chapter Test Project", "description": ""},
    )
    project_id = project_response.json()["id"]

    # Add chapter
    add_response = await client.post(
        f"/api/projects/{project_id}/chapters",
        json={"title": "Test Chapter", "description": "Chapter desc"},
    )
    assert add_response.status_code == 200
    chapter_id = add_response.json()["id"]

    # Update chapter
    update_response = await client.put(
        f"/api/projects/{project_id}/chapters/{chapter_id}",
        json={"title": "Updated Chapter", "description": "Updated desc"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Updated Chapter"

    # Delete chapter
    delete_response = await client.delete(f"/api/projects/{project_id}/chapters/{chapter_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"

    # Cleanup - delete the project
    await client.delete(f"/api/projects/{project_id}")


@pytest.mark.asyncio
async def test_section_flow(client: AsyncClient):
    """Test section create/update/delete flow."""
    # First create a project
    project_response = await client.post(
        "/api/projects",
        json={"name": "Section Test Project", "description": ""},
    )
    project_id = project_response.json()["id"]

    # Add section
    add_response = await client.post(
        f"/api/projects/{project_id}/sections",
        json={"title": "Test Section", "description": "Section desc"},
    )
    assert add_response.status_code == 200
    section_id = add_response.json()["id"]

    # Update section
    update_response = await client.put(
        f"/api/projects/{project_id}/sections/{section_id}",
        json={"title": "Updated Section"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Updated Section"

    # Delete section
    delete_response = await client.delete(f"/api/projects/{project_id}/sections/{section_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"

    # Cleanup
    await client.delete(f"/api/projects/{project_id}")


@pytest.mark.asyncio
async def test_get_project_with_manuals(client: AsyncClient, tmp_data_dir, test_user_id: str):
    """Test getting a project that has manuals returns correct schema.

    This tests the doc_id field in ProjectManualInfo schema.
    Regression test for manual_id -> doc_id rename.
    """
    import json
    from pathlib import Path

    # Create a project
    project_response = await client.post(
        "/api/projects",
        json={"name": "Project With Manuals", "description": ""},
    )
    assert project_response.status_code == 200
    project_id = project_response.json()["id"]

    # Create a doc directly in storage (simulating a processed video)
    doc_id = "test-manual-001"
    users_dir = tmp_data_dir / "users"
    doc_dir = users_dir / test_user_id / "docs" / doc_id
    doc_dir.mkdir(parents=True)

    # Write minimal metadata
    metadata = {
        "id": doc_id,
        "title": "Test Manual",
        "created_at": "2024-01-01T00:00:00Z",
        "language": "en",
    }
    (doc_dir / "metadata.json").write_text(json.dumps(metadata))
    (doc_dir / "en.md").write_text("# Test Manual\n\nContent here.")

    # Add the doc to the project via API
    add_response = await client.post(f"/api/projects/{project_id}/manuals/{doc_id}")
    assert add_response.status_code == 200

    # Get the project - this should return manuals with doc_id field
    get_response = await client.get(f"/api/projects/{project_id}")
    assert get_response.status_code == 200

    data = get_response.json()
    assert "manuals" in data
    assert len(data["manuals"]) == 1

    # Verify the schema uses doc_id (not manual_id)
    manual = data["manuals"][0]
    assert "doc_id" in manual, "Response should use 'doc_id' not 'manual_id'"
    assert manual["doc_id"] == doc_id
    assert "order" in manual

    # Cleanup
    await client.delete(f"/api/projects/{project_id}")
