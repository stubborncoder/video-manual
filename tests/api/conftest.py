"""API test fixtures."""

import os
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Generator
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

# Set test environment
os.environ["ENVIRONMENT"] = "test"


@pytest.fixture
def auth_headers(test_user_id: str) -> dict[str, str]:
    """Return authentication headers for API tests."""
    return {"Cookie": f"session_user_id={test_user_id}"}


@pytest.fixture
def admin_auth_headers() -> dict[str, str]:
    """Return admin authentication headers for API tests."""
    return {"Cookie": "session_user_id=admin-user"}


@pytest.fixture
async def client(
    tmp_data_dir: Path,
    test_user_id: str,
    auth_headers: dict[str, str],
) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with mocked storage paths."""
    users_dir = tmp_data_dir / "users"
    checkpoints_dir = tmp_data_dir / "checkpoints"
    templates_dir = tmp_data_dir / "templates"

    # Create templates dir
    templates_dir.mkdir(exist_ok=True)

    # Patch at all levels where USERS_DIR is imported
    patches = [
        patch("src.config.DATA_DIR", tmp_data_dir),
        patch("src.config.USERS_DIR", users_dir),
        patch("src.config.CHECKPOINTS_DIR", checkpoints_dir),
        patch("src.config.TEMPLATES_DIR", templates_dir),
        # Patch at storage module level (they use `from ..config import USERS_DIR`)
        patch("src.storage.user_storage.USERS_DIR", users_dir),
        patch("src.storage.project_storage.USERS_DIR", users_dir),
        patch("src.storage.trash_storage.USERS_DIR", users_dir),
        patch("src.storage.version_storage.USERS_DIR", users_dir),
        patch("src.storage.template_storage.USERS_DIR", users_dir),
        patch("src.storage.template_storage.TEMPLATES_DIR", templates_dir),
        patch("src.storage.compilation_version_storage.USERS_DIR", users_dir),
    ]

    # Apply all patches
    for p in patches:
        p.start()

    try:
        from src.api.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            headers=auth_headers,
        ) as ac:
            yield ac
    finally:
        # Stop all patches in reverse order
        for p in reversed(patches):
            p.stop()


@pytest.fixture
async def unauthenticated_client(tmp_data_dir: Path) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client without authentication."""
    users_dir = tmp_data_dir / "users"
    checkpoints_dir = tmp_data_dir / "checkpoints"
    templates_dir = tmp_data_dir / "templates"

    patches = [
        patch("src.config.DATA_DIR", tmp_data_dir),
        patch("src.config.USERS_DIR", users_dir),
        patch("src.config.CHECKPOINTS_DIR", checkpoints_dir),
        patch("src.storage.user_storage.USERS_DIR", users_dir),
        patch("src.storage.project_storage.USERS_DIR", users_dir),
        patch("src.storage.trash_storage.USERS_DIR", users_dir),
        patch("src.storage.version_storage.USERS_DIR", users_dir),
        patch("src.storage.template_storage.USERS_DIR", users_dir),
        patch("src.storage.compilation_version_storage.USERS_DIR", users_dir),
    ]

    for p in patches:
        p.start()

    try:
        from src.api.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
        ) as ac:
            yield ac
    finally:
        for p in reversed(patches):
            p.stop()


@pytest.fixture
async def admin_client(
    tmp_data_dir: Path,
    admin_auth_headers: dict[str, str],
) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with admin authentication."""
    users_dir = tmp_data_dir / "users"
    checkpoints_dir = tmp_data_dir / "checkpoints"
    templates_dir = tmp_data_dir / "templates"

    patches = [
        patch("src.config.DATA_DIR", tmp_data_dir),
        patch("src.config.USERS_DIR", users_dir),
        patch("src.config.CHECKPOINTS_DIR", checkpoints_dir),
        patch("src.storage.user_storage.USERS_DIR", users_dir),
        patch("src.storage.project_storage.USERS_DIR", users_dir),
        patch("src.storage.trash_storage.USERS_DIR", users_dir),
        patch("src.storage.version_storage.USERS_DIR", users_dir),
        patch("src.storage.template_storage.USERS_DIR", users_dir),
        patch("src.storage.compilation_version_storage.USERS_DIR", users_dir),
    ]

    for p in patches:
        p.start()

    try:
        from src.api.main import app

        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://test",
            headers=admin_auth_headers,
        ) as ac:
            yield ac
    finally:
        for p in reversed(patches):
            p.stop()


@pytest.fixture
def mock_storage_with_docs(test_storage, sample_doc_metadata: dict, sample_markdown_content: str):
    """Create a storage instance with pre-populated documents."""
    # Create a test document
    doc_id = "test-doc-001"
    doc_dir = test_storage.docs_dir / doc_id
    doc_dir.mkdir(parents=True)

    # Write markdown file
    (doc_dir / "en.md").write_text(sample_markdown_content)

    # Write metadata
    import json
    metadata = {
        **sample_doc_metadata,
        "id": doc_id,
        "created_at": "2024-01-01T00:00:00Z",
    }
    (doc_dir / "metadata.json").write_text(json.dumps(metadata))

    # Create screenshots directory
    screenshots_dir = doc_dir / "screenshots"
    screenshots_dir.mkdir()

    return test_storage, doc_id


@pytest.fixture
def mock_storage_with_project(test_storage, sample_project_data: dict):
    """Create a storage instance with a pre-populated project."""
    from src.storage.project_storage import ProjectStorage

    project_storage = ProjectStorage(test_storage.user_id)
    project_id = project_storage.create_project(
        name=sample_project_data["name"],
        description=sample_project_data["description"],
    )

    return test_storage, project_storage, project_id
