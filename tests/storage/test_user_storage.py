"""Tests for UserStorage module."""

import json
import pytest
from pathlib import Path
from unittest.mock import patch


class TestUserStorageInit:
    """Tests for UserStorage initialization."""

    def test_init_creates_directories(self, test_storage, tmp_data_dir, test_user_id):
        """Test that ensure_user_folders creates required directories."""
        test_storage.ensure_user_folders()

        assert test_storage.videos_dir.exists()
        assert test_storage.docs_dir.exists()
        assert test_storage.user_dir == tmp_data_dir / "users" / test_user_id

    def test_init_sets_correct_paths(self, test_storage, test_user_id):
        """Test that paths are correctly set on initialization."""
        assert test_storage.user_id == test_user_id
        # Check path structure is correct (relative to user_dir)
        assert test_storage.videos_dir == test_storage.user_dir / "videos"
        assert test_storage.docs_dir == test_storage.user_dir / "docs"
        assert test_storage.user_dir.name == test_user_id


class TestListDocs:
    """Tests for listing documents."""

    def test_list_docs_empty(self, test_storage):
        """Test listing docs when no docs exist."""
        test_storage.ensure_user_folders()
        result = test_storage.list_docs()
        assert result == []

    def test_list_docs_with_data(self, test_storage):
        """Test listing docs when docs exist."""
        test_storage.ensure_user_folders()

        # Create some doc directories
        (test_storage.docs_dir / "doc-1").mkdir()
        (test_storage.docs_dir / "doc-2").mkdir()
        (test_storage.docs_dir / "doc-3").mkdir()

        result = test_storage.list_docs()
        assert len(result) == 3
        assert set(result) == {"doc-1", "doc-2", "doc-3"}

    def test_list_docs_ignores_files(self, test_storage):
        """Test that list_docs only returns directories, not files."""
        test_storage.ensure_user_folders()

        (test_storage.docs_dir / "doc-1").mkdir()
        (test_storage.docs_dir / "random-file.txt").write_text("test")

        result = test_storage.list_docs()
        assert result == ["doc-1"]

    def test_list_docs_nonexistent_dir(self, test_storage, tmp_data_dir):
        """Test listing docs when docs directory doesn't exist."""
        # Don't call ensure_user_folders
        result = test_storage.list_docs()
        assert result == []


class TestGetDoc:
    """Tests for getting document content."""

    def test_get_doc_content(self, test_storage, sample_markdown_content):
        """Test getting doc content."""
        test_storage.ensure_user_folders()

        # Create doc with content
        doc_dir = test_storage.docs_dir / "test-doc"
        lang_dir = doc_dir / "en"
        lang_dir.mkdir(parents=True)
        (lang_dir / "doc.md").write_text(sample_markdown_content)

        result = test_storage.get_doc_content("test-doc", "en")
        assert result == sample_markdown_content

    def test_get_doc_not_found(self, test_storage):
        """Test getting doc content when doc doesn't exist."""
        test_storage.ensure_user_folders()
        result = test_storage.get_doc_content("nonexistent-doc", "en")
        assert result is None

    def test_get_doc_legacy_manual_md(self, test_storage):
        """Test getting doc content from legacy manual.md file."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "legacy-doc"
        lang_dir = doc_dir / "en"
        lang_dir.mkdir(parents=True)
        (lang_dir / "manual.md").write_text("Legacy content")

        result = test_storage.get_doc_content("legacy-doc", "en")
        assert result == "Legacy content"

    def test_get_doc_root_level_fallback(self, test_storage):
        """Test getting doc content from root-level doc.md (very old structure)."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "very-old-doc"
        doc_dir.mkdir(parents=True)
        (doc_dir / "doc.md").write_text("Very old content")

        result = test_storage.get_doc_content("very-old-doc", "en")
        assert result == "Very old content"

    def test_get_doc_different_language(self, test_storage):
        """Test getting doc content in different language."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "multilang-doc"
        (doc_dir / "en").mkdir(parents=True)
        (doc_dir / "es").mkdir(parents=True)
        (doc_dir / "en" / "doc.md").write_text("English content")
        (doc_dir / "es" / "doc.md").write_text("Spanish content")

        assert test_storage.get_doc_content("multilang-doc", "en") == "English content"
        assert test_storage.get_doc_content("multilang-doc", "es") == "Spanish content"


class TestSaveDocContent:
    """Tests for saving document content."""

    def test_save_doc_content(self, test_storage, sample_markdown_content):
        """Test saving doc content."""
        test_storage.ensure_user_folders()

        # Create doc directory first
        doc_dir = test_storage.docs_dir / "new-doc"
        doc_dir.mkdir()

        result_path = test_storage.save_doc_content("new-doc", sample_markdown_content, "en")

        assert result_path.exists()
        assert result_path.read_text() == sample_markdown_content
        assert result_path == doc_dir / "en" / "doc.md"

    def test_save_doc_content_creates_lang_dir(self, test_storage):
        """Test that save_doc_content creates language directory if needed."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "new-doc"
        doc_dir.mkdir()

        test_storage.save_doc_content("new-doc", "Content", "fr")

        assert (doc_dir / "fr").exists()
        assert (doc_dir / "fr" / "doc.md").read_text() == "Content"

    def test_save_doc_content_doc_not_found(self, test_storage):
        """Test saving doc content when doc directory doesn't exist."""
        test_storage.ensure_user_folders()

        with pytest.raises(FileNotFoundError):
            test_storage.save_doc_content("nonexistent-doc", "Content", "en")


