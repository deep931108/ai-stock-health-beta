from __future__ import annotations

import hashlib
import secrets
import sqlite3
import string
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class BetaSession:
    tester_code: str
    expires_at: int


class BetaAccessStore:
    """Small invite/session store for the private Beta.

    Plain invite codes are returned only at creation time.  SQLite stores
    SHA-256 hashes, so copying the database does not reveal usable invites.
    """

    COOKIE_NAME = "ai_stock_beta_session"
    SESSION_DAYS = 90

    def __init__(self, database_path: str | Path):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path, timeout=20)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA foreign_keys=ON")
        return connection

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS beta_invites (
                    tester_code TEXT PRIMARY KEY,
                    invite_hash TEXT UNIQUE NOT NULL,
                    active INTEGER NOT NULL DEFAULT 1,
                    created_at INTEGER NOT NULL,
                    activated_at INTEGER,
                    last_login_at INTEGER
                );
                CREATE TABLE IF NOT EXISTS beta_sessions (
                    session_hash TEXT PRIMARY KEY,
                    tester_code TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    last_seen_at INTEGER NOT NULL,
                    FOREIGN KEY(tester_code) REFERENCES beta_invites(tester_code)
                );
                CREATE INDEX IF NOT EXISTS idx_beta_sessions_tester
                ON beta_sessions(tester_code);
                """
            )

    def create_invites(self, count: int = 20) -> list[dict[str, str]]:
        count = max(1, min(int(count), 100))
        now = int(time.time())
        created: list[dict[str, str]] = []
        alphabet = string.ascii_uppercase + string.digits
        with self.connect() as connection:
            current = connection.execute("SELECT COUNT(*) FROM beta_invites").fetchone()[0]
            for offset in range(1, count + 1):
                tester_code = f"BETA-{current + offset:03d}"
                while True:
                    raw = "ASH-" + "".join(secrets.choice(alphabet) for _ in range(4))
                    raw += "-" + "".join(secrets.choice(alphabet) for _ in range(4))
                    digest = self._hash(raw)
                    exists = connection.execute(
                        "SELECT 1 FROM beta_invites WHERE invite_hash = ?", (digest,)
                    ).fetchone()
                    if not exists:
                        break
                connection.execute(
                    "INSERT INTO beta_invites "
                    "(tester_code, invite_hash, active, created_at) VALUES (?, ?, 1, ?)",
                    (tester_code, digest, now),
                )
                created.append({"tester_code": tester_code, "invite_code": raw})
        return created

    def activate(self, invite_code: str) -> tuple[str, BetaSession] | None:
        digest = self._hash(invite_code)
        now = int(time.time())
        expires_at = now + self.SESSION_DAYS * 86400
        with self.connect() as connection:
            invite = connection.execute(
                "SELECT tester_code FROM beta_invites "
                "WHERE invite_hash = ? AND active = 1", (digest,)
            ).fetchone()
            if not invite:
                return None
            tester_code = str(invite["tester_code"])
            token = secrets.token_urlsafe(32)
            connection.execute(
                "INSERT INTO beta_sessions "
                "(session_hash, tester_code, created_at, expires_at, last_seen_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (self._hash(token), tester_code, now, expires_at, now),
            )
            connection.execute(
                "UPDATE beta_invites SET activated_at = COALESCE(activated_at, ?), "
                "last_login_at = ? WHERE tester_code = ?",
                (now, now, tester_code),
            )
        return token, BetaSession(tester_code=tester_code, expires_at=expires_at)

    def validate(self, token: str | None) -> BetaSession | None:
        if not token:
            return None
        now = int(time.time())
        digest = self._hash(token)
        with self.connect() as connection:
            row = connection.execute(
                "SELECT s.tester_code, s.expires_at FROM beta_sessions s "
                "JOIN beta_invites i ON i.tester_code = s.tester_code "
                "WHERE s.session_hash = ? AND s.expires_at > ? AND i.active = 1",
                (digest, now),
            ).fetchone()
            if not row:
                return None
            connection.execute(
                "UPDATE beta_sessions SET last_seen_at = ? WHERE session_hash = ?",
                (now, digest),
            )
            return BetaSession(str(row["tester_code"]), int(row["expires_at"]))

    def logout(self, token: str | None) -> None:
        if not token:
            return
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM beta_sessions WHERE session_hash = ?", (self._hash(token),)
            )

    def revoke(self, tester_code: str) -> bool:
        with self.connect() as connection:
            changed = connection.execute(
                "UPDATE beta_invites SET active = 0 WHERE tester_code = ?",
                (str(tester_code).strip().upper(),),
            ).rowcount
            connection.execute(
                "DELETE FROM beta_sessions WHERE tester_code = ?",
                (str(tester_code).strip().upper(),),
            )
        return bool(changed)

    def status(self) -> dict[str, Any]:
        now = int(time.time())
        with self.connect() as connection:
            row = connection.execute(
                "SELECT COUNT(*) total, "
                "SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) active, "
                "SUM(CASE WHEN activated_at IS NOT NULL THEN 1 ELSE 0 END) activated "
                "FROM beta_invites"
            ).fetchone()
            sessions = connection.execute(
                "SELECT COUNT(*) FROM beta_sessions WHERE expires_at > ?", (now,)
            ).fetchone()[0]
        return {
            "total": int(row["total"] or 0),
            "active": int(row["active"] or 0),
            "activated": int(row["activated"] or 0),
            "active_sessions": int(sessions or 0),
        }

    @staticmethod
    def _hash(value: str) -> str:
        normalized = str(value or "").strip().upper().encode("utf-8")
        return hashlib.sha256(normalized).hexdigest()
