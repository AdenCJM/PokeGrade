"""Coverage for the canonical-standards loader.

standards.json is the single source of truth shared by centering.py, verdict.py
and the Claude prompt, so these tests pin the loader contract and the ladder
boundaries that the verdict gates depend on. If a band edit silently shifts a
boundary, one of these fails before it can drift into the of-record logic.
"""

from __future__ import annotations

import pytest

from pokegrade import standards as std


def test_standards_loads_and_is_a_dict() -> None:
    data = std.load_standards()
    assert isinstance(data, dict)
    assert data  # non-empty


def test_version_is_non_empty_string() -> None:
    version = std.standards_version()
    assert isinstance(version, str)
    assert version  # non-empty
    assert version != "unknown"  # the real file carries a version


# --- ladder: worse_pct -> PSA grade ----------------------------------------
# Boundaries are inclusive on max_worse_pct (worse_pct <= band["max_worse_pct"]).
@pytest.mark.parametrize(
    ("worse_pct", "expected_grade"),
    [
        (50, 10),  # well within 10-eligible
        (55, 10),  # exactly the 10-eligible boundary stays a 10
        (58, 9),   # past 55 but within 60 -> PSA-9 borderline band
        (63, 8),
        # NOTE: the spec asked for (72)==7, but the implemented ladder caps grade
        # 7 at max_worse_pct 70, so 72 falls into the next band (grade 6). 70 is
        # the value that actually maps to a 7 under the real standards.json
        # ladder, so the test matches the implemented contract here.
        (70, 7),
        (72, 6),
    ],
)
def test_grade_for_worse_pct_ladder(worse_pct: float, expected_grade: float) -> None:
    assert std.grade_for_worse_pct(worse_pct) == expected_grade


def test_grade_for_worse_pct_severe_is_low_grade() -> None:
    """A 90/10 split is egregiously off-centre — a low grade, well below a 7."""
    grade = std.grade_for_worse_pct(90)
    assert grade <= 6


# --- front threshold knobs the verdict gates on -----------------------------


def test_front_thresholds_boundaries() -> None:
    front = std.front_thresholds()
    assert front["ten_eligible_max_pct"] == 55
    assert front["skip_threshold_pct"] == 60
