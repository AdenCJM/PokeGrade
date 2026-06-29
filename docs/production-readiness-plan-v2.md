# PokeGrade: local v1 → public credits-app — build-ready plan (v2)

_Supersedes the v1 production-readiness plan. Incorporates the 2026-06-29 evaluation (`pokegrade-freemium-evaluation.md`) and four locked decisions. Australian English. This is a plan for sign-off, not yet an instruction to build._

## Locked decisions (this revision)

1. **Monetization = tiny hard trial + credits**, not open freemium. A small lifetime free trial, then one-off credit packs ("buy N grades"). Bring-your-own-key for power/binder graders is a Phase 2 add. No "unlimited" tier.
2. **Async job grade flow from Phase 0.** `submit → 202 + job id → poll/SSE`. The synchronous ~130s request is retired.
3. **Verified log and the name/trademark decision are launch blockers**, not Phase 3. Founder PSA seeding starts on day one (multi-month clock).
4. Carried from v1: Vercel (frontend) + Railway/Render (Dockerized engine) + managed Postgres + Cloudflare (DNS/WAF/Turnstile) + R2 for images. Engine secrets (incl. `ANTHROPIC_API_KEY`) on the engine host only. Clerk auth. Raw psycopg3 + numbered migrations, no ORM.
5. **Accuracy posture = go/no-go on a 10**, not grade-band prediction. "Accurate" means a low false-SUBMIT rate (told you to pay the fee, came back below 10) and a low skip-that-gemmed rate, both from `dual_error_report()`, plus coverage (confident-call rate). The conservative `could_not_assess` default and the loupe checklist stay; the open verified log is the accuracy claim. See the Accuracy & calibration workstream below.

## What changed from v1, and why

| v1 | v2 | Reason |
|---|---|---|
| Freemium quota + paid subscription | Tiny trial + credit packs + BYO-key | Every grade is a ~$0.10–0.30 paid Opus call; credits align cost to the discrete paid action. |
| Synchronous ~130s grade | Async job (`enqueue → poll`) | maxDuration 120 vs 130s abort is contradictory and collides with Cloudflare's ~100s 524; a 524 charges a credit for a dropped result. |
| Spend ceiling reads "today's spend" | Usage-capture-first + reservation ceiling + Console hard cap + kill switch | `adjudicate.py` discards `message.usage`; the v1 ceiling has nothing to sum and can't bound a concurrent burst. |
| "1:1" SQLite→Postgres | Deliberate migration (TEXT timestamps, `predictions` PK, scoped trigger, `user_id`) | A literal 1:1 silently breaks ordering, the test suite, and append-only integrity. |
| Trust `X-PokeGrade-User` on the strength of the shared secret | Signed per-request `user_id+tier+expiry` claim the engine verifies | One leaked secret otherwise mints arbitrary-user, arbitrary-tier paid grades. |
| Verified log + name in Phase 3 | Both at launch | The log is the credibility spine and has a multi-month seeding clock; the name is a takedown risk that scales with traffic. |
| Pricing "check it" (correct, but undone) | One verified constant: Opus 4.8 = $5/$25 per Mtok | Real cost ≈ $0.10–0.30/grade. Size every tier on this. |

---

## Phase 0 — Foundation + cost truth (NOT public)

Nothing public ships until all of Phase 0 lands. This phase is the bulk of the work (~2–3 weeks of the long poles).

### 0.1 Cost-truth model (gates the commercial decision; ~1–2 days)
- CREATE `engine/pokegrade/pricing.py` — single source: `PRICING = {"claude-opus-4-8": (5.00, 25.00)}` (USD per 1M input/output tokens), plus `cost_usd(model, usage) -> float`.
- Run `messages.count_tokens` against `claude-opus-4-8` on a representative front+back+4-closeup packet. Record real input/output token counts.
- Eval-gate `imaging.py` MAX_EDGE **1568 vs 2576** on the existing eval set (`engine/evals/`): does the lower resolution change any verdict? If not, set 1568 (≈3× cheaper image tokens). This is the single largest cost lever.
- Add a `cache_control` breakpoint on the system+schema prefix in `adjudicate.py` (images sit after it in the message array, so the rubric prompt caches).
- **Deliverable:** a one-page margin/quota/price model. Free-trial size and credit-pack price derive from it.
- **Acceptance:** the trial size and pack price are written down with the per-grade cost and gross margin per pack.

