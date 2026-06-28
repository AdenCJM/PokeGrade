"""Tests for the append-only SQLite ledger.

The load-bearing guarantee is `record_actual` APPENDING (never overwriting) on
a re-grade — that is what keeps the verified log miss-inclusive — so it gets the
most explicit coverage. The rest pins idempotent schema creation, prediction
round-trip with JSON columns preserved, and the dual-error report surfacing both
error directions.
"""

from __future__ import annotations

from pokegrade.ledger import Ledger
from pokegrade.models import (
    Actual,
    Confidence,
    Pillar,
    Prediction,
    Provenance,
    Verdict,
)


def _make_ledger(tmp_path) -> Ledger:
    """A ledger backed by a throwaway DB under pytest's tmp_path so tests never
    touch the real .data/ledger.db."""
    return Ledger(path=tmp_path / "ledger.db")


def _sample_prediction(card_id: str, verdict: Verdict = Verdict.SUBMIT) -> Prediction:
    return Prediction(
        card_id=card_id,
        run_id="run-1",
        verdict=verdict,
        confidence=Confidence.high,
        limiting_pillar=Pillar.centering,
        centering_front="54.0/46.0",
        centering_back="60.0/40.0",
        centering_worse_axis="h",
        reason_codes=["CENTERING_TEN_ELIGIBLE", "ALL_SOFT_PILLARS_CLEAN"],
        card_value=120.0,
        fee=25.0,
        spread_9_10=80.0,
        ev_estimate=55.0,
        audit_flag=True,
        provenance=Provenance(
            received_at="2026-06-28T10:00:00+00:00",
            model_id="claude-opus-4-8",
            prompt_hash="ph_abc",
            packet_hash="pk_def",
            standards_version="1.0.0",
            code_commit="deadbee",
            calibration_id="cal-1",
        ),
    )


def test_init_db_is_idempotent(tmp_path):
    """Constructing the ledger and re-calling init_db must not error or wipe
    data — CREATE TABLE IF NOT EXISTS is a no-op once the schema exists."""
    ledger = _make_ledger(tmp_path)
    ledger.record_card("card-1", captured_at="2026-06-28T09:00:00+00:00")
    ledger.init_db()
    ledger.init_db()
    # A second Ledger over the same path re-runs init_db in its constructor.
    ledger2 = Ledger(path=tmp_path / "ledger.db")
    ledger2.init_db()
    # Data laid down before the re-inits is still there.
    ledger2.record_actual(Actual(card_id="card-1", submitted=True, psa_grade=9.0))
    assert len(ledger2.get_actuals("card-1")) == 1


def test_record_prediction_round_trips(tmp_path):
    """reason_codes (JSON list) and the flattened provenance fields must survive
    the write. We read back through sqlite directly to assert the JSON column
    and a provenance column landed as stored."""
    ledger = _make_ledger(tmp_path)
    ledger.record_card("card-1", captured_at="2026-06-28T09:00:00+00:00")
    pred = _sample_prediction("card-1")
    ledger.record_prediction(pred)

    with ledger._connect() as conn:
        row = conn.execute(
            """
            SELECT verdict, confidence, limiting_pillar, reason_codes,
                   model_id, prompt_hash, packet_hash, standards_version,
                   code_commit, calibration_id, created_at, audit_flag,
                   ev_estimate
            FROM predictions WHERE card_id = ?
            """,
            ("card-1",),
        ).fetchone()

    assert row["verdict"] == "SUBMIT"
    assert row["confidence"] == "high"
    assert row["limiting_pillar"] == "centering"
    # reason_codes preserved as a JSON list, order intact.
    import json

    assert json.loads(row["reason_codes"]) == [
        "CENTERING_TEN_ELIGIBLE",
        "ALL_SOFT_PILLARS_CLEAN",
    ]
    # provenance flattened into its own columns.
    assert row["model_id"] == "claude-opus-4-8"
    assert row["prompt_hash"] == "ph_abc"
    assert row["packet_hash"] == "pk_def"
    assert row["standards_version"] == "1.0.0"
    assert row["code_commit"] == "deadbee"
    assert row["calibration_id"] == "cal-1"
    # received_at populated created_at verbatim (no fallback stamp needed).
    assert row["created_at"] == "2026-06-28T10:00:00+00:00"
    assert row["audit_flag"] == 1
    assert row["ev_estimate"] == 55.0


def test_record_prediction_stamps_created_at_when_empty(tmp_path):
    """When provenance.received_at is empty the ledger stamps a UTC timestamp
    rather than storing a blank — the verified log needs an ordering key."""
    ledger = _make_ledger(tmp_path)
    ledger.record_card("card-empty", captured_at="2026-06-28T09:00:00+00:00")
    pred = _sample_prediction("card-empty")
    pred.provenance.received_at = ""
    ledger.record_prediction(pred)

    with ledger._connect() as conn:
        created_at = conn.execute(
            "SELECT created_at FROM predictions WHERE card_id = ?",
            ("card-empty",),
        ).fetchone()["created_at"]
    assert created_at  # non-empty ISO-8601 stamp
    assert "T" in created_at


