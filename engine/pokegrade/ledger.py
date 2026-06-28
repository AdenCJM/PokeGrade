"""SQLite ledger: the append-only substrate for the open verified log.

PokeGrade's trust differentiator is a miss-inclusive pre-grade vs PSA log, so
the of-record table that backs it must never lose or rewrite history. Two
guarantees follow from that and shape this module:

  1. Actuals are APPEND-ONLY. A card can be re-graded (cracked, resubmitted,
     bumped a grade), so `record_actual` always INSERTs a new row and never
     UPDATEs a prior one. The full sequence of outcomes is the evidence; an
     overwrite would silently launder a miss.
  2. Predictions are pinned to their exact inputs via the provenance hash
     fields, so a logged SUBMIT can be reproduced from the same packet later.

Storage is plain stdlib sqlite3 (local v1, single writer). `reason_codes` and
the provenance bundle are stored as JSON text columns — they are read back for
the verified log, not queried relationally, so a JSON blob is the honest shape.

Fail-closed: read/parse helpers swallow malformed-row errors and skip the row
rather than raise out of a reporting call, so one bad row never takes down the
whole log.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .config import LEDGER_PATH, ensure_data_dirs
from .models import Actual, Prediction, Verdict


def _utc_now_iso() -> str:
    """ISO-8601 UTC timestamp, used when the model carries no explicit one."""
    return datetime.now(timezone.utc).isoformat()


def _json_dumps(value: Any) -> str:
    """Compact, deterministic JSON for the text columns (sorted keys so the
    same logical content hashes/compares the same on round-trip)."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)


def _json_loads_list(text: Optional[str]) -> list[Any]:
    """Parse a JSON list column fail-closed: a NULL or malformed value reads
    back as an empty list rather than raising."""
    if not text:
        return []
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError):
        return []
    return parsed if isinstance(parsed, list) else []