### 0.2 Usage capture (prerequisite for the spend breaker and the per-grade log)
- MODIFY `adjudicate.py` — immediately after `client.messages.create(...)` returns, read `message.usage` (input/output/cache tokens) **before** JSON parsing, so a post-call parse failure still books spend. Return usage in `meta`.
- MODIFY `pipeline.py` / ledger writes — persist `cost_usd`, input/output tokens, and `used_llm` per grade event.
- **Acceptance:** every completed grade row carries real token counts and a `cost_usd` computed from `pricing.py`.

### 0.3 Postgres + ledger refactor, done right
- CREATE `engine/pokegrade/db.py` — psycopg3 connection pool (sized for Railway/Render limits); short transactions; never hold a connection across OpenCV or the Claude call.
- CREATE `engine/migrations/0001_init.sql` — translate the schema with these deliberate choices:
  - `created_at` / `recorded_at` stay **TEXT** (timestamptz breaks `MAX()` ordering and the exact ISO-8601 string assertions in the tests).
  - `predictions` gets a **BIGSERIAL primary key**; the "latest prediction" query tiebreaks on it (not on `created_at` alone).
  - `cards` keeps `INSERT OR REPLACE` semantics via `ON CONFLICT (card_id) DO UPDATE` (legitimate metadata refresh).
  - `actuals`: append-only trigger that RAISEs on UPDATE/DELETE, **scoped to `actuals` only**, landed in the same migration that creates the table.
  - Add `user_id` (nullable for migration, enforced for new rows) to `cards`, `predictions`, `actuals`; scope every `dual_error_report` query by `user_id`.
  - `reason_codes` → JSONB.
- CREATE `engine/pokegrade/migrate.py` + MODIFY `cli.py` (`pokegrade migrate`) — numbered-migrations runner; expand/contract discipline.
- MODIFY `ledger.py` — psycopg3 against the pool; **preserve method signatures** so `pipeline.py` is untouched.
- Least-privilege DB role: the app role cannot DROP the trigger or ALTER migrations.
- Local dev runs against the same Postgres (docker-compose), so the trigger, atomic credit debit, and JSONB are exercised where you develop.
- **Acceptance (CI on disposable Postgres):** an UPDATE or DELETE on `actuals` raises; existing append-only ledger tests pass green; a concurrent N+1 credit-debit race lands exactly the limit.

### 0.4 Async grade-job flow
- CREATE `grade_jobs` table (migration): `job_id` (client-supplied idempotency key, PK), `user_id`, `status` (`created→queued→running→succeeded|failed|refunded`), `credit_reserved` (bool), `cost_usd`, `result` (JSONB), `error`, `created_at`, `updated_at`. Unique on `job_id` so a retry is a no-op.
- Engine: `POST /jobs` inserts the row (idempotent on `job_id`) and returns `202 + job_id`; a **worker process** (same image, `pokegrade worker` entrypoint) polls `SELECT ... FROM grade_jobs WHERE status='queued' FOR UPDATE SKIP LOCKED`, runs the grade, writes the result, reconciles cost. `GET /jobs/:id` returns status + result. _(Postgres-as-queue with SKIP LOCKED is the simplest robust option for a solo launch; Upstash QStash / Cloudflare Queues is the upgrade if throughput demands it.)_
- MODIFY `src/app/api/grade/route.ts` — becomes the submit endpoint: verify Turnstile + identity, atomically reserve credit (0.5), enqueue, return `202 + job_id`. CREATE `src/app/api/grade/[jobId]/route.ts` — poll proxy to `GET /jobs/:id`.
- MODIFY `src/app/page.tsx` + components — job-status UX (submit → polling/progress → result). The old "await the fetch then move to done" assumption is replaced by job states; this is also a *better* wait experience than a 2-minute spinner.
- **Acceptance:** a duplicate `job_id` never triggers a second paid call; a worker restart resumes queued jobs; the client renders queued/running/succeeded/failed distinctly.