class TestDeleteDoc:
    """Tests for deleting documents."""

    def test_get_doc_dir_creates_directory(self, test_storage):
        """Test that get_doc_dir creates the doc directory."""
        test_storage.ensure_user_folders()

        doc_dir, doc_id = test_storage.get_doc_dir(video_name="test-video.mp4")

        assert doc_dir.exists()
        assert doc_id == "test-video"

    def test_get_doc_dir_with_explicit_id(self, test_storage):
        """Test get_doc_dir with explicit doc_id."""
        test_storage.ensure_user_folders()

        doc_dir, doc_id = test_storage.get_doc_dir(doc_id="my-custom-id")

        assert doc_id == "my-custom-id"
        assert doc_dir == test_storage.docs_dir / "my-custom-id"

    def test_get_doc_dir_creates_unique_on_conflict(self, test_storage):
        """Test that get_doc_dir creates unique ID when create_new=True."""
        test_storage.ensure_user_folders()

        # Create first doc
        doc_dir1, doc_id1 = test_storage.get_doc_dir(video_name="test.mp4")
        assert doc_id1 == "test"

        # Create second doc with same video name and create_new=True
        doc_dir2, doc_id2 = test_storage.get_doc_dir(video_name="test.mp4", create_new=True)
        assert doc_id2 == "test-2"

        # Create third
        doc_dir3, doc_id3 = test_storage.get_doc_dir(video_name="test.mp4", create_new=True)
        assert doc_id3 == "test-3"


class TestListVideos:
    """Tests for listing videos."""

    def test_list_videos_empty(self, test_storage):
        """Test listing videos when no videos exist."""
        test_storage.ensure_user_folders()
        result = test_storage.list_videos()
        assert result == []

    def test_list_videos_with_data(self, test_storage):
        """Test listing videos when videos exist."""
        test_storage.ensure_user_folders()

        # Create some video files
        (test_storage.videos_dir / "video1.mp4").write_bytes(b"fake video 1")
        (test_storage.videos_dir / "video2.mov").write_bytes(b"fake video 2")
        (test_storage.videos_dir / "video3.webm").write_bytes(b"fake video 3")

        result = test_storage.list_videos()
        assert len(result) == 3
        names = [v.name for v in result]
        assert "video1.mp4" in names
        assert "video2.mov" in names
        assert "video3.webm" in names

    def test_list_videos_ignores_non_video_files(self, test_storage):
        """Test that list_videos ignores non-video files."""
        test_storage.ensure_user_folders()

        (test_storage.videos_dir / "video.mp4").write_bytes(b"video")
        (test_storage.videos_dir / "document.pdf").write_bytes(b"pdf")
        (test_storage.videos_dir / "image.png").write_bytes(b"png")

        result = test_storage.list_videos()
        assert len(result) == 1
        assert result[0].name == "video.mp4"

    def test_list_videos_nonexistent_dir(self, test_storage):
        """Test listing videos when videos directory doesn't exist."""
        result = test_storage.list_videos()
        assert result == []

    def test_list_videos_sorted_by_mtime(self, test_storage):
        """Test that videos are sorted by modification time (newest first)."""
        import time
        test_storage.ensure_user_folders()

        # Create videos with slight delay to ensure different mtimes
        (test_storage.videos_dir / "old.mp4").write_bytes(b"old")
        time.sleep(0.1)
        (test_storage.videos_dir / "new.mp4").write_bytes(b"new")

        result = test_storage.list_videos()
        assert result[0].name == "new.mp4"
        assert result[1].name == "old.mp4"


