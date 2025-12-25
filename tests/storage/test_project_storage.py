"""Tests for ProjectStorage module."""

import json
import pytest
from pathlib import Path
from unittest.mock import patch


@pytest.fixture
def project_storage(tmp_data_dir, test_user_id):
    """Create a ProjectStorage instance with a temporary directory."""
    # Patch at the module level where USERS_DIR is imported
    with patch("src.storage.project_storage.USERS_DIR", tmp_data_dir / "users"):
        from src.storage.project_storage import ProjectStorage
        storage = ProjectStorage(test_user_id)
        storage.ensure_projects_dir()
        # Also create docs dir for some tests
        storage.docs_dir.mkdir(parents=True, exist_ok=True)
        yield storage


class TestProjectCRUD:
    """Tests for project creation, reading, updating, and deletion."""

    def test_create_project(self, project_storage):
        """Test creating a new project."""
        project_id = project_storage.create_project(
            name="My Test Project",
            description="A test project",
            default_language="en"
        )

        assert project_id == "my-test-project"
        assert (project_storage.projects_dir / project_id / "project.json").exists()
        assert (project_storage.projects_dir / project_id / "exports").exists()

    def test_create_project_handles_duplicates(self, project_storage):
        """Test that duplicate project names get unique IDs."""
        project_id1 = project_storage.create_project(name="Test Project")
        project_id2 = project_storage.create_project(name="Test Project")
        project_id3 = project_storage.create_project(name="Test Project")

        assert project_id1 == "test-project"
        assert project_id2 == "test-project-2"
        assert project_id3 == "test-project-3"

    def test_list_projects_empty(self, project_storage):
        """Test listing projects when none exist."""
        result = project_storage.list_projects()
        assert result == []

    def test_list_projects_with_data(self, project_storage):
        """Test listing projects when projects exist."""
        project_storage.create_project(name="Project A")
        project_storage.create_project(name="Project B")
        project_storage.create_project(name="Project C")

        result = project_storage.list_projects()
        assert len(result) == 3

        names = [p["name"] for p in result]
        assert "Project A" in names
        assert "Project B" in names
        assert "Project C" in names

    def test_list_projects_sorted_by_updated_at(self, project_storage):
        """Test that projects are sorted by updated_at (newest first)."""
        import time

        project_storage.create_project(name="Old Project")
        time.sleep(0.1)
        project_storage.create_project(name="New Project")

        result = project_storage.list_projects()
        assert result[0]["name"] == "New Project"
        assert result[1]["name"] == "Old Project"

    def test_get_project(self, project_storage):
        """Test getting a project by ID."""
        project_id = project_storage.create_project(
            name="Get Test",
            description="Test description"
        )

        result = project_storage.get_project(project_id)

        assert result is not None
        assert result["name"] == "Get Test"
        assert result["description"] == "Test description"
        assert result["id"] == project_id
        assert "created_at" in result
        assert "updated_at" in result

    def test_get_project_not_found(self, project_storage):
        """Test getting a project that doesn't exist."""
        result = project_storage.get_project("nonexistent-project")
        assert result is None

    def test_update_project(self, project_storage):
        """Test updating a project."""
        project_id = project_storage.create_project(name="Original Name")

        project_storage.update_project(project_id, {
            "name": "Updated Name",
            "description": "New description"
        })

        result = project_storage.get_project(project_id)
        assert result["name"] == "Updated Name"
        assert result["description"] == "New description"

    def test_update_project_not_found(self, project_storage):
        """Test updating a project that doesn't exist."""
        with pytest.raises(ValueError, match="Project not found"):
            project_storage.update_project("nonexistent", {"name": "New"})

    def test_update_project_cannot_change_id(self, project_storage):
        """Test that updating cannot change the project ID."""
        project_id = project_storage.create_project(name="Test")

        project_storage.update_project(project_id, {"id": "new-id"})

        result = project_storage.get_project(project_id)
        assert result["id"] == project_id  # ID unchanged

    def test_delete_project(self, project_storage):
        """Test deleting a project."""
        project_id = project_storage.create_project(name="To Delete")

        project_storage.delete_project(project_id)

        assert project_storage.get_project(project_id) is None
        assert not (project_storage.projects_dir / project_id).exists()

    def test_delete_project_not_found(self, project_storage):
        """Test deleting a project that doesn't exist."""
        with pytest.raises(ValueError, match="Project not found"):
            project_storage.delete_project("nonexistent")

    def test_delete_default_project_fails(self, project_storage):
        """Test that deleting the default project raises an error."""
        project_storage.ensure_default_project()

        with pytest.raises(ValueError, match="Cannot delete the default project"):
            project_storage.delete_project("__default__")