### 0.5 Container + trust boundary
- CREATE `engine/Dockerfile` (multistage; `apt libgl1 libglib2.0-0` for OpenCV runtime; non-root; `CMD uvicorn pokegrade.app:app`) and the worker entrypoint. CREATE `engine/.dockerignore`.
- CREATE `render.yaml` / `railway.json` — port 8000, `/health` check, Postgres add-on, secret env.
- MODIFY `provenance.py::code_commit()` — read `os.environ["CODE_COMMIT"]`; hard-fail at startup if unset in production (no per-request `git` shell-out).
- MODIFY `config.py` — read `ENGINE_SHARED_SECRET`, `DATABASE_URL`, `R2_*`, `SENTRY_DSN`, `CODE_COMMIT`, `SPEND_CEILING_USD`, `GRADING_DISABLED`.
- Trust boundary: `route.ts` signs a short-lived HMAC token binding `user_id + entitlement + expiry`; the engine **verifies** it (the shared secret is transport auth only, not identity). `user_id` derives from the verified Clerk session, never from request input. The engine enforces credit + spend + a hard concurrency cap in its own transaction regardless of header claims.
- ruff + a CI workflow running pytest against a Postgres service container.
- **Acceptance:** `/health` 200, `/jobs` 401 without a valid signed token, container build clean, `CODE_COMMIT` present in the image.

---

## Phase 1 — Hard launch blockers

### 1.1 Identity + entitlements (credits)
- CREATE `src/middleware.ts`, `src/app/api/webhooks/clerk/route.ts`; MODIFY `layout.tsx`, `page.tsx`, `route.ts`, `package.json`.
- Data model: `users` (Clerk id, email, created_at); `credit_transactions` (append-only: `id`, `user_id`, `delta`, `reason`, `stripe_event_id` nullable, `created_at`) with balance = `SUM(delta)`. A trust-consistent, auditable credit ledger.
- Free trial: a small fixed grant on signup (size from 0.1), debited per successful grade.

### 1.2 Anonymous-first first grade
- Allow 1–2 anonymous grades gated by device/IP + Turnstile (infra already built for cost control), counted against the spend ceiling, before the signup ask. Defer signup to value capture (save the grade / hit the limit).
- **Why:** for an impulse "should I grade THIS card" tool aimed at a sceptical community, a signup-before-result wall is the highest-cost conversion mistake; the result screen is the best salesperson.

### 1.3 Layered cost backstop
- The real cap: **atomic credit debit** at job submit (`UPDATE ... WHERE balance >= 1 RETURNING ...`), refunded on `failed`.
- Reservation spend ceiling: `spend_counters(period, reserved_usd, actual_usd)`; reserve worst-case estimated cost before the call, reconcile to actual after; refuse (fail-closed to IN_HAND_CHECK, refund credit) when reserved + worst-case would exceed `SPEND_CEILING_USD`.
- Independent second layer: an **Anthropic Console hard monthly cap** the app cannot defeat.
- Kill switch: `GRADING_DISABLED=1` → engine short-circuits to `conservative_default` (it already does this when `has_api_key()` is false).
- Per-IP + Turnstile rate limit (Upstash/Vercel KV); keep existing size caps.

### 1.4 The 402 / credit-exhausted paywall
- MODIFY the grade handler — branch on status: a credit-exhausted response renders a **dedicated upgrade screen** that keeps the uploaded card visible, shows what a credit pack unlocks, has one Stripe Checkout CTA and a reset/availability line. Add a near-limit nudge. _(Today any non-OK response renders as a flat red error box, which throws away the highest-intent conversion moment.)_

### 1.5 Observability + ops (launch blockers, not nice-to-haves)
- Sentry both sides. Structured JSON logging replacing `print()`. Per-grade log: `run_id`, hashed `user_id`, verdict, latency, tokens, `cost_usd`, fail-closed reason.
- MODIFY `adjudicate.py` — narrow the bare `except` so timeout / refusal / parse / upstream are separately observable; emit a tagged Sentry event on every non-success branch; alert on fallback rate as a model-drift signal; stop leaking exception class names to users. (Capture usage before parsing so post-call failures still book spend.)
- Three phone-reaching alerts (SMS/push, not just Sentry email): **spend-breaker-tripped**, **engine-down** (external uptime on `/health`), **migration-failed**.
- Minimal runbook: "spend tripped", "rotate leaked secret", "restore the ledger".
- Ledger durability: enable provider PITR/automated backups deliberately + a scheduled `pg_dump` of the ledger tables to R2 + **one documented end-to-end restore-into-scratch drill** + a fresh dump immediately before any migration.

