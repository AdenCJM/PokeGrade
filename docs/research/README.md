# PokeGrade research

Background research for PokeGrade, captured to build on later. The focus is two questions that shape accuracy and roadmap: who else is doing AI pre-grading and where the open gap is, and where to source real ground-truth data to validate and improve the estimate.

_Captured: 2026-06-28. Figures attributed to specific apps are vendor-reported unless marked independent; verify before relying on them._

## Documents

- [competitive-landscape.md](competitive-landscape.md) - the existing AI pre-grading apps, what the community actually says, and the open gap PokeGrade can own: a public, miss-inclusive verified-returns log.
- [training-data-sources.md](training-data-sources.md) - where to source image to official-grade data, a pipeline for assembling the dataset, the label-leakage trap to avoid, and model-architecture references.

## TL;DR

- The market has consolidated into roughly half a dozen photo pre-graders. The line collectors care about is whether a tool publishes a verified-returns log (predicted grade vs the eventual PSA result). Most do not.
- SnapGradeAI is the current credibility leader, but its full log with misses is gated behind signup. No app publishes a fully open, per-card, miss-inclusive log, and no neutral benchmark tests every app on the same cards. That gap is PokeGrade's clearest trust differentiator.
- The clean training triplet (raw photo + AI grade + official grade) does not exist publicly. Assemble it. The PSA Public API is the legitimate ground-truth tap for image plus official grade. Generate the AI-grade column yourself by running the grader over those images.
- Avoid slabbed-card datasets for the grade signal: the printed grade in the frame leaks the label, and slab photos do not match the raw cards users actually photograph.

## How this connects to the current build

PokeGrade today grades with Claude vision and a PSA-style rubric (see the root README and PLAN.md). This research does not call for replacing that. The data sources here are for three things: validating and calibrating the current grader against real PSA outcomes, powering an open verified-returns log as a product feature, and optionally fine-tuning later if the data justifies it.