class Ledger:
    """Append-only SQLite ledger for cards, predictions, and actuals.

    A fresh connection is opened per operation (`_connect`) rather than held
    open. Local v1 is a single writer and the volume is tiny, so the simplicity
    of not managing a long-lived connection outweighs the per-call open cost,
    and it keeps the ledger safe to touch from a request handler and a test in
    the same process.
    """

    def __init__(self, path: str | Path | None = None) -> None:
        # Default to the canonical ledger path and make sure .data/ exists so a
        # first call on a clean checkout does not fail on a missing directory.
        ensure_data_dirs()
        self.path = Path(path) if path is not None else LEDGER_PATH
        self.init_db()

    # --- connection / schema ------------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        # Row factory by name keeps the read helpers readable (row["psa_grade"])
        # and decoupled from column ordering.
        conn.row_factory = sqlite3.Row
        # Enforce the FK relationships even though local v1 never deletes; it is
        # cheap insurance against an orphaned prediction.
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def init_db(self) -> None:
        """Create the three tables if they do not exist. Idempotent: safe to
        call on every construction and from migrations, the CREATE ... IF NOT
        EXISTS statements are no-ops once the schema is in place."""
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS cards (
                    card_id          TEXT PRIMARY KEY,
                    captured_at      TEXT,
                    name             TEXT,
                    set_name         TEXT,
                    number           TEXT,
                    protocol_version TEXT,
                    image_dir        TEXT
                );

                CREATE TABLE IF NOT EXISTS predictions (
                    card_id               TEXT,
                    run_id                TEXT,
                    verdict               TEXT,
                    confidence            TEXT,
                    limiting_pillar       TEXT,
                    centering_front       TEXT,
                    centering_back        TEXT,
                    centering_worse_axis  TEXT,
                    reason_codes          TEXT,
                    card_value            REAL,
                    fee                   REAL,
                    spread_9_10           REAL,
                    ev_estimate           REAL,
                    audit_flag            INTEGER,
                    model_id              TEXT,
                    prompt_version        TEXT,
                    prompt_hash           TEXT,
                    packet_hash           TEXT,
                    standards_version     TEXT,
                    code_commit           TEXT,
                    calibration_id        TEXT,
                    created_at            TEXT,
                    FOREIGN KEY (card_id) REFERENCES cards (card_id)
                );

                -- Append-only outcome log. The AUTOINCREMENT id preserves
                -- insertion order so a re-grade reads back after the original.
                CREATE TABLE IF NOT EXISTS actuals (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    card_id     TEXT,
                    submitted   INTEGER,
                    psa_grade   REAL,
                    cert        TEXT,
                    recorded_at TEXT,
                    FOREIGN KEY (card_id) REFERENCES cards (card_id)
                );
                """
            )

    # --- writes -------------------------------------------------------------

    def record_card(
        self,
        card_id: str,
        captured_at: str,
        name: Optional[str] = None,
        set_name: Optional[str] = None,
        number: Optional[str] = None,
        protocol_version: str = "v1",
        image_dir: str = "",
    ) -> None:
        """Upsert the card metadata row. INSERT OR REPLACE because a card_id is
        a stable identity and re-recording it (e.g. with a corrected card read)
        should refresh the metadata, not duplicate the card. This is NOT the
        append-only table — actuals are."""
        with self._connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO cards
                    (card_id, captured_at, name, set_name, number,
                     protocol_version, image_dir)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    card_id,
                    captured_at,
                    name,
                    set_name,
                    number,
                    protocol_version,
                    image_dir,
                ),
            )

    def record_prediction(self, pred: Prediction) -> None:
        """Append one prediction row, flattening the provenance bundle into its
        own columns so the verified log can pin a verdict to its exact inputs
        (model, prompt version + hash, packet hash, standards version, code
        commit, calibration id)."""
        prov = pred.provenance
        created_at = prov.received_at or _utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO predictions
                    (card_id, run_id, verdict, confidence, limiting_pillar,
                     centering_front, centering_back, centering_worse_axis,
                     reason_codes, card_value, fee, spread_9_10, ev_estimate,
                     audit_flag, model_id, prompt_version, prompt_hash,
                     packet_hash, standards_version, code_commit,
                     calibration_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?)
                """,
                (
                    pred.card_id,
                    pred.run_id,
                    pred.verdict.value,
                    pred.confidence.value,
                    pred.limiting_pillar.value if pred.limiting_pillar else None,
                    pred.centering_front,
                    pred.centering_back,
                    pred.centering_worse_axis,
                    _json_dumps(pred.reason_codes),
                    pred.card_value,
                    pred.fee,
                    pred.spread_9_10,
                    pred.ev_estimate,
                    1 if pred.audit_flag else 0,
                    prov.model_id,
                    prov.prompt_version,
                    prov.prompt_hash,
                    prov.packet_hash,
                    prov.standards_version,
                    prov.code_commit,
                    prov.calibration_id,
                    created_at,
                ),
            )

    def record_actual(self, actual: Actual) -> None:
        """APPEND a single actual-outcome row. This is the regression-critical
        guarantee: it is always an INSERT, never an UPDATE, so a re-grade of the
        same card adds a second row and the first is preserved verbatim. The
        AUTOINCREMENT id keeps the rows in submission order on read-back."""
        recorded_at = actual.recorded_at or _utc_now_iso()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO actuals
                    (card_id, submitted, psa_grade, cert, recorded_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    actual.card_id,
                    1 if actual.submitted else 0,
                    actual.psa_grade,
                    actual.cert,
                    recorded_at,
                ),
            )

    # --- reads --------------------------------------------------------------

    def get_actuals(self, card_id: str) -> list[Actual]:
        """All recorded outcomes for a card, in insertion order (oldest first).
        Ordering on the AUTOINCREMENT id, not recorded_at, so the sequence is
        the true write order even if two outcomes share a timestamp."""
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT card_id, submitted, psa_grade, cert, recorded_at
                FROM actuals
                WHERE card_id = ?
                ORDER BY id ASC
                """,
                (card_id,),
            ).fetchall()
        out: list[Actual] = []
        for row in rows:
            out.append(
                Actual(
                    card_id=row["card_id"],
                    submitted=bool(row["submitted"]),
                    psa_grade=row["psa_grade"],
                    cert=row["cert"],
                    recorded_at=row["recorded_at"] or "",
                )
            )
        return out

    # --- reporting ----------------------------------------------------------

    def dual_error_report(self) -> list[dict]:
        """Surface the two error directions PokeGrade most needs to learn from.

        The product's whole credibility rests on owning its misses, and there
        are two kinds:

          - "false_submit":   predicted SUBMIT, but the slab came back below a
                              10 (we told someone to spend the fee and lost).
          - "skip_that_gemmed": predicted SKIP or IN_HAND_CHECK, but the card
                              actually gemmed a 10 (over-caution cost an upgrade).

        For each card holding both a prediction and at least one actual, the
        latest prediction (by created_at) is judged against EVERY recorded
        actual, so a card that gemmed on a re-grade still surfaces as a
        skip_that_gemmed. Rows that classify as neither are omitted. Malformed
        rows are skipped fail-closed rather than crashing the report."""
        with self._connect() as conn:
            # One prediction per card: the most recent by created_at. A card can
            # accrue multiple predictions over re-runs; the latest is of-record.
            pred_rows = conn.execute(
                """
                SELECT p.card_id, p.verdict, p.created_at
                FROM predictions p
                WHERE p.created_at = (
                    SELECT MAX(p2.created_at)
                    FROM predictions p2
                    WHERE p2.card_id = p.card_id
                )
                """
            ).fetchall()
            actual_rows = conn.execute(
                """
                SELECT card_id, psa_grade
                FROM actuals
                ORDER BY id ASC
                """
            ).fetchall()

        # Group actuals by card so each prediction is checked against the full
        # outcome history, not just the most recent grade.
        actuals_by_card: dict[str, list[Optional[float]]] = {}
        for row in actual_rows:
            actuals_by_card.setdefault(row["card_id"], []).append(row["psa_grade"])

        report: list[dict] = []
        for prow in pred_rows:
            card_id = prow["card_id"]
            grades = actuals_by_card.get(card_id)
            if not grades:
                continue  # no actual yet — nothing to verify against
            try:
                verdict = Verdict(prow["verdict"])
            except ValueError:
                continue  # unknown verdict string: skip fail-closed
            for grade in grades:
                if grade is None:
                    continue
                error_type: Optional[str] = None
                if verdict == Verdict.SUBMIT and grade < 10:
                    error_type = "false_submit"
                elif (
                    verdict in (Verdict.SKIP, Verdict.IN_HAND_CHECK)
                    and grade == 10
                ):
                    error_type = "skip_that_gemmed"
                if error_type is not None:
                    report.append(
                        {
                            "card_id": card_id,
                            "verdict": verdict.value,
                            "psa_grade": grade,
                            "error_type": error_type,
                        }
                    )
        return report
