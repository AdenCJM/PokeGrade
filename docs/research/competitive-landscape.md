# Competitive landscape: AI Pokémon card pre-grading

_Captured: 2026-06-28. Accuracy figures are vendor-reported unless marked independent._

## What pre-grading is

A pre-grader estimates the most likely PSA outcome from photos so the owner can decide whether a card is worth submitting. It is a screening tool and a financial decision, a way to avoid wasting $200+ in submission fees on a card that will not grade well. It is not a replacement for PSA, BGS, CGC, or TAG, which return a physical slab.

## The apps

| App | What it is | Accuracy claim | Notes |
|---|---|---|---|
| SnapGradeAI | Photo pre-grader, Pokémon + multi-TCG | 87% within ±0.5 of PSA over 412 cards; 89% on Pokémon (vendor) | Credibility leader. Publishes a verified-returns log, but the full table with misses is gated behind signup; the public page shows aggregates plus a small sample. $1-2 per pre-grade, 2 free credits. |
| CardGrading.app | Photo pre-grader with sub-grades + live value | None published | Strongest all-round feature set (centering/corners/edges/surface sub-grades plus market prices). About $0.17/card ($4.99/mo for 30). Does not publish accuracy data. |
| CardGrade.io | Photo pre-grader, 16-zone analysis | 92.8% vs PSA (vendor) | Distinct product from CardGrading.app despite the near-identical name. No public per-card log found. |
| TCGrader | Multi-TCG pre-grader (Pokémon, MTG, YGO, sports, One Piece, Lorcana) | None published | Free signup, 1 free credit. High-volume positioning. |
| PokeGrade.AI | No-account instant pre-grader (Pokémon, One Piece, Lorcana) | None published | Live competitor already using the "PokeGrade" name. Light on sub-grade depth and value data. Relevant to branding and positioning. |
| Digital Grading Co (DGC) | Photo pre-grader | 90% exact, 100% within 1 grade over 21 cards (independent, community-compiled) | The only genuinely open per-card log, hosted by a third party. Never inflates; under-calls borderline 9/10s. |
| TAG / AGS | AI-driven slabbing service | n/a | Different product class. Returns a physical slab like PSA, but AI does the evaluation. About $15+/card. |

Open-source graders worth reading as references: `crimsonthinker/psa_pokemon_cards` (deep learning, sub-grade heads) and `u-siri-ous/KYC` (Beckett-based CNN). Small but functional. See [training-data-sources.md](training-data-sources.md).

## What the community says

- The reflex on r/PokemonTCG when any AI tool is named: "Where's the verified-returns log?" Tools claiming "95% accuracy" with no dataset attached get dismissed rather than trusted.
- Pre-grading is framed as a financial decision, not real grading. The pitch that lands is avoiding $200+ in wasted fees per submission.
- There is visible grading fatigue. The most-engaged r/PokemonTCG thread in the research window was a 3,337-upvote, 783-comment "anyone else tired of the grading obsession?" Cheap, honest pre-screening rides that tension: fewer pointless submissions, not more slabs.

## The gap PokeGrade can own

No app publishes a fully open, per-card, miss-inclusive log of pre-grade vs eventual official PSA grade:

- SnapGradeAI gates the full table (with misses) behind signup.
- DGC's open table is independent but tiny (21 cards) and community-compiled, not vendor-published.
- Everyone else publishes nothing.
- No neutral benchmark runs every app blind on the same card set against PSA outcomes.

A truly open, per-card, miss-inclusive verified log, or a standardised blind cross-app benchmark, would be the single most credible trust signal in the category, because that proof is its loudest unmet demand. Treat the public log as a product feature, not just internal QA. Publish misses, not only hits.

## Accuracy nuance to design around

The make-or-break zone is the 9 versus 10 boundary. Independent testing of DGC showed it systematically under-calls borderline gems (a 9.3 to 9.5 prediction can still return PSA 10). Calibration at the top of the scale is where a pre-grader earns or loses trust, because PSA 10 vs PSA 9 is the difference that drives most of a card's value.

## Sources

- SnapGradeAI: https://www.snapgradeai.com/ , verified-returns page https://www.snapgradeai.com/check-psa-grade-before-submission
- CardGrading.app roundup: https://cardgrading.app/blog/best-ai-card-grading-apps
- CardGrade.io: https://cardgrade.io/
- DGC independent test (TCG Talk): https://tcgtalk.com/guides/digital-grading-company-review
- r/PokemonTCG grading-fatigue thread: https://www.reddit.com/r/PokemonTCG/comments/1u7zxzc/is_anyone_else_getting_tired_of_the_grading/