class TestDeleteVideo:
    """Tests for video-related operations (indirectly tested via list)."""

    def test_get_video_path(self, test_storage):
        """Test getting video path."""
        test_storage.ensure_user_folders()

        path = test_storage.get_video_path("my-video.mp4")
        assert path == test_storage.videos_dir / "my-video.mp4"


class TestDocMetadata:
    """Tests for document metadata operations."""

    def test_get_doc_metadata(self, test_storage, sample_doc_metadata):
        """Test getting doc metadata."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "test-doc"
        doc_dir.mkdir()
        (doc_dir / "metadata.json").write_text(json.dumps(sample_doc_metadata))

        result = test_storage.get_doc_metadata("test-doc")
        assert result is not None
        assert result["title"] == sample_doc_metadata["title"]
        assert result["source_video"] == sample_doc_metadata["source_video"]

    def test_get_doc_metadata_not_found(self, test_storage):
        """Test getting metadata when doc doesn't exist."""
        test_storage.ensure_user_folders()
        result = test_storage.get_doc_metadata("nonexistent-doc")
        assert result is None

    def test_get_doc_metadata_no_metadata_file(self, test_storage):
        """Test getting metadata when doc exists but has no metadata.json."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "no-metadata-doc"
        doc_dir.mkdir()

        result = test_storage.get_doc_metadata("no-metadata-doc")
        assert result is None

    def test_get_doc_metadata_corrupted_json(self, test_storage):
        """Test getting metadata when JSON is corrupted."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "corrupted-doc"
        doc_dir.mkdir()
        (doc_dir / "metadata.json").write_text("not valid json {{{")

        result = test_storage.get_doc_metadata("corrupted-doc")
        assert result is None

    def test_update_doc_metadata(self, test_storage, sample_doc_metadata):
        """Test updating doc metadata."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "test-doc"
        doc_dir.mkdir()
        (doc_dir / "metadata.json").write_text(json.dumps(sample_doc_metadata))

        test_storage.update_doc_metadata("test-doc", {"title": "New Title", "new_field": "value"})

        result = test_storage.get_doc_metadata("test-doc")
        assert result["title"] == "New Title"
        assert result["new_field"] == "value"
        assert "updated_at" in result
        # Original fields should be preserved
        assert result["source_video"] == sample_doc_metadata["source_video"]

    def test_update_doc_metadata_creates_if_not_exists(self, test_storage):
        """Test updating metadata when no metadata file exists."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "new-doc"
        doc_dir.mkdir()

        test_storage.update_doc_metadata("new-doc", {"title": "New Doc"})

        result = test_storage.get_doc_metadata("new-doc")
        assert result["title"] == "New Doc"
        assert "updated_at" in result


class TestDocLanguages:
    """Tests for document language operations."""

    def test_list_doc_languages(self, test_storage):
        """Test listing available languages for a doc."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "multilang-doc"
        (doc_dir / "en").mkdir(parents=True)
        (doc_dir / "es").mkdir()
        (doc_dir / "fr").mkdir()

        # Create doc.md in each language folder
        (doc_dir / "en" / "doc.md").write_text("English")
        (doc_dir / "es" / "doc.md").write_text("Spanish")
        (doc_dir / "fr" / "doc.md").write_text("French")

        result = test_storage.list_doc_languages("multilang-doc")
        assert set(result) == {"en", "es", "fr"}

    def test_list_doc_languages_empty(self, test_storage):
        """Test listing languages when doc has no language folders."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "empty-doc"
        doc_dir.mkdir()

        result = test_storage.list_doc_languages("empty-doc")
        assert result == []

    def test_list_doc_languages_nonexistent_doc(self, test_storage):
        """Test listing languages for nonexistent doc."""
        test_storage.ensure_user_folders()
        result = test_storage.list_doc_languages("nonexistent")
        assert result == []


class TestDocsByVideo:
    """Tests for finding docs by source video."""

    def test_get_docs_by_video(self, test_storage):
        """Test finding docs created from a video."""
        test_storage.ensure_user_folders()
        test_storage.videos_dir.mkdir(parents=True, exist_ok=True)

        # Create a doc with metadata referencing video
        doc_dir = test_storage.docs_dir / "doc-from-video"
        doc_dir.mkdir()
        video_path = str(test_storage.videos_dir / "source.mp4")
        metadata = {
            "video_path": video_path,
            "languages_generated": ["en"],
            "created_at": "2024-01-01T00:00:00",
        }
        (doc_dir / "metadata.json").write_text(json.dumps(metadata))

        result = test_storage.get_docs_by_video("source.mp4")
        assert len(result) == 1
        assert result[0]["doc_id"] == "doc-from-video"

    def test_get_docs_by_video_no_match(self, test_storage):
        """Test finding docs when no docs match the video."""
        test_storage.ensure_user_folders()
        result = test_storage.get_docs_by_video("nonexistent-video.mp4")
        assert result == []


