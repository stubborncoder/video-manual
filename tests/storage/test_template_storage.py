"""Tests for TemplateStorage module."""

import json
import pytest
import zipfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch, MagicMock


def create_minimal_docx() -> bytes:
    """Create a minimal valid .docx file for testing."""
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Minimal required files for a valid docx
        zf.writestr('[Content_Types].xml', '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>''')
        zf.writestr('word/document.xml', '''<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body><w:p><w:r><w:t>Test</w:t></w:r></w:p></w:body>
</w:document>''')
        zf.writestr('_rels/.rels', '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>''')
    return buffer.getvalue()


@pytest.fixture
def template_storage(tmp_data_dir, test_user_id):
    """Create a TemplateStorage instance with a temporary directory."""
    global_templates_dir = tmp_data_dir / "templates"
    global_templates_dir.mkdir(parents=True)

    # Patch at the module level where variables are imported
    with patch("src.storage.template_storage.USERS_DIR", tmp_data_dir / "users"):
        with patch("src.storage.template_storage.TEMPLATES_DIR", global_templates_dir):
            from src.storage.template_storage import TemplateStorage
            storage = TemplateStorage(test_user_id)
            storage.ensure_directories()
            yield storage


@pytest.fixture
def valid_docx_content():
    """Provide valid docx content for tests."""
    return create_minimal_docx()


class TestTemplateListOperations:
    """Tests for listing templates."""

    def test_list_templates_empty(self, template_storage):
        """Test listing templates when none exist."""
        result = template_storage.list_templates()
        assert result == []

    def test_list_templates_user_only(self, template_storage, valid_docx_content):
        """Test listing only user templates."""
        # Create user templates
        template_storage.save_template(valid_docx_content, "user-template-1")
        template_storage.save_template(valid_docx_content, "user-template-2")

        result = template_storage.list_templates()

        assert len(result) == 2
        assert all(not t.is_global for t in result)

    def test_list_templates_global_only(self, template_storage, valid_docx_content):
        """Test listing only global templates."""
        # Create global templates directly
        (template_storage.global_templates_dir / "global-1.docx").write_bytes(valid_docx_content)
        (template_storage.global_templates_dir / "global-2.docx").write_bytes(valid_docx_content)

        result = template_storage.list_templates()

        assert len(result) == 2
        assert all(t.is_global for t in result)

    def test_list_templates_user_overrides_global(self, template_storage, valid_docx_content):
        """Test that user templates override global templates with same name."""
        # Create global template
        (template_storage.global_templates_dir / "shared-name.docx").write_bytes(valid_docx_content)

        # Create user template with same name
        template_storage.save_template(valid_docx_content, "shared-name")

        result = template_storage.list_templates()

        # Should only have one template (user version)
        assert len(result) == 1
        assert result[0].name == "shared-name"
        assert result[0].is_global is False

    def test_list_templates_ignores_temp_files(self, template_storage, valid_docx_content):
        """Test that Word temp files (~$) are ignored."""
        template_storage.save_template(valid_docx_content, "normal-template")
        # Create temp file
        (template_storage.templates_dir / "~$temp-file.docx").write_bytes(valid_docx_content)

        result = template_storage.list_templates()

        assert len(result) == 1
        assert result[0].name == "normal-template"

    def test_list_user_templates(self, template_storage, valid_docx_content):
        """Test listing only user templates."""
        template_storage.save_template(valid_docx_content, "user-only")
        (template_storage.global_templates_dir / "global-only.docx").write_bytes(valid_docx_content)

        result = template_storage.list_user_templates()

        assert len(result) == 1
        assert result[0].name == "user-only"
        assert result[0].is_global is False

    def test_list_global_templates(self, template_storage, valid_docx_content):
        """Test listing only global templates."""
        template_storage.save_template(valid_docx_content, "user-only")
        (template_storage.global_templates_dir / "global-only.docx").write_bytes(valid_docx_content)

        result = template_storage.list_global_templates()

        assert len(result) == 1
        assert result[0].name == "global-only"
        assert result[0].is_global is True


