"""Global test fixtures for vDocs backend tests."""

import os
import shutil
import tempfile
from pathlib import Path
from typing import Generator
from unittest.mock import MagicMock, patch

import pytest

# Set test environment before importing app modules
os.environ["ENVIRONMENT"] = "test"
os.environ["VDOCS_DATA_DIR"] = tempfile.mkdtemp()


@pytest.fixture(scope="session")
def test_data_dir() -> Generator[Path, None, None]:
    """Create a temporary data directory for the test session."""
    temp_dir = Path(tempfile.mkdtemp(prefix="vdocs_test_"))
    yield temp_dir
    # Cleanup after all tests
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def tmp_data_dir(tmp_path: Path) -> Path:
    """Create a temporary data directory for a single test."""
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True)
    (data_dir / "users").mkdir()
    (data_dir / "checkpoints").mkdir()
    return data_dir


@pytest.fixture
def test_user_id() -> str:
    """Return a consistent test user ID."""
    return "test-user-123"


@pytest.fixture
def test_storage(tmp_data_dir: Path, test_user_id: str):
    """Create a UserStorage instance with a temporary directory."""
    # Patch at both config and module level to ensure consistency
    with patch("src.config.USERS_DIR", tmp_data_dir / "users"):
        with patch("src.storage.user_storage.USERS_DIR", tmp_data_dir / "users"):
            from src.storage.user_storage import UserStorage
            storage = UserStorage(test_user_id)
            storage.ensure_user_folders()
            yield storage


@pytest.fixture
def mock_llm():
    """Mock LLM to avoid API calls during tests."""
    mock = MagicMock()
    mock.invoke.return_value = MagicMock(content="Mocked LLM response")
    mock.ainvoke.return_value = MagicMock(content="Mocked async LLM response")
    return mock


@pytest.fixture
def mock_google_api_key():
    """Mock Google API key for tests."""
    with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-google-api-key"}):
        yield


@pytest.fixture
def mock_anthropic_api_key():
    """Mock Anthropic API key for tests."""
    with patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-anthropic-api-key"}):
        yield


@pytest.fixture
def sample_markdown_content() -> str:
    """Return sample markdown content for testing."""
    return """# Test Manual

## Introduction
This is a test manual for unit testing.

## Step 1: First Step
Do the first thing.

![Screenshot](screenshots/step1.png)

## Step 2: Second Step
Do the second thing.

![Screenshot](screenshots/step2.png)
"""


@pytest.fixture
def sample_video_metadata() -> dict:
    """Return sample video metadata for testing."""
    return {
        "filename": "test_video.mp4",
        "duration": 120.5,
        "width": 1920,
        "height": 1080,
        "fps": 30.0,
        "size_bytes": 1024000,
    }


@pytest.fixture
def sample_project_data() -> dict:
    """Return sample project data for testing."""
    return {
        "name": "Test Project",
        "description": "A test project for unit testing",
        "chapters": [],
        "sections": [],
        "manuals": [],
    }


@pytest.fixture
def sample_doc_metadata() -> dict:
    """Return sample document metadata for testing."""
    return {
        "title": "Test Document",
        "source_video": "test_video.mp4",
        "language": "en",
        "document_format": "step-manual",
        "target_audience": "Technical users",
        "target_objective": "Learn to use the software",
    }