class TestListScreenshots:
    """Tests for listing screenshots."""

    def test_list_screenshots(self, test_storage):
        """Test listing screenshots for a doc."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "doc-with-screenshots"
        screenshots_dir = doc_dir / "screenshots"
        screenshots_dir.mkdir(parents=True)

        (screenshots_dir / "step1.png").write_bytes(b"img1")
        (screenshots_dir / "step2.png").write_bytes(b"img2")
        (screenshots_dir / "step3.jpg").write_bytes(b"img3")

        result = test_storage.list_screenshots("doc-with-screenshots")
        assert len(result) == 3
        names = [s.name for s in result]
        assert "step1.png" in names
        assert "step2.png" in names
        assert "step3.jpg" in names

    def test_list_screenshots_empty(self, test_storage):
        """Test listing screenshots when none exist."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "doc-no-screenshots"
        doc_dir.mkdir()

        result = test_storage.list_screenshots("doc-no-screenshots")
        assert result == []

    def test_list_screenshots_no_dir(self, test_storage):
        """Test listing screenshots when screenshots dir doesn't exist."""
        test_storage.ensure_user_folders()
        result = test_storage.list_screenshots("nonexistent-doc")
        assert result == []


class TestShareToken:
    """Tests for share token functionality."""

    def test_create_share_token(self, test_storage):
        """Test creating a share token for a doc."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "shareable-doc"
        doc_dir.mkdir()
        (doc_dir / "metadata.json").write_text("{}")

        token = test_storage.create_share_token("shareable-doc", "en")

        assert token is not None
        assert len(token) > 20  # URL-safe tokens are typically 43 chars

        # Verify it's stored in metadata
        metadata = test_storage.get_doc_metadata("shareable-doc")
        assert metadata["share"]["token"] == token
        assert metadata["share"]["language"] == "en"

    def test_get_share_info(self, test_storage):
        """Test getting share info for a doc."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "shared-doc"
        doc_dir.mkdir()
        (doc_dir / "metadata.json").write_text("{}")

        test_storage.create_share_token("shared-doc", "es")

        share_info = test_storage.get_share_info("shared-doc")
        assert share_info is not None
        assert "token" in share_info
        assert share_info["language"] == "es"

    def test_get_share_info_not_shared(self, test_storage):
        """Test getting share info for doc that isn't shared."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "not-shared-doc"
        doc_dir.mkdir()
        (doc_dir / "metadata.json").write_text("{}")

        share_info = test_storage.get_share_info("not-shared-doc")
        assert share_info is None

    def test_revoke_share(self, test_storage):
        """Test revoking a share token."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "revoke-doc"
        doc_dir.mkdir()
        (doc_dir / "metadata.json").write_text("{}")

        test_storage.create_share_token("revoke-doc", "en")
        result = test_storage.revoke_share("revoke-doc")

        assert result is True
        assert test_storage.get_share_info("revoke-doc") is None

    def test_revoke_share_not_shared(self, test_storage):
        """Test revoking share for doc that isn't shared."""
        test_storage.ensure_user_folders()

        doc_dir = test_storage.docs_dir / "no-share-doc"
        doc_dir.mkdir()
        (doc_dir / "metadata.json").write_text("{}")

        result = test_storage.revoke_share("no-share-doc")
        assert result is False


class TestSlugify:
    """Tests for the slugify function."""

    def test_slugify_basic(self):
        """Test basic slugify functionality."""
        from src.storage.user_storage import slugify

        assert slugify("Hello World") == "hello-world"
        assert slugify("Test_Document") == "test-document"
        assert slugify("My Video File") == "my-video-file"

    def test_slugify_special_chars(self):
        """Test slugify with special characters."""
        from src.storage.user_storage import slugify

        assert slugify("Test@#$%^&*()") == "test"
        assert slugify("Hello!!World") == "helloworld"

    def test_slugify_empty(self):
        """Test slugify with empty or special-only string."""
        from src.storage.user_storage import slugify

        assert slugify("") == "doc"
        assert slugify("@#$%") == "doc"

    def test_slugify_length_limit(self):
        """Test slugify respects length limit."""
        from src.storage.user_storage import slugify

        long_name = "a" * 100
        result = slugify(long_name)
        assert len(result) <= 50
