from pathlib import Path


def test_mobile_onboarding_uses_precise_targets_and_transition_lock() -> None:
    root = Path(__file__).parents[1]
    js = (root / "web" / "app.js").read_text(
        encoding="utf-8"
    )

    assert '"#dailyResearchSection .home-section-heading"' in js
    assert '"#dailyResearchSection .daily-research-overview"' in js
    assert '"#futureEventsTitle"' in js
    assert '"#futureEvents > :first-child"' in js
    assert '"#stockCenter .stock-center-heading"' in js
    assert '"#stockCenter .explore-search"' in js
    assert "function onboardingStepSelectors(step)" in js
    assert "function clearOnboardingTargetHighlights()" in js
    assert '".hero-card .stock-title"' not in js
    assert '".hero-card .score-area"' in js
    assert '"onboarding-mobile-target"' in js
    assert "function positionMobileOnboardingGroup()" in js
    assert "onboarding-mobile-group-frame" in js
    assert "currentMode === \"guided\" ? \"pro\" : \"guided\"" in js
    assert '"aria-pressed"' in js
    assert "function moveOnboarding(stepDelta)" in js
    assert "onboardingTransitioning" in js

    missing_block = js.split(
        "if (!onboardingTarget) {",
        1,
    )[1].split(
        "const documentRoot",
        1,
    )[0]

    assert "showOnboardingStep(onboardingStepIndex + 1)" not in (
        missing_block
    )
    assert 'waitForOnboardingTarget(\n      "#top"' in missing_block
