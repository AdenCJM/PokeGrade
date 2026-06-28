"""Deterministic, EV-aware verdict: SUBMIT / IN_HAND_CHECK / SKIP.

`verdict.py` is the of-record arbiter (CEO plan: "the deterministic gates win,
Claude fills the judgment the CV cannot"). It computes the terminal enum from
three inputs:

  1. the measured front centering (a worse-axis past the SKIP threshold forces
     SKIP; an unmeasurable / borderless centering routes to IN_HAND_CHECK),
  2. the EV inputs (a 9-vs-10 spread that does not clear the fee is not worth
     submitting even at high odds), and
  3. Claude's soft-pillar flags (could_not_assess on any soft pillar routes to
     IN_HAND_CHECK; a photo-visible major defect forces SKIP).

Claude does NOT emit the terminal verdict — it supplies the soft-pillar
assessment that feeds gate 3.

Reconciliation note (design prose vs eng test boundaries): because PokeGrade
answers "will this gem a *10*?", any measured, high-confidence centering that
caps the card below 10 (worse-axis > ten_eligible_max_pct, i.e. worse than
55/45) is a deterministic 10-killer -> SKIP. This is why 58/42 -> SKIP even
though 56-60 is the "PSA-9 borderline" band for grade estimation. Borderless or
unmeasurable centering is never a confident 10-killer, so it routes to
IN_HAND_CHECK instead.
"""

from __future__ import annotations

from typing import Optional

from . import standards as std
from .models import (
    CenteringMeasurement,
    Confidence,
    Pillar,
    PillarStatus,
    Severity,
    SideCentering,
    SoftPillarAssessment,
    SoftPillarFlag,
    ValueInputs,
    Verdict,
    VerdictResult,
)

_SOFT_PILLARS = (Pillar.corners, Pillar.edges, Pillar.surface)


def _soft_flag(soft: SoftPillarAssessment, pillar: Pillar) -> SoftPillarFlag:
    return getattr(soft, pillar.value)


def _centering_measured(side: Optional[SideCentering]) -> bool:
    """True when the side carries a real, high/medium-confidence ratio the
    verdict can stand behind."""
    return bool(
        side
        and side.assessable
        and side.worse_pct is not None
        and side.confidence in (Confidence.high, Confidence.medium)
    )


def decide(
    centering: CenteringMeasurement,
    soft: SoftPillarAssessment,
    value: ValueInputs,
) -> VerdictResult:
    front = centering.front
    reasons: list[str] = []

    f_front = std.front_thresholds()
    ten_max = float(f_front["ten_eligible_max_pct"])  # 55
    skip_th = float(f_front["skip_threshold_pct"])  # 60

    # --- EV: marginal value of a successful 9->10 upgrade, net of fee --------
    ev_estimate: Optional[float] = None
    ev_worth: Optional[bool] = None
    if value.spread_9_10 is not None and value.fee is not None:
        ev_estimate = round(value.spread_9_10 - value.fee, 2)
        ev_worth = value.spread_9_10 > value.fee

    # Gate 0 (EV not-worth): a spread that does not clear the fee makes grading
    # uneconomic regardless of condition. Checked first — the money question.
    if std.spread_must_exceed_fee() and ev_worth is False:
        reasons.append("EV_SPREAD_BELOW_FEE")
        return VerdictResult(
            verdict=Verdict.SKIP,
            limiting_pillar=None,
            confidence=Confidence.high,
            reason_codes=reasons,
            ev_estimate=ev_estimate,
            ev_worth=ev_worth,
        )

    # --- Gate 1: centering is the only deterministic pillar ------------------
    centering_measured = _centering_measured(front)
    centering_caps_below_10 = False
    if centering_measured:
        assert front is not None and front.worse_pct is not None
        if front.worse_pct > skip_th:
            reasons.append("CENTERING_OUT_OF_BOUNDS")
            centering_caps_below_10 = True
        elif front.worse_pct > ten_max:
            reasons.append("CENTERING_CAPS_BELOW_10")
            centering_caps_below_10 = True

    if centering_caps_below_10:
        return VerdictResult(
            verdict=Verdict.SKIP,
            limiting_pillar=Pillar.centering,
            confidence=Confidence.high,
            reason_codes=reasons,
            ev_estimate=ev_estimate,
            ev_worth=ev_worth,
        )

    # --- Gate 2: a photo-visible major soft defect is a 10-killer ------------
    for pillar in _SOFT_PILLARS:
        flag = _soft_flag(soft, pillar)
        if flag.status == PillarStatus.concern and flag.severity == Severity.major:
            reasons.append(f"SOFT_PILLAR_MAJOR:{pillar.value}")
            return VerdictResult(
                verdict=Verdict.SKIP,
                limiting_pillar=pillar,
                confidence=Confidence.medium,
                reason_codes=reasons,
                ev_estimate=ev_estimate,
                ev_worth=ev_worth,
            )

    # --- Gate 3: anything unconfirmed or mildly flagged -> IN_HAND_CHECK -----
    in_hand_reasons: list[str] = []
    limiting: Optional[Pillar] = None

    if not centering_measured:
        in_hand_reasons.append("CENTERING_COULD_NOT_ASSESS")
        if limiting is None:
            limiting = Pillar.centering

    for pillar in _SOFT_PILLARS:
        flag = _soft_flag(soft, pillar)
        if flag.status == PillarStatus.could_not_assess:
            in_hand_reasons.append(f"SOFT_PILLAR_COULD_NOT_ASSESS:{pillar.value}")
            if limiting is None:
                limiting = pillar
        elif flag.status == PillarStatus.concern:
            in_hand_reasons.append(f"SOFT_PILLAR_CONCERN:{pillar.value}")
            if limiting is None:
                limiting = pillar

    if in_hand_reasons:
        reasons.extend(in_hand_reasons)
        # Honest confidence: low if the unknown is centering itself, else medium.
        conf = Confidence.low if not centering_measured else Confidence.medium
        # Prefer the adjudicator's own limiting-pillar candidate when it named one.
        if soft.limiting_pillar_candidate is not None:
            limiting = soft.limiting_pillar_candidate
        return VerdictResult(
            verdict=Verdict.IN_HAND_CHECK,
            limiting_pillar=limiting,
            confidence=conf,
            reason_codes=reasons,
            ev_estimate=ev_estimate,
            ev_worth=ev_worth,
        )

    # --- SUBMIT (rare): measured-perfect centering + all soft pillars clean --
    # Confidence tracks the centering read: an uncalibrated measurement is capped
    # at medium upstream, so a SUBMIT honestly reports medium rather than high.
    reasons.append("CENTERING_TEN_ELIGIBLE")
    reasons.append("ALL_SOFT_PILLARS_CLEAN")
    submit_conf = front.confidence if front is not None else Confidence.high
    return VerdictResult(
        verdict=Verdict.SUBMIT,
        limiting_pillar=None,
        confidence=submit_conf,
        reason_codes=reasons,
        ev_estimate=ev_estimate,
        ev_worth=ev_worth,
    )
