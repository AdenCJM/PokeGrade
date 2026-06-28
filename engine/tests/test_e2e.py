"""End-to-end pipeline integration (T8, critical path).

Drives the real pipeline — centering (CV) -> adjudicator (forced offline, so it
fail-closes to the conservative could_not_assess default) -> deterministic
verdict -> ledger prediction row — on synthetic fixture cards with a centering
ratio known by construction. No API key is used: the adjudicator's fail-closed
branch is exactly what we assert routes a clean-centered card to IN_HAND_CHECK.
"""

from __future__ import annotations

import pytest

from pokegrade import pipeline
from pokegrade.ledger import Ledger
from pokegrade.models import ValueInputs, Verdict
from tests import fixtures as fx


@pytest.fixture(autouse=True)
def _offline(monkeypatch):
    # Force the soft-pillar adjudicator offline so the e2e path is deterministic
    # and never spends an API call: has_api_key() -> False -> conservative default.
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.fixture()
def ledger(tmp_path):
    return Ledger(tmp_path / "e2e.db")


def test_off_centre_card_skips_and_logs(ledger):
    # left=40,right=80 -> worse axis h at 80/120 = 66.7% -> caps below a 10.
    front = fx.bordered_card_png(left=40, right=80, top=60, bottom=60)
    axis, pct = fx.expected_worse_pct(40, 80, 60, 60)

    resp = pipeline.grade(front_bytes=front, value=ValueInputs(), ledger=ledger)

    assert resp.verdict == Verdict.SKIP
    assert resp.limiting_pillar.value == "centering"
    assert "CENTERING_OUT_OF_BOUNDS" in resp.reason_codes
    assert resp.centering.front is not None and resp.centering.front.assessable
    assert abs(resp.centering.front.worse_pct - pct) <= 2.0
    assert resp.centering.front.worse_axis == axis

    # The prediction was logged; no actual yet.
    rows = ledger.dual_error_report()
    assert rows == []  # no actuals recorded
    assert ledger.get_actuals(resp.card_id) == []


def test_well_centred_card_routes_to_in_hand_check(ledger):
    # Near-perfect centering (52.x%) -> 10-eligible, but with no adjudicator the
    # soft pillars are could_not_assess -> IN_HAND_CHECK (the honest default).
    front = fx.bordered_card_png(left=60, right=58, top=62, bottom=60)
    resp = pipeline.grade(front_bytes=front, value=ValueInputs(), ledger=ledger)

    assert resp.verdict == Verdict.IN_HAND_CHECK
    assert any(r.startswith("SOFT_PILLAR_COULD_NOT_ASSESS") for r in resp.reason_codes)
    assert resp.centering.front.assessable
    assert resp.centering.front.worse_pct <= 55.0


def test_tiny_spread_skips_on_economics(ledger):
    # A perfectly fine card, but the 9->10 spread does not clear the fee.
    front = fx.bordered_card_png(left=60, right=60, top=60, bottom=60)
    resp = pipeline.grade(
        front_bytes=front,
        value=ValueInputs(card_value=30, fee=25, spread_9_10=15),
        ledger=ledger,
    )
    assert resp.verdict == Verdict.SKIP
    assert "EV_SPREAD_BELOW_FEE" in resp.reason_codes
    assert resp.ev_estimate == -10.0
    assert resp.ev_worth is False


def test_garbage_image_fails_closed_to_in_hand_check(ledger):
    # No card detected -> centering could_not_assess -> IN_HAND_CHECK, never a crash.
    resp = pipeline.grade(front_bytes=fx.garbage_bytes(), value=ValueInputs(), ledger=ledger)
    assert resp.verdict == Verdict.IN_HAND_CHECK
    assert "CENTERING_COULD_NOT_ASSESS" in resp.reason_codes


def _clean_assessment():
    from pokegrade.models import (
        Confidence,
        PillarStatus,
        SoftPillarAssessment,
        SoftPillarFlag,
    )

    return SoftPillarAssessment(
        corners=SoftPillarFlag(status=PillarStatus.clean),
        edges=SoftPillarFlag(status=PillarStatus.clean),
        surface=SoftPillarFlag(status=PillarStatus.clean),
        confidence=Confidence.high,
    )


def _patch_clean_adjudicator(monkeypatch):
    from pokegrade import adjudicate

    monkeypatch.setattr(
        adjudicate,
        "adjudicate",
        lambda **k: (
            _clean_assessment(),
            {"model_id": "m", "prompt_version": "v", "prompt_hash": "h", "used_llm": True},
        ),
    )


def test_clean_soft_without_closeups_cannot_submit(monkeypatch, ledger):
    # Even if the adjudicator calls all soft pillars clean, a flat-only shot must
    # NOT reach SUBMIT — the close-up gate downgrades clean to could_not_assess.
    _patch_clean_adjudicator(monkeypatch)
    front = fx.bordered_card_png(left=60, right=60, top=60, bottom=60)  # ~50/50
    resp = pipeline.grade(front_bytes=front, value=ValueInputs(), ledger=ledger)
    assert resp.verdict == Verdict.IN_HAND_CHECK


def test_clean_soft_with_closeup_allows_submit(monkeypatch, ledger):
    _patch_clean_adjudicator(monkeypatch)
    front = fx.bordered_card_png(left=60, right=60, top=60, bottom=60)
    resp = pipeline.grade(
        front_bytes=front, closeup_bytes=[front], value=ValueInputs(), ledger=ledger
    )
    assert resp.verdict == Verdict.SUBMIT


def test_prediction_round_trips_through_ledger(ledger):
    front = fx.bordered_card_png(left=40, right=80, top=60, bottom=60)
    resp = pipeline.grade(front_bytes=front, value=ValueInputs(), ledger=ledger)

    # Record an actual and confirm the dual-error report reconciles it.
    from pokegrade.models import Actual

    ledger.record_actual(Actual(card_id=resp.card_id, submitted=True, psa_grade=10))
    report = ledger.dual_error_report()
    assert len(report) == 1
    assert report[0]["card_id"] == resp.card_id
    assert report[0]["error_type"] == "skip_that_gemmed"
