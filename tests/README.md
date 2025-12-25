# Backend Test Suite

This directory contains the backend test suite for the vDocs platform. Tests are written using pytest with pytest-asyncio for async testing.

## Test Statistics

- **Total Tests**: 562
- **Coverage**: ~35%

## Directory Structure

```
tests/
├── conftest.py          # Global fixtures and configuration
├── factories.py         # Test data factories
├── api/                 # API endpoint tests
│   ├── conftest.py      # API-specific fixtures (client, auth)
│   ├── test_admin.py    # Admin endpoints
│   ├── test_auth.py     # Authentication endpoints
│   ├── test_docs.py     # Document operations
│   ├── test_jobs.py     # Background job endpoints
│   ├── test_projects.py # Project CRUD operations
│   ├── test_templates.py# Template management
│   ├── test_trash.py    # Trash/restore operations
│   └── test_videos.py   # Video processing endpoints
├── core/                # Core business logic tests
│   ├── test_constants.py   # Constants validation
│   ├── test_models.py      # Pydantic model tests
│   └── test_sanitization.py# Input sanitization
├── export/              # Export functionality tests
│   ├── test_doc_exporter.py  # DocX export
│   ├── test_html_exporter.py # HTML export
│   └── test_word_exporter.py # Word document export
└── storage/             # Storage layer tests
    ├── test_project_storage.py  # Project file operations
    ├── test_template_storage.py # Template storage
    ├── test_trash_storage.py    # Trash operations
    ├── test_user_storage.py     # User data storage
    └── test_version_storage.py  # Version control storage
```

## Test Categories

### API Tests (`api/`)
Integration tests for FastAPI endpoints using httpx AsyncClient. Tests include:
- **Authentication**: Token validation, session management
- **Project CRUD**: Create, read, update, delete projects
- **Document Operations**: Chapter/section management, content updates
- **Video Processing**: Upload, processing status, thumbnail generation
- **Templates**: Template CRUD, applying templates
- **Admin**: User management, system operations
- **Jobs**: Background job status, WebSocket updates
- **Trash**: Soft delete, restore, permanent deletion

### Core Tests (`core/`)
Unit tests for core business logic:
- **Models**: Pydantic model validation, serialization
- **Constants**: Configuration values, enums
- **Sanitization**: Input validation, XSS prevention

### Export Tests (`export/`)
Tests for document export functionality:
- **HTML Export**: Converting documents to HTML
- **Word Export**: DOCX generation with formatting
- **Doc Export**: General document export utilities

### Storage Tests (`storage/`)
Tests for the file-based storage layer:
- **User Storage**: User directories, preferences
- **Project Storage**: Project files, structure
- **Version Storage**: Version history, snapshots, diffs
- **Template Storage**: Template files, categories
- **Trash Storage**: Soft delete, TTL-based cleanup

## Running Tests

```bash
# Run all tests
uv run pytest

# Run with coverage
uv run pytest --cov=src --cov-report=html

# Run specific test file
uv run pytest tests/api/test_projects.py

# Run specific test class
uv run pytest tests/api/test_projects.py::TestProjectCRUD

# Run with verbose output
uv run pytest -v

# Run tests matching pattern
uv run pytest -k "test_create"
```

## Key Fixtures

### Global (`conftest.py`)
- `tmp_data_dir`: Temporary directory for test data
- `test_user_id`: Test user identifier
- `sample_project`: Pre-configured test project

### API (`api/conftest.py`)
- `client`: Async HTTP client with mocked storage
- `auth_headers`: Authentication headers for requests
- Storage path patches for test isolation

## Test Isolation

Tests use temporary directories and patch storage paths at the module level to ensure complete isolation. The `api/conftest.py` patches both `src.config` and individual storage modules to handle Python's import binding behavior.

## CI Integration

Tests run automatically on pull requests via GitHub Actions:
- Linting with Ruff
- Test execution with coverage reporting
- Coverage report uploaded as XML

See `.github/workflows/ci.yml` for the workflow configuration.
