"""LLM-judge eval for the soft-pillar adjudicator (eng Decision 6).

The adjudicator has no ground truth to score against in v1 — there are no PSA
grades on file yet. So this judge does NOT ask "was the grade right?"; it asks
"did the adjudicator obey its own rubric?". That is the only thing we can measure
honestly today, and it is also the thing most worth measuring: the adjudicator's
entire value is its conservatism. A flat full-card photo shows the absence of
OBVIOUS defects, not flawlessness, so the adjudicator is instructed to default
unconfirmable pillars to `could_not_assess`, never to emit a numeric grade or a
verdict, to write coordinate-level loupe items, and to read only literally
legible text. A prompt regression that quietly relaxes any of those is exactly
what a process eval is built to catch — before it reaches a user and before a
single real PSA label exists.

Transport mirrors `pokegrade.adjudicate` exactly: the Python Anthropic SDK,
Opus 4.8 via `config.resolve_model()`, adaptive thinking, `output_config.format`
json_schema, effort high, NO temperature/top_p/budget_tokens (all 400 on 4.8),
and `stop_reason` is checked before any content is read.

Fail-closed: no API key, no SDK, a refusal, an empty body, or any parse/transport
error returns a null-scored "judge unavailable" result rather than raising. A
broken judge must never take down the pipeline it is meant to watch.
"""

from __future__ import annotations

import json
from typing import Optional

from pokegrade.config import has_api_key, resolve_model

JUDGE_PROMPT_VERSION = "1.0.0"

# Each criterion is scored 0-10 with a short reason. The judge is a strict JSON
# emitter (output_config.format), so the schema constrains the shape; the prompt
# constrains the meaning. Conservatism is weighted hardest because it is the
# adjudicator's whole reason to exist.
RUBRIC_CRITERIA = (
    "conservatism",
    "no_hallucinated_grade",
    "weakest_link_awareness",
    "loupe_specificity",
    "card_read_grounding",
)

# A score at or above this on the (weighted) total is a "pass". Set high: the
# adjudicator is a safety component, so "mostly followed the rubric" is a fail.
PASS_THRESHOLD = 7.0

_CRITERION_SCORE = {
    "type": "object",
    "additionalProperties": False,
    "required": ["score", "reason"],
    "properties": {
        # JSON Schema here can't express 0..10 (no min/max on the structured
        # output path), so the prompt states the range and we clamp on parse.
        "score": {"type": "number"},
        "reason": {"type": "string"},
    },
}

JUDGE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["rubric", "summary"],
    "properties": {
        "rubric": {
            "type": "object",
            "additionalProperties": False,
            "required": list(RUBRIC_CRITERIA),
            "properties": {c: _CRITERION_SCORE for c in RUBRIC_CRITERIA},
        },
        "summary": {"type": "string"},
    },
}

# Conservatism is the dominant criterion, so it carries the most weight. The rest
# are equal. Weights sum to 1.0 so the weighted mean stays on the 0-10 scale.
_WEIGHTS = {
    "conservatism": 0.40,
    "no_hallucinated_grade": 0.20,
    "weakest_link_awareness": 0.10,
    "loupe_specificity": 0.15,
    "card_read_grounding": 0.15,
}


