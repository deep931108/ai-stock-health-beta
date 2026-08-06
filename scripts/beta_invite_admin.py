from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path


WEB_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = WEB_ROOT.parent
sys.path.insert(0, str(WEB_ROOT))

from beta_access import BetaAccessStore  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Manage AI Stock Health Beta invites")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create")
    create.add_argument("--count", type=int, default=20)
    create.add_argument("--output", default="")
    sub.add_parser("status")
    revoke = sub.add_parser("revoke")
    revoke.add_argument("--tester", required=True)
    args = parser.parse_args()

    store = BetaAccessStore(
        PROJECT_ROOT / "database" / "web_beta" / "beta-access.sqlite3"
    )
    if args.command == "create":
        invites = store.create_invites(args.count)
        output = Path(args.output) if args.output else (
            PROJECT_ROOT / "database" / "web_beta" / "invite-codes-latest.json"
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": "BetaInviteList-v1.0",
            "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
            "count": len(invites),
            "invites": invites,
            "warning": "Keep this file private. Invite codes cannot be recovered from SQLite.",
        }
        output.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
        result = {"status": "success", "count": len(invites), "output": str(output)}
    elif args.command == "revoke":
        revoked = store.revoke(args.tester)
        result = {"status": "success" if revoked else "not_found", "tester_code": args.tester}
    else:
        result = {"status": "success", "counts": store.status()}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
