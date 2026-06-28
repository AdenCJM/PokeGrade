"""Claude soft-pillar adjudicator (corners / edges / surface) + loupe checklist.

Claude is demoted from grading the whole card to ruling the soft pillars from
the flat shots at a conservative `could_not_assess` default and writing a
coordinate-level loupe checklist (CEO plan, design Premise 3). It does NOT emit
the terminal verdict — `verdict.py` owns that. No crop-by-crop adjudication in
v1 (phase 2).

Transport: the Python Anthropic SDK, mirroring the proven Opus 4.8 wiring from
the web app (adaptive thinking, `output_config.format` json_schema with NO
`name` field, effort high, NO temperature/top_p/budget_tokens — all 400 on
4.8 — and always check `stop_reason` before reading content). This is the
"reuse the proven Opus 4.8 wiring" the CEO plan calls for; the design's
`claude -p` framing predates the converged FastAPI server.

Fail-closed: any missing key, refusal, or parse failure returns the
conservative default (all soft pillars `could_not_assess`), which routes the
card to IN_HAND_CHECK rather than inventing confidence the photos can't support.
"""

from __future__ import annotations

import json
from typing import Optional

from . import standards as std
from .config import has_api_key, resolve_model
from .models import (
    CardRead,
    CenteringMeasurement,
    Confidence,
    Finish,
    LoupeItem,
    Pillar,
    PhotoQuality,
    PillarStatus,
    Severity,
    SoftPillarAssessment,
    SoftPillarFlag,
)
from .provenance import sha256_text

ADJUDICATOR_PROMPT_VERSION = "1.0.0"

# --- strict JSON contract (output_config.format) ----------------------------
# Enums do the constraining (JSON Schema here can't express min/max). Every
# object is additionalProperties:false and lists every property in required.

_PILLAR_FLAG = {
    "type": "object",
    "additionalProperties": False,
    "required": ["status", "severity", "observation"],
    "properties": {
        "status": {"type": "string", "enum": ["clean", "concern", "could_not_assess"]},
        "severity": {"type": "string", "enum": ["none", "minor", "moderate", "major"]},
        "observation": {"type": "string"},
    },
}
_NULLABLE_STR = {"type": ["string", "null"]}
_CONFIDENCE = {"type": "string", "enum": ["high", "medium", "low"]}

ADJUDICATION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "card_read",
        "soft_pillars",
        "limiting_pillar_candidate",
        "loupe_checklist",
        "photo_quality",
        "confidence",
        "narrative",
    ],
    "properties": {
        "card_read": {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "name",
                "set",
                "number",
                "language",
                "finish",
                "read_evidence",
                "confidence",
            ],
            "properties": {
                "name": _NULLABLE_STR,
                "set": _NULLABLE_STR,
                "number": _NULLABLE_STR,
                "language": _NULLABLE_STR,
                "finish": {
                    "type": "string",
                    "enum": ["holo", "reverse-holo", "full-art", "non-holo", "unknown"],
                },
                "read_evidence": {"type": "string"},
                "confidence": _CONFIDENCE,
            },
        },
        "soft_pillars": {
            "type": "object",
            "additionalProperties": False,
            "required": ["corners", "edges", "surface"],
            "properties": {
                "corners": _PILLAR_FLAG,
                "edges": _PILLAR_FLAG,
                "surface": _PILLAR_FLAG,
            },
        },
        "limiting_pillar_candidate": {
            "type": "string",
            "enum": ["centering", "corners", "edges", "surface", "none"],
        },
        "loupe_checklist": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["pillar", "location", "what_to_check"],
                "properties": {
                    "pillar": {
                        "type": "string",
                        "enum": ["centering", "corners", "edges", "surface"],
                    },
                    "location": {"type": "string"},
                    "what_to_check": {"type": "string"},
                },
            },
        },
        "photo_quality": {
            "type": "object",
            "additionalProperties": False,
            "required": ["gradeable", "issues"],
            "properties": {
                "gradeable": {"type": "string", "enum": ["yes", "limited", "no"]},
                "issues": {"type": "array", "items": {"type": "string"}},
            },
        },
        "confidence": _CONFIDENCE,
        "narrative": {"type": "string"},
    },
}