class TestGetTemplate:
    """Tests for getting templates."""

    def test_get_template_user(self, template_storage, valid_docx_content):
        """Test getting a user template."""
        template_storage.save_template(valid_docx_content, "my-template")

        result = template_storage.get_template("my-template")

        assert result is not None
        assert result.name == "my-template.docx"
        assert result.exists()

    def test_get_template_global(self, template_storage, valid_docx_content):
        """Test getting a global template."""
        (template_storage.global_templates_dir / "global-template.docx").write_bytes(valid_docx_content)

        result = template_storage.get_template("global-template")

        assert result is not None
        assert "global-template.docx" in str(result)

    def test_get_template_not_found(self, template_storage):
        """Test getting a template that doesn't exist."""
        result = template_storage.get_template("nonexistent")
        assert result is None

    def test_get_template_user_takes_precedence(self, template_storage, valid_docx_content):
        """Test that user template is returned over global with same name."""
        # Create both
        (template_storage.global_templates_dir / "same-name.docx").write_bytes(valid_docx_content)
        template_storage.save_template(valid_docx_content, "same-name")

        result = template_storage.get_template("same-name")

        # Should be user template path
        assert str(template_storage.templates_dir) in str(result)

    def test_get_template_info(self, template_storage, valid_docx_content):
        """Test getting detailed template info."""
        template_storage.save_template(valid_docx_content, "detailed-template", "step-manual")

        result = template_storage.get_template_info("detailed-template")

        assert result is not None
        assert result.name == "detailed-template"
        assert result.is_global is False
        assert result.document_format == "step-manual"
        assert result.uploaded_at is not None
        assert result.size_bytes > 0


class TestSaveTemplate:
    """Tests for saving templates."""

    def test_save_template(self, template_storage, valid_docx_content):
        """Test saving a template."""
        result = template_storage.save_template(valid_docx_content, "new-template")

        assert result.name == "new-template"
        assert result.is_global is False
        assert (template_storage.templates_dir / "new-template.docx").exists()

    def test_save_template_with_document_format(self, template_storage, valid_docx_content):
        """Test saving a template with document format."""
        result = template_storage.save_template(
            valid_docx_content,
            "quick-guide-template",
            document_format="quick-guide"
        )

        assert result.document_format == "quick-guide"

        # Check metadata file
        meta_path = template_storage.templates_dir / "quick-guide-template.json"
        assert meta_path.exists()
        metadata = json.loads(meta_path.read_text())
        assert metadata["document_format"] == "quick-guide"

    def test_save_template_creates_metadata(self, template_storage, valid_docx_content):
        """Test that saving creates metadata JSON."""
        template_storage.save_template(valid_docx_content, "meta-test")

        meta_path = template_storage.templates_dir / "meta-test.json"
        assert meta_path.exists()

        metadata = json.loads(meta_path.read_text())
        assert "uploaded_at" in metadata
        assert metadata["original_name"] == "meta-test"

    def test_save_template_sanitizes_name(self, template_storage, valid_docx_content):
        """Test that template names are sanitized."""
        result = template_storage.save_template(valid_docx_content, "My Template With Spaces!")

        assert result.name == "my-template-with-spaces"
        assert (template_storage.templates_dir / "my-template-with-spaces.docx").exists()

    def test_save_template_removes_extension(self, template_storage, valid_docx_content):
        """Test that .docx extension is removed from name."""
        result = template_storage.save_template(valid_docx_content, "template.docx")

        assert result.name == "template"

    def test_save_template_too_large(self, template_storage, valid_docx_content):
        """Test that templates exceeding size limit are rejected."""
        # Create content larger than 10MB
        large_content = b"x" * (11 * 1024 * 1024)

        with pytest.raises(ValueError, match="exceeds maximum size"):
            template_storage.save_template(large_content, "large-template")

    def test_save_template_invalid_docx(self, template_storage):
        """Test that invalid docx files are rejected."""
        invalid_content = b"not a valid docx file"

        with pytest.raises(ValueError, match="Invalid Word document"):
            template_storage.save_template(invalid_content, "invalid")


class TestDeleteTemplate:
    """Tests for deleting templates."""

    def test_delete_template(self, template_storage, valid_docx_content):
        """Test deleting a user template."""
        template_storage.save_template(valid_docx_content, "to-delete")

        result = template_storage.delete_template("to-delete")

        assert result is True
        assert not (template_storage.templates_dir / "to-delete.docx").exists()
        assert not (template_storage.templates_dir / "to-delete.json").exists()

    def test_delete_template_not_found(self, template_storage):
        """Test deleting a template that doesn't exist."""
        result = template_storage.delete_template("nonexistent")
        assert result is False

    def test_delete_global_template_fails(self, template_storage, valid_docx_content):
        """Test that deleting a global template raises an error."""
        (template_storage.global_templates_dir / "global-only.docx").write_bytes(valid_docx_content)

        with pytest.raises(ValueError, match="Cannot delete global templates"):
            template_storage.delete_template("global-only")


