from __future__ import annotations

import json
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Any


def _safe_reason(error: Exception) -> str:
    if isinstance(error, PermissionError):
        return "permission_denied"
    if isinstance(error, sqlite3.DatabaseError):
        return "database_unavailable"
    return "unavailable"


def database_readiness(database_path: str | Path) -> dict[str, Any]:
    path = Path(database_path)
    connection: sqlite3.Connection | None = None
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=3)
        connection.execute(
            "CREATE TABLE IF NOT EXISTS service_health_probe ("
            "id INTEGER PRIMARY KEY CHECK (id = 1), checked_at INTEGER NOT NULL)"
        )
        checked_at = int(time.time())
        connection.execute(
            "INSERT INTO service_health_probe(id, checked_at) VALUES(1, ?) "
            "ON CONFLICT(id) DO UPDATE SET checked_at = excluded.checked_at",
            (checked_at,),
        )
        stored = connection.execute(
            "SELECT checked_at FROM service_health_probe WHERE id = 1"
        ).fetchone()
        integrity = connection.execute("PRAGMA quick_check").fetchone()
        connection.commit()
        writable = bool(stored and stored[0] == checked_at)
        valid = bool(integrity and integrity[0] == "ok")
        return {
            "writable": writable and valid,
            "integrity": "ok" if valid else "failed",
        }
    except (OSError, sqlite3.Error) as error:
        return {"writable": False, "integrity": _safe_reason(error)}
    finally:
        if connection is not None:
            connection.close()


def _report_paths(repository: Any) -> list[Path]:
    paths: dict[str, Path] = {}
    report_root = Path(repository.report_root)
    if report_root.is_dir():
        for path in report_root.glob("*/latest.json"):
            paths[path.parent.name] = path
    sample_dir = repository.sample_dir
    if sample_dir:
        sample_root = Path(sample_dir)
        if sample_root.is_dir():
            for path in sample_root.glob("*.json"):
                paths.setdefault(path.stem, path)
    return list(paths.values())


def _report_date(path: Path) -> str | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    value = payload.get("data_as_of") or payload.get("generated_at")
    if not value and isinstance(payload.get("overview"), dict):
        value = payload["overview"].get("data_as_of")
    text = str(value or "")[:10]
    return text if len(text) == 10 else None


def report_readiness(repository: Any) -> dict[str, Any]:
    paths = _report_paths(repository)
    dates = [value for value in (_report_date(path) for path in paths) if value]
    return {
        "available": bool(paths),
        "count": len(paths),
        "latest_data_date": max(dates) if dates else None,
    }


def verify_database(database_path: str | Path) -> bool:
    path = Path(database_path)
    if not path.is_file():
        return False
    try:
        with closing(sqlite3.connect(
            f"file:{path.as_posix()}?mode=ro", uri=True
        )) as connection:
            result = connection.execute("PRAGMA integrity_check").fetchone()
        return bool(result and result[0] == "ok")
    except sqlite3.Error:
        return False


def backup_database(source: str | Path, destination: str | Path) -> Path:
    source_path = Path(source)
    destination_path = Path(destination)
    if not source_path.is_file():
        raise FileNotFoundError(source_path)
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination_path.with_suffix(destination_path.suffix + ".tmp")
    if temporary.exists():
        temporary.unlink()
    try:
        with closing(sqlite3.connect(source_path)) as source_db:
            with closing(sqlite3.connect(temporary)) as backup_db:
                source_db.backup(backup_db)
        if not verify_database(temporary):
            raise sqlite3.DatabaseError("backup integrity verification failed")
        temporary.replace(destination_path)
        return destination_path
    finally:
        if temporary.exists():
            temporary.unlink()


def restore_database(
    backup: str | Path,
    destination: str | Path,
    *,
    confirmed: bool = False,
) -> Path:
    if not confirmed:
        raise PermissionError("restore requires explicit confirmation")
    backup_path = Path(backup)
    destination_path = Path(destination)
    if not verify_database(backup_path):
        raise sqlite3.DatabaseError("backup is missing or invalid")
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    safety_copy = destination_path.with_suffix(
        destination_path.suffix + f".before-restore-{int(time.time())}.bak"
    )
    if destination_path.is_file():
        backup_database(destination_path, safety_copy)
    temporary = destination_path.with_suffix(destination_path.suffix + ".restore.tmp")
    try:
        backup_database(backup_path, temporary)
        temporary.replace(destination_path)
        if not verify_database(destination_path):
            raise sqlite3.DatabaseError("restored database verification failed")
        return safety_copy if safety_copy.exists() else destination_path
    finally:
        if temporary.exists():
            temporary.unlink()
