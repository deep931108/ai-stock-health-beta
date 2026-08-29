from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Any


class BetaInsightsStore:
    """Privacy-limited event and feedback storage for the private Beta."""

    EVENT_NAMES = {
        "session_started", "page_view", "stock_opened", "mode_changed",
        "watchlist_changed", "feedback_opened", "personality_completed",
    }
    PAGE_NAMES = {
        "home", "watchlist", "events", "explore", "about", "compare",
        "personality", "detail", "news",
    }
    MODE_NAMES = {"guided", "pro"}
    FEEDBACK_CATEGORIES = {
        "usability", "data", "bug", "missing_feature", "other",
    }

    def __init__(self, database_path: str | Path):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=20)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS beta_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tester_code TEXT NOT NULL,
                    event_name TEXT NOT NULL,
                    page TEXT,
                    stock_id TEXT,
                    mode TEXT,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_beta_events_created
                ON beta_events(created_at);
                CREATE INDEX IF NOT EXISTS idx_beta_events_tester
                ON beta_events(tester_code, created_at);
                CREATE TABLE IF NOT EXISTS beta_feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tester_code TEXT NOT NULL,
                    category TEXT NOT NULL,
                    rating INTEGER,
                    message TEXT NOT NULL,
                    page TEXT,
                    stock_id TEXT,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_beta_feedback_created
                ON beta_feedback(created_at);
                """
            )

    @staticmethod
    def _clean_optional(value: str | None, maximum: int) -> str | None:
        cleaned = str(value or "").strip()
        return cleaned[:maximum] or None

    def record_event(
        self, tester_code: str, event_name: str, page: str | None = None,
        stock_id: str | None = None, mode: str | None = None,
    ) -> None:
        event_name = str(event_name).strip().lower()
        page = self._clean_optional(page, 32)
        stock_id = self._clean_optional(stock_id, 4)
        mode = self._clean_optional(mode, 16)
        if event_name not in self.EVENT_NAMES:
            raise ValueError("unsupported event")
        if page and page not in self.PAGE_NAMES:
            raise ValueError("unsupported page")
        if stock_id and (not stock_id.isdigit() or len(stock_id) != 4):
            raise ValueError("invalid stock id")
        if mode and mode not in self.MODE_NAMES:
            raise ValueError("unsupported mode")
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO beta_events "
                "(tester_code, event_name, page, stock_id, mode, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (str(tester_code).strip().upper(), event_name, page, stock_id,
                 mode, int(time.time())),
            )

    def record_feedback(
        self, tester_code: str, category: str, message: str,
        rating: int | None = None, page: str | None = None,
        stock_id: str | None = None,
    ) -> int:
        category = str(category).strip().lower()
        message = str(message).strip()
        page = self._clean_optional(page, 32)
        stock_id = self._clean_optional(stock_id, 4)
        if category not in self.FEEDBACK_CATEGORIES:
            raise ValueError("unsupported category")
        if len(message) < 2 or len(message) > 1200:
            raise ValueError("invalid message")
        if rating is not None and not 1 <= int(rating) <= 5:
            raise ValueError("invalid rating")
        if page and page not in self.PAGE_NAMES:
            raise ValueError("unsupported page")
        if stock_id and (not stock_id.isdigit() or len(stock_id) != 4):
            raise ValueError("invalid stock id")
        with self.connect() as connection:
            cursor = connection.execute(
                "INSERT INTO beta_feedback "
                "(tester_code, category, rating, message, page, stock_id, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (str(tester_code).strip().upper(), category, rating, message,
                 page, stock_id, int(time.time())),
            )
            return int(cursor.lastrowid)

    def summary(self, days: int = 7) -> dict[str, Any]:
        days = max(1, min(int(days), 90))
        since = int(time.time()) - days * 86400
        with self.connect() as connection:
            active_testers = connection.execute(
                "SELECT COUNT(DISTINCT tester_code) FROM beta_events "
                "WHERE created_at >= ?", (since,),
            ).fetchone()[0]
            event_rows = connection.execute(
                "SELECT event_name, COUNT(*) count FROM beta_events "
                "WHERE created_at >= ? GROUP BY event_name "
                "ORDER BY count DESC, event_name", (since,),
            ).fetchall()
            feedback_row = connection.execute(
                "SELECT COUNT(*) count, AVG(rating) average_rating "
                "FROM beta_feedback WHERE created_at >= ?", (since,),
            ).fetchone()
            recent_feedback = connection.execute(
                "SELECT id, tester_code, category, rating, message, page, "
                "stock_id, created_at FROM beta_feedback "
                "ORDER BY created_at DESC, id DESC LIMIT 20"
            ).fetchall()
        average = feedback_row["average_rating"]
        return {
            "window_days": days,
            "active_testers": int(active_testers or 0),
            "event_counts": {
                str(row["event_name"]): int(row["count"]) for row in event_rows
            },
            "feedback_count": int(feedback_row["count"] or 0),
            "average_rating": round(float(average), 2) if average is not None else None,
            "recent_feedback": [dict(row) for row in recent_feedback],
        }