def build_system_prompt() -> str:
    s = std.load_standards()
    soft = s["soft_pillars"]
    return f"""You are the soft-pillar adjudicator inside PokeGrade, a PSA pre-screen for modern Pokemon cards. A deterministic computer-vision layer has already MEASURED centering; your job is ONLY the soft pillars — corners, edges, surface — plus a coordinate-level loupe checklist and an honest card read. You do NOT grade centering and you do NOT output a verdict (a separate deterministic step decides SUBMIT / IN_HAND_CHECK / SKIP). This is a pre-grading estimate, never an official PSA/BGS/CGC grade.

WEAKEST-LINK RULE. {s["weakest_link"]["rationale"]}

THE CONSERVATIVE DEFAULT — this is the most important instruction. A flat full-card photo shows the ABSENCE OF OBVIOUS DEFECTS, not flawlessness. The micro-scratches and micro-whitening that drop a pack-fresh modern card from a 10 to a 9 are exactly what flat shots miss. So for EACH soft pillar:
  - status "could_not_assess" is the DEFAULT. Use it whenever the photos cannot actually confirm the pillar is flawless (no sharp glare-free close-up of that area, foil glare over the region, low resolution, or an angled shot). {soft["rationale"]}
  - status "concern" ONLY when you can actually SEE a defect (visible whitening, a real scratch you can distinguish from holo glare, a ding, chipping). Set severity minor / moderate / major to how much it threatens a 10. A clear, photo-visible 10-killer is "major".
  - status "clean" ONLY when a sharp, glare-free close-up genuinely confirms that area is flawless. Without such a close-up, a pillar may NOT be "clean".

SURFACE is the dominant hidden cap for modern foils and is honestly degraded to in-hand-only on heavily etched SIRs — if foil glare masks the high-value area, that is "could_not_assess", never "clean".

LOUPE CHECKLIST. Point to exactly where on the card to inspect in hand and under raking light, with coordinates ("top-right corner", "holo band near 60%/30%", "left edge mid-card"). This is the deliverable for a clean-looking card, not a confident grade.

CARD READ — do not hallucinate. In read_evidence state only the literal text and symbols you can actually read (card name as printed, collector number e.g. "4/102", set symbol, language). Fill name/set/number/language ONLY from that evidence; if illegible, use null and lower confidence. Never infer the set from the artwork.

limiting_pillar_candidate: name the soft pillar most likely to cap this card (corners/edges/surface), or "centering" if the centering note flags a problem, or "none". confidence: your overall confidence in this soft-pillar read. narrative: plain, honest English for a collector — what is holding the card back and what to check in hand. Be specific, never flattering."""


def _centering_context(centering: CenteringMeasurement) -> str:
    front = centering.front
    if front is None:
        return "Centering: no front measurement available."
    if not front.assessable or front.worse_pct is None:
        bt = front.border_type.value
        return (
            f"Centering (CV): could not measure a reliable ratio ({bt}, "
            f"confidence {front.confidence.value}). "
            + " ".join(front.notes)
        )
    return (
        f"Centering (CV, for context only — do NOT re-grade it): worse axis "
        f"{front.worse_axis} at {front.h_ratio} / {front.v_ratio}, "
        f"worse share {front.worse_pct:.1f}%, {front.border_type.value}, "
        f"confidence {front.confidence.value}."
    )


def _image_block(b64: str, media_type: str = "image/jpeg") -> dict:
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": b64},
    }


def _to_assessment(raw: dict) -> SoftPillarAssessment:
    def flag(d: dict) -> SoftPillarFlag:
        status = PillarStatus(d.get("status", "could_not_assess"))
        severity = Severity(d.get("severity", "none"))
        # The schema can't express "only a concern carries severity", so
        # normalise the semantic contradiction (clean/could_not_assess + major)
        # the model could still emit — severity is meaningful only for a concern.
        if status != PillarStatus.concern:
            severity = Severity.none
        return SoftPillarFlag(
            status=status, severity=severity, observation=str(d.get("observation", ""))
        )

    sp = raw.get("soft_pillars", {})
    cr = raw.get("card_read", {})
    lpc = raw.get("limiting_pillar_candidate", "none")
    limiting: Optional[Pillar] = None if lpc in (None, "none") else Pillar(lpc)
    pq = raw.get("photo_quality", {})

    return SoftPillarAssessment(
        corners=flag(sp.get("corners", {})),
        edges=flag(sp.get("edges", {})),
        surface=flag(sp.get("surface", {})),
        limiting_pillar_candidate=limiting,
        loupe_checklist=[
            LoupeItem(
                pillar=Pillar(item["pillar"]),
                location=str(item.get("location", "")),
                what_to_check=str(item.get("what_to_check", "")),
            )
            for item in raw.get("loupe_checklist", [])
            if item.get("pillar") in {p.value for p in Pillar}
        ],
        card_read=CardRead(
            name=cr.get("name"),
            set=cr.get("set"),
            number=cr.get("number"),
            language=cr.get("language"),
            finish=Finish(cr.get("finish", "unknown")),
            read_evidence=str(cr.get("read_evidence", "")),
            confidence=Confidence(cr.get("confidence", "low")),
        ),
        photo_quality=PhotoQuality(
            gradeable=str(pq.get("gradeable", "limited")),
            issues=[str(x) for x in pq.get("issues", [])],
        ),
        confidence=Confidence(raw.get("confidence", "low")),
        narrative=str(raw.get("narrative", "")),
    )


