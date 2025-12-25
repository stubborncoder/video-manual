"""Tests for TrashStorage module."""

import json
import pytest
import time
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import patch


@pytest.fixture
def trash_storage(tmp_data_dir, test_user_id):
    """Create a TrashStorage instance with a temporary directory."""
    # Patch at the module level where USERS_DIR is imported
    with patch("src.storage.trash_storage.USERS_DIR", tmp_data_dir / "users"):
        from src.storage.trash_storage import TrashStorage
        storage = TrashStorage(test_user_id)
        storage.ensure_trash_dirs()

        # Create source directories
        storage.videos_dir.mkdir(parents=True, exist_ok=True)
        storage.docs_dir.mkdir(parents=True, exist_ok=True)
        storage.projects_dir.mkdir(parents=True, exist_ok=True)

        yield storage


class TestMoveToTrash:
    """Tests for moving items to trash."""

    def test_move_video_to_trash(self, trash_storage):
        """Test moving a video file to trash."""
        # Create a video file
        video_path = trash_storage.videos_dir / "test-video.mp4"
        video_path.write_bytes(b"fake video content")

        result = trash_storage.move_to_trash("video", "test-video.mp4")

        assert result is not None
        assert result.item_type == "video"
        assert result.original_name == "test-video.mp4"
        assert not video_path.exists()  # Original removed
        assert Path(result.trash_path).exists()  # In trash

    def test_move_doc_to_trash(self, trash_storage):
        """Test moving a doc directory to trash."""
        # Create a doc directory
        doc_dir = trash_storage.docs_dir / "my-doc"
        doc_dir.mkdir()
        (doc_dir / "doc.md").write_text("# My Doc")
        (doc_dir / "metadata.json").write_text("{}")

        result = trash_storage.move_to_trash("doc", "my-doc")

        assert result.item_type == "doc"
        assert result.original_name == "my-doc"
        assert not doc_dir.exists()
        assert Path(result.trash_path).exists()

    def test_move_project_to_trash(self, trash_storage):
        """Test moving a project directory to trash."""
        # Create a project directory
        project_dir = trash_storage.projects_dir / "my-project"
        project_dir.mkdir()
        (project_dir / "project.json").write_text('{"name": "My Project"}')

        result = trash_storage.move_to_trash("project", "my-project")

        assert result.item_type == "project"
        assert result.original_name == "my-project"
        assert not project_dir.exists()

    def test_move_to_trash_with_metadata(self, trash_storage):
        """Test moving to trash with additional metadata."""
        video_path = trash_storage.videos_dir / "video.mp4"
        video_path.write_bytes(b"content")

        result = trash_storage.move_to_trash(
            "video",
            "video.mp4",
            metadata={"size": 1024, "duration": 60}
        )

        assert result.metadata["size"] == 1024
        assert result.metadata["duration"] == 60

    def test_move_to_trash_with_related_items(self, trash_storage):
        """Test moving to trash with related items list."""
        video_path = trash_storage.videos_dir / "video.mp4"
        video_path.write_bytes(b"content")

        result = trash_storage.move_to_trash(
            "video",
            "video.mp4",
            related_items=["doc-1", "doc-2"]
        )

        assert result.related_items == ["doc-1", "doc-2"]

    def test_move_to_trash_not_found(self, trash_storage):
        """Test moving nonexistent item to trash."""
        with pytest.raises(ValueError, match="Video not found"):
            trash_storage.move_to_trash("video", "nonexistent.mp4")

    def test_move_to_trash_invalid_type(self, trash_storage):
        """Test moving with invalid item type."""
        with pytest.raises(ValueError, match="Invalid item type"):
            trash_storage.move_to_trash("invalid", "something")

    def test_move_to_trash_cascade_deleted(self, trash_storage):
        """Test marking item as cascade deleted."""
        video_path = trash_storage.videos_dir / "cascade.mp4"
        video_path.write_bytes(b"content")

        result = trash_storage.move_to_trash(
            "video",
            "cascade.mp4",
            cascade_deleted=True
        )

        assert result.cascade_deleted is True

    def test_move_to_trash_sets_expiry(self, trash_storage):
        """Test that move to trash sets expiration date."""
        video_path = trash_storage.videos_dir / "expires.mp4"
        video_path.write_bytes(b"content")

        result = trash_storage.move_to_trash("video", "expires.mp4")

        deleted_at = datetime.fromisoformat(result.deleted_at)
        expires_at = datetime.fromisoformat(result.expires_at)

        # Should expire 30 days from deletion
        expected_expiry = deleted_at + timedelta(days=30)
        assert abs((expires_at - expected_expiry).total_seconds()) < 1