### 1.6 Verified log + actuals ingestion (the moat, at launch)
- CREATE a public `/log` read surface from `dual_error_report()` + predictions/actuals, **miss-inclusive** (publish false-submits and skipped-gems, not just hits).
- CREATE an actuals-ingestion path: PSA Public API cert lookup (per the data-sourcing approach) and/or a user "my card came back" web flow. Surface a **stable card permalink / id** on every verdict so a prediction can be joined to its eventual PSA outcome.
- Seed: founder submits real PSA cards through the engine **starting in Phase 0** (the PSA turnaround is the long pole). A log with zero rows is a promise, not proof.

### 1.7 Name / trademark + legal (blocker before marketing; parallel track, starts now)
- Short trademark-counsel consult on the product **name** and on marketing use of card art / TPC logos. Deliberately decide **coexist / differentiate / rename** against the live "PokeGrade.AI" competitor. Secure domain + handles for the final name before any SEO or word-of-mouth accrues.
- CREATE `LICENSE`, privacy/terms pages, footer, account delete/export routes. Persistent in-product disclaimer ("a second opinion, NOT an official grade; not affiliated with PSA/BGS/CGC") on every verdict, not only the footer. GDPR/CCPA: anonymise PII while retaining anonymised ledger rows.

---

## Phase 2 — Monetization + retention

- **Stripe** Checkout selling credit packs (one "buy N grades" SKU minimum); webhook **idempotent on `event.id`**, appends a `credit_transaction`; Customer Portal for receipts/management; store Stripe event ids, reconcile periodically. CREATE billing/webhook routes + `pricing.tsx`.
- **Bring-your-own-key**: a power user supplies their own `ANTHROPIC_API_KEY` (stored encrypted, engine-side only); their grades draw a reduced service credit or none. Moves the highest-cost cohort's spend off your books.
- **Retention loop**: server-side card history (replaces browser-local `localStorage`, survives device change), a "submitted to PSA" status, and a return prompt (email/in-app) to log the returned grade. One loop improves retention, feeds the verified log, and creates shareable "called it" moments. Guard against self-report selection bias poisoning the log.
- Frontend tests (Vitest + RTL + one Playwright happy path) + R2 consented image storage (hashes always, bytes only on consent; signed URLs; retention purge) + deploy automation (`deploy-engine.yml`: build/push image, run `pokegrade migrate` as an expand/contract release step; frontend via Vercel Git integration).

---

## Phase 3 — Hardening

- Private networking between Vercel and the engine (demotes the shared secret from the trust boundary to defence-in-depth); two-key rotation window.
- Account export/delete completeness.
- Virality surface: share / OG-image on the verdict (the most shareable moment), referral.
- SEO per-card / per-set log pages (the verified log doubles as a content/SEO engine).
- Metrics dashboard from `grade_events`; shared-secret `/admin/metrics`.

---

## Accuracy & calibration (cross-phase workstream — the product's credibility spine)

The engine answers one question: "is this card worth submitting to chase a 10?" Accuracy is therefore two error rates (`dual_error_report` already computes them) plus coverage, not point-grade error. Today this is **unmeasured by design** (`evals/judge.py` scores rubric adherence, not outcomes, because no PSA labels exist yet), the centering thresholds (`ten_eligible_max_pct=55`, `skip_threshold_pct=60` in `standards.json`) are reasoned not data-fit, and the per-phone lens calibration (`calibrate.py`) that de-biases centering is an operator one-off that public users will never run. This workstream closes those gaps. It runs in parallel and is gated by the multi-month PSA-return clock, so it **starts day one**.

