"""Tests for Guide Agent tools.

Tests the enhanced UI control tools that provide READ-ONLY
demonstration capabilities for the guide agent.
"""

import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path


@pytest.fixture
def guide_tools(tmp_data_dir: Path, test_user_id: str):
    """Create guide tools with mocked storage."""
    with patch("src.config.USERS_DIR", tmp_data_dir / "users"):
        with patch("src.storage.user_storage.USERS_DIR", tmp_data_dir / "users"):
            with patch("src.agents.guide_agent.tools.GITHUB_TOKEN", None):
                with patch("src.agents.guide_agent.tools.GITHUB_REPO", None):
                    from src.agents.guide_agent.tools import create_guide_tools
                    tools = create_guide_tools(test_user_id)
                    # Convert to dict for easier access
                    return {tool.name: tool for tool in tools}


class TestShowDropdown:
    """Tests for show_dropdown tool."""

    def test_returns_correct_action(self, guide_tools):
        """Should return show_dropdown action with target."""
        result = guide_tools["show_dropdown"].invoke({
            "element_id": "manual-actions-123"
        })

        assert result["action"] == "show_dropdown"
        assert result["target"] == "manual-actions-123"

    def test_default_duration(self, guide_tools):
        """Should use default duration of 5000ms."""
        result = guide_tools["show_dropdown"].invoke({
            "element_id": "test-dropdown"
        })

        assert result["duration"] == 5000

    def test_custom_duration(self, guide_tools):
        """Should accept custom duration."""
        result = guide_tools["show_dropdown"].invoke({
            "element_id": "test-dropdown",
            "duration_ms": 3000
        })

        assert result["duration"] == 3000

    def test_various_element_ids(self, guide_tools):
        """Should work with various element ID patterns."""
        test_ids = [
            "manual-actions-abc123",
            "video-actions-my-video.mp4",
            "project-actions-456",
            "export-format-selector",
            "language-selector",
        ]

        for element_id in test_ids:
            result = guide_tools["show_dropdown"].invoke({
                "element_id": element_id
            })
            assert result["target"] == element_id


class TestShowModal:
    """Tests for show_modal tool."""

    def test_returns_correct_action(self, guide_tools):
        """Should return show_modal action with title and content."""
        result = guide_tools["show_modal"].invoke({
            "title": "Test Title",
            "content": "Test content"
        })

        assert result["action"] == "show_modal"
        assert result["title"] == "Test Title"
        assert result["content"] == "Test content"

    def test_default_type(self, guide_tools):
        """Should use 'info' as default modal type."""
        result = guide_tools["show_modal"].invoke({
            "title": "Test",
            "content": "Content"
        })

        assert result["modal_type"] == "info"

    def test_custom_type(self, guide_tools):
        """Should accept custom modal types."""
        types = ["info", "tip", "warning", "success"]

        for modal_type in types:
            result = guide_tools["show_modal"].invoke({
                "title": "Test",
                "content": "Content",
                "modal_type": modal_type
            })
            assert result["modal_type"] == modal_type

    def test_default_auto_close(self, guide_tools):
        """Should use 0 as default auto_close (manual close)."""
        result = guide_tools["show_modal"].invoke({
            "title": "Test",
            "content": "Content"
        })

        assert result["auto_close"] == 0

    def test_custom_auto_close(self, guide_tools):
        """Should accept custom auto_close duration."""
        result = guide_tools["show_modal"].invoke({
            "title": "Test",
            "content": "Content",
            "auto_close_ms": 5000
        })

        assert result["auto_close"] == 5000

    def test_markdown_content(self, guide_tools):
        """Should preserve markdown formatting in content."""
        markdown_content = """
**Bold text** and _italic_

- Bullet point 1
- Bullet point 2

1. Numbered item
2. Another item

`code snippet`
"""
        result = guide_tools["show_modal"].invoke({
            "title": "Markdown Test",
            "content": markdown_content
        })

        assert result["content"] == markdown_content


class TestClickElement:
    """Tests for click_element tool."""

    def test_returns_correct_action(self, guide_tools):
        """Should return click_element action with target."""
        result = guide_tools["click_element"].invoke({
            "element_id": "menu-trigger"
        })

        assert result["action"] == "click_element"
        assert result["target"] == "menu-trigger"

    def test_various_element_ids(self, guide_tools):
        """Should work with various element IDs."""
        test_ids = [
            "accordion-header",
            "tab-button-1",
            "tooltip-trigger",
            "collapse-section",
        ]

        for element_id in test_ids:
            result = guide_tools["click_element"].invoke({
                "element_id": element_id
            })
            assert result["target"] == element_id


