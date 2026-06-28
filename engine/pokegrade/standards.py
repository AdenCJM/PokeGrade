"""Loader for the canonical PSA standards (``standards.json``).

One source of truth, read by ``centering.py`` (ladder -> grade estimate),
``verdict.py`` (SKIP / borderline thresholds, EV rule), and injected into the
Claude adjudication prompt. A band change is one auditable edit and the two
sides never drift.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from .config import STANDARDS_PATH


@lru_cache(maxsize=1)
def load_standards() -> dict[str, Any]:
    with open(STANDARDS_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def standards_version() -> str:
    return str(load_standards().get("version", "unknown"))


def front_thresholds() -> dict[str, Any]:
    return load_standards()["centering"]["front"]


def back_thresholds() -> dict[str, Any]:
    return load_standards()["centering"]["back"]


def grade_for_worse_pct(worse_pct: float, side: str = "front") -> float:
    """Map a worse-axis percentage to a PSA grade via the side's ladder.

    Backs have no explicit ladder in v1; they reuse the front ladder for a
    rough estimate (the back is rarely the limiting axis)."""
    front = front_thresholds()
    ladder = front["ladder"]
    for band in ladder:
        if worse_pct <= band["max_worse_pct"]:
            return float(band["grade"])
    return float(ladder[-1]["grade"])


def spread_must_exceed_fee() -> bool:
    return bool(load_standards()["verdict"]["ev"]["spread_must_exceed_fee"])


def audit_sample_rate() -> float:
    return float(load_standards()["verdict"].get("audit_sample_rate", 0.0))