1. **Blind benchmark seeding (starts Phase 0; the long pole).** Founder submits a **spectrum-spanning** set across the predicted range — SUBMIT *and* IN_HAND_CHECK *and* SKIP cards — photographed the way a user would (phone, no chessboard calibration), logged through the engine, then PSA outcomes ingested via the PSA Public API. Target N≥50–100 to start, growing. **Critical: include the cards the tool said SKIP**, or selection bias makes the SUBMIT rate look great while the SKIP precision is never tested (you can't observe the counterfactual grade of a card you told someone not to submit). Design this as a benchmark, not "submit the ones I think will gem."
2. **Threshold-calibration harness.** Extend `calibrate.py` (or add `calibrate_thresholds.py`): given the labelled log, sweep the centering cutoffs and the confidence model and report the false-submit / skip-gemmed / coverage frontier; pick the operating point. Thresholds move from hand-set in `standards.json` to **data-fit and versioned** (the `standards_version` provenance already supports this).
3. **Device-distortion measurement + generic profiles.** Measure how far an uncalibrated phone lens shifts the worse-axis% (same card across several phones vs a calibrated reference). If material, ship per-camera-model distortion profiles keyed off EXIF camera model; otherwise widen the SUBMIT centering margin to absorb the bias and keep uncalibrated centering capped at medium confidence (the code already does the cap).
4. **Outcome-accuracy regression gate (CI, once labels exist).** Replay logged packets through the engine, compare each verdict to the eventual PSA grade, assert the false-submit rate stays under target. Gate every Opus version bump, prompt edit, and threshold change on it (the `prompt_hash` / provenance machinery detects drift). The current `judge.py` process eval stays as the pre-label guard.
5. **Capture-quality nudges to lift coverage.** Coverage (not error rate) is the binding usefulness constraint — an honest tool says IN_HAND_CHECK a lot. The capture flow should push users toward the close-ups that let soft pillars resolve to clean/concern instead of could_not_assess, especially for high-value cards. The loupe checklist tells them where; ask for those shots up front.
6. **Honest public accuracy panel.** The `/log` surface shows the live false-submit and skip-gemmed rates with denominators, miss-inclusive, alongside coverage. This is both the accuracy claim and the marketing — no competitor publishes it.

**Decision still needed:** the **target false-submit rate at a target coverage** (the operating point in step 2) — e.g. "of cards we call SUBMIT, ≥X% grade 10." Set it once the first benchmark labels land.

## Verification matrix

- Container build + `/health` 200 + `/jobs` 401 without a valid signed token.
- Migrations idempotent; UPDATE/DELETE on `actuals` raises; timestamps round-trip as TEXT; `predictions` PK present.
- `npm run engine:test` green against Postgres; concurrent N+1 credit-debit → exactly the limit succeed.
- Idempotency: a replayed `job_id` returns the existing job, no second paid call.
- Spend-ceiling reservation: a simulated burst cannot exceed `SPEND_CEILING_USD`; kill switch routes to IN_HAND_CHECK and refunds the credit.
- Turnstile 403 / rate-limit 429; anonymous grade counts against the ceiling.
- 402 renders the upgrade screen (not a red error box) with the card still visible.
- Async UX: queued → running → succeeded/failed render distinctly; a worker restart resumes queued jobs.
- Verified log renders miss-inclusive from real seeded rows; a verdict carries a stable permalink.
- Stripe test-mode: a credit-pack purchase appends exactly one `credit_transaction` (idempotent on `event.id`).
- One documented ledger restore-into-scratch drill completed.

## Effort

~4–6 weeks Claude-Code-assisted solo to a safe public launch, plus the multi-month PSA-return clock for seeding the verified log (start day one, in parallel). Phase 0 long poles: async flow + usage capture + the done-right Postgres migration (~2–3 weeks combined). The cost re-baseline is ~1–2 days but gates everything commercial.

## Open items still needing a human decision

- Final product **name** (counsel-dependent) — drives domain/handles/SEO and cannot be cheaply reversed after traffic.
- Free-trial **size** and credit-pack **price** — fall out of the 0.1 cost model; not yet numerically set.
- Whether to seed the verified log with **only founder submissions** at launch or also invite a small trusted-tester cohort.
- The **target false-submit rate at a target coverage** (the accuracy operating point) — set once the first benchmark labels land.
