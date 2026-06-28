"""Shared test factories for the verdict + standards suites.

These builders keep each test focused on the ONE input it varies. The verdict
gates on three things — measured front centering, the three soft-pillar flags,
and the EV inputs — so the factories default everything to the "happy" path
(a measured-perfect, high-confidence front; all soft pillars clean; no EV
inputs) and let each test override only the field under test.

Kept dependency-light on purpose: these mirror the production models exactly,
so the tests exercise the real Pydantic contracts rather than stand-ins.
"""

from __future__ import annotations

from typing import Optional

from pokegrade.models import (
    BorderType,
    CenteringMeasurement,
    Confidence,
    Pillar,
    PillarStatus,
    Severity,
    SideCentering,
    SoftPillarAssessment,
    SoftPillarFlag,
    ValueInputs,
)


def make_side(
    worse_pct: Optional[float],
    confidence: Confidence = Confidence.high,
    assessable: bool = True,
    border_type: BorderType = BorderType.bordered,
) -> SideCentering:
    """One side's centering, defaulting to a real, high-confidence ratio.

    The verdict only stands behind a side when assessable is True, worse_pct is
    set, and confidence is high/medium (see verdict._centering_measured). The
    defaults here satisfy that, so a test that wants an UNMEASURABLE side flips
    assessable=False and/or confidence=low explicitly.
    """
    return SideCentering(
        worse_pct=worse_pct,
        confidence=confidence,
        assessable=assessable,
        border_type=border_type,
    )


def make_front(
    worse_pct: Optional[float],
    confidence: Confidence = Confidence.high,
    assessable: bool = True,
    border_type: BorderType = BorderType.bordered,
) -> CenteringMeasurement:
    """A CenteringMeasurement carrying only a front side — the verdict gates on
    the front, so the back is irrelevant to these tests."""
    return CenteringMeasurement(
        front=make_side(
            worse_pct,
            confidence=confidence,
            assessable=assessable,
            border_type=border_type,
        )
    )


def clean_flag() -> SoftPillarFlag:
    """A soft pillar the adjudicator confirmed clean (no concern, no severity)."""
    return SoftPillarFlag(status=PillarStatus.clean, severity=Severity.none)


def concern_flag(severity: Severity, observation: str = "") -> SoftPillarFlag:
    """A soft pillar the adjudicator flagged as a concern at a given severity."""
    return SoftPillarFlag(
        status=PillarStatus.concern, severity=severity, observation=observation
    )


def clean_soft() -> SoftPillarAssessment:
    """All three soft pillars confirmed clean — the only soft state that can let
    a card through to SUBMIT."""
    return SoftPillarAssessment(
        corners=clean_flag(),
        edges=clean_flag(),
        surface=clean_flag(),
        confidence=Confidence.high,
    )


def default_soft() -> SoftPillarAssessment:
    """The conservative fail-closed default: every soft pillar could_not_assess,
    which routes the card to IN_HAND_CHECK. Mirrors what the engine emits when no
    adjudicator ran."""
    return SoftPillarAssessment.conservative_default()


def soft_with(pillar: Pillar, flag: SoftPillarFlag) -> SoftPillarAssessment:
    """Clean soft assessment with ONE pillar overridden — isolates a single
    soft-pillar concern against an otherwise-clean card."""
    soft = clean_soft()
    setattr(soft, pillar.value, flag)
    return soft


def no_value() -> ValueInputs:
    """No EV inputs — the EV gate is skipped, so centering + soft decide alone."""
    return ValueInputs()


def value(
    spread_9_10: Optional[float] = None,
    fee: Optional[float] = None,
    card_value: Optional[float] = None,
) -> ValueInputs:
    return ValueInputs(spread_9_10=spread_9_10, fee=fee, card_value=card_value)
