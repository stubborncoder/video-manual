"""TUI Screens."""

from .login import LoginScreen
from .dashboard import DashboardScreen
from .videos import VideosScreen
from .process_video import ProcessVideoScreen
from .manuals import ManualsScreen
from .view_manual import ViewManualScreen
from .projects import ProjectsScreen
from .project_detail import ProjectDetailScreen
from .compile_project import CompileProjectScreen

__all__ = [
    "LoginScreen",
    "DashboardScreen",
    "VideosScreen",
    "ProcessVideoScreen",
    "ManualsScreen",
    "ViewManualScreen",
    "ProjectsScreen",
    "ProjectDetailScreen",
    "CompileProjectScreen",
]