class TestChapterManagement:
    """Tests for chapter operations within projects."""

    def test_add_chapter(self, project_storage):
        """Test adding a chapter to a project."""
        project_id = project_storage.create_project(name="Test Project")

        chapter_id = project_storage.add_chapter(
            project_id,
            title="Introduction",
            description="The intro chapter"
        )

        assert chapter_id == "ch-01"

        project = project_storage.get_project(project_id)
        assert len(project["chapters"]) == 1
        assert project["chapters"][0]["title"] == "Introduction"
        assert project["chapters"][0]["description"] == "The intro chapter"

    def test_add_multiple_chapters(self, project_storage):
        """Test adding multiple chapters."""
        project_id = project_storage.create_project(name="Test")

        ch1 = project_storage.add_chapter(project_id, "Chapter 1")
        ch2 = project_storage.add_chapter(project_id, "Chapter 2")
        ch3 = project_storage.add_chapter(project_id, "Chapter 3")

        assert ch1 == "ch-01"
        assert ch2 == "ch-02"
        assert ch3 == "ch-03"

        project = project_storage.get_project(project_id)
        assert len(project["chapters"]) == 3

    def test_add_chapter_project_not_found(self, project_storage):
        """Test adding chapter to nonexistent project."""
        with pytest.raises(ValueError, match="Project not found"):
            project_storage.add_chapter("nonexistent", "Chapter")

    def test_remove_chapter(self, project_storage):
        """Test removing a chapter from a project."""
        project_id = project_storage.create_project(name="Test")
        ch1 = project_storage.add_chapter(project_id, "Chapter 1")
        ch2 = project_storage.add_chapter(project_id, "Chapter 2")

        project_storage.delete_chapter(project_id, ch1)

        project = project_storage.get_project(project_id)
        assert len(project["chapters"]) == 1
        assert project["chapters"][0]["id"] == ch2

    def test_reorder_chapters(self, project_storage):
        """Test reordering chapters in a project."""
        project_id = project_storage.create_project(name="Test")
        ch1 = project_storage.add_chapter(project_id, "Chapter 1")
        ch2 = project_storage.add_chapter(project_id, "Chapter 2")
        ch3 = project_storage.add_chapter(project_id, "Chapter 3")

        # Reorder: 3, 1, 2
        project_storage.reorder_chapters(project_id, [ch3, ch1, ch2])

        project = project_storage.get_project(project_id)
        chapters = project["chapters"]
        assert chapters[0]["id"] == ch3
        assert chapters[0]["order"] == 1
        assert chapters[1]["id"] == ch1
        assert chapters[1]["order"] == 2
        assert chapters[2]["id"] == ch2
        assert chapters[2]["order"] == 3

    def test_reorder_chapters_invalid_id(self, project_storage):
        """Test reordering with invalid chapter ID."""
        project_id = project_storage.create_project(name="Test")
        project_storage.add_chapter(project_id, "Chapter 1")

        with pytest.raises(ValueError, match="Chapter not found"):
            project_storage.reorder_chapters(project_id, ["invalid-ch"])

    def test_list_chapters(self, project_storage):
        """Test listing chapters in order."""
        project_id = project_storage.create_project(name="Test")
        project_storage.add_chapter(project_id, "Chapter 1")
        project_storage.add_chapter(project_id, "Chapter 2")

        chapters = project_storage.list_chapters(project_id)

        assert len(chapters) == 2
        assert chapters[0]["title"] == "Chapter 1"
        assert chapters[1]["title"] == "Chapter 2"

    def test_update_chapter(self, project_storage):
        """Test updating a chapter's properties."""
        project_id = project_storage.create_project(name="Test")
        ch_id = project_storage.add_chapter(project_id, "Original Title")

        project_storage.update_chapter(project_id, ch_id, {
            "title": "Updated Title",
            "description": "New description"
        })

        chapters = project_storage.list_chapters(project_id)
        assert chapters[0]["title"] == "Updated Title"
        assert chapters[0]["description"] == "New description"


