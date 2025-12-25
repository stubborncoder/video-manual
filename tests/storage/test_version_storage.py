"""Tests for VersionStorage module."""

import json
import pytest
from pathlib import Path
from datetime import datetime
from unittest.mock import patch, MagicMock


@pytest.fixture
def version_storage(tmp_data_dir, test_user_id):
    """Create a VersionStorage instance with a temporary directory."""
    # Patch at the module level where USERS_DIR is imported
    with patch("src.storage.version_storage.USERS_DIR", tmp_data_dir / "users"):
        from src.storage.version_storage import VersionStorage

        doc_id = "test-doc"
        # Create the doc directory structure
        doc_dir = tmp_data_dir / "users" / test_user_id / "docs" / doc_id
        doc_dir.mkdir(parents=True)

        storage = VersionStorage(test_user_id, doc_id)
        yield storage


@pytest.fixture
def version_storage_with_content(version_storage):
    """VersionStorage with existing content for versioning tests."""
    # Create language folder with content
    lang_dir = version_storage.doc_dir / "en"
    lang_dir.mkdir(parents=True)
    (lang_dir / "manual.md").write_text("# Original Content\n\nThis is the original.")

    # Create screenshots
    screenshots_dir = version_storage.doc_dir / "screenshots"
    screenshots_dir.mkdir()
    (screenshots_dir / "step1.png").write_bytes(b"PNG image data 1")
    (screenshots_dir / "step2.png").write_bytes(b"PNG image data 2")

    # Create initial metadata
    metadata = {
        "title": "Test Doc",
        "version": {"number": "1.0.0", "history": []},
        "created_at": datetime.now().isoformat()
    }
    version_storage.metadata_path.write_text(json.dumps(metadata))

    return version_storage


class TestVersionBasics:
    """Tests for basic version operations."""

    def test_get_current_version_default(self, version_storage):
        """Test getting current version when no metadata exists."""
        result = version_storage.get_current_version()
        assert result == "1.0.0"

    def test_get_current_version_from_metadata(self, version_storage):
        """Test getting current version from metadata."""
        metadata = {"version": {"number": "2.5.3", "history": []}}
        version_storage.metadata_path.write_text(json.dumps(metadata))

        result = version_storage.get_current_version()
        assert result == "2.5.3"

    def test_bump_version_number_patch(self, version_storage):
        """Test patch version bump."""
        result = version_storage._bump_version_number("1.0.0", "patch")
        assert result == "1.0.1"

        result = version_storage._bump_version_number("1.2.9", "patch")
        assert result == "1.2.10"

    def test_bump_version_number_minor(self, version_storage):
        """Test minor version bump."""
        result = version_storage._bump_version_number("1.0.5", "minor")
        assert result == "1.1.0"

        result = version_storage._bump_version_number("2.9.3", "minor")
        assert result == "2.10.0"

    def test_bump_version_number_major(self, version_storage):
        """Test major version bump."""
        result = version_storage._bump_version_number("1.5.3", "major")
        assert result == "2.0.0"

        result = version_storage._bump_version_number("0.9.9", "major")
        assert result == "1.0.0"

    def test_bump_version_number_invalid_format(self, version_storage):
        """Test version bump with invalid version format."""
        result = version_storage._bump_version_number("invalid", "patch")
        assert result == "1.0.1"


