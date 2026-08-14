from pathlib import Path


def test_market_home_contract_is_rendered() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    js = (root / "web" / "app.js").read_text(encoding="utf-8")
    adapter = (root / "client_report_adapter.py").read_text(encoding="utf-8")
    assert "evidence.css?v=2.9.0" in html
    assert "home.css?v=2.9.0" in html
    assert "app.js?v=2.9.0" in html
    assert 'id="marketPreview"' in html
    assert 'id="marketIndexChange"' in html
    assert "function renderMarketHomeSummary" in js
    assert 'market?.status === "stale"' in js
    assert "market_home_summary" in adapter
    assert "_normalize_market_home_summary" in adapter

