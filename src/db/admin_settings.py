"""Admin settings service for global configuration."""

import json
from datetime import datetime
from typing import Any, Optional

from .database import get_connection
from ..core.models import (
    TaskType,
    DEFAULT_MODELS,
    MODELS_BY_TASK,
    is_valid_model_for_task,
)


# Setting keys for model configuration
SETTING_VIDEO_ANALYSIS_MODEL = "model_video_analysis"
SETTING_MANUAL_GENERATION_MODEL = "model_manual_generation"
SETTING_MANUAL_EVALUATION_MODEL = "model_manual_evaluation"
SETTING_MANUAL_EDITING_MODEL = "model_manual_editing"

# Map task types to setting keys
TASK_TO_SETTING_KEY: dict[TaskType, str] = {
    TaskType.VIDEO_ANALYSIS: SETTING_VIDEO_ANALYSIS_MODEL,
    TaskType.MANUAL_GENERATION: SETTING_MANUAL_GENERATION_MODEL,
    TaskType.MANUAL_EVALUATION: SETTING_MANUAL_EVALUATION_MODEL,
    TaskType.MANUAL_EDITING: SETTING_MANUAL_EDITING_MODEL,
}


class AdminSettings:
    """Service for managing admin settings."""

    @staticmethod
    def get(key: str) -> Optional[str]:
        """Get a setting value by key.

        Args:
            key: Setting key

        Returns:
            Setting value or None if not found
        """
        with get_connection() as conn:
            cursor = conn.execute(
                "SELECT value FROM admin_settings WHERE key = ?",
                (key,),
            )
            row = cursor.fetchone()
            return row["value"] if row else None

    @staticmethod
    def set(key: str, value: str, updated_by: Optional[str] = None) -> None:
        """Set a setting value.

        Args:
            key: Setting key
            value: Setting value
            updated_by: User ID who made the change
        """
        with get_connection() as conn:
            conn.execute(
                """
                INSERT INTO admin_settings (key, value, updated_at, updated_by)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at,
                    updated_by = excluded.updated_by
                """,
                (key, value, datetime.now(), updated_by),
            )

    @staticmethod
    def get_all() -> dict[str, Any]:
        """Get all settings as a dictionary.

        Returns:
            Dict of all settings
        """
        with get_connection() as conn:
            cursor = conn.execute(
                "SELECT key, value, updated_at, updated_by FROM admin_settings"
            )
            settings = {}
            for row in cursor.fetchall():
                settings[row["key"]] = {
                    "value": row["value"],
                    "updated_at": row["updated_at"],
                    "updated_by": row["updated_by"],
                }
            return settings

    @staticmethod
    def delete(key: str) -> bool:
        """Delete a setting.

        Args:
            key: Setting key

        Returns:
            True if setting was deleted
        """
        with get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM admin_settings WHERE key = ?",
                (key,),
            )
            return cursor.rowcount > 0

    # ============================================
    # MODEL CONFIGURATION HELPERS
    # ============================================

    @staticmethod
    def get_model_for_task(task: TaskType) -> str:
        """Get the configured model for a task type.

        Args:
            task: The task type

        Returns:
            Model ID (from config or default)
        """
        setting_key = TASK_TO_SETTING_KEY.get(task)
        if setting_key:
            configured = AdminSettings.get(setting_key)
            if configured and is_valid_model_for_task(configured, task):
                return configured

        # Fall back to default
        return DEFAULT_MODELS.get(task, "gemini-2.5-pro")

    @staticmethod
    def set_model_for_task(
        task: TaskType,
        model_id: str,
        updated_by: Optional[str] = None
    ) -> bool:
        """Set the model for a task type.

        Args:
            task: The task type
            model_id: The model ID to use
            updated_by: User ID who made the change

        Returns:
            True if model was set successfully
        """
        # Validate model is allowed for this task
        if not is_valid_model_for_task(model_id, task):
            return False

        setting_key = TASK_TO_SETTING_KEY.get(task)
        if setting_key:
            AdminSettings.set(setting_key, model_id, updated_by)
            return True
        return False

    @staticmethod
    def get_all_model_settings() -> dict[str, str]:
        """Get all model settings with defaults.

        Returns:
            Dict mapping task type to model ID
        """
        return {
            "video_analysis": AdminSettings.get_model_for_task(TaskType.VIDEO_ANALYSIS),
            "manual_generation": AdminSettings.get_model_for_task(TaskType.MANUAL_GENERATION),
            "manual_evaluation": AdminSettings.get_model_for_task(TaskType.MANUAL_EVALUATION),
            "manual_editing": AdminSettings.get_model_for_task(TaskType.MANUAL_EDITING),
        }

    @staticmethod
    def set_all_model_settings(
        settings: dict[str, str],
        updated_by: Optional[str] = None
    ) -> dict[str, bool]:
        """Set multiple model settings at once.

        Args:
            settings: Dict mapping task type to model ID
            updated_by: User ID who made the change

        Returns:
            Dict mapping task type to success status
        """
        results = {}
        task_map = {
            "video_analysis": TaskType.VIDEO_ANALYSIS,
            "manual_generation": TaskType.MANUAL_GENERATION,
            "manual_evaluation": TaskType.MANUAL_EVALUATION,
            "manual_editing": TaskType.MANUAL_EDITING,
        }

        for key, model_id in settings.items():
            task = task_map.get(key)
            if task:
                results[key] = AdminSettings.set_model_for_task(task, model_id, updated_by)
            else:
                results[key] = False

        return results
