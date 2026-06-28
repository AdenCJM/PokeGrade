"""Tests for the deterministic centering measurement.

The accuracy assertion (worse_pct within +/- 2 pp of the constructed ratio) is
the design's stated accuracy target. The other two cases pin the two honest
fail modes: borderless art must NOT emit a false-precise ratio, and a cardless /
garbage image must fail closed to could-not-assess rather than crash.
"""

from __future__ import annotations

import base64

import pytest

from pokegrade.centering import measure, measure_card
from pokegrade.models import BorderType, Confidence
from tests import fixtures


# --- accuracy: measured worse_pct within +/-2 pp of the constructed ratio ----

# Each case is (left, right, top, bottom) edge gaps in canonical card pixels.
# The worse axis and its share are derived from these by fixtures.expected_*.
_BORDERED_CASES = [
    # Off-centre horizontally: ~58/42 on the h-axis (the verdict's SKIP zone).
    (58, 42, 50, 50),
    # Near-perfect: ~52/48 worse axis, PSA-10 territory.
    (52, 48, 49, 51),
    # Off-centre vertically: ~65/35 on the v-axis.
    (50, 50, 65, 35),
    # Strongly off both ways; worse axis is the more lopsided one.
    (66, 34, 55, 45),
]


@pytest.mark.parametrize("gaps", _BORDERED_CASES)
def test_bordered_worse_pct_within_tolerance(gaps: tuple[int, int, int, int]) -> None:
    left, right, top, bottom = gaps
    png = fixtures.bordered_card_png(left, right, top, bottom)

    result = measure(png, side="front")

    assert result.assessable is True
    assert result.border_type == BorderType.bordered
    assert result.worse_pct is not None

    exp_axis, exp_pct = fixtures.expected_worse_pct(left, right, top, bottom)
    assert result.worse_axis == exp_axis
    assert abs(result.worse_pct - exp_pct) <= 2.0, (
        f"measured {result.worse_pct} vs constructed {exp_pct} "
        f"({result.h_ratio} h / {result.v_ratio} v)"
    )


def test_bordered_emits_grade_and_overlay() -> None:
    """A clean bordered measurement carries a PSA grade and a decodable overlay."""
    png = fixtures.bordered_card_png(58, 42, 50, 50)
    result = measure(png, side="front")

    assert result.grade_estimate is not None
    assert result.confidence in (Confidence.high, Confidence.medium)
    assert result.overlay_png_b64 is not None
    # The overlay is real base64 PNG bytes, no data: prefix.
    raw = base64.b64decode(result.overlay_png_b64)
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"


# --- borderless: NO numeric ratio, low-confidence assess-by-eye --------------


def test_borderless_emits_no_ratio() -> None:
    png = fixtures.borderless_card_png()
    result = measure(png, side="front")

    assert result.border_type == BorderType.borderless
    assert result.assessable is False
    assert result.confidence == Confidence.low
    # The crux: no false-precise numbers leak out of the borderless branch.
    assert result.worse_pct is None
    assert result.grade_estimate is None
    assert result.worse_axis == "unknown"
    assert result.h_ratio == "unknown"
    assert result.v_ratio == "unknown"
    assert any("borderless" in n for n in result.notes)


# --- fail-closed: garbage / blank must not crash -----------------------------


def test_garbage_fails_closed() -> None:
    result = measure(fixtures.garbage_bytes(), side="front")

    assert result.assessable is False
    assert result.confidence == Confidence.low
    assert result.worse_pct is None
    assert result.notes  # carries a human-readable reason


def test_blank_image_fails_closed() -> None:
    result = measure(fixtures.blank_png(), side="front")

    assert result.assessable is False
    assert result.confidence == Confidence.low
    assert result.worse_pct is None


def test_empty_bytes_fails_closed() -> None:
    result = measure(b"", side="front")
    assert result.assessable is False
    assert result.worse_pct is None


# --- measure_card: two sides, optional back ----------------------------------


def test_measure_card_front_only() -> None:
    png = fixtures.bordered_card_png(58, 42, 50, 50)
    m = measure_card(png, back_bytes=None)

    assert m.front is not None
    assert m.front.assessable is True
    assert m.back is None


def test_measure_card_both_sides() -> None:
    front = fixtures.bordered_card_png(58, 42, 50, 50)
    back = fixtures.bordered_card_png(52, 48, 50, 50)
    m = measure_card(front, back_bytes=back)

    assert m.front is not None and m.front.assessable is True
    assert m.back is not None and m.back.assessable is True
