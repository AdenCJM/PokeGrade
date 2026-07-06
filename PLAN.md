# PokeGrade — Implementation Plan (v1)

This is the original v1 implementation plan. For the v2 public-launch roadmap, see [`docs/production-readiness-plan-v2.md`](../docs/production-readiness-plan-v2.md).

## Goal
A web app where a user submits photos of a Pokémon card and gets an estimated grade with a per-dimension breakdown. Usable this afternoon, run locally on a Mac and reachable from a phone over the home wifi (LAN). Front photo required; back and close-up photos optional.

This produces a **pre-grading estimate / second opinion**, not an official PSA/Beckett/CGC grade. The UI must be honest about that.

## Grading engine
Claude Opus 4.8 vision (model configurable via env). The image(s) plus an engineered grading prompt are sent server-side. The model acts as a professional grader using PSA-style methodology across four pillars. PSA methodology is the industry standard for Pokémon cards, so predictions are directly comparable to official grades:
- **Centering** — front/back, left-right and top-bottom border ratios
- **Corners** — sharpness, whitening, fraying, dings
- **Edges** — whitening, chipping, nicks, roughness
- **Surface** — scratches, print lines, indentations, holo scratches, stains, gloss, dimples

### Structured output (forced via tool use, validated with zod)
```
{
  identification: { name, set?, number?, language?, finish? (holo|reverse|full-art|non-holo|unknown), confidence },
  subgrades: { centering, corners, edges, surface },   // each 1-10, 0.5 steps
  centeringEstimate?: { frontLR?, frontTB?, backLR?, backTB? },  // e.g. "55/45"
  overall: number,            // 1-10, PSA-style, 0.5 steps
  gradeLabel: string,         // "Gem Mint", "Mint", "NM-MT", ...
  confidence: "low"|"medium"|"high",
  defects: [ { dimension, severity (minor|moderate|major), location, description } ],
  summary: string,            // plain-English
  caveats: string[]           // photo-quality limitations
}
```

The prompt forces the model to ground every observation in what is actually visible, to lower confidence when photos are blurry / glared / low-res / angled, and to never invent a card ID it cannot read.

## Stack
- **Next.js (App Router) + TypeScript + React** — single codebase, server API route keeps the API key off the client.
- **Tailwind CSS** — fast, clean styling, dark mode default + light mode.
- **@anthropic-ai/sdk** — vision call from the server route.
- **zod** — validate the model's structured output.
- Key read from `.env.local` as `ANTHROPIC_API_KEY`; `MODEL` optional override.

## Image handling
- Client resizes each photo to a max long edge of **1568px**. This is Claude's vision sweet spot: larger resolutions get downsampled server-side anyway, so resizing client-side saves bandwidth and API token cost without losing meaningful detail. JPEG compression at ~0.85 quality is invisible to the model but further reduces payload.
- Front (required), Back (optional), Close-ups (optional, multiple). All sent in one message. The UI explains that close-ups of corners and edges dramatically improve accuracy because fine defects (whitening, fraying, surface scratches) can get lost at full-card resolution.
- Reject non-image files; cap total count and individual file size to prevent abuse.

## UX flow
1. Landing: large capture/upload zone. On mobile, `<input type="file" accept="image/*" capture="environment">` opens the camera (works over plain HTTP on LAN — no HTTPS needed, unlike getUserMedia). On desktop, file picker + drag-drop.
2. Slots: Front (required), Back (optional), Close-ups (optional). Thumbnails with remove.
3. "Grade card" → loading state (dimensions animate while analysing).
4. Result panel: big overall grade with grade-band colour, card identification, four subgrade bars, defect list with locations, plain-English summary, confidence, caveats.
5. "Grade another" resets. Session history (localStorage thumbnails + grades) to compare cards.

## Design system
- Aesthetic: "premium grading lab." Dark mode default (collectibles apps read well dark), light mode supported. Restrained, intentional — no gradient-everywhere AI slop, no emoji-as-UI.
- Typography: strong display face for the grade number; clean sans for body.
- Colour: grade bands — 10 gem (emerald/gold), 9 green, 7-8 teal/blue, 5-6 amber, <5 red. Neutral surfaces otherwise.
- Layout: mobile-first single column, generous spacing, card-like result surface.
- Motion: subtle count-up on the grade, subgrade bars fill in. Nothing gratuitous.

## Edge cases & eng concerns
- No/invalid API key → server returns a clear 4xx/5xx with an actionable message; UI shows "set ANTHROPIC_API_KEY in .env.local".
- Oversized / non-image input → validate client + server; resize client-side.
- Malformed model output → forced tool-use schema + zod validation + one retry on parse failure.
- Glare/blur/low-res/angled → model lowers confidence and lists caveats.
- API errors / rate limits → friendly error + retry button.
- Latency (opus vision on detailed analysis can be 15-40s) → strong loading state; model switchable to sonnet via env for speed.
- Cost → client-side downscale controls token count.
- Security → key server-side only; `.env.local` gitignored; request size limits.
- Privacy → images processed in memory, not persisted server-side; history kept only in the browser.

## LAN access
- Dev script runs `next dev -H 0.0.0.0 -p 3000` and prints the Mac's LAN IP so the phone can open `http://<lan-ip>:3000`.
- File-input camera capture avoids the HTTPS requirement that `getUserMedia` would impose.

## Deliverables
- Working Next.js app, `npm install && npm run dev`.
- `.env.local.example`, README with run + LAN + key instructions.
- A sample/smoke test of the API route with a test image.
