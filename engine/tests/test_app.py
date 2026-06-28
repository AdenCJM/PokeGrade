"""HTTP-level tests for the FastAPI engine (app.py).

The whole request surface — multipart parsing, the size/required guards, and
response serialisation — was previously only exercised end to end through the
running server. These drive it via TestClient with the adjudicator forced
offline, so they are deterministic and spend no API call. The ledger is
redirected to a temp DB so the real dev ledger stays clean.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from pokegrade import pipeline
from pokegrade.app import app
from pokegrade.ledger import Ledger
from tests import fixtures as fx


@pytest.fixture(autouse=True)
def _offline_with_temp_ledger(monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    db = tmp_path / "app.db"
    monkeypatch.setattr(pipeline, "Ledger", lambda *a, **k: Ledger(db))


client = TestClient(app)


def test_health_reports_offline_adjudicator():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["adjudicator"] is False  # no key set
    assert body["standards_version"]


def test_grade_well_centred_card_returns_in_hand_check():
    front = fx.bordered_card_png(left=60, right=58, top=62, bottom=60)
    r = client.post(
        "/grade",
        files={"front": ("front_flat.png", front, "image/png")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["verdict"] == "IN_HAND_CHECK"
    assert body["centering"]["front"]["assessable"] is True


def test_grade_off_centre_with_value_skips():
    front = fx.bordered_card_png(left=40, right=80, top=60, bottom=60)
    r = client.post(
        "/grade",
        files={"front": ("front_flat.png", front, "image/png")},
        data={"fee": "25", "spread_9_10": "120"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["verdict"] == "SKIP"
    assert body["limiting_pillar"] == "centering"
    assert body["ev_estimate"] == 95.0


def test_grade_drops_negative_ev_inputs():
    # A direct API caller can bypass the browser's min=0; the engine must drop a
    # negative fee rather than skew the EV gate.
    front = fx.bordered_card_png(left=40, right=80, top=60, bottom=60)
    r = client.post(
        "/grade",
        files={"front": ("front_flat.png", front, "image/png")},
        data={"fee": "-5", "spread_9_10": "120"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["value"]["fee"] is None
    assert body["ev_estimate"] is None  # both inputs needed; fee was dropped


def test_grade_requires_front():
    r = client.post("/grade", files={})
    # FastAPI rejects the missing required file field before our handler runs.
    assert r.status_code in (400, 422)
