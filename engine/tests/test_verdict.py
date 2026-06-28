"""Coverage for the of-record verdict arbiter (verdict.decide).

These tests pin the deterministic decision boundaries described in verdict.py's
module docstring: the EV money-gate runs first, then measured front centering,
then a photo-visible major soft defect, then anything unconfirmed routes to
IN_HAND_CHECK. Each case varies ONE input via the conftest factories so a
regression points at the exact gate that moved.

The boundary values (55 stays 10-eligible, 55.1 skips; spread > fee is strict)
are load-bearing — they are the difference between telling a collector to submit
a card and telling them to keep it in hand.
"""

from __future__ import annotations

from pokegrade.models import (
    BorderType,
    Confidence,
    Pillar,
    Severity,
    Verdict,
)

from .conftest import (
    clean_soft,
    concern_flag,
    default_soft,
    make_front,
    no_value,
    soft_with,
    value,
)


# --- centering gate: measured, high-confidence front ------------------------


def test_front_58_42_conservative_soft_skips_on_centering() -> None:
    """58/42 caps the card below a 10. Because PokeGrade answers 'will this gem a
    10?', a measured high-confidence worse-axis past 55 is a deterministic
    10-killer -> SKIP, limiting=centering, before the soft pillars even matter."""
    res = decide_result(
        make_front(58.0), default_soft(), no_value()
    )
    assert res.verdict == Verdict.SKIP
    assert res.limiting_pillar == Pillar.centering
    assert "CENTERING_CAPS_BELOW_10" in res.reason_codes
    assert res.confidence == Confidence.high


def test_front_62_38_skips_out_of_bounds() -> None:
    """62/38 is past the 60 skip threshold — the cap is egregious and flagged
    CENTERING_OUT_OF_BOUNDS rather than the milder CAPS_BELOW_10."""
    res = decide_result(make_front(62.0), default_soft(), no_value())
    assert res.verdict == Verdict.SKIP
    assert res.limiting_pillar == Pillar.centering
    assert "CENTERING_OUT_OF_BOUNDS" in res.reason_codes
    assert "CENTERING_CAPS_BELOW_10" not in res.reason_codes


def test_front_53_conservative_soft_routes_in_hand_check() -> None:
    """Centering is fine (53 <= 55) but every soft pillar is could_not_assess,
    so the honest answer is IN_HAND_CHECK with one reason per soft pillar."""
    res = decide_result(make_front(53.0), default_soft(), no_value())
    assert res.verdict == Verdict.IN_HAND_CHECK
    for pillar in ("corners", "edges", "surface"):
        assert f"SOFT_PILLAR_COULD_NOT_ASSESS:{pillar}" in res.reason_codes


def test_front_51_all_soft_clean_submits() -> None:
    """The rare SUBMIT: measured-perfect centering plus every soft pillar
    confirmed clean. High confidence because nothing is unknown."""
    res = decide_result(make_front(51.0), clean_soft(), no_value())
    assert res.verdict == Verdict.SUBMIT
    assert res.confidence == Confidence.high
    assert res.limiting_pillar is None


def test_borderless_unmeasurable_centering_routes_in_hand_check() -> None:
    """A borderless / unmeasurable centering is never a confident 10-killer, so
    it routes to IN_HAND_CHECK (not SUBMIT, not SKIP) even with clean soft
    pillars. The reason names CENTERING_COULD_NOT_ASSESS."""
    centering = make_front(
        None,
        confidence=Confidence.low,
        assessable=False,
        border_type=BorderType.borderless,
    )
    res = decide_result(centering, clean_soft(), no_value())
    assert res.verdict == Verdict.IN_HAND_CHECK
    assert res.verdict != Verdict.SUBMIT
    assert res.verdict != Verdict.SKIP
    assert "CENTERING_COULD_NOT_ASSESS" in res.reason_codes


# --- the exact 55 boundary --------------------------------------------------


def test_worse_pct_55_stays_ten_eligible() -> None:
    """Exactly 55 is <= ten_eligible_max_pct, so it is NOT a skip. With clean
    soft pillars it submits."""
    res = decide_result(make_front(55.0), clean_soft(), no_value())
    assert res.verdict != Verdict.SKIP
    assert res.verdict == Verdict.SUBMIT
    assert "CENTERING_CAPS_BELOW_10" not in res.reason_codes


def test_worse_pct_55_1_skips() -> None:
    """Just past the boundary (55.1 > 55) caps below a 10 -> SKIP."""
    res = decide_result(make_front(55.1), clean_soft(), no_value())
    assert res.verdict == Verdict.SKIP
    assert res.limiting_pillar == Pillar.centering
    assert "CENTERING_CAPS_BELOW_10" in res.reason_codes


# --- EV money-gate (runs first, before condition) ---------------------------


def test_ev_spread_below_fee_skips_even_perfect_card() -> None:
    """spread_9_10 (20) <= fee (25): grading is uneconomic no matter how clean
    the card. SKIP with EV_SPREAD_BELOW_FEE, ev_estimate -5.0, ev_worth False."""
    res = decide_result(
        make_front(51.0), clean_soft(), value(spread_9_10=20.0, fee=25.0)
    )
    assert res.verdict == Verdict.SKIP
    assert "EV_SPREAD_BELOW_FEE" in res.reason_codes
    assert res.ev_estimate == -5.0
    assert res.ev_worth is False


def test_ev_spread_above_fee_perfect_card_submits() -> None:
    """spread_9_10 (120) > fee (25): the upgrade clears the fee, so a
    measured-perfect, clean-soft card submits with ev_estimate 95.0."""
    res = decide_result(
        make_front(51.0), clean_soft(), value(spread_9_10=120.0, fee=25.0)
    )
    assert res.verdict == Verdict.SUBMIT
    assert res.ev_estimate == 95.0
    assert res.ev_worth is True


# --- soft-pillar severity gates ---------------------------------------------


def test_soft_pillar_major_concern_skips() -> None:
    """A photo-visible MAJOR soft defect is a 10-killer even with good
    centering -> SKIP, limiting=that pillar, reason SOFT_PILLAR_MAJOR."""
    soft = soft_with(Pillar.surface, concern_flag(Severity.major))
    res = decide_result(make_front(51.0), soft, no_value())
    assert res.verdict == Verdict.SKIP
    assert res.limiting_pillar == Pillar.surface
    assert "SOFT_PILLAR_MAJOR:surface" in res.reason_codes


def test_soft_pillar_minor_concern_routes_in_hand_check() -> None:
    """A MINOR soft concern is not a deterministic 10-killer — it routes to
    IN_HAND_CHECK for an in-person look."""
    soft = soft_with(Pillar.corners, concern_flag(Severity.minor))
    res = decide_result(make_front(51.0), soft, no_value())
    assert res.verdict == Verdict.IN_HAND_CHECK
    assert "SOFT_PILLAR_CONCERN:corners" in res.reason_codes


# --- helper -----------------------------------------------------------------


def decide_result(centering, soft, val):
    """Thin wrapper so the import of decide stays local to the call site and the
    test bodies read as plain English."""
    from pokegrade.verdict import decide

    return decide(centering, soft, val)
