from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from beta_maintenance import backup_database, restore_database, verify_database


def default_database() -> Path:
    return Path(
        os.environ.get(
            "AI_STOCK_BETA_DB_PATH",
            PROJECT_ROOT.parent / "database" / "web_beta" / "beta-access.sqlite3",
        )
    ).resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description="GC Beta SQLite backup utility")
    parser.add_argument("action", choices=("backup", "verify", "restore"))
    parser.add_argument("--database", type=Path, default=default_database())
    parser.add_argument("--file", type=Path)
    parser.add_argument("--confirm-restore", action="store_true")
    args = parser.parse_args()

    if args.action == "backup":
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        target = args.file or Path("backups") / f"beta-access-{stamp}.sqlite3"
        result = backup_database(args.database, target)
        print(f"Backup verified: {result}")
        return 0

    target = args.file or args.database
    if args.action == "verify":
        valid = verify_database(target)
        print("Database integrity: ok" if valid else "Database integrity: failed")
        return 0 if valid else 1

    if args.file is None:
        parser.error("restore requires --file BACKUP")
    safety_copy = restore_database(
        args.file,
        args.database,
        confirmed=args.confirm_restore,
    )
    print(f"Restore verified. Safety copy or destination: {safety_copy}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