class TestListTrash:
    """Tests for listing trash contents."""

    def test_list_trash_empty(self, trash_storage):
        """Test listing empty trash."""
        result = trash_storage.list_trash()
        assert result == []

    def test_list_trash_all_types(self, trash_storage):
        """Test listing all items in trash."""
        # Create and trash items of different types
        (trash_storage.videos_dir / "video.mp4").write_bytes(b"v")
        (trash_storage.docs_dir / "doc").mkdir()
        (trash_storage.projects_dir / "project").mkdir()

        trash_storage.move_to_trash("video", "video.mp4")
        trash_storage.move_to_trash("doc", "doc")
        trash_storage.move_to_trash("project", "project")

        result = trash_storage.list_trash()

        assert len(result) == 3
        types = {item.item_type for item in result}
        assert types == {"video", "doc", "project"}

    def test_list_trash_filter_by_type(self, trash_storage):
        """Test filtering trash by item type."""
        # Create and trash mixed items
        (trash_storage.videos_dir / "v1.mp4").write_bytes(b"v1")
        (trash_storage.videos_dir / "v2.mp4").write_bytes(b"v2")
        (trash_storage.docs_dir / "doc").mkdir()

        trash_storage.move_to_trash("video", "v1.mp4")
        trash_storage.move_to_trash("video", "v2.mp4")
        trash_storage.move_to_trash("doc", "doc")

        videos = trash_storage.list_trash("video")
        docs = trash_storage.list_trash("doc")

        assert len(videos) == 2
        assert len(docs) == 1

    def test_list_trash_sorted_by_deleted_at(self, trash_storage):
        """Test that trash is sorted by deletion time (newest first)."""
        (trash_storage.videos_dir / "old.mp4").write_bytes(b"old")
        trash_storage.move_to_trash("video", "old.mp4")

        time.sleep(0.1)

        (trash_storage.videos_dir / "new.mp4").write_bytes(b"new")
        trash_storage.move_to_trash("video", "new.mp4")

        result = trash_storage.list_trash()

        assert result[0].original_name == "new.mp4"
        assert result[1].original_name == "old.mp4"


class TestRestoreFromTrash:
    """Tests for restoring items from trash."""

    def test_restore_video(self, trash_storage):
        """Test restoring a video from trash."""
        video_path = trash_storage.videos_dir / "restore-me.mp4"
        video_path.write_bytes(b"video content")

        trash_item = trash_storage.move_to_trash("video", "restore-me.mp4")
        trash_id = trash_item.trash_id

        restored_path = trash_storage.restore("video", trash_id)

        assert restored_path.exists()
        assert restored_path.read_bytes() == b"video content"

    def test_restore_doc(self, trash_storage):
        """Test restoring a doc from trash."""
        doc_dir = trash_storage.docs_dir / "restore-doc"
        doc_dir.mkdir()
        (doc_dir / "doc.md").write_text("# Content")

        trash_item = trash_storage.move_to_trash("doc", "restore-doc")
        trash_id = trash_item.trash_id

        restored_path = trash_storage.restore("doc", trash_id)

        assert restored_path.exists()
        assert (restored_path / "doc.md").read_text() == "# Content"

    def test_restore_handles_conflict(self, trash_storage):
        """Test restore when original location is occupied."""
        video_path = trash_storage.videos_dir / "conflict.mp4"
        video_path.write_bytes(b"original")

        trash_item = trash_storage.move_to_trash("video", "conflict.mp4")
        trash_id = trash_item.trash_id

        # Create new file at original location
        video_path.write_bytes(b"new file")

        restored_path = trash_storage.restore("video", trash_id)

        # Should be restored with different name
        assert "restored" in str(restored_path)
        assert restored_path.exists()
        # Both files should exist
        assert video_path.exists()

    def test_restore_not_found(self, trash_storage):
        """Test restoring item that doesn't exist in trash."""
        with pytest.raises(ValueError, match="Item not found in trash"):
            trash_storage.restore("video", "nonexistent")

    def test_restore_removes_from_manifest(self, trash_storage):
        """Test that restore removes item from manifest."""
        video_path = trash_storage.videos_dir / "manifest-test.mp4"
        video_path.write_bytes(b"content")

        trash_item = trash_storage.move_to_trash("video", "manifest-test.mp4")
        trash_id = trash_item.trash_id

        trash_storage.restore("video", trash_id)

        # Should no longer be in list
        result = trash_storage.list_trash()
        assert not any(item.trash_id == trash_id for item in result)


