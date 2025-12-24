"""Custom tools for the Project Compiler Agent."""

import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List

from langchain_core.tools import tool

from ...storage.project_storage import ProjectStorage
from ...storage.user_storage import UserStorage
from ...storage.version_storage import VersionStorage
from ...storage.compilation_version_storage import CompilationVersionStorage


@tool
def analyze_project(project_id: str, user_id: str, language: str) -> Dict[str, Any]:
    """Analyze project structure and load all source manuals.

    Use this tool first to understand the project structure and load all manual contents
    before creating a merge plan.

    Args:
        project_id: The project identifier
        user_id: The user identifier
        language: Language code (e.g., 'en', 'es')

    Returns:
        Project structure with all manual contents including:
        - project: Project metadata (name, description, chapters)
        - source_manuals: List of manuals with their content and metadata
    """
    project_storage = ProjectStorage(user_id)
    user_storage = UserStorage(user_id)

    project = project_storage.get_project(project_id)
    if not project:
        return {"error": f"Project not found: {project_id}"}

    source_manuals = []

    for chapter in project.get("chapters", []):
        for manual_id in chapter.get("manuals", []):
            content = user_storage.get_doc_content(manual_id, language)
            vs = VersionStorage(user_id, manual_id)

            # Get all available languages for this manual
            available_languages = user_storage.list_doc_languages(manual_id)

            # Count sections in content
            section_count = 0
            if content:
                section_count = content.count('\n## ') + content.count('\n### ')

            source_manuals.append({
                "id": manual_id,
                "chapter_id": chapter["id"],
                "chapter_title": chapter["title"],
                "chapter_order": chapter.get("order", 0),
                "content": content,
                "version": vs.get_current_version(),
                "section_count": section_count,
                "has_content": content is not None and len(content) > 0,
                "available_languages": available_languages,
                "requested_language": language,
            })

    return {
        "project": {
            "id": project["id"],
            "name": project["name"],
            "description": project.get("description", ""),
            "chapter_count": len(project.get("chapters", [])),
            "total_manuals": len(source_manuals),
        },
        "source_manuals": source_manuals,
    }