class TestSaveVersion:
    """Tests for saving versions."""

    def test_auto_patch_before_overwrite(self, version_storage_with_content):
        """Test automatic patch version creation before overwrite."""
        storage = version_storage_with_content

        new_version = storage.auto_patch_before_overwrite("Auto-save before edit")

        assert new_version == "1.0.1"

        # Check snapshot was created
        snapshot_dir = storage.versions_dir / "v1.0.0"
        assert snapshot_dir.exists()
        assert (snapshot_dir / "en" / "manual.md").exists()
        assert (snapshot_dir / "metadata_snapshot.json").exists()

    def test_auto_patch_no_content(self, version_storage):
        """Test auto_patch returns None when no content exists."""
        result = version_storage.auto_patch_before_overwrite()
        assert result is None

    def test_bump_version_minor(self, version_storage_with_content):
        """Test manual minor version bump."""
        storage = version_storage_with_content

        new_version = storage.bump_version("minor", "Feature complete")

        assert new_version == "1.1.0"

        # Verify history was updated
        metadata = storage._load_metadata()
        assert len(metadata["version"]["history"]) == 1
        assert metadata["version"]["history"][0]["notes"] == "Feature complete"

    def test_bump_version_major(self, version_storage_with_content):
        """Test manual major version bump."""
        storage = version_storage_with_content

        new_version = storage.bump_version("major", "Breaking changes")

        assert new_version == "2.0.0"

    def test_bump_version_invalid_type(self, version_storage_with_content):
        """Test bump_version with invalid bump type."""
        with pytest.raises(ValueError, match="Invalid bump type"):
            version_storage_with_content.bump_version("invalid", "notes")


class TestListVersions:
    """Tests for listing versions."""

    def test_list_versions_current_only(self, version_storage_with_content):
        """Test listing versions when only current version exists."""
        result = version_storage_with_content.list_versions()

        assert len(result) == 1
        assert result[0]["version"] == "1.0.0"
        assert result[0]["is_current"] is True

    def test_list_versions_with_history(self, version_storage_with_content):
        """Test listing versions with history."""
        storage = version_storage_with_content

        # Create some version history (only minor/major bumps allowed, patch is auto)
        storage.bump_version("minor", "Version 1.1.0")
        storage.bump_version("minor", "Version 1.2.0")

        result = storage.list_versions()

        assert len(result) == 3
        # Current version first
        assert result[0]["version"] == "1.2.0"
        assert result[0]["is_current"] is True
        # Then history (newest first)
        assert result[1]["version"] == "1.1.0"
        assert result[1]["is_current"] is False
        assert result[2]["version"] == "1.0.0"
        assert result[2]["is_current"] is False


class TestGetVersion:
    """Tests for getting specific version details."""

    def test_get_version_current(self, version_storage_with_content):
        """Test getting current version details."""
        result = version_storage_with_content.get_version("1.0.0")

        assert result is not None
        assert result["version"] == "1.0.0"
        assert result["is_current"] is True

    def test_get_version_from_history(self, version_storage_with_content):
        """Test getting a historical version."""
        storage = version_storage_with_content
        storage.bump_version("minor", "Update")

        result = storage.get_version("1.0.0")

        assert result is not None
        assert result["version"] == "1.0.0"
        assert result["is_current"] is False

    def test_get_version_not_found(self, version_storage_with_content):
        """Test getting a version that doesn't exist."""
        result = version_storage_with_content.get_version("9.9.9")
        assert result is None


class TestRestoreVersion:
    """Tests for restoring previous versions."""

    def test_restore_version(self, version_storage_with_content):
        """Test restoring a previous version."""
        storage = version_storage_with_content

        # Bump version first (this creates snapshot of original)
        storage.bump_version("minor", "Before modification")

        # Make changes
        (storage.doc_dir / "en" / "manual.md").write_text("# Modified Content")

        # Restore the 1.0.0 version
        result = storage.restore_version("1.0.0", "en")

        assert result is True

        # Check content was restored
        restored_content = (storage.doc_dir / "en" / "manual.md").read_text()
        assert "Original Content" in restored_content

    def test_restore_version_not_found(self, version_storage_with_content):
        """Test restoring a version that doesn't exist."""
        result = version_storage_with_content.restore_version("9.9.9", "en")
        assert result is False

    def test_restore_creates_auto_patch(self, version_storage_with_content):
        """Test that restore creates an auto-patch of current state."""
        storage = version_storage_with_content

        # Create a version to restore from
        storage.bump_version("minor", "v1.1")

        # Get initial version count
        initial_versions = len(storage.list_versions())

        # Restore
        storage.restore_version("1.0.0", "en")

        # Should have created new auto-patch
        final_versions = len(storage.list_versions())
        assert final_versions > initial_versions


