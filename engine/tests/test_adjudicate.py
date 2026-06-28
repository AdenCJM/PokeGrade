"""Tests for the soft-pillar adjudicator's pure parts (adjudicate.py).

Two things matter and neither needs an API call: the JSON->model mapping
(`_to_assessment`), which is full of silent `.get` defaults and an enum-filter
on the loupe checklist, and the fail-closed offline branch, whose `meta`
contract the ledger keys provenance off.
"""

from __future__ import annotations

from pokegrade import adjudicate
from pokegrade.models import (
    CenteringMeasurement,
    Confidence,
    Pillar,
    PillarStatus,
    Severity,
)


def test_to_assessment_maps_flags_and_filters_bad_loupe_pillar():
    raw = {
        "card_read": {
            "name": "Charizard",
            "set": "Base Set",
            "number": "4/102",
            "language": "English",
            "finish": "holo",
            "read_evidence": "reads 4/102",
            "confidence": "high",
        },
        "soft_pillars": {
            "corners": {"status": "clean", "severity": "none", "observation": "sharp"},
            "edges": {"status": "could_not_assess", "severity": "none", "observation": ""},
            "surface": {"status": "concern", "severity": "moderate", "observation": "scratch"},
        },
        "limiting_pillar_candidate": "surface",
        "loupe_checklist": [
            {"pillar": "surface", "location": "holo 60%/30%", "what_to_check": "scratch"},
            {"pillar": "bogus", "location": "x", "what_to_check": "y"},  # must be dropped
        ],
        "photo_quality": {"gradeable": "limited", "issues": ["glare"]},
        "confidence": "medium",
        "narrative": "ok",
    }
    a = adjudicate._to_assessment(raw)
    assert a.corners.status == PillarStatus.clean
    assert a.surface.status == PillarStatus.concern
    assert a.surface.severity == Severity.moderate
    assert a.limiting_pillar_candidate == Pillar.surface
    assert a.card_read.name == "Charizard"
    # the bogus loupe pillar is filtered out; only the valid one survives
    assert len(a.loupe_checklist) == 1
    assert a.loupe_checklist[0].pillar == Pillar.surface


def test_to_assessment_none_candidate_maps_to_none():
    raw = {
        "card_read": {"name": None, "set": None, "number": None, "language": None,
                      "finish": "unknown", "read_evidence": "", "confidence": "low"},
        "soft_pillars": {
            "corners": {"status": "could_not_assess", "severity": "none", "observation": ""},
            "edges": {"status": "could_not_assess", "severity": "none", "observation": ""},
            "surface": {"status": "could_not_assess", "severity": "none", "observation": ""},
        },
        "limiting_pillar_candidate": "none",
        "loupe_checklist": [],
        "photo_quality": {"gradeable": "no", "issues": []},
        "confidence": "low",
        "narrative": "",
    }
    a = adjudicate._to_assessment(raw)
    assert a.limiting_pillar_candidate is None


def test_undecodable_front_fails_closed_without_api():
    # front_b64 None (image could not be decoded) must NOT ship bytes to the API;
    # it fails closed locally with the conservative default.
    assessment, meta = adjudicate.adjudicate(
        front_b64=None, centering=CenteringMeasurement()
    )
    assert meta["used_llm"] is False
    assert assessment.surface.status == PillarStatus.could_not_assess


def test_clean_status_normalises_away_stray_severity():
    raw = {
        "card_read": {"name": None, "set": None, "number": None, "language": None,
                      "finish": "unknown", "read_evidence": "", "confidence": "low"},
        "soft_pillars": {
            "corners": {"status": "clean", "severity": "major", "observation": ""},
            "edges": {"status": "could_not_assess", "severity": "moderate", "observation": ""},
            "surface": {"status": "concern", "severity": "major", "observation": "x"},
        },
        "limiting_pillar_candidate": "none",
        "loupe_checklist": [],
        "photo_quality": {"gradeable": "limited", "issues": []},
        "confidence": "low",
        "narrative": "",
    }
    a = adjudicate._to_assessment(raw)
    assert a.corners.severity == Severity.none  # clean can't carry severity
    assert a.edges.severity == Severity.none  # nor could_not_assess
    assert a.surface.severity == Severity.major  # a concern keeps it


def test_offline_adjudication_fails_closed(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assessment, meta = adjudicate.adjudicate(
        front_b64="ignored", centering=CenteringMeasurement()
    )
    assert meta["used_llm"] is False
    assert meta["prompt_hash"]  # provenance still populated
    assert assessment.corners.status == PillarStatus.could_not_assess
    assert assessment.edges.status == PillarStatus.could_not_assess
    assert assessment.surface.status == PillarStatus.could_not_assess
    assert assessment.confidence == Confidence.low
