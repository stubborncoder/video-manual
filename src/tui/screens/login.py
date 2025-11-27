"""Login screen for user authentication."""

from textual.app import ComposeResult
from textual.containers import Container, Vertical
from textual.screen import Screen
from textual.widgets import Button, Input, Label, Static
from textual.validation import Length


class LoginScreen(Screen):
    """Login screen for user identification."""

    def compose(self) -> ComposeResult:
        """Compose the login screen."""
        with Container(id="login-box"):
            with Vertical(id="login-header"):
                yield Static("Video Manual", id="app-title")
                yield Static("AI-powered video documentation", id="app-subtitle")

            with Vertical(id="login-form"):
                yield Label("User ID")
                yield Input(
                    placeholder="Enter your user ID...",
                    id="user-input",
                    validators=[Length(minimum=1, failure_description="User ID required")],
                )
                yield Button("Login", id="login-btn", variant="primary")

            with Vertical(id="user-list"):
                yield Static("Quick Select", id="user-list-title")

    def on_mount(self) -> None:
        """Focus the input field and load existing users."""
        self.query_one("#user-input", Input).focus()
        self._load_existing_users()

    def _load_existing_users(self) -> None:
        """Load and display existing users."""
        from pathlib import Path

        users_dir = Path("data/users")
        container = self.query_one("#user-list", Vertical)

        if users_dir.exists():
            users = [d.name for d in users_dir.iterdir() if d.is_dir()]
            for user_id in sorted(users)[:5]:
                button = Button(user_id, classes="user-btn", id=f"user-{user_id}")
                container.mount(button)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        if event.button.id == "login-btn":
            self._do_login()
        elif event.button.id and event.button.id.startswith("user-"):
            user_id = event.button.id.replace("user-", "")
            self._login_user(user_id)

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle enter key in input."""
        if event.input.id == "user-input":
            self._do_login()

    def _do_login(self) -> None:
        """Process login from input field."""
        input_widget = self.query_one("#user-input", Input)
        user_id = input_widget.value.strip()

        if not user_id:
            self.notify("Please enter a user ID", severity="error")
            return

        self._login_user(user_id)

    def _login_user(self, user_id: str) -> None:
        """Login with the given user ID."""
        from ...storage.user_storage import UserStorage

        storage = UserStorage(user_id)
        storage.ensure_user_folders()
        self.app.set_user(user_id)
