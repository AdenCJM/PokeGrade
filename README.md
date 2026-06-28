# PokeGrade

Submit photos of a Pokémon card and get an **estimated** PSA-style grade with a per-pillar breakdown (centering, corners, edges, surface), card identification, and the specific defects the model can see.

This is a pre-grading **second opinion**, not an official PSA / Beckett / CGC grade. It runs Claude's vision model over your photos. Treat the number as a directional estimate, especially from a single phone photo — see [Accuracy & honesty](#accuracy--honesty).

## Quick start

```bash
# 1. Install deps (already done if node_modules/ exists)
npm install

# 2. Add your Anthropic API key
cp .env.local.example .env.local
#    then edit .env.local and paste your key from
#    https://console.anthropic.com/settings/keys

# 3. Run it
npm run dev          # http://localhost:3000  (this Mac only)
# or
npm run dev:lan      # also reachable from your phone over wifi
```

## Using it from your phone (same wifi)

```bash
npm run dev:lan
```

Next prints a **Network:** URL like `http://192.168.1.103:3000`. Open that on your
phone (it must be on the same wifi as the Mac). The "Camera" button opens the
camera directly. No HTTPS or deploy needed — it uses the native camera picker
rather than the browser webcam API, which is why plain HTTP over LAN works.

If the page won't load on your phone, check that your Mac firewall allows
incoming connections for Node, and that both devices are on the same network.

## How to get the best estimate

- **Fill the frame** with the card, shot straight-on (not at an angle).
- **Kill the glare.** Diffuse light beats a single harsh source; glare hides
  surface scratches and edge whitening and forces the model to guess.
- Add the **back** — centering and edge wear on the back affect the grade.
- Add **close-ups** of the corners and any suspect area. Fine defects are lost
  when the full-card photo is scaled down, so close-ups materially improve the
  read — without them, the model caps corner/edge/surface subgrades at 9.

## Accuracy & honesty

A photo-based estimate can reasonably judge centering and obvious corner/edge/
surface wear. It **cannot** reliably catch micro-scratches, subtle print lines,
or whitening hidden under glare, and it can be fooled by lighting and resolution.
The app asks the model to ground every call in what is actually visible, to flag
per pillar whether the photos can confirm it, to never award a grade it can't
see, and to lower its confidence on poor photos. Use it to triage and compare
cards, not as a substitute for professional grading.

> Tip: run the same card 2-3 times. If the subgrades swing by more than a grade,
> the photos aren't giving the model enough to work with — reshoot square-on with
> better light and add close-ups.

## Configuration

| Env var             | Default           | Notes                                                  |
| ------------------- | ----------------- | ------------------------------------------------------ |
| `ANTHROPIC_API_KEY` | (required)        | Your key. Server-side only, never sent to the browser. |
| `MODEL`             | `claude-opus-4-8` | Set `claude-sonnet-4-6` for faster, cheaper runs.      |

## How it works

1. The browser resizes each photo to a 2576px long edge (Opus 4.8's high-res
   vision ceiling, where corner/edge/surface detail lives), applies EXIF
   orientation, and re-encodes to JPEG.
2. `POST /api/grade` sends the image(s) to Claude Opus 4.8 with a PSA grading
   rubric and a forced structured-output schema (adaptive thinking on).
3. The response is validated and repaired (grades snapped to the PSA scale,
   overall clamped to the weakest pillar) and rendered as the grade, subgrades,
   and defect list.

Images are processed in memory and are **not** stored on the server. Your session
history lives only in your browser (localStorage).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · `@anthropic-ai/sdk` · zod