def test_record_actual_appends_and_never_overwrites(tmp_path):
    """REGRESSION-CRITICAL: a re-grade of the same card must APPEND a second
    actual row, never overwrite the first. get_actuals returns both, in the
    order they were written. This is the guarantee that keeps the verified log
    miss-inclusive — an overwrite would silently launder a missed call."""
    ledger = _make_ledger(tmp_path)
    ledger.record_card("card-1", captured_at="2026-06-28T09:00:00+00:00")

    first = Actual(
        card_id="card-1",
        submitted=True,
        psa_grade=9.0,
        cert="CERT-FIRST",
        recorded_at="2026-06-28T11:00:00+00:00",
    )
    second = Actual(
        card_id="card-1",
        submitted=True,
        psa_grade=10.0,
        cert="CERT-SECOND",
        recorded_at="2026-06-29T11:00:00+00:00",
    )
    ledger.record_actual(first)
    ledger.record_actual(second)

    actuals = ledger.get_actuals("card-1")
    assert len(actuals) == 2, "re-grade must append, not overwrite"
    # Insertion order preserved: the original 9 still first, the re-grade 10 next.
    assert actuals[0].psa_grade == 9.0
    assert actuals[0].cert == "CERT-FIRST"
    assert actuals[1].psa_grade == 10.0
    assert actuals[1].cert == "CERT-SECOND"


def test_record_actual_stamps_recorded_at_when_empty(tmp_path):
    """A missing recorded_at is stamped UTC, never stored blank."""
    ledger = _make_ledger(tmp_path)
    ledger.record_card("card-1", captured_at="2026-06-28T09:00:00+00:00")
    ledger.record_actual(Actual(card_id="card-1", submitted=True, psa_grade=8.0))
    actuals = ledger.get_actuals("card-1")
    assert len(actuals) == 1
    assert actuals[0].recorded_at  # non-empty
    assert "T" in actuals[0].recorded_at


def test_get_actuals_empty_for_unknown_card(tmp_path):
    ledger = _make_ledger(tmp_path)
    assert ledger.get_actuals("nope") == []


def test_dual_error_report_surfaces_both_directions(tmp_path):
    """A seeded false-submit and skip-that-gemmed must both surface; a correct
    call (SUBMIT -> 10) must not."""
    ledger = _make_ledger(tmp_path)

    # false_submit: predicted SUBMIT, came back a 9.
    ledger.record_card("fs", captured_at="2026-06-28T09:00:00+00:00")
    ledger.record_prediction(_sample_prediction("fs", verdict=Verdict.SUBMIT))
    ledger.record_actual(Actual(card_id="fs", submitted=True, psa_grade=9.0))

    # skip_that_gemmed: predicted SKIP, gemmed a 10.
    ledger.record_card("sg", captured_at="2026-06-28T09:00:00+00:00")
    ledger.record_prediction(_sample_prediction("sg", verdict=Verdict.SKIP))
    ledger.record_actual(Actual(card_id="sg", submitted=True, psa_grade=10.0))

    # correct submit: predicted SUBMIT, gemmed a 10 — must NOT appear.
    ledger.record_card("ok", captured_at="2026-06-28T09:00:00+00:00")
    ledger.record_prediction(_sample_prediction("ok", verdict=Verdict.SUBMIT))
    ledger.record_actual(Actual(card_id="ok", submitted=True, psa_grade=10.0))

    report = ledger.dual_error_report()
    by_card = {r["card_id"]: r for r in report}

    assert by_card["fs"]["error_type"] == "false_submit"
    assert by_card["fs"]["psa_grade"] == 9.0
    assert by_card["fs"]["verdict"] == "SUBMIT"

    assert by_card["sg"]["error_type"] == "skip_that_gemmed"
    assert by_card["sg"]["psa_grade"] == 10.0
    assert by_card["sg"]["verdict"] == "SKIP"

    assert "ok" not in by_card, "a correct SUBMIT->10 is not an error"


def test_dual_error_report_in_hand_check_gemmed_is_a_skip(tmp_path):
    """IN_HAND_CHECK is also a skip direction: if the held-back card gems a 10,
    that is a skip_that_gemmed too."""
    ledger = _make_ledger(tmp_path)
    ledger.record_card("ihc", captured_at="2026-06-28T09:00:00+00:00")
    ledger.record_prediction(
        _sample_prediction("ihc", verdict=Verdict.IN_HAND_CHECK)
    )
    ledger.record_actual(Actual(card_id="ihc", submitted=True, psa_grade=10.0))

    report = ledger.dual_error_report()
    assert {r["card_id"]: r["error_type"] for r in report}["ihc"] == "skip_that_gemmed"


def test_dual_error_report_checks_full_actual_history(tmp_path):
    """A SKIP that gems only on a LATER re-grade must still surface — the report
    judges the prediction against every recorded actual, not just the latest."""
    ledger = _make_ledger(tmp_path)
    ledger.record_card("regrade", captured_at="2026-06-28T09:00:00+00:00")
    ledger.record_prediction(_sample_prediction("regrade", verdict=Verdict.SKIP))
    # First submission missed, the re-grade gemmed.
    ledger.record_actual(Actual(card_id="regrade", submitted=True, psa_grade=8.0))
    ledger.record_actual(Actual(card_id="regrade", submitted=True, psa_grade=10.0))

    report = ledger.dual_error_report()
    gemmed = [r for r in report if r["card_id"] == "regrade"]
    assert any(r["error_type"] == "skip_that_gemmed" for r in gemmed)


def test_dual_error_report_empty_without_actuals(tmp_path):
    """A prediction with no actual yet has nothing to verify against."""
    ledger = _make_ledger(tmp_path)
    ledger.record_card("pending", captured_at="2026-06-28T09:00:00+00:00")
    ledger.record_prediction(_sample_prediction("pending", verdict=Verdict.SUBMIT))
    assert ledger.dual_error_report() == []
