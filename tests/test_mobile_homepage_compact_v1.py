from pathlib import Path


def test_mobile_homepage_uses_compact_dashboard_contract() -> None:
    root = Path(__file__).parents[1]
    html = (root / "web" / "index.html").read_text(encoding="utf-8")
    css = (root / "web" / "home.css").read_text(encoding="utf-8")
    manifest = (root / "web" / "manifest.webmanifest").read_text(encoding="utf-8")

    assert "<b>GC Terminal</b>" in html
    assert "<title>GC Terminal｜投資研究工作台</title>" in html
    assert '"name": "GC Terminal"' in manifest
    assert "v3.9.8.7 mobile homepage compact dashboard" in css
    assert "grid-template-columns:repeat(3,minmax(0,1fr))" in css
    assert "grid-template-columns:repeat(2,minmax(0,1fr))" in css
    assert "scroll-snap-type:x proximity" in css
    assert "flex:0 0 148px" in css
    assert "-webkit-line-clamp:2" in css