class TestAddManualToProject:
    """Tests for adding manuals/docs to projects."""

    def test_add_doc_to_project(self, project_storage):
        """Test adding a doc to a project."""
        project_id = project_storage.create_project(name="Test")
        chapter_id = project_storage.add_chapter(project_id, "Chapter 1")

        # Create a doc directory
        doc_id = "test-doc"
        (project_storage.docs_dir / doc_id).mkdir(parents=True)

        project_storage.add_doc_to_project(project_id, doc_id, chapter_id)

        project = project_storage.get_project(project_id)
        assert doc_id in project["chapters"][0]["docs"]

    def test_add_doc_creates_chapter_if_none_specified(self, project_storage, tmp_data_dir):
        """Test that adding a doc without chapter creates a new chapter."""
        project_id = project_storage.create_project(name="Test")

        # Create a doc with metadata
        doc_id = "my-doc"
        doc_dir = project_storage.docs_dir / doc_id
        doc_dir.mkdir(parents=True)
        (doc_dir / "metadata.json").write_text(json.dumps({"title": "My Document"}))

        # Need to also patch user_storage since add_doc_to_project uses it internally
        with patch("src.storage.user_storage.USERS_DIR", tmp_data_dir / "users"):
            project_storage.add_doc_to_project(project_id, doc_id)

        project = project_storage.get_project(project_id)
        assert len(project["chapters"]) == 1
        assert project["chapters"][0]["title"] == "My Document"
        assert doc_id in project["chapters"][0]["docs"]

    def test_add_doc_not_found(self, project_storage):
        """Test adding a doc that doesn't exist."""
        project_id = project_storage.create_project(name="Test")
        chapter_id = project_storage.add_chapter(project_id, "Chapter")

        with pytest.raises(ValueError, match="Manual not found"):
            project_storage.add_doc_to_project(project_id, "nonexistent", chapter_id)

    def test_remove_doc_from_project(self, project_storage):
        """Test removing a doc from a project."""
        project_id = project_storage.create_project(name="Test")

        # Create and add doc
        doc_id = "test-doc"
        (project_storage.docs_dir / doc_id).mkdir(parents=True)
        project_storage.add_doc_to_project(project_id, doc_id)

        # Remove it
        project_storage.remove_doc_from_project(project_id, doc_id)

        project = project_storage.get_project(project_id)
        # Empty chapters should be cleaned up
        assert len(project["chapters"]) == 0

    def test_move_doc_to_chapter(self, project_storage):
        """Test moving a doc between chapters."""
        project_id = project_storage.create_project(name="Test")
        ch1 = project_storage.add_chapter(project_id, "Chapter 1")
        ch2 = project_storage.add_chapter(project_id, "Chapter 2")

        doc_id = "test-doc"
        (project_storage.docs_dir / doc_id).mkdir(parents=True)
        project_storage.add_doc_to_project(project_id, doc_id, ch1)

        # Move to chapter 2
        project_storage.move_doc_to_chapter(project_id, doc_id, ch2)

        project = project_storage.get_project(project_id)
        ch1_data = next(c for c in project["chapters"] if c["id"] == ch1)
        ch2_data = next(c for c in project["chapters"] if c["id"] == ch2)

        assert doc_id not in ch1_data["docs"]
        assert doc_id in ch2_data["docs"]


class TestDefaultProject:
    """Tests for default project handling."""

    def test_ensure_default_project_creates_if_not_exists(self, project_storage):
        """Test that ensure_default_project creates the default project."""
        result = project_storage.ensure_default_project()

        assert result is not None
        assert result["id"] == "__default__"
        assert result["is_default"] is True
        assert result["name"] == "My Docs"

    def test_ensure_default_project_returns_existing(self, project_storage):
        """Test that ensure_default_project returns existing default project."""
        first = project_storage.ensure_default_project()
        second = project_storage.ensure_default_project()

        assert first["id"] == second["id"]
        assert first["created_at"] == second["created_at"]

    def test_is_default_project(self, project_storage):
        """Test checking if a project is the default project."""
        project_storage.ensure_default_project()
        regular_id = project_storage.create_project(name="Regular")

        assert project_storage.is_default_project("__default__") is True
        assert project_storage.is_default_project(regular_id) is False


class TestProjectQueries:
    """Tests for project query operations."""

    def test_get_project_docs(self, project_storage):
        """Test getting all docs in a project."""
        project_id = project_storage.create_project(name="Test")
        ch1 = project_storage.add_chapter(project_id, "Chapter 1")

        # Create docs
        for i in range(3):
            doc_id = f"doc-{i}"
            (project_storage.docs_dir / doc_id).mkdir(parents=True)
            project_storage.add_doc_to_project(project_id, doc_id, ch1)

        docs = project_storage.get_project_docs(project_id)

        assert len(docs) == 3
        assert all(d["chapter_id"] == ch1 for d in docs)

    def test_get_unassigned_docs(self, project_storage):
        """Test finding docs not assigned to any project."""
        # Create some docs without assigning to project
        for i in range(2):
            doc_dir = project_storage.docs_dir / f"unassigned-{i}"
            doc_dir.mkdir(parents=True)
            (doc_dir / "metadata.json").write_text("{}")

        # Create one assigned doc
        project_id = project_storage.create_project(name="Test")
        assigned_doc = "assigned-doc"
        (project_storage.docs_dir / assigned_doc).mkdir(parents=True)
        project_storage.add_doc_to_project(project_id, assigned_doc)

        unassigned = project_storage.get_unassigned_docs()

        assert len(unassigned) == 2
        assert "unassigned-0" in unassigned
        assert "unassigned-1" in unassigned
        assert assigned_doc not in unassigned