class TestDeletePermanently:
    """Tests for permanent deletion from trash."""

    def test_permanent_delete_file(self, trash_storage):
        """Test permanently deleting a file from trash."""
        video_path = trash_storage.videos_dir / "delete-me.mp4"
        video_path.write_bytes(b"content")

        trash_item = trash_storage.move_to_trash("video", "delete-me.mp4")
        trash_id = trash_item.trash_id
        trash_path = Path(trash_item.trash_path)

        trash_storage.permanent_delete("video", trash_id)

        assert not trash_path.exists()
        assert trash_storage.get_trash_item("video", trash_id) is None

    def test_permanent_delete_directory(self, trash_storage):
        """Test permanently deleting a directory from trash."""
        doc_dir = trash_storage.docs_dir / "delete-doc"
        doc_dir.mkdir()
        (doc_dir / "doc.md").write_text("content")

        trash_item = trash_storage.move_to_trash("doc", "delete-doc")
        trash_id = trash_item.trash_id

        trash_storage.permanent_delete("doc", trash_id)

        assert not Path(trash_item.trash_path).exists()

    def test_permanent_delete_not_found(self, trash_storage):
        """Test permanently deleting item not in trash."""
        with pytest.raises(ValueError, match="Item not found in trash"):
            trash_storage.permanent_delete("video", "nonexistent")


class TestTrashExpiry:
    """Tests for trash expiration handling."""

    def test_cleanup_expired(self, trash_storage):
        """Test cleaning up expired items."""
        video_path = trash_storage.videos_dir / "expired.mp4"
        video_path.write_bytes(b"content")

        trash_storage.move_to_trash("video", "expired.mp4")

        # Manually modify expiration to past
        items = trash_storage._load_manifest()
        items[0]["expires_at"] = (datetime.now() - timedelta(days=1)).isoformat()
        trash_storage._save_manifest(items)

        cleaned = trash_storage.cleanup_expired()

        assert cleaned == 1
        assert len(trash_storage.list_trash()) == 0

    def test_cleanup_keeps_unexpired(self, trash_storage):
        """Test that cleanup keeps unexpired items."""
        (trash_storage.videos_dir / "expired.mp4").write_bytes(b"e")
        (trash_storage.videos_dir / "fresh.mp4").write_bytes(b"f")

        trash_storage.move_to_trash("video", "expired.mp4")
        trash_storage.move_to_trash("video", "fresh.mp4")

        # Expire only the first one
        items = trash_storage._load_manifest()
        items[0]["expires_at"] = (datetime.now() - timedelta(days=1)).isoformat()
        trash_storage._save_manifest(items)

        cleaned = trash_storage.cleanup_expired()

        assert cleaned == 1
        remaining = trash_storage.list_trash()
        assert len(remaining) == 1
        assert remaining[0].original_name == "fresh.mp4"

    def test_cleanup_no_expired(self, trash_storage):
        """Test cleanup when nothing is expired."""
        (trash_storage.videos_dir / "fresh.mp4").write_bytes(b"content")
        trash_storage.move_to_trash("video", "fresh.mp4")

        cleaned = trash_storage.cleanup_expired()

        assert cleaned == 0
        assert len(trash_storage.list_trash()) == 1


class TestEmptyTrash:
    """Tests for emptying entire trash."""

    def test_empty_trash(self, trash_storage):
        """Test emptying entire trash."""
        # Create multiple items
        for i in range(3):
            (trash_storage.videos_dir / f"video{i}.mp4").write_bytes(b"v")
            trash_storage.move_to_trash("video", f"video{i}.mp4")

        count = trash_storage.empty_trash()

        assert count == 3
        assert len(trash_storage.list_trash()) == 0

        # Verify files are actually deleted
        for item in (trash_storage.trash_dir / "videos").iterdir():
            assert False, f"Trash file still exists: {item}"

    def test_empty_trash_already_empty(self, trash_storage):
        """Test emptying already empty trash."""
        count = trash_storage.empty_trash()
        assert count == 0


class TestGetTrashItem:
    """Tests for getting specific trash items."""

    def test_get_trash_item(self, trash_storage):
        """Test getting a specific trash item."""
        video_path = trash_storage.videos_dir / "get-me.mp4"
        video_path.write_bytes(b"content")

        trash_item = trash_storage.move_to_trash("video", "get-me.mp4")
        trash_id = trash_item.trash_id

        result = trash_storage.get_trash_item("video", trash_id)

        assert result is not None
        assert result.original_name == "get-me.mp4"

    def test_get_trash_item_not_found(self, trash_storage):
        """Test getting nonexistent trash item."""
        result = trash_storage.get_trash_item("video", "nonexistent")
        assert result is None

    def test_get_trash_item_wrong_type(self, trash_storage):
        """Test getting trash item with wrong type."""
        video_path = trash_storage.videos_dir / "video.mp4"
        video_path.write_bytes(b"content")

        trash_item = trash_storage.move_to_trash("video", "video.mp4")
        trash_id = trash_item.trash_id

        # Try to get as doc (wrong type)
        result = trash_storage.get_trash_item("doc", trash_id)
        assert result is None


