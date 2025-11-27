"""Main Textual application for Video Manual TUI."""

from pathlib import Path
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import Footer, Header

from .screens.login import LoginScreen
from .screens.dashboard import DashboardScreen


class VideoManualApp(App):
    """Video Manual TUI Application."""

    TITLE = "Video Manual"
    SUB_TITLE = "AI-powered video documentation"

    CSS_PATH = "styles.tcss"

    BINDINGS = [
        Binding("q", "quit", "Quit", show=True, priority=True),
        Binding("d", "go_dashboard", "Dashboard", show=True),
        Binding("escape", "go_back", "Back", show=True, priority=True),
        Binding("?", "toggle_help", "Help", show=True),
    ]

    def __init__(self):
        super().__init__()
        self.current_user_id: str | None = None

    def compose(self) -> ComposeResult:
        """Compose the app layout."""
        yield Header(show_clock=True)
        yield Footer()

    def on_mount(self) -> None:
        """Called when app is mounted."""
        self.push_screen(LoginScreen())

    def action_quit(self) -> None:
        """Quit the application."""
        self.exit()

    def action_go_dashboard(self) -> None:
        """Navigate to dashboard."""
        if self.current_user_id:
            while len(self.screen_stack) > 1:
                self.pop_screen()
            self.push_screen(DashboardScreen(self.current_user_id))

    def action_go_back(self) -> None:
        """Go back to previous screen."""
        if len(self.screen_stack) > 1:
            self.pop_screen()

    def action_toggle_help(self) -> None:
        """Toggle help screen."""
        pass  # TODO: Add help screen

    def set_user(self, user_id: str) -> None:
        """Set the current user and navigate to dashboard."""
        self.current_user_id = user_id
        self.push_screen(DashboardScreen(user_id))


def run_tui():
    """Run the TUI application."""
    app = VideoManualApp()
    app.run()


if __name__ == "__main__":
    run_tui()