@tool
def compile_manuals(
    project_id: str,
    user_id: str,
    language: str,
    merge_plan: Dict[str, Any],
) -> Dict[str, Any]:
    """Execute compilation based on the approved merge plan.

    This tool requires human approval before execution. It will merge multiple
    manuals into a single unified document according to the provided merge plan.

    Args:
        project_id: The project identifier
        user_id: The user identifier
        language: Language code
        merge_plan: The approved merge plan containing:
            - chapters: List of chapters with their source manuals and ordering
            - duplicates_detected: Content to remove (optional)
            - transitions_needed: Transitions between sections (optional)

    Returns:
        Dict with output_path, compiled_content, and version info
    """
    project_storage = ProjectStorage(user_id)
    user_storage = UserStorage(user_id)
    compilation_storage = CompilationVersionStorage(user_id, project_id)

    project = project_storage.get_project(project_id)
    if not project:
        return {"error": f"Project not found: {project_id}"}

    # Auto-save previous compilation before creating new one
    prev_version = compilation_storage.auto_save_before_compile()

    # Get the current compilation directory (handles migration)
    current_dir = compilation_storage.get_current_directory()
    screenshots_dir = current_dir / "screenshots"

    # Clear existing screenshots to avoid stale files
    if screenshots_dir.exists():
        shutil.rmtree(screenshots_dir)
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    # Build a lookup of manual contents, track versions, and copy screenshots
    manual_contents = {}
    source_manuals = []

    for chapter in project.get("chapters", []):
        for manual_id in chapter.get("manuals", []):
            content = user_storage.get_doc_content(manual_id, language)
            vs = VersionStorage(user_id, manual_id)
            manual_version = vs.get_current_version()

            if content:
                # Track source manual version
                source_manuals.append({
                    "manual_id": manual_id,
                    "version": manual_version,
                })

                # Copy screenshots from this manual to compiled folder
                manual_screenshots_dir = user_storage.docs_dir / manual_id / "screenshots"
                if manual_screenshots_dir.exists():
                    for img_file in manual_screenshots_dir.glob("*"):
                        if img_file.is_file():
                            # Prefix with manual_id to avoid conflicts
                            new_name = f"{manual_id}_{img_file.name}"
                            dest = screenshots_dir / new_name
                            shutil.copy2(img_file, dest)

                            # Update image references in content
                            # Match patterns like ![...](../screenshots/filename.png) or ![...](screenshots/filename.png)
                            old_patterns = [
                                f"](../screenshots/{img_file.name})",
                                f"](screenshots/{img_file.name})",
                                f"]({img_file.name})",
                            ]
                            new_ref = f"](screenshots/{new_name})"
                            for old_pattern in old_patterns:
                                content = content.replace(old_pattern, new_ref)

                manual_contents[manual_id] = content

    # Build compiled content following the plan
    compiled_sections = []

    # Add project header
    compiled_sections.append(f"# {project['name']}\n")
    if project.get('description'):
        compiled_sections.append(f"*{project['description']}*\n")
    compiled_sections.append(f"*Compiled: {datetime.now().strftime('%Y-%m-%d %H:%M')}*\n")
    compiled_sections.append("---\n")

    # Process chapters according to merge plan
    plan_chapters = merge_plan.get("chapters", [])

    for chapter_info in plan_chapters:
        chapter_title = chapter_info.get("title", "Untitled Chapter")
        sources = chapter_info.get("sources", [])
        merge_strategy = chapter_info.get("merge_strategy", "sequential")

        # Add chapter heading
        compiled_sections.append(f"\n## {chapter_title}\n")

        if chapter_info.get("notes"):
            compiled_sections.append(f"*{chapter_info['notes']}*\n")

        # Add content from sources
        for source in sources:
            # Parse source reference (e.g., "manual-1:sections-1-2" or just "manual-1")
            if ":" in source:
                manual_id, section_spec = source.split(":", 1)
            else:
                manual_id = source
                section_spec = None

            content = manual_contents.get(manual_id, "")
            if content:
                # For now, include full content (section filtering can be added later)
                # Remove the top-level heading from manual content to avoid duplicate titles
                lines = content.split('\n')
                filtered_lines = []
                skip_first_h1 = True
                for line in lines:
                    if skip_first_h1 and line.startswith('# '):
                        skip_first_h1 = False
                        continue
                    filtered_lines.append(line)

                compiled_sections.append('\n'.join(filtered_lines))
                compiled_sections.append("\n")

    # Handle duplicates removal (noted in compilation report)
    duplicates = merge_plan.get("duplicates_detected", [])

    # Handle transitions
    transitions = merge_plan.get("transitions_needed", [])

    # Combine all sections
    compiled_content = "\n".join(compiled_sections)

    # Save compiled markdown to current directory
    output_file = current_dir / f"manual_{language}.md"
    output_file.write_text(compiled_content, encoding='utf-8')

    # Save compilation report
    report = {
        "compiled_at": datetime.now().isoformat(),
        "language": language,
        "merge_plan": merge_plan,
        "source_manuals": source_manuals,
        "source_manual_count": len(manual_contents),
        "duplicates_removed": len(duplicates),
        "transitions_added": len(transitions),
    }
    report_file = current_dir / "compilation.json"
    report_file.write_text(json.dumps(report, indent=2), encoding='utf-8')

    # Save compilation to version history
    new_version = compilation_storage.save_compilation(
        languages=[language],
        source_manuals=source_manuals,
        merge_plan=merge_plan,
        notes=f"Compiled {len(manual_contents)} manuals",
    )

    return {
        "output_path": str(output_file),
        "compiled_content": compiled_content,
        "version": new_version,
        "previous_version_saved": prev_version,
        "source_manual_count": len(manual_contents),
        "source_manuals": source_manuals,
        "duplicates_removed": len(duplicates),
        "transitions_added": len(transitions),
    }


def _count_sections(content: str) -> int:
    """Count the number of sections in markdown content."""
    if not content:
        return 0
    return content.count('\n## ') + content.count('\n### ')