class TestTags:
    """Tests for tag management."""

    def test_add_tag_to_doc(self, project_storage):
        """Test adding a tag to a doc."""
        doc_id = "tagged-doc"
        doc_dir = project_storage.docs_dir / doc_id
        doc_dir.mkdir(parents=True)
        (doc_dir / "metadata.json").write_text("{}")

        project_storage.add_tag_to_doc(doc_id, "important")

        metadata = json.loads((doc_dir / "metadata.json").read_text())
        assert "important" in metadata["tags"]

    def test_add_duplicate_tag(self, project_storage):
        """Test that adding duplicate tag doesn't create duplicates."""
        doc_id = "tagged-doc"
        doc_dir = project_storage.docs_dir / doc_id
        doc_dir.mkdir(parents=True)
        (doc_dir / "metadata.json").write_text("{}")

        project_storage.add_tag_to_doc(doc_id, "tag1")
        project_storage.add_tag_to_doc(doc_id, "tag1")

        metadata = json.loads((doc_dir / "metadata.json").read_text())
        assert metadata["tags"].count("tag1") == 1

    def test_remove_tag_from_doc(self, project_storage):
        """Test removing a tag from a doc."""
        doc_id = "tagged-doc"
        doc_dir = project_storage.docs_dir / doc_id
        doc_dir.mkdir(parents=True)
        (doc_dir / "metadata.json").write_text('{"tags": ["tag1", "tag2"]}')

        project_storage.remove_tag_from_doc(doc_id, "tag1")

        metadata = json.loads((doc_dir / "metadata.json").read_text())
        assert "tag1" not in metadata["tags"]
        assert "tag2" in metadata["tags"]

    def test_list_all_tags(self, project_storage):
        """Test listing all unique tags across docs."""
        for i, tags in enumerate([["a", "b"], ["b", "c"], ["c", "d"]]):
            doc_dir = project_storage.docs_dir / f"doc-{i}"
            doc_dir.mkdir(parents=True)
            (doc_dir / "metadata.json").write_text(json.dumps({"tags": tags}))

        all_tags = project_storage.list_all_tags()

        assert set(all_tags) == {"a", "b", "c", "d"}

    def test_get_docs_by_tag(self, project_storage):
        """Test finding docs with a specific tag."""
        # Create docs with different tags
        for i, tags in enumerate([["target"], ["other"], ["target", "extra"]]):
            doc_dir = project_storage.docs_dir / f"doc-{i}"
            doc_dir.mkdir(parents=True)
            (doc_dir / "metadata.json").write_text(json.dumps({"tags": tags}))

        result = project_storage.get_docs_by_tag("target")

        assert len(result) == 2
        assert "doc-0" in result
        assert "doc-2" in result
        assert "doc-1" not in result


class TestSections:
    """Tests for section management within projects."""

    def test_add_section(self, project_storage):
        """Test adding a section to a project."""
        project_id = project_storage.create_project(name="Test")

        section_id = project_storage.add_section(
            project_id,
            title="Part 1",
            description="First section"
        )

        assert section_id == "sec-01"

        project = project_storage.get_project(project_id)
        assert len(project["sections"]) == 1
        assert project["sections"][0]["title"] == "Part 1"

    def test_move_chapter_to_section(self, project_storage):
        """Test moving a chapter to a section."""
        project_id = project_storage.create_project(name="Test")
        section_id = project_storage.add_section(project_id, "Section 1")
        chapter_id = project_storage.add_chapter(project_id, "Chapter 1")

        project_storage.move_chapter_to_section(project_id, chapter_id, section_id)

        project = project_storage.get_project(project_id)
        section = project["sections"][0]
        assert chapter_id in section["chapters"]

    def test_reorder_sections(self, project_storage):
        """Test reordering sections."""
        project_id = project_storage.create_project(name="Test")
        sec1 = project_storage.add_section(project_id, "Section 1")
        sec2 = project_storage.add_section(project_id, "Section 2")

        project_storage.reorder_sections(project_id, [sec2, sec1])

        sections = project_storage.list_sections(project_id)
        assert sections[0]["id"] == sec2
        assert sections[1]["id"] == sec1
