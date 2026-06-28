"""PokeGrade evaluation harness.

These evals measure PROCESS, not outcome. There is no PSA ground truth in v1
(eng Decision 6), so we cannot score the adjudicator on grade correctness yet.
What we CAN score — and what actually protects the product — is whether the
soft-pillar adjudicator FOLLOWS ITS RUBRIC: did it stay conservative, refuse to
invent a grade, point the loupe at coordinates, and only read text that's
literally legible. An LLM judge rates the assessment against that rubric so a
prompt regression (e.g. the model starts calling pillars "clean" from a flat
shot) is caught before it ships, well before any real PSA labels exist.
"""

from __future__ import annotations

from .judge import judge_adjudication

__all__ = ["judge_adjudication"]