class TestStartWorkflow:
    """Tests for start_workflow tool."""

    def test_returns_correct_action(self, guide_tools):
        """Should return start_workflow action with title and steps."""
        steps = [
            {
                "title": "Step 1",
                "description": "First step"
            }
        ]

        result = guide_tools["start_workflow"].invoke({
            "workflow_title": "Test Workflow",
            "steps": steps
        })

        assert result["action"] == "start_workflow"
        assert result["title"] == "Test Workflow"
        assert result["steps"] == steps

    def test_multiple_steps(self, guide_tools):
        """Should handle multiple steps."""
        steps = [
            {"title": "Step 1", "description": "First step"},
            {"title": "Step 2", "description": "Second step"},
            {"title": "Step 3", "description": "Third step"},
        ]

        result = guide_tools["start_workflow"].invoke({
            "workflow_title": "Multi-Step",
            "steps": steps
        })

        assert len(result["steps"]) == 3
        assert result["steps"][0]["title"] == "Step 1"
        assert result["steps"][2]["title"] == "Step 3"

    def test_step_with_highlight(self, guide_tools):
        """Should preserve highlight in steps."""
        steps = [
            {
                "title": "Click Upload",
                "description": "Click the upload button",
                "highlight": "upload-video-btn"
            }
        ]

        result = guide_tools["start_workflow"].invoke({
            "workflow_title": "Upload Flow",
            "steps": steps
        })

        assert result["steps"][0]["highlight"] == "upload-video-btn"

    def test_step_with_navigate(self, guide_tools):
        """Should preserve navigate in steps."""
        steps = [
            {
                "title": "Go to Videos",
                "description": "Navigate to videos page",
                "navigate": "/dashboard/videos"
            }
        ]

        result = guide_tools["start_workflow"].invoke({
            "workflow_title": "Navigation Flow",
            "steps": steps
        })

        assert result["steps"][0]["navigate"] == "/dashboard/videos"

    def test_step_with_highlight_and_navigate(self, guide_tools):
        """Should preserve both highlight and navigate in steps."""
        steps = [
            {
                "title": "Complete Step",
                "description": "Full step with all options",
                "highlight": "nav-videos",
                "navigate": "/dashboard/videos"
            }
        ]

        result = guide_tools["start_workflow"].invoke({
            "workflow_title": "Complete Flow",
            "steps": steps
        })

        assert result["steps"][0]["highlight"] == "nav-videos"
        assert result["steps"][0]["navigate"] == "/dashboard/videos"

    def test_empty_steps(self, guide_tools):
        """Should handle empty steps array."""
        result = guide_tools["start_workflow"].invoke({
            "workflow_title": "Empty Workflow",
            "steps": []
        })

        assert result["steps"] == []

    def test_markdown_in_description(self, guide_tools):
        """Should preserve markdown in step descriptions."""
        steps = [
            {
                "title": "Markdown Step",
                "description": "Click the **Upload Video** button to _start_"
            }
        ]

        result = guide_tools["start_workflow"].invoke({
            "workflow_title": "Markdown Flow",
            "steps": steps
        })

        assert "**Upload Video**" in result["steps"][0]["description"]


class TestHighlightElement:
    """Tests for highlight_element tool."""

    def test_returns_correct_action(self, guide_tools):
        """Should return highlight action with target."""
        result = guide_tools["highlight_element"].invoke({
            "element_id": "upload-video-btn"
        })

        assert result["action"] == "highlight"
        assert result["target"] == "upload-video-btn"

    def test_default_duration(self, guide_tools):
        """Should use default duration of 5000ms."""
        result = guide_tools["highlight_element"].invoke({
            "element_id": "test-element"
        })

        assert result["duration"] == 5000

    def test_custom_duration(self, guide_tools):
        """Should accept custom duration."""
        result = guide_tools["highlight_element"].invoke({
            "element_id": "test-element",
            "duration_ms": 10000
        })

        assert result["duration"] == 10000


class TestNavigateToPage:
    """Tests for navigate_to_page tool."""

    def test_returns_correct_action(self, guide_tools):
        """Should return navigate action with path."""
        result = guide_tools["navigate_to_page"].invoke({
            "path": "/dashboard/videos"
        })

        assert result["action"] == "navigate"
        assert result["to"] == "/dashboard/videos"

    def test_various_paths(self, guide_tools):
        """Should work with various page paths."""
        paths = [
            "/dashboard",
            "/dashboard/videos",
            "/dashboard/manuals",
            "/dashboard/projects",
            "/dashboard/projects/abc123",
        ]

        for path in paths:
            result = guide_tools["navigate_to_page"].invoke({
                "path": path
            })
            assert result["to"] == path


class TestToolsList:
    """Tests for the complete tools list returned by create_guide_tools."""

    def test_all_ui_control_tools_present(self, guide_tools):
        """Should include all enhanced UI control tools."""
        expected_tools = [
            "show_dropdown",
            "show_modal",
            "click_element",
            "start_workflow",
        ]

        for tool_name in expected_tools:
            assert tool_name in guide_tools, f"Missing tool: {tool_name}"

    def test_all_data_query_tools_present(self, guide_tools):
        """Should include all data query tools."""
        expected_tools = [
            "get_user_manuals",
            "get_user_videos",
            "get_user_projects",
            "get_page_elements",
        ]

        for tool_name in expected_tools:
            assert tool_name in guide_tools, f"Missing tool: {tool_name}"

    def test_all_action_tools_present(self, guide_tools):
        """Should include all action tools."""
        expected_tools = [
            "highlight_element",
            "navigate_to_page",
        ]

        for tool_name in expected_tools:
            assert tool_name in guide_tools, f"Missing tool: {tool_name}"

    def test_github_issue_tools_present(self, guide_tools):
        """Should include GitHub issue tools."""
        expected_tools = [
            "create_github_issue",
            "get_issues",
            "add_issue_comment",
            "get_issue_details",
        ]

        for tool_name in expected_tools:
            assert tool_name in guide_tools, f"Missing tool: {tool_name}"

    def test_total_tool_count(self, guide_tools):
        """Should have expected total number of tools."""
        # 4 data query + 2 action + 4 UI control + 4 github = 14
        expected_count = 14
        assert len(guide_tools) == expected_count