def build_judge_system_prompt() -> str:
    """The rubric, written for the judge. It deliberately rewards the SAME
    behaviour the adjudicator is instructed to produce, so a judge high score
    means 'the adjudicator obeyed its brief', not 'the card is a 10'."""
    return """You are a strict evaluator auditing one output of PokeGrade's soft-pillar adjudicator. The adjudicator looks at flat (and sometimes close-up) photos of a Pokemon card and rules ONLY the soft pillars — corners, edges, surface — plus a coordinate-level loupe checklist and an honest card read. It must NOT grade centering and must NOT output a verdict (SUBMIT / IN_HAND_CHECK / SKIP) or any numeric grade; a separate deterministic step owns those.

You are NOT checking whether the card's grade is correct — there is no ground truth. You are checking whether the adjudicator FOLLOWED ITS RUBRIC. Score each criterion 0-10 (10 = perfect adherence, 0 = flagrant violation) with a one-sentence reason grounded in the assessment JSON you are given.

CRITERIA:

1. conservatism (THE MOST IMPORTANT). A flat full-card photo shows the ABSENCE OF OBVIOUS DEFECTS, not flawlessness — the micro-scratches and micro-whitening that drop a card from a 10 to a 9 are exactly what flat shots miss. So every soft pillar that the supplied photos cannot actually confirm as flawless MUST be `could_not_assess`, not `clean`. A pillar may be `clean` ONLY if a sharp, glare-free close-up genuinely confirms that area. Score HIGH when unconfirmable pillars defaulted to could_not_assess; score LOW for any pillar marked `clean` without a close-up justification visible in the observation, and lowest of all if everything was waved through as clean from flat shots. `concern` with a concrete visible defect is fine and does not cost conservatism.

2. no_hallucinated_grade. The assessment must contain NO numeric PSA grade (e.g. "this is a 9", "PSA 10") and NO verdict word (SUBMIT / IN_HAND_CHECK / SKIP) anywhere — narrative, observations, loupe items, card read. limiting_pillar_candidate naming a pillar is allowed (that is not a grade). Score 10 if clean; drop fast for any leaked grade or verdict.

3. weakest_link_awareness. The ceiling is the WORST pillar, never an average. Reward an assessment whose narrative / limiting_pillar_candidate identifies the binding constraint (the could_not_assess or concern pillar most likely to cap the card) instead of averaging the pillars or fixating on what looks good.

4. loupe_specificity. Loupe items must point to an actual location to inspect in hand — a coordinate or named region ("top-right corner", "left edge mid-card", "holo band near 60%/30%"), each paired with a concrete thing to check. Score LOW for vague, location-free items ("check the surface", "look at the card") and for an empty checklist on a card that has unconfirmed pillars.

5. card_read_grounding. The card read must rest only on LITERAL readable text/symbols (name as printed, collector number, set symbol, language). read_evidence should cite what was actually legible; name/set/number filled from artwork or guesswork — rather than legible text — is a violation. A null field with low confidence when text is illegible is CORRECT behaviour and should score high, not low.

Then write a 1-2 sentence summary of how well this output adhered to the rubric and the single biggest adherence risk. Be specific and unflattering. Australian English. No grade, no verdict from you either."""


def _clamp_score(raw: object) -> float:
    """Coerce a judge score onto 0..10. The structured-output schema cannot
    enforce the range, so we defend against an out-of-band or non-numeric value
    rather than trust it blindly."""
    try:
        return max(0.0, min(10.0, float(raw)))
    except (TypeError, ValueError):
        # Treat an unparseable score as the conservative floor — a judge that
        # couldn't commit to a number should not silently inflate the total.
        return 0.0


def _weighted_total(rubric: dict[str, dict]) -> float:
    """Weighted mean of the per-criterion scores, conservatism dominant. Any
    criterion the judge omitted counts as 0 (fail-closed on a partial rubric)."""
    return round(
        sum(_WEIGHTS[c] * _clamp_score(rubric.get(c, {}).get("score")) for c in RUBRIC_CRITERIA),
        2,
    )


def _unavailable(reason: str) -> dict:
    """The fail-closed result. score/passed are None so a caller can tell a
    real low score apart from 'the judge never ran' and exclude it from any
    aggregate rather than counting it as a failed assessment."""
    return {"score": None, "passed": None, "rubric": {}, "summary": f"judge unavailable: {reason}"}


def _coerce_rubric(raw: dict) -> dict[str, dict]:
    """Normalise the judge's rubric block into {criterion: {score, reason}} with
    clamped scores and string reasons, tolerating missing criteria."""
    raw_rubric = raw.get("rubric", {}) if isinstance(raw, dict) else {}
    out: dict[str, dict] = {}
    for c in RUBRIC_CRITERIA:
        entry = raw_rubric.get(c, {}) if isinstance(raw_rubric, dict) else {}
        if not isinstance(entry, dict):
            entry = {}
        out[c] = {
            "score": _clamp_score(entry.get("score")),
            "reason": str(entry.get("reason", "")),
        }
    return out


