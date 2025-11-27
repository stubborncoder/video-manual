"""Login screen for user authentication."""

from textual.app import ComposeResult
from textual.containers import Container, Vertical, Center
from textual.screen import Screen
from textual.widgets import Button, Input, Label, Static
from textual.validation import Length


class LoginScreen(Screen):
    """Login screen for user identification."""

    CSS = """
    LoginScreen {
        align: center middle;
    }

    #login-container {
        width: 60;
        height: auto;
        border: solid $primary;
        padding: 2 4;
    }

    #login-title {
        text-align: center;
        text-style: bold;
        color: $primary;
        margin-bottom: 1;
    }

    #login-subtitle {
        text-align: center;
        color: $text-muted;
        margin-bottom: 2;
    }

    .field-label {
        margin-top: 1;
        margin-bottom: 0;
    }

    #user-input {
        margin-bottom: 1;
    }

    #login-button {
        margin-top: 2;
        width: 100%;
    }

    #error-message {
        color: $error;
        text-align: center;
        margin-top: 1;
        display: none;
    }

    #error-message.visible {
        display: block;
    }

    #existing-users {
        margin-top: 2;
        padding-top: 1;
        border-top: solid $surface-lighten-2;
    }

    #existing-users-label {
        color: $text-muted;
        margin-bottom: 1;
    }

    .user-button {
        width: 100%;
        margin-bottom: 1;
    }
    """

    def compose(self) -> ComposeResult:
        """Compose the login screen."""
        with Center():
            with Container(id="login-container"):
                yield Static("Video Manual", id="login-title")
                yield Static("Enter your user ID to continue", id="login-subtitle")

                yield Label("User ID", classes="field-label")
                yield Input(
                    placeholder="Enter user ID...",
                    id="user-input",
                    validators=[Length(minimum=1, failure_description="User ID required")],
                )

                yield Button("Login", id="login-button", variant="primary")
                yield Static("", id="error-message")

                with Vertical(id="existing-users"):
                    yield Label("Or select existing user:", id="existing-users-label")
                    # Will be populated dynamically

    def on_mount(self) -> None:
        """Focus the input field and load existing users."""
        self.query_one("#user-input", Input).focus()
        self._load_existing_users()

    def _load_existing_users(self) -> None:
        """Load and display existing users."""
        from pathlib import Path

        users_dir = Path("data/users")
        if users_dir.exists():
            users = [d.name for d in users_dir.iterdir() if d.is_dir()]
            container = self.query_one("#existing-users", Vertical)

            for user_id in sorted(users)[:5]:  # Show max 5 users
                button = Button(user_id, classes="user-button", id=f"user-{user_id}")
                container.mount(button)

            if not users:
                container.display = False

    def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button presses."""
        if event.button.id == "login-button":
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
            self._show_error("Please enter a user ID")
            return

        self._login_user(user_id)

    def _login_user(self, user_id: str) -> None:
        """Login with the given user ID."""
        from ...storage.user_storage import UserStorage

        # Ensure user folders exist
        storage = UserStorage(user_id)
        storage.ensure_user_folders()

        # Set user in app and navigate to dashboard
        self.app.set_user(user_id)

    def _show_error(self, message: str) -> None:
        """Show error message."""
        error_widget = self.query_one("#error-message", Static)
        error_widget.update(message)
        error_widget.add_class("visible")
