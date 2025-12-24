"""Token usage tracking service for LLM API calls."""

from datetime import datetime, date
from typing import Optional

from .database import get_connection


# Model pricing (USD per 1M tokens) - as of Dec 2025
# Sources:
# - Anthropic: https://costgoat.com/pricing/claude-api
# - Google: https://ai.google.dev/gemini-api/docs/pricing
MODEL_PRICING = {
    # ==================== Google Gemini models ====================
    # Gemini 3 Pro Preview - $2.00/$12.00 (≤200K tokens)
    "gemini-3-pro-preview": {
        "input": 2.00,
        "output": 12.00,
        "cached_input": 0.20,  # ~10% of input price
    },
    # Gemini 2.5 Pro - $1.25/$10.00 (≤200K tokens)
    "gemini-2.5-pro": {
        "input": 1.25,
        "output": 10.00,
        "cached_input": 0.125,  # 10% of input price
    },
    # Gemini 2.5 Flash - $0.30/$2.50
    "gemini-2.5-flash": {
        "input": 0.30,
        "output": 2.50,
        "cached_input": 0.03,  # 10% of input price
    },
    # Gemini 2.0 Flash - $0.10/$0.40
    "gemini-2.0-flash": {
        "input": 0.10,
        "output": 0.40,
        "cached_input": 0.025,
    },
    # Gemini 2.0 Flash Experimental - Free tier
    "gemini-2.0-flash-exp": {
        "input": 0.00,
        "output": 0.00,
        "cached_input": 0.00,
    },

    # ==================== Anthropic Claude models ====================
    # Cache pricing: write = 1.25x input, read = 0.1x input
    # Claude Opus 4.5 - $5.00/$25.00
    "claude-opus-4-5": {
        "input": 5.00,
        "output": 25.00,
        "cache_write": 6.25,   # 1.25x input
        "cache_read": 0.50,    # 0.1x input
    },
    # Claude Sonnet 4.5 - $3.00/$15.00
    "claude-sonnet-4-5": {
        "input": 3.00,
        "output": 15.00,
        "cache_write": 3.75,   # 1.25x input
        "cache_read": 0.30,    # 0.1x input
    },
    # Claude Haiku 4.5 - $1.00/$5.00
    "claude-haiku-4-5": {
        "input": 1.00,
        "output": 5.00,
        "cache_write": 1.25,   # 1.25x input
        "cache_read": 0.10,    # 0.1x input
    },
}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    cached_tokens: int = 0,
    cache_creation_tokens: int = 0,
    cache_read_tokens: int = 0,
) -> float:
    """Calculate total cost accounting for caching discounts.

    Args:
        model: Model name
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        cached_tokens: Number of cached tokens (Gemini)
        cache_creation_tokens: Number of cache creation tokens (Claude)
        cache_read_tokens: Number of cache read tokens (Claude)

    Returns:
        Total cost in USD
    """
    # Normalize model name to find pricing
    model_lower = model.lower()
    pricing = None

    for model_key in MODEL_PRICING:
        if model_key in model_lower:
            pricing = MODEL_PRICING[model_key]
            break

    # Default to gemini-2.5-pro pricing if not found
    if not pricing:
        pricing = MODEL_PRICING["gemini-2.5-pro"]

    # For Gemini: cached tokens get 75% discount
    if "gemini" in model_lower:
        regular_input = input_tokens - cached_tokens
        cost = (
            regular_input * pricing.get("input", 0) / 1_000_000
            + cached_tokens * pricing.get("cached_input", 0) / 1_000_000
            + output_tokens * pricing.get("output", 0) / 1_000_000
        )
    # For Claude: cache creation costs more, cache read costs less
    else:
        regular_input = input_tokens - cache_read_tokens
        cost = (
            regular_input * pricing.get("input", 0) / 1_000_000
            + cache_creation_tokens * pricing.get("cache_write", 0) / 1_000_000
            + cache_read_tokens * pricing.get("cache_read", 0) / 1_000_000
            + output_tokens * pricing.get("output", 0) / 1_000_000
        )

    return cost