def judge_adjudication(
    packet: dict,
    assessment: dict,
    *,
    model: Optional[str] = None,
) -> dict:
    """Score one soft-pillar assessment against the rubric with an LLM judge.

    Args:
        packet: the inputs the adjudicator saw — its shape is informational
            context for the judge (what photos/centering were available), so we
            pass it as-is. Only the centering note and photo-quality matter to
            the judge's conservatism read; the raw image bytes are NOT resent.
        assessment: the adjudicator's output (a SoftPillarAssessment dumped to a
            dict). This is the artefact under audit.
        model: optional override; defaults to config.resolve_model() (Opus 4.8),
            matching the adjudicator's own wiring.

    Returns:
        {score, passed, rubric, summary}. On any failure path score/passed are
        None and summary explains why — this never raises.
    """
    resolved = model or resolve_model()

    # Fail-closed gate 1: no key, no judge. Mirrors adjudicate.py's has_api_key
    # check so the eval degrades the same way the thing it watches does.
    if not has_api_key():
        return _unavailable("no ANTHROPIC_API_KEY configured")

    # Fail-closed gate 2: SDK import is wrapped — the eval harness must run (and
    # import-check) on a box where anthropic is absent without exploding.
    try:
        import anthropic
    except Exception:
        return _unavailable("anthropic SDK not importable")

    # The judge only needs the centering context and photo-quality from the
    # packet (to reason about whether 'clean' was even defensible) plus the full
    # assessment. We do NOT resend image bytes: the rubric is about the text of
    # the assessment, not a re-grade of the card.
    packet_context = {
        "centering": packet.get("centering"),
        "had_back": bool(packet.get("back_b64")),
        "closeup_count": len(packet.get("closeups_b64") or []),
        "note": packet.get("note"),
    }
    user_content = (
        "PACKET CONTEXT (what the adjudicator had to work with):\n"
        + json.dumps(packet_context, default=str, indent=2)
        + "\n\nADJUDICATOR ASSESSMENT UNDER AUDIT:\n"
        + json.dumps(assessment, default=str, indent=2)
        + "\n\nScore every rubric criterion 0-10 with a one-sentence reason, "
        "then write the summary. Judge ONLY rubric adherence, not grade "
        "correctness."
    )

    try:
        client = anthropic.Anthropic()
        message = client.messages.create(
            model=resolved,
            max_tokens=4000,
            system=build_judge_system_prompt(),
            thinking={"type": "adaptive"},
            output_config={
                "effort": "high",
                "format": {"type": "json_schema", "schema": JUDGE_SCHEMA},
            },
            messages=[{"role": "user", "content": user_content}],
        )
        # Always check stop_reason before reading content — a refusal carries an
        # empty/partial body and must not be parsed as a score.
        if message.stop_reason == "refusal":
            return _unavailable("model declined to evaluate")
        text = next(
            (
                b.text
                for b in message.content
                if getattr(b, "type", "") == "text" and b.text.strip()
            ),
            None,
        )
        if not text:
            return _unavailable("model returned no assessable output")

        raw = json.loads(text)
        rubric = _coerce_rubric(raw)
        total = _weighted_total(rubric)
        return {
            "score": total,
            "passed": total >= PASS_THRESHOLD,
            "rubric": rubric,
            "summary": str(raw.get("summary", "")),
        }
    except Exception as exc:  # fail-closed on any transport / parse error
        return _unavailable(f"{type(exc).__name__}")


# A hardcoded sample so this module is runnable on its own:
#   uv run python -m evals.judge      (or)   uv run python evals/judge.py
# It exercises the real wiring against the real API when a key is present, and
# degrades to the fail-closed "judge unavailable" result when it is not.
_SAMPLE_PACKET = {
    "centering": (
        "Centering (CV, for context only): worse axis h at 54.0/46.0, "
        "worse share 54.0%, bordered, confidence high."
    ),
    "back_b64": None,
    "closeups_b64": [],
    "note": "Single flat front shot, moderate foil glare across the holo band.",
}

# A deliberately well-behaved assessment: everything the flat shot can't confirm
# is could_not_assess, no grade leaks, the loupe items are coordinate-level, and
# the card read cites only legible text. A good judge should score this high.
_SAMPLE_ASSESSMENT = {
    "corners": {
        "status": "could_not_assess",
        "severity": "none",
        "observation": "No sharp glare-free close-up of any corner; flat shot cannot confirm flawlessness.",
    },
    "edges": {
        "status": "could_not_assess",
        "severity": "none",
        "observation": "Edges not resolvable at this resolution; whitening would be invisible here.",
    },
    "surface": {
        "status": "could_not_assess",
        "severity": "none",
        "observation": "Foil glare masks the holo band; micro-scratches cannot be ruled out in-hand only.",
    },
    "limiting_pillar_candidate": "surface",
    "loupe_checklist": [
        {
            "pillar": "surface",
            "location": "holo band near 60%/40% of the card face",
            "what_to_check": "Rake light across the foil for micro-scratches the glare is hiding.",
        },
        {
            "pillar": "corners",
            "location": "top-right corner",
            "what_to_check": "Check under loupe for whitening or a soft tip.",
        },
    ],
    "card_read": {
        "name": "Charizard",
        "set": None,
        "number": "4/102",
        "language": "English",
        "finish": "holo",
        "read_evidence": "Card name 'Charizard' legible; collector number '4/102' legible; set symbol not resolvable.",
        "confidence": "medium",
    },
    "photo_quality": {"gradeable": "limited", "issues": ["foil glare over holo band"]},
    "confidence": "low",
    "narrative": "Centering looks fine, but surface is the likely cap and can't be cleared from this glary flat shot — inspect the holo and the top-right corner in hand.",
}


if __name__ == "__main__":
    result = judge_adjudication(_SAMPLE_PACKET, _SAMPLE_ASSESSMENT)
    print(json.dumps(result, indent=2))
