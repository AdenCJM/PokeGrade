"""Ingest orchestration: images + value inputs -> evidence -> verdict -> ledger.

This is the one place every module is wired together:

    measure centering (CV) -> adjudicate soft pillars (Claude) -> decide
    verdict (deterministic) -> record the prediction (ledger) -> respond.

The verdict gates are deterministic and own the terminal enum; Claude fills the
soft-pillar judgment the CV cannot. The engine REPLACES the shipped whole-card
LLM grade — there is no silent fallback to LLM-eyeballed centering.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from . import adjudicate, centering as centering_mod, imaging, standards as std, verdict as verdict_mod
from . import ENGINE_VERSION
from .calibrate import load_calibration
from .config import ensure_data_dirs
from .exif_validate import validate_exif
from .ledger import Ledger
from .models import (
    Confidence,
    GradeResponse,
    PillarStatus,
    Prediction,
    Provenance,
    Severity,
    ValueInputs,
    Verdict,
)

_SOFT_PILLAR_NAMES = ("corners", "edges", "surface")
from .provenance import code_commit, hash_packet, sha256_bytes


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _worse_ratio(side) -> Optional[str]:
    if side is None or not side.assessable:
        return None
    return side.h_ratio if side.worse_axis == "h" else side.v_ratio


def grade(
    *,
    front_bytes: bytes,
    back_bytes: Optional[bytes] = None,
    closeup_bytes: Optional[list[bytes]] = None,
    value: Optional[ValueInputs] = None,
    ledger: Optional[Ledger] = None,
) -> GradeResponse:
    """Run the full ingest pipeline for one card and persist the prediction."""
    ensure_data_dirs()
    value = value or ValueInputs()
    closeup_bytes = closeup_bytes or []
    card_id = str(uuid.uuid4())
    run_id = str(uuid.uuid4())
    received_at = _now_iso()
    notes: list[str] = []

    # --- provenance the engine can see server-side --------------------------
    image_hashes = {"front_flat": sha256_bytes(front_bytes)}
    if back_bytes:
        image_hashes["back_flat"] = sha256_bytes(back_bytes)
    for i, c in enumerate(closeup_bytes):
        image_hashes[f"closeup_{i + 1}"] = sha256_bytes(c)

    # EXIF capture validation is degraded on the web path (phones strip EXIF).
    exif = validate_exif(front_bytes)
    if exif.get("degraded"):
        notes.extend(exif.get("flags", []))

    # --- lens calibration (optional; web path runs with or without) ---------
    calibration = load_calibration()
    calibration_id = ""
    if calibration:
        calibration_id = str(calibration.get("calibration_id", ""))
    else:
        notes.append(
            "No lens-distortion calibration profile loaded — centering confidence "
            "reduced; run `pokegrade calibrate-lens` for this phone."
        )

    # Normalise once: lossless upright PNG for the CV path, oriented JPEG for
    # Claude. This handles HEIC and EXIF orientation that raw cv2/Claude cannot.
    cv_front = imaging.normalize_for_cv(front_bytes)
    cv_back = imaging.normalize_for_cv(back_bytes) if back_bytes else None

    # --- 1. deterministic centering -----------------------------------------
    centering = centering_mod.measure_card(cv_front, cv_back, calibration)
    if centering.front is not None:
        notes.extend(centering.front.notes)
        # Without a lens-calibration profile the +/-2pp accuracy target does not
        # hold, so a measured result cannot be "high" confidence — cap it at
        # medium, which honestly downgrades the centering read (a SUBMIT, whose
        # confidence tracks the centering read, can no longer claim high).
        if not calibration and centering.front.confidence == Confidence.high:
            centering.front.confidence = Confidence.medium

    # --- 2. Claude soft-pillar adjudication (fail-closed) -------------------
    front_b64 = imaging.to_jpeg_b64(front_bytes)  # None if undecodable
    back_b64 = imaging.to_jpeg_b64(back_bytes) if back_bytes else None
    closeups_b64 = [b for b in (imaging.to_jpeg_b64(c) for c in closeup_bytes) if b]
    soft, adj_meta = adjudicate.adjudicate(
        front_b64=front_b64,
        back_b64=back_b64,
        closeups_b64=closeups_b64,
        centering=centering,
    )
    if not adj_meta.get("used_llm"):
        notes.append(soft.narrative or "Soft pillars not assessed — routed to in-hand check.")

    # Design honesty: a flat full-card shot shows the ABSENCE of obvious defects,
    # not flawlessness. Without a corroborating close-up, a soft pillar may not
    # count as "clean" — downgrade it to could_not_assess so SUBMIT is
    # unreachable on flat shots alone. This is the deterministic backstop for the
    # premise the prompt also states (no confident 10 from photos), and it caps a
    # model-drift / text-in-image prompt injection that flips all pillars clean.
    if not closeups_b64:
        for name in _SOFT_PILLAR_NAMES:
            flag = getattr(soft, name)
            if flag.status == PillarStatus.clean:
                flag.status = PillarStatus.could_not_assess
                flag.severity = Severity.none

    # --- 3. deterministic verdict -------------------------------------------
    vr = verdict_mod.decide(centering, soft, value)

    # --- audit sampling: a random share of non-SUBMIT predictions is flagged
    # for occasional real submission so over-skipping stays measurable. --------
    audit_flag = vr.verdict != Verdict.SUBMIT and random.random() < std.audit_sample_rate()

    # --- provenance + ledger ------------------------------------------------
    packet = {
        "centering": centering.model_dump(exclude={"front": {"overlay_png_b64"}, "back": {"overlay_png_b64"}}),
        "soft_pillars": soft.model_dump(),
        "value": value.model_dump(),
        "image_hashes": image_hashes,
    }
    provenance = Provenance(
        image_hashes=image_hashes,
        received_at=received_at,
        model_id=str(adj_meta.get("model_id", "")),
        prompt_version=str(adj_meta.get("prompt_version", "")),
        prompt_hash=str(adj_meta.get("prompt_hash", "")),
        packet_hash=hash_packet(packet),
        standards_version=std.standards_version(),
        code_commit=code_commit(),
        calibration_id=calibration_id,
    )

    prediction = Prediction(
        card_id=card_id,
        run_id=run_id,
        verdict=vr.verdict,
        confidence=vr.confidence,
        limiting_pillar=vr.limiting_pillar,
        centering_front=_worse_ratio(centering.front),
        centering_back=_worse_ratio(centering.back),
        centering_worse_axis=(centering.front.worse_axis if centering.front else None),
        reason_codes=vr.reason_codes,
        card_value=value.card_value,
        fee=value.fee,
        spread_9_10=value.spread_9_10,
        ev_estimate=vr.ev_estimate,
        audit_flag=audit_flag,
        provenance=provenance,
    )

    led = ledger or Ledger()
    led.init_db()
    led.record_card(
        card_id=card_id,
        captured_at=received_at,
        name=soft.card_read.name,
        set_name=soft.card_read.set,
        number=soft.card_read.number,
    )
    led.record_prediction(prediction)

    return GradeResponse(
        card_id=card_id,
        run_id=run_id,
        verdict=vr.verdict,
        confidence=vr.confidence,
        limiting_pillar=vr.limiting_pillar,
        reason_codes=vr.reason_codes,
        centering=centering,
        soft_pillars=soft,
        value=value,
        ev_estimate=vr.ev_estimate,
        ev_worth=vr.ev_worth,
        standards_version=std.standards_version(),
        engine_version=ENGINE_VERSION,
        provenance=provenance,
        notes=notes,
    )