class UsageTracking:
    """Service for tracking LLM token usage."""

    @staticmethod
    def log_request(
        user_id: str,
        operation: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int = 0,
        cache_creation_tokens: int = 0,
        cache_read_tokens: int = 0,
        doc_id: Optional[str] = None,
        job_id: Optional[str] = None,
    ) -> int:
        """Log an LLM request with token usage.

        Args:
            user_id: User identifier
            operation: Operation type (e.g., 'video_analysis', 'doc_generation')
            model: Model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            cached_tokens: Number of cached tokens (Gemini)
            cache_creation_tokens: Number of cache creation tokens (Claude)
            cache_read_tokens: Number of cache read tokens (Claude)
            doc_id: Optional doc identifier
            job_id: Optional job identifier

        Returns:
            Request ID
        """
        total_tokens = input_tokens + output_tokens
        cost_usd = calculate_cost(
            model,
            input_tokens,
            output_tokens,
            cached_tokens,
            cache_creation_tokens,
            cache_read_tokens,
        )

        with get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO llm_requests (
                    user_id, timestamp, operation, model,
                    input_tokens, output_tokens, total_tokens,
                    cached_tokens, cache_creation_tokens, cache_read_tokens,
                    cost_usd, manual_id, job_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    datetime.now(),
                    operation,
                    model,
                    input_tokens,
                    output_tokens,
                    total_tokens,
                    cached_tokens,
                    cache_creation_tokens,
                    cache_read_tokens,
                    cost_usd,
                    doc_id,  # DB column is still manual_id for backwards compatibility
                    job_id,
                ),
            )
            request_id = cursor.lastrowid

        # Update daily aggregate
        UsageTracking.update_daily_aggregate(
            user_id=user_id,
            operation=operation,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cached_tokens=cached_tokens,
            cache_read_tokens=cache_read_tokens,
            cost_usd=cost_usd,
        )

        return request_id

    @staticmethod
    def update_daily_aggregate(
        user_id: str,
        operation: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cached_tokens: int = 0,
        cache_read_tokens: int = 0,
        cost_usd: float = 0.0,
    ) -> None:
        """Update daily usage aggregate.

        Args:
            user_id: User identifier
            operation: Operation type
            model: Model name
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            cached_tokens: Number of cached tokens
            cache_read_tokens: Number of cache read tokens
            cost_usd: Request cost
        """
        today = date.today().isoformat()

        with get_connection() as conn:
            # Try to update existing record
            cursor = conn.execute(
                """
                UPDATE usage_daily
                SET request_count = request_count + 1,
                    total_input_tokens = total_input_tokens + ?,
                    total_output_tokens = total_output_tokens + ?,
                    total_cached_tokens = total_cached_tokens + ?,
                    total_cache_read_tokens = total_cache_read_tokens + ?,
                    total_cost_usd = total_cost_usd + ?
                WHERE user_id = ? AND date = ? AND operation = ? AND model = ?
                """,
                (
                    input_tokens,
                    output_tokens,
                    cached_tokens,
                    cache_read_tokens,
                    cost_usd,
                    user_id,
                    today,
                    operation,
                    model,
                ),
            )

            # If no record exists, insert new one
            if cursor.rowcount == 0:
                conn.execute(
                    """
                    INSERT INTO usage_daily (
                        user_id, date, operation, model,
                        request_count, total_input_tokens, total_output_tokens,
                        total_cached_tokens, total_cache_read_tokens, total_cost_usd
                    )
                    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        today,
                        operation,
                        model,
                        input_tokens,
                        output_tokens,
                        cached_tokens,
                        cache_read_tokens,
                        cost_usd,
                    ),
                )

    @staticmethod
    def get_user_usage(
        user_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> list[dict]:
        """Get usage records for a user.

        Args:
            user_id: User identifier
            start_date: Optional start date (YYYY-MM-DD)
            end_date: Optional end date (YYYY-MM-DD)

        Returns:
            List of usage records
        """
        query = """
            SELECT id, user_id, timestamp, operation, model,
                   input_tokens, output_tokens, total_tokens,
                   cached_tokens, cache_creation_tokens, cache_read_tokens,
                   cost_usd, manual_id, job_id
            FROM llm_requests
            WHERE user_id = ?
        """
        params = [user_id]

        if start_date:
            query += " AND date(timestamp) >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date(timestamp) <= ?"
            params.append(end_date)

        query += " ORDER BY timestamp DESC"

        with get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_daily_summary(
        start_date: Optional[str] = None, end_date: Optional[str] = None
    ) -> list[dict]:
        """Get daily usage summary across all users.

        Args:
            start_date: Optional start date (YYYY-MM-DD)
            end_date: Optional end date (YYYY-MM-DD)

        Returns:
            List of daily summaries
        """
        query = """
            SELECT date, operation, model,
                   SUM(request_count) as request_count,
                   SUM(total_input_tokens) as total_input_tokens,
                   SUM(total_output_tokens) as total_output_tokens,
                   SUM(total_cached_tokens) as total_cached_tokens,
                   SUM(total_cache_read_tokens) as total_cache_read_tokens,
                   SUM(total_cost_usd) as total_cost_usd
            FROM usage_daily
            WHERE 1=1
        """
        params = []

        if start_date:
            query += " AND date >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date <= ?"
            params.append(end_date)

        query += " GROUP BY date, operation, model ORDER BY date DESC"

        with get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_all_users_usage(
        start_date: Optional[str] = None, end_date: Optional[str] = None
    ) -> list[dict]:
        """Get usage summary for all users.

        Args:
            start_date: Optional start date (YYYY-MM-DD)
            end_date: Optional end date (YYYY-MM-DD)

        Returns:
            List of user usage summaries
        """
        query = """
            SELECT user_id,
                   SUM(request_count) as total_requests,
                   SUM(total_input_tokens) as total_input_tokens,
                   SUM(total_output_tokens) as total_output_tokens,
                   SUM(total_cached_tokens) as total_cached_tokens,
                   SUM(total_cache_read_tokens) as total_cache_read_tokens,
                   SUM(total_cost_usd) as total_cost_usd
            FROM usage_daily
            WHERE 1=1
        """
        params = []

        if start_date:
            query += " AND date >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date <= ?"
            params.append(end_date)

        query += " GROUP BY user_id ORDER BY total_cost_usd DESC"

        with get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_user_usage_summary(user_id: str) -> dict:
        """Get usage summary for a specific user.

        Args:
            user_id: User identifier

        Returns:
            Dictionary with usage summary (total_requests, tokens, cost)
        """
        query = """
            SELECT SUM(request_count) as total_requests,
                   SUM(total_input_tokens) as total_input_tokens,
                   SUM(total_output_tokens) as total_output_tokens,
                   SUM(total_cached_tokens) as total_cached_tokens,
                   SUM(total_cache_read_tokens) as total_cache_read_tokens,
                   SUM(total_cost_usd) as total_cost_usd
            FROM usage_daily
            WHERE user_id = ?
        """

        with get_connection() as conn:
            cursor = conn.execute(query, [user_id])
            row = cursor.fetchone()
            if row:
                return {
                    "total_requests": row["total_requests"] or 0,
                    "total_input_tokens": row["total_input_tokens"] or 0,
                    "total_output_tokens": row["total_output_tokens"] or 0,
                    "total_cached_tokens": row["total_cached_tokens"] or 0,
                    "total_cache_read_tokens": row["total_cache_read_tokens"] or 0,
                    "total_cost_usd": row["total_cost_usd"] or 0.0,
                }
            return {
                "total_requests": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_cached_tokens": 0,
                "total_cache_read_tokens": 0,
                "total_cost_usd": 0.0,
            }

    @staticmethod
    def get_model_summary(
        start_date: Optional[str] = None, end_date: Optional[str] = None
    ) -> list[dict]:
        """Get usage summary grouped by model.

        Args:
            start_date: Optional start date (YYYY-MM-DD)
            end_date: Optional end date (YYYY-MM-DD)

        Returns:
            List of model usage summaries
        """
        query = """
            SELECT model,
                   SUM(request_count) as total_requests,
                   SUM(total_input_tokens) as total_input_tokens,
                   SUM(total_output_tokens) as total_output_tokens,
                   SUM(total_cached_tokens) as total_cached_tokens,
                   SUM(total_cache_read_tokens) as total_cache_read_tokens,
                   SUM(total_cost_usd) as total_cost_usd
            FROM usage_daily
            WHERE 1=1
        """
        params = []

        if start_date:
            query += " AND date >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date <= ?"
            params.append(end_date)

        query += " GROUP BY model ORDER BY total_cost_usd DESC"

        with get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_manual_usage(
        start_date: Optional[str] = None, end_date: Optional[str] = None
    ) -> list[dict]:
        """Get usage summary grouped by manual.

        Args:
            start_date: Optional start date (YYYY-MM-DD)
            end_date: Optional end date (YYYY-MM-DD)

        Returns:
            List of manual usage summaries
        """
        query = """
            SELECT manual_id,
                   COUNT(*) as total_requests,
                   SUM(input_tokens) as total_input_tokens,
                   SUM(output_tokens) as total_output_tokens,
                   SUM(cached_tokens) as total_cached_tokens,
                   SUM(cache_read_tokens) as total_cache_read_tokens,
                   SUM(cost_usd) as total_cost_usd,
                   MIN(timestamp) as first_request,
                   MAX(timestamp) as last_request
            FROM llm_requests
            WHERE manual_id IS NOT NULL
        """
        params = []

        if start_date:
            query += " AND date(timestamp) >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date(timestamp) <= ?"
            params.append(end_date)

        query += " GROUP BY manual_id ORDER BY total_cost_usd DESC"

        with get_connection() as conn:
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
