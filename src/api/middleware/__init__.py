"""API middleware."""

from .admin import require_admin

__all__ = ["require_admin"]
