"""FastAPI engine: the accuracy backend behind the Next.js web UI.

Runs locally on a fixed port (127.0.0.1:8000). The Next `/api/grade` route
proxies to `/grade` as multipart (raw bytes, so the engine sees the original
file, not a re-encoded canvas blob). `/health` is the readiness gate the dev
orchestration waits on.
"""

from __future__ import annotations

import math
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from . import ENGINE_VERSION
from .config import has_api_key
from .models import GradeResponse, ValueInputs
from .pipeline import grade
from .standards import standards_version

app = FastAPI(title="PokeGrade engine", version=ENGINE_VERSION)

MAX_CLOSEUPS = 6
MAX_BYTES = 30 * 1024 * 1024  # per-image guardrail


@app.get("/health")
def health() -> dict:
    """Readiness + capability probe. `adjudicator` is false when no API key is
    set — the engine still runs (centering + verdict), soft pillars route to
    in-hand check."""
    from .calibrate import load_calibration

    return {
        "status": "ok",
        "engine_version": ENGINE_VERSION,
        "standards_version": standards_version(),
        "adjudicator": has_api_key(),
        "calibration_loaded": load_calibration() is not None,
    }


def _money(v: Optional[float]) -> Optional[float]:
    """Drop a value input that is non-finite or negative (the browser caps at 0,
    but a direct multipart call could send NaN/inf/negative and skew the EV gate
    or pollute the ledger)."""
    if v is None or not math.isfinite(v) or v < 0:
        return None
    return v


def _read(upload: Optional[UploadFile]) -> Optional[bytes]:
    if upload is None:
        return None
    data = upload.file.read()
    if not data:
        return None
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="An uploaded image is too large.")
    return data


@app.post("/grade", response_model=GradeResponse)
async def grade_endpoint(
    front: UploadFile = File(...),
    back: Optional[UploadFile] = File(None),
    closeups: list[UploadFile] = File(default_factory=list),
    card_value: Optional[float] = Form(None),
    fee: Optional[float] = Form(None),
    spread_9_10: Optional[float] = Form(None),
) -> GradeResponse:
    front_bytes = _read(front)
    if not front_bytes:
        raise HTTPException(status_code=400, detail="A front photo is required.")
    back_bytes = _read(back)
    closeup_bytes = [b for b in (_read(c) for c in closeups[:MAX_CLOSEUPS]) if b]

    value = ValueInputs(
        card_value=_money(card_value), fee=_money(fee), spread_9_10=_money(spread_9_10)
    )
    try:
        return grade(
            front_bytes=front_bytes,
            back_bytes=back_bytes,
            closeup_bytes=closeup_bytes,
            value=value,
        )
    except Exception as exc:  # pragma: no cover - surfaced to the web UI
        raise HTTPException(status_code=502, detail=f"Engine error: {exc}") from exc