class TestGetTrashStats:
    """Tests for trash statistics."""

    def test_get_trash_stats_empty(self, trash_storage):
        """Test stats when trash is empty."""
        result = trash_storage.get_trash_stats()

        assert result["videos"] == 0
        assert result["docs"] == 0
        assert result["projects"] == 0
        assert result["total"] == 0

    def test_get_trash_stats_with_items(self, trash_storage):
        """Test stats with items in trash."""
        # Add items of different types
        (trash_storage.videos_dir / "v1.mp4").write_bytes(b"v")
        (trash_storage.videos_dir / "v2.mp4").write_bytes(b"v")
        (trash_storage.docs_dir / "doc").mkdir()
        (trash_storage.projects_dir / "project").mkdir()

        trash_storage.move_to_trash("video", "v1.mp4")
        trash_storage.move_to_trash("video", "v2.mp4")
        trash_storage.move_to_trash("doc", "doc")
        trash_storage.move_to_trash("project", "project")

        result = trash_storage.get_trash_stats()

        assert result["videos"] == 2
        assert result["docs"] == 1
        assert result["projects"] == 1
        assert result["total"] == 4


class TestTrashItem:
    """Tests for TrashItem class."""

    def test_trash_item_to_dict(self, trash_storage):
        """Test TrashItem serialization."""
        video_path = trash_storage.videos_dir / "serialize.mp4"
        video_path.write_bytes(b"content")

        trash_item = trash_storage.move_to_trash(
            "video",
            "serialize.mp4",
            related_items=["doc-1"],
            metadata={"size": 100}
        )

        result = trash_item.to_dict()

        assert result["type"] == "video"
        assert result["original_name"] == "serialize.mp4"
        assert result["related_items"] == ["doc-1"]
        assert result["metadata"]["size"] == 100
        assert "deleted_at" in result
        assert "expires_at" in result

    def test_trash_item_from_dict(self):
        """Test TrashItem deserialization."""
        from src.storage.trash_storage import TrashItem

        data = {
            "type": "doc",
            "original_name": "my-doc",
            "original_path": "/path/to/original",
            "trash_path": "/path/to/trash",
            "deleted_at": "2024-01-01T00:00:00",
            "expires_at": "2024-01-31T00:00:00",
            "related_items": ["item-1"],
            "cascade_deleted": True,
            "metadata": {"key": "value"}
        }

        item = TrashItem.from_dict(data)

        assert item.item_type == "doc"
        assert item.original_name == "my-doc"
        assert item.cascade_deleted is True
        assert item.related_items == ["item-1"]

    def test_trash_id_property(self, trash_storage):
        """Test trash_id property returns correct ID."""
        video_path = trash_storage.videos_dir / "id-test.mp4"
        video_path.write_bytes(b"content")

        trash_item = trash_storage.move_to_trash("video", "id-test.mp4")

        assert trash_item.trash_id == Path(trash_item.trash_path).name


class TestManifestHandling:
    """Tests for manifest file operations."""

    def test_load_manifest_creates_empty(self, trash_storage):
        """Test loading manifest when file doesn't exist."""
        # Delete manifest if exists
        if trash_storage.manifest_path.exists():
            trash_storage.manifest_path.unlink()

        result = trash_storage._load_manifest()
        assert result == []

    def test_save_manifest_creates_file(self, trash_storage):
        """Test saving manifest creates the file."""
        trash_storage._save_manifest([{"test": "data"}])

        assert trash_storage.manifest_path.exists()
        content = json.loads(trash_storage.manifest_path.read_text())
        assert content["items"] == [{"test": "data"}]


class TestEnsureTrashDirs:
    """Tests for trash directory creation."""

    def test_ensure_trash_dirs(self, tmp_data_dir, test_user_id):
        """Test that ensure_trash_dirs creates all required directories."""
        with patch("src.config.DATA_DIR", tmp_data_dir):
            with patch("src.config.USERS_DIR", tmp_data_dir / "users"):
                from src.storage.trash_storage import TrashStorage
                storage = TrashStorage(test_user_id)

                storage.ensure_trash_dirs()

                assert (storage.trash_dir / "videos").exists()
                assert (storage.trash_dir / "docs").exists()
                assert (storage.trash_dir / "projects").exists()