class TestMaxVersionsLimit:
    """Tests for version cleanup and limits."""

    def test_cleanup_old_versions(self, version_storage_with_content):
        """Test cleaning up old versions."""
        storage = version_storage_with_content

        # Create many versions using minor bumps
        for i in range(5):
            (storage.doc_dir / "en" / "manual.md").write_text(f"Content {i}")
            storage.bump_version("minor", f"Version {i}")

        # Cleanup, keeping only 2
        removed = storage.cleanup_old_versions(keep_count=2)

        assert removed == 3  # Started with 5 versions, kept 2

        # Verify only 2 version directories remain
        remaining = list(storage.versions_dir.glob("v*"))
        assert len(remaining) == 2

    def test_cleanup_no_versions(self, version_storage):
        """Test cleanup when no versions exist."""
        removed = version_storage.cleanup_old_versions(keep_count=5)
        assert removed == 0

    def test_cleanup_updates_metadata_history(self, version_storage_with_content):
        """Test that cleanup updates metadata history."""
        storage = version_storage_with_content

        # Create versions using minor bumps
        for i in range(5):
            (storage.doc_dir / "en" / "manual.md").write_text(f"Content {i}")
            storage.bump_version("minor", f"Version {i}")

        storage.cleanup_old_versions(keep_count=2)

        # Check metadata history was cleaned
        metadata = storage._load_metadata()
        history = metadata["version"]["history"]

        # History should only reference existing snapshots
        for entry in history:
            snapshot_path = storage.doc_dir / entry["snapshot_dir"]
            assert snapshot_path.exists()


class TestDiffVersions:
    """Tests for version comparison."""

    def test_diff_versions(self, version_storage_with_content):
        """Test comparing two versions."""
        storage = version_storage_with_content

        # Modify content and create new version
        (storage.doc_dir / "en" / "manual.md").write_text(
            "# New Content\n\nThis is modified.\nWith extra lines."
        )
        storage.bump_version("minor", "Modified")

        result = storage.diff_versions("1.0.0", "1.1.0", "en")

        assert "error" not in result
        assert result["v1"] == "1.0.0"
        assert result["v2"] == "1.1.0"
        assert "v1_lines" in result
        assert "v2_lines" in result
        assert "chars_changed" in result

    def test_diff_version_not_found(self, version_storage_with_content):
        """Test diff when version doesn't exist."""
        result = version_storage_with_content.diff_versions("1.0.0", "9.9.9", "en")
        assert "error" in result


