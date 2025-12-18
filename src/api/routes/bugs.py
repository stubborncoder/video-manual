"""Bug tracker routes - GitHub Issues integration."""

from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..dependencies import CurrentUser, CurrentUserInfo
from ...config import GITHUB_TOKEN, GITHUB_REPO

router = APIRouter(prefix="/bugs", tags=["bugs"])


# ===========================================
# Pydantic Models
# ===========================================


class BugSummary(BaseModel):
    """Summary of a bug/issue for list view."""

    number: int
    title: str
    state: str
    url: str
    created_at: str
    labels: list[str]
    comments_count: int


class BugListResponse(BaseModel):
    """Response for bug list endpoint."""

    issues: list[BugSummary]
    count: int


class CommentInfo(BaseModel):
    """Comment information."""

    id: int
    body: str
    author: str
    created_at: str


class BugDetail(BaseModel):
    """Full bug/issue details with comments."""

    number: int
    title: str
    body: str
    state: str
    url: str
    created_at: str
    updated_at: str
    labels: list[str]
    author: str
    comments: list[CommentInfo]


class CommentRequest(BaseModel):
    """Request to add a comment."""

    body: str


class CommentResponse(BaseModel):
    """Response after adding a comment."""

    id: int
    url: str
    message: str


# ===========================================
# Helper Functions
# ===========================================


def get_github_headers() -> dict[str, str]:
    """Get headers for GitHub API requests."""
    return {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def check_github_config():
    """Check if GitHub is configured."""
    if not GITHUB_TOKEN or not GITHUB_REPO:
        raise HTTPException(
            status_code=503,
            detail="GitHub integration not configured. Please set GITHUB_TOKEN and GITHUB_REPO.",
        )


# ===========================================
# Routes
# ===========================================


@router.get("")
async def list_bugs(
    user_id: CurrentUser,
    status: str = "open",
    search: str | None = None,
) -> BugListResponse:
    """List all bug reports from GitHub Issues.

    Args:
        status: Filter by issue status - "open", "closed", or "all"
        search: Optional search term to filter by title/body
    """
    check_github_config()

    try:
        params: dict[str, Any] = {
            "labels": "vdocs:user-report",
            "state": status if status in ("open", "closed", "all") else "open",
            "per_page": 50,
            "sort": "created",
            "direction": "desc",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/issues",
                headers=get_github_headers(),
                params=params,
            )
            response.raise_for_status()
            issues = response.json()

            # Filter by search term if provided
            if search:
                search_lower = search.lower()
                issues = [
                    i
                    for i in issues
                    if search_lower in i["title"].lower()
                    or search_lower in (i.get("body") or "").lower()
                ]

            return BugListResponse(
                count=len(issues),
                issues=[
                    BugSummary(
                        number=i["number"],
                        title=i["title"],
                        url=i["html_url"],
                        state=i["state"],
                        created_at=i["created_at"],
                        labels=[label["name"] for label in i.get("labels", [])],
                        comments_count=i.get("comments", 0),
                    )
                    for i in issues
                ],
            )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"GitHub API error: {e.response.text[:200]}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch issues: {str(e)}")


@router.get("/{issue_number}")
async def get_bug(
    issue_number: int,
    user_id: CurrentUser,
) -> BugDetail:
    """Get detailed information about a specific bug/issue.

    Args:
        issue_number: The GitHub issue number
    """
    check_github_config()

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get issue details
            issue_response = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/issues/{issue_number}",
                headers=get_github_headers(),
            )
            if issue_response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Issue #{issue_number} not found")
            issue_response.raise_for_status()
            issue = issue_response.json()

            # Get comments
            comments_response = await client.get(
                f"https://api.github.com/repos/{GITHUB_REPO}/issues/{issue_number}/comments",
                headers=get_github_headers(),
                params={"per_page": 100},
            )
            comments_response.raise_for_status()
            comments = comments_response.json()

            return BugDetail(
                number=issue["number"],
                title=issue["title"],
                body=issue.get("body") or "",
                state=issue["state"],
                url=issue["html_url"],
                created_at=issue["created_at"],
                updated_at=issue["updated_at"],
                labels=[label["name"] for label in issue.get("labels", [])],
                author=issue["user"]["login"],
                comments=[
                    CommentInfo(
                        id=c["id"],
                        body=c["body"],
                        author=c["user"]["login"],
                        created_at=c["created_at"],
                    )
                    for c in comments
                ],
            )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"GitHub API error: {e.response.text[:200]}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch issue: {str(e)}")


@router.post("/{issue_number}/comments")
async def add_comment(
    issue_number: int,
    request: CommentRequest,
    user_info: CurrentUserInfo,
) -> CommentResponse:
    """Add a comment to an existing issue.

    Args:
        issue_number: The GitHub issue number
        request: Comment body
    """
    check_github_config()

    # Add user context to comment
    user_context = f"*User ID: `{user_info.user_id}`*"
    if user_info.email:
        user_context += f"\n*Email: `{user_info.email}`*"

    body = f"""{request.body}

---
*Comment added via vDocs*
{user_context}
"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://api.github.com/repos/{GITHUB_REPO}/issues/{issue_number}/comments",
                headers=get_github_headers(),
                json={"body": body},
            )
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail=f"Issue #{issue_number} not found")
            response.raise_for_status()
            data = response.json()

            return CommentResponse(
                id=data["id"],
                url=data["html_url"],
                message=f"Comment added to issue #{issue_number}",
            )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"GitHub API error: {e.response.text[:200]}",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")
