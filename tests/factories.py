"""Test data factories for generating test objects."""

import uuid
from datetime import datetime
from typing import Any, Optional

import factory


class VideoMetadataFactory(factory.Factory):
    """Factory for creating video metadata."""

    class Meta:
        model = dict

    filename = factory.LazyFunction(lambda: f"video_{uuid.uuid4().hex[:8]}.mp4")
    duration = factory.Faker("pyfloat", min_value=10.0, max_value=600.0)
    width = 1920
    height = 1080
    fps = 30.0
    size_bytes = factory.Faker("pyint", min_value=100000, max_value=100000000)


class DocMetadataFactory(factory.Factory):
    """Factory for creating document metadata."""

    class Meta:
        model = dict

    id = factory.LazyFunction(lambda: f"doc_{uuid.uuid4().hex[:8]}")
    title = factory.Faker("sentence", nb_words=4)
    source_video = factory.LazyFunction(lambda: f"video_{uuid.uuid4().hex[:8]}.mp4")
    language = "en"
    document_format = "step-manual"
    target_audience = factory.Faker("sentence", nb_words=3)
    target_objective = factory.Faker("sentence", nb_words=5)
    created_at = factory.LazyFunction(lambda: datetime.now().isoformat())


class ProjectFactory(factory.Factory):
    """Factory for creating project data."""

    class Meta:
        model = dict

    id = factory.LazyFunction(lambda: f"proj_{uuid.uuid4().hex[:8]}")
    name = factory.Faker("company")
    description = factory.Faker("paragraph")
    created_at = factory.LazyFunction(lambda: datetime.now().isoformat())
    chapters = factory.LazyFunction(list)
    sections = factory.LazyFunction(list)
    manuals = factory.LazyFunction(list)


class ChapterFactory(factory.Factory):
    """Factory for creating chapter data."""

    class Meta:
        model = dict

    id = factory.LazyFunction(lambda: f"chap_{uuid.uuid4().hex[:8]}")
    title = factory.Faker("sentence", nb_words=3)
    description = factory.Faker("sentence", nb_words=10)
    order = factory.Sequence(lambda n: n)


class UserFactory(factory.Factory):
    """Factory for creating user data."""

    class Meta:
        model = dict

    id = factory.LazyFunction(lambda: f"user_{uuid.uuid4().hex[:8]}")
    email = factory.Faker("email")
    display_name = factory.Faker("name")
    role = "user"
    tier = "free"
    tester = False
    created_at = factory.LazyFunction(lambda: datetime.now().isoformat())


class JobFactory(factory.Factory):
    """Factory for creating job data."""

    class Meta:
        model = dict

    id = factory.LazyFunction(lambda: f"job_{uuid.uuid4().hex[:8]}")
    user_id = factory.LazyFunction(lambda: f"user_{uuid.uuid4().hex[:8]}")
    video_name = factory.LazyFunction(lambda: f"video_{uuid.uuid4().hex[:8]}.mp4")
    doc_id = None
    status = "pending"
    current_node = None
    node_index = None
    total_nodes = None
    error = None
    started_at = None
    completed_at = None
    seen = False


class TemplateFactory(factory.Factory):
    """Factory for creating template data."""

    class Meta:
        model = dict

    id = factory.LazyFunction(lambda: f"tmpl_{uuid.uuid4().hex[:8]}")
    name = factory.Faker("word")
    filename = factory.LazyFunction(lambda: f"template_{uuid.uuid4().hex[:8]}.docx")
    description = factory.Faker("sentence")
    document_formats = factory.LazyFunction(lambda: ["step-manual"])
    created_at = factory.LazyFunction(lambda: datetime.now().isoformat())


class EvaluationFactory(factory.Factory):
    """Factory for creating evaluation data."""

    class Meta:
        model = dict

    doc_id = factory.LazyFunction(lambda: f"doc_{uuid.uuid4().hex[:8]}")
    language = "en"
    overall_score = factory.Faker("pyint", min_value=1, max_value=10)
    summary = factory.Faker("paragraph")
    strengths = factory.LazyFunction(lambda: ["Clear instructions", "Good screenshots"])
    areas_for_improvement = factory.LazyFunction(lambda: ["Add more examples"])
    recommendations = factory.LazyFunction(lambda: ["Consider adding a glossary"])
    evaluated_at = factory.LazyFunction(lambda: datetime.now().isoformat())


# Helper functions for creating test data
def create_markdown_content(
    title: str = "Test Manual",
    num_steps: int = 3,
    with_screenshots: bool = True,
) -> str:
    """Create sample markdown content for testing."""
    lines = [f"# {title}", "", "## Introduction", "This is a test manual.", ""]

    for i in range(1, num_steps + 1):
        lines.append(f"## Step {i}: Step Title {i}")
        lines.append(f"Description for step {i}.")
        lines.append("")
        if with_screenshots:
            lines.append(f"![Screenshot](screenshots/step{i}.png)")
            lines.append("")

    return "\n".join(lines)


def create_video_bytes(size: int = 1024) -> bytes:
    """Create fake video bytes for upload testing."""
    # Return random bytes that look like a minimal MP4 header
    header = b'\x00\x00\x00\x1c\x66\x74\x79\x70\x69\x73\x6f\x6d'
    return header + b'\x00' * (size - len(header))


def create_docx_bytes() -> bytes:
    """Create minimal DOCX bytes for template testing."""
    # DOCX files are ZIP archives, so we create a minimal valid ZIP
    import io
    import zipfile

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Minimal DOCX structure
        zf.writestr('[Content_Types].xml', '''<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>''')
        zf.writestr('_rels/.rels', '''<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>''')
        zf.writestr('word/document.xml', '''<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>Test Template</w:t></w:r></w:p></w:body>
</w:document>''')

    return buffer.getvalue()