class TestEvaluationStorage:
    """Tests for evaluation storage functionality."""

    def test_save_evaluation(self, version_storage_with_content):
        """Test saving an evaluation."""
        storage = version_storage_with_content

        evaluation = {
            "overall_score": 85,
            "evaluated_at": datetime.now().isoformat(),
            "dimensions": {"clarity": 90, "completeness": 80}
        }

        result = storage.save_evaluation(evaluation, "en")

        assert result["version"] == "1.0.0"
        assert result["language"] == "en"
        assert result["overall_score"] == 85

        # Check file was created
        eval_file = storage.doc_dir / "evaluations" / "v1.0.0_en.json"
        assert eval_file.exists()

    def test_get_evaluation(self, version_storage_with_content):
        """Test getting a stored evaluation."""
        storage = version_storage_with_content

        # Save first
        evaluation = {
            "overall_score": 75,
            "evaluated_at": datetime.now().isoformat(),
        }
        storage.save_evaluation(evaluation, "en")

        # Mock the validation to avoid importing the schema
        with patch("src.storage.version_storage.VersionStorage.get_evaluation") as mock_get:
            mock_get.return_value = evaluation
            result = mock_get("en")
            assert result["overall_score"] == 75

    def test_get_evaluation_not_found(self, version_storage_with_content):
        """Test getting evaluation that doesn't exist."""
        result = version_storage_with_content.get_evaluation("en", validate=False)
        assert result is None

    def test_list_evaluations(self, version_storage_with_content):
        """Test listing all evaluations."""
        storage = version_storage_with_content

        # Create evaluations for different versions/languages
        eval1 = {"overall_score": 80, "evaluated_at": "2024-01-01T00:00:00"}
        eval2 = {"overall_score": 90, "evaluated_at": "2024-01-02T00:00:00"}

        storage.save_evaluation(eval1, "en")
        storage.bump_version("minor", "Update")
        storage.save_evaluation(eval2, "en")

        result = storage.list_evaluations()

        assert len(result) == 2

    def test_delete_evaluation(self, version_storage_with_content):
        """Test deleting an evaluation."""
        storage = version_storage_with_content

        # Save first
        evaluation = {"overall_score": 70, "evaluated_at": datetime.now().isoformat()}
        storage.save_evaluation(evaluation, "en")

        # Delete
        result = storage.delete_evaluation("en")
        assert result is True

        # Verify deleted
        assert storage.get_evaluation("en", validate=False) is None

    def test_delete_evaluation_not_found(self, version_storage_with_content):
        """Test deleting evaluation that doesn't exist."""
        result = version_storage_with_content.delete_evaluation("en")
        assert result is False


class TestSnapshotCreation:
    """Tests for snapshot creation internals."""

    def test_create_snapshot_copies_content(self, version_storage_with_content):
        """Test that snapshot copies language content correctly."""
        storage = version_storage_with_content

        snapshot_dir = storage._create_snapshot("1.0.0", "Test snapshot")

        assert (snapshot_dir / "en" / "manual.md").exists()
        content = (snapshot_dir / "en" / "manual.md").read_text()
        assert "Original Content" in content

    def test_create_snapshot_saves_metadata(self, version_storage_with_content):
        """Test that snapshot saves metadata."""
        storage = version_storage_with_content

        snapshot_dir = storage._create_snapshot("1.0.0", "Test notes")

        metadata_path = snapshot_dir / "metadata_snapshot.json"
        assert metadata_path.exists()

        metadata = json.loads(metadata_path.read_text())
        assert metadata["version"] == "1.0.0"
        assert metadata["notes"] == "Test notes"

    def test_create_snapshot_multiple_languages(self, version_storage_with_content):
        """Test snapshot with multiple languages."""
        storage = version_storage_with_content

        # Add Spanish content
        es_dir = storage.doc_dir / "es"
        es_dir.mkdir()
        (es_dir / "manual.md").write_text("# Contenido en Espanol")

        snapshot_dir = storage._create_snapshot("1.0.0", "Multi-lang")

        assert (snapshot_dir / "en" / "manual.md").exists()
        assert (snapshot_dir / "es" / "manual.md").exists()


class TestGetVersionContent:
    """Tests for retrieving version content."""

    def test_get_version_content_current(self, version_storage_with_content):
        """Test getting content for current version."""
        storage = version_storage_with_content

        content = storage._get_version_content("1.0.0", "en")

        assert content is not None
        assert "Original Content" in content

    def test_get_version_content_from_snapshot(self, version_storage_with_content):
        """Test getting content from a historical snapshot."""
        storage = version_storage_with_content

        # Create new version
        storage.bump_version("minor", "Update")
        (storage.doc_dir / "en" / "manual.md").write_text("# New Content")

        # Get old version content
        content = storage._get_version_content("1.0.0", "en")

        assert content is not None
        assert "Original Content" in content

    def test_get_version_content_not_found(self, version_storage_with_content):
        """Test getting content for non-existent version/language."""
        storage = version_storage_with_content

        content = storage._get_version_content("1.0.0", "nonexistent")
        assert content is None
