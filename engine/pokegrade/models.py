"""Shared data contracts for the PokeGrade engine.

These Pydantic models ARE the interface between the modules. `centering.py`
emits a `CenteringMeasurement`; `adjudicate.py` emits a `SoftPillarAssessment`;
`verdict.py` consumes both plus `ValueInputs` and returns a `VerdictResult`;
`ledger.py` persists a `Prediction`; `app.py` returns a `GradeResponse`.

Keep this module dependency-light (pydantic + stdlib only) so every other
module — and the test suite — can import it without pulling in OpenCV or the
Anthropic SDK.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# --- enums ------------------------------------------------------------------


class Verdict(str, Enum):
    SUBMIT = "SUBMIT"
    IN_HAND_CHECK = "IN_HAND_CHECK"
    SKIP = "SKIP"


class Confidence(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class Pillar(str, Enum):
    centering = "centering"
    corners = "corners"
    edges = "edges"
    surface = "surface"


class BorderType(str, Enum):
    bordered = "bordered"
    borderless = "borderless"


class PillarStatus(str, Enum):
    """A soft pillar's photo-screen status.

    `could_not_assess` is the conservative DEFAULT: flat full-card shots usually
    cannot confirm corner/edge/surface flawlessness, so the honest answer is "I
    can't tell from this photo" — which routes the card to IN_HAND_CHECK.
    """

    clean = "clean"
    concern = "concern"
    could_not_assess = "could_not_assess"


class Severity(str, Enum):
    none = "none"
    minor = "minor"
    moderate = "moderate"
    major = "major"


class Finish(str, Enum):
    holo = "holo"
    reverse_holo = "reverse-holo"
    full_art = "full-art"
    non_holo = "non-holo"
    unknown = "unknown"


# --- centering --------------------------------------------------------------


class SideCentering(BaseModel):
    """Deterministic centering measurement for one side of a card.

    `worse_pct` is the larger border-share on the worse axis, 50..100
    (e.g. 58.0 means a 58/42 split). It is what the verdict gates on.
    """

    left_px: Optional[float] = None
    right_px: Optional[float] = None
    top_px: Optional[float] = None
    bottom_px: Optional[float] = None
    h_ratio: str = "unknown"  # "WW.W/LL.L" on the horizontal (left-right) axis
    v_ratio: str = "unknown"  # "WW.W/LL.L" on the vertical (top-bottom) axis
    worse_axis: str = "unknown"  # "h" | "v" | "unknown"
    worse_pct: Optional[float] = None  # larger share on the worse axis, 50..100
    border_type: BorderType = BorderType.bordered
    confidence: Confidence = Confidence.low
    assessable: bool = False  # True only when a real ratio was measured
    grade_estimate: Optional[float] = None  # PSA-ladder grade for this side
    overlay_png_b64: Optional[str] = None  # annotated overlay, base64 (no prefix)
    notes: list[str] = Field(default_factory=list)


class CenteringMeasurement(BaseModel):
    front: Optional[SideCentering] = None
    back: Optional[SideCentering] = None


# --- soft pillars (Claude adjudicator output) -------------------------------


class SoftPillarFlag(BaseModel):
    status: PillarStatus = PillarStatus.could_not_assess
    severity: Severity = Severity.none
    observation: str = ""


class LoupeItem(BaseModel):
    pillar: Pillar
    location: str  # coordinate-level: "top-right corner", "holo near 64%,32%"
    what_to_check: str


class CardRead(BaseModel):
    name: Optional[str] = None
    set: Optional[str] = None
    number: Optional[str] = None
    language: Optional[str] = None
    finish: Finish = Finish.unknown
    read_evidence: str = ""
    confidence: Confidence = Confidence.low


class PhotoQuality(BaseModel):
    gradeable: str = "limited"  # "yes" | "limited" | "no"
    issues: list[str] = Field(default_factory=list)


class SoftPillarAssessment(BaseModel):
    """What Claude returns. It does NOT emit the terminal verdict enum —
    `verdict.py` owns that. Claude supplies the soft-pillar flags, the loupe
    checklist, the card read, and the human narrative.
    """

    corners: SoftPillarFlag = Field(default_factory=SoftPillarFlag)
    edges: SoftPillarFlag = Field(default_factory=SoftPillarFlag)
    surface: SoftPillarFlag = Field(default_factory=SoftPillarFlag)
    limiting_pillar_candidate: Optional[Pillar] = None
    loupe_checklist: list[LoupeItem] = Field(default_factory=list)
    card_read: CardRead = Field(default_factory=CardRead)
    photo_quality: PhotoQuality = Field(default_factory=PhotoQuality)
    confidence: Confidence = Confidence.low
    narrative: str = ""

    @classmethod
    def conservative_default(cls, note: str = "") -> "SoftPillarAssessment":
        """The fail-closed assessment used when no adjudicator ran (no API key,
        engine error, or the soft step was skipped): every soft pillar
        could_not_assess, which routes the card to IN_HAND_CHECK."""
        pq = PhotoQuality(gradeable="limited", issues=[note] if note else [])
        return cls(photo_quality=pq, confidence=Confidence.low, narrative=note)


# --- value / EV inputs ------------------------------------------------------


class ValueInputs(BaseModel):
    card_value: Optional[float] = None  # market price of the raw/likely-9 card
    fee: Optional[float] = None  # grading + shipping fee
    spread_9_10: Optional[float] = None  # price(PSA 10) - price(PSA 9)


# --- verdict ----------------------------------------------------------------


class VerdictResult(BaseModel):
    verdict: Verdict
    limiting_pillar: Optional[Pillar] = None
    confidence: Confidence = Confidence.low
    reason_codes: list[str] = Field(default_factory=list)
    ev_estimate: Optional[float] = None  # spread_9_10 - fee, when both provided
    ev_worth: Optional[bool] = None  # spread covers the fee (None if unknown)


# --- ledger -----------------------------------------------------------------


class Provenance(BaseModel):
    image_hashes: dict[str, str] = Field(default_factory=dict)
    received_at: str = ""  # ISO-8601, stamped by the caller
    model_id: str = ""
    prompt_version: str = ""
    prompt_hash: str = ""
    packet_hash: str = ""
    standards_version: str = ""
    code_commit: str = ""
    calibration_id: str = ""


class Prediction(BaseModel):
    """One logged prediction row. Append-only on actuals; predictions are the
    of-record output tied to their exact inputs via the hash fields."""

    card_id: str
    run_id: str
    verdict: Verdict
    confidence: Confidence
    limiting_pillar: Optional[Pillar] = None
    centering_front: Optional[str] = None  # worse-axis ratio, e.g. "58.0/42.0"
    centering_back: Optional[str] = None
    centering_worse_axis: Optional[str] = None
    reason_codes: list[str] = Field(default_factory=list)
    card_value: Optional[float] = None
    fee: Optional[float] = None
    spread_9_10: Optional[float] = None
    ev_estimate: Optional[float] = None
    audit_flag: bool = False
    provenance: Provenance = Field(default_factory=Provenance)


class Actual(BaseModel):
    card_id: str
    submitted: bool = False
    psa_grade: Optional[float] = None
    cert: Optional[str] = None
    recorded_at: str = ""


# --- full engine response (web <- engine) -----------------------------------


class GradeResponse(BaseModel):
    card_id: str
    run_id: str
    verdict: Verdict
    confidence: Confidence
    limiting_pillar: Optional[Pillar] = None
    reason_codes: list[str] = Field(default_factory=list)
    centering: CenteringMeasurement = Field(default_factory=CenteringMeasurement)
    soft_pillars: SoftPillarAssessment = Field(default_factory=SoftPillarAssessment)
    value: ValueInputs = Field(default_factory=ValueInputs)
    ev_estimate: Optional[float] = None
    ev_worth: Optional[bool] = None
    standards_version: str = ""
    engine_version: str = ""
    provenance: Provenance = Field(default_factory=Provenance)
    notes: list[str] = Field(default_factory=list)