class TestTemplateValidation:
    """Tests for template validation."""

    def test_is_valid_docx_valid(self, template_storage, valid_docx_content):
        """Test validation of valid docx."""
        result = template_storage._is_valid_docx(valid_docx_content)
        assert result is True

    def test_is_valid_docx_invalid_zip(self, template_storage):
        """Test validation rejects non-zip files."""
        result = template_storage._is_valid_docx(b"not a zip file")
        assert result is False

    def test_is_valid_docx_missing_components(self, template_storage):
        """Test validation rejects zip without required docx components."""
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, 'w') as zf:
            zf.writestr("random.txt", "not a docx")
        invalid_zip = buffer.getvalue()

        result = template_storage._is_valid_docx(invalid_zip)
        assert result is False

    def test_template_exists(self, template_storage, valid_docx_content):
        """Test checking if template exists."""
        assert template_storage.template_exists("nonexistent") is False

        template_storage.save_template(valid_docx_content, "exists")
        assert template_storage.template_exists("exists") is True

    def test_user_template_exists(self, template_storage, valid_docx_content):
        """Test checking if user template specifically exists."""
        # Global template
        (template_storage.global_templates_dir / "global.docx").write_bytes(valid_docx_content)

        assert template_storage.user_template_exists("global") is False

        # User template
        template_storage.save_template(valid_docx_content, "user")
        assert template_storage.user_template_exists("user") is True


class TestSanitizeName:
    """Tests for name sanitization."""

    def test_sanitize_removes_spaces(self, template_storage):
        """Test that spaces are replaced with hyphens."""
        result = template_storage._sanitize_name("hello world")
        assert result == "hello-world"

    def test_sanitize_removes_special_chars(self, template_storage):
        """Test that special characters are removed."""
        result = template_storage._sanitize_name("template@#$%^&*()")
        assert result == "template"

    def test_sanitize_lowercase(self, template_storage):
        """Test that result is lowercase."""
        result = template_storage._sanitize_name("UPPERCASE")
        assert result == "uppercase"

    def test_sanitize_removes_extension(self, template_storage):
        """Test that .docx extension is removed."""
        result = template_storage._sanitize_name("template.docx")
        assert result == "template"

    def test_sanitize_limits_length(self, template_storage):
        """Test that long names are truncated."""
        long_name = "a" * 100
        result = template_storage._sanitize_name(long_name)
        assert len(result) <= 50

    def test_sanitize_empty_fallback(self, template_storage):
        """Test fallback for empty result."""
        result = template_storage._sanitize_name("@#$%")
        assert result == "template"


class TestTemplateInfo:
    """Tests for TemplateInfo dataclass."""

    def test_template_info_to_dict(self, template_storage, valid_docx_content):
        """Test TemplateInfo serialization."""
        template_storage.save_template(valid_docx_content, "info-test", "step-manual")

        info = template_storage.get_template_info("info-test")
        result = info.to_dict()

        assert result["name"] == "info-test"
        assert result["is_global"] is False
        assert result["document_format"] == "step-manual"
        assert "size_bytes" in result
        assert "uploaded_at" in result

    def test_template_info_path_not_in_dict(self, template_storage, valid_docx_content):
        """Test that path is not included in dict (security)."""
        template_storage.save_template(valid_docx_content, "path-test")

        info = template_storage.get_template_info("path-test")
        result = info.to_dict()

        assert "path" not in result


class TestEnsureDirectories:
    """Tests for directory creation."""

    def test_ensure_directories_creates_user_dir(self, tmp_data_dir, test_user_id):
        """Test that ensure_directories creates user templates directory."""
        with patch("src.config.DATA_DIR", tmp_data_dir):
            with patch("src.config.USERS_DIR", tmp_data_dir / "users"):
                with patch("src.config.TEMPLATES_DIR", tmp_data_dir / "templates"):
                    from src.storage.template_storage import TemplateStorage
                    storage = TemplateStorage(test_user_id)

                    storage.ensure_directories()

                    assert storage.templates_dir.exists()
                    assert storage.global_templates_dir.exists()


class TestMetadataHandling:
    """Tests for metadata file handling."""

    def test_load_template_metadata_exists(self, template_storage, valid_docx_content):
        """Test loading metadata when it exists."""
        template_storage.save_template(valid_docx_content, "meta-test", "quick-guide")

        template_path = template_storage.templates_dir / "meta-test.docx"
        metadata = template_storage._load_template_metadata(template_path)

        assert metadata["document_format"] == "quick-guide"
        assert "uploaded_at" in metadata

    def test_load_template_metadata_not_exists(self, template_storage, valid_docx_content):
        """Test loading metadata when file doesn't exist."""
        # Create template file without metadata
        (template_storage.templates_dir / "no-meta.docx").write_bytes(valid_docx_content)

        template_path = template_storage.templates_dir / "no-meta.docx"
        metadata = template_storage._load_template_metadata(template_path)

        assert metadata == {}

    def test_load_template_metadata_corrupted(self, template_storage, valid_docx_content):
        """Test loading corrupted metadata file."""
        (template_storage.templates_dir / "corrupted.docx").write_bytes(valid_docx_content)
        (template_storage.templates_dir / "corrupted.json").write_text("not valid json {{{")

        template_path = template_storage.templates_dir / "corrupted.docx"
        metadata = template_storage._load_template_metadata(template_path)

        assert metadata == {}
