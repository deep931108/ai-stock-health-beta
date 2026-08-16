from __future__ import annotations

import re
from pathlib import Path


def test_market_home_contract_is_rendered() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    adapter = (root / "client_report_adapter.py").read_text(encoding="utf-8")
    versions = re.findall(r'/assets/(?:evidence\.css|home\.css|app\.js)\?v=([^"\']+)', html)
    assert len(versions) == 3 and len(set(versions)) == 1
    assert 'id="marketPreview"' in html
    assert "function renderMarketHomeSummary" in js
    assert "market_home_summary" in adapter


def test_upcoming_events_include_market_calendar_without_stock_navigation() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    assert 'central_bank_meeting:"央行"' in js
    assert 'export_orders_release:"外銷訂單"' in js
    assert 'event.stock_id === "MARKET"' in js