def prompt_hash() -> str:
    """Hash of the system prompt + schema, for ledger provenance."""
    return sha256_text(
        build_system_prompt() + json.dumps(ADJUDICATION_SCHEMA, sort_keys=True)
    )


def adjudicate(
    *,
    front_b64: Optional[str],
    back_b64: Optional[str] = None,
    closeups_b64: Optional[list[str]] = None,
    centering: CenteringMeasurement,
) -> tuple[SoftPillarAssessment, dict]:
    """Run the soft-pillar adjudication. Returns (assessment, meta) where meta
    carries {model_id, prompt_version, prompt_hash, used_llm}. Fail-closed.

    front_b64 is None when the front photo could not be decoded — we do NOT
    ship undecodable bytes to the API (it would 400 and waste a call), we fail
    closed locally."""
    model = resolve_model()
    meta = {
        "model_id": model,
        "prompt_version": ADJUDICATOR_PROMPT_VERSION,
        "prompt_hash": prompt_hash(),
        "used_llm": False,
    }

    if not front_b64:
        return (
            SoftPillarAssessment.conservative_default(
                "Front photo could not be decoded — soft pillars not assessed; "
                "routed to in-hand check."
            ),
            meta,
        )

    if not has_api_key():
        return (
            SoftPillarAssessment.conservative_default(
                "No ANTHROPIC_API_KEY configured — soft pillars not assessed; "
                "routed to in-hand check."
            ),
            meta,
        )

    try:
        import anthropic
    except Exception:
        return (
            SoftPillarAssessment.conservative_default(
                "Anthropic SDK unavailable — soft pillars not assessed."
            ),
            meta,
        )

    closeups_b64 = closeups_b64 or []
    content: list[dict] = [{"type": "text", "text": "FRONT (flat):"}, _image_block(front_b64)]
    if back_b64:
        content.append({"type": "text", "text": "BACK (flat):"})
        content.append(_image_block(back_b64))
    for i, c in enumerate(closeups_b64):
        content.append({"type": "text", "text": f"Close-up {i + 1}:"})
        content.append(_image_block(c))
    content.append(
        {
            "type": "text",
            "text": (
                _centering_context(centering)
                + "\n\nRule the soft pillars (corners, edges, surface) for THIS card "
                "from the shots above, defaulting to could_not_assess wherever the "
                "photos cannot confirm flawlessness. Write the loupe checklist and "
                "the card read. Do not grade centering; do not output a verdict."
            ),
        }
    )

    try:
        client = anthropic.Anthropic()
        message = client.messages.create(
            model=model,
            max_tokens=8000,
            system=build_system_prompt(),
            thinking={"type": "adaptive"},
            output_config={
                "effort": "high",
                "format": {"type": "json_schema", "schema": ADJUDICATION_SCHEMA},
            },
            messages=[{"role": "user", "content": content}],
        )
        if message.stop_reason == "refusal":
            return (
                SoftPillarAssessment.conservative_default(
                    "The model declined to assess these photos — routed to in-hand check."
                ),
                meta,
            )
        text = next(
            (b.text for b in message.content if getattr(b, "type", "") == "text" and b.text.strip()),
            None,
        )
        if not text:
            return (
                SoftPillarAssessment.conservative_default(
                    "The model returned no assessable output — routed to in-hand check."
                ),
                meta,
            )
        assessment = _to_assessment(json.loads(text))
        meta["used_llm"] = True
        return assessment, meta
    except Exception as exc:  # fail-closed on any upstream / parse error
        return (
            SoftPillarAssessment.conservative_default(
                f"Soft-pillar adjudication unavailable ({type(exc).__name__}) — "
                "routed to in-hand check."
            ),
            meta,
        )
