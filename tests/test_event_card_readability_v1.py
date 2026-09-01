from pathlib import Path


def test_event_cards_publish_readable_hierarchy() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )
    css = (root / "web" / "home.css").read_text(
        encoding="utf-8"
    )
    html = (root / "web" / "index.html").read_text(
        encoding="utf-8"
    )
    sw = (root / "web" / "sw.js").read_text(
        encoding="utf-8"
    )

    assert 'class="event-direction-badge ${tone}"' in js
    assert 'class="event-card-explanation"' in js
    assert 'class="event-card-details"' in js
    assert "查看原因與證據" in js
    assert "綜合影響" in js

    assert "/* Event group readability v1 */" in css
    assert ".event-direction-badge.positive" in css
    assert ".event-direction-badge.negative" in css
    assert ".event-card-explanation" in css
    assert "@media (max-width: 720px)" in css

    assert "home.css?v=3.9.8.7" in html
    assert "app.js?v=3.9.8.7" in html
    assert "home.css?v=3.9.8.7" in sw
    assert "app.js?v=3.9.8.7" in sw
    assert "ai-stock-health-beta-v12-home-compact" in sw
