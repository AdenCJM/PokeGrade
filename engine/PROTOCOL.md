# PokeGrade Capture Protocol

This is a spec, not code, and it is load-bearing. The grade verdict is only as
honest as the photo it reads. Centering is the one pillar PokeGrade measures
deterministically (border-width ratios in pixels), so a sloppy shot does not just
add noise, it corrupts the only number the engine can stand behind. The rules
below exist to make that pixel measurement trustworthy and to fail closed when it
cannot be.

The verdict language this protocol feeds: a card resolves to **SUBMIT**,
**IN_HAND_CHECK**, or **SKIP**, gated first on centering (`worse_pct`, the larger
border share on the worse axis), then on the soft pillars (corners, edges,
surface) which a flat photo can only screen, never clear.

## 1. Folder and naming convention (local CLI ingest)

One card is one folder. The CLI ingests a folder; filenames are the contract, not
the order they were taken. Unknown files are ignored, not guessed at.

```
<card_id>/
  front_flat.jpg      required  square-on full-front centering shot
  back_flat.jpg       required  square-on full-back centering shot
  front_rake_N.jpg    phase 2   raking-light surface pass, light from North
  front_rake_E.jpg    phase 2   ... East
  front_rake_S.jpg    phase 2   ... South
  front_rake_W.jpg    phase 2   ... West
  corner_macro_TL.jpg phase 2   macro of a single corner (TL/TR/BL/BR)
  corner_macro_TR.jpg phase 2
  corner_macro_BL.jpg phase 2
  corner_macro_BR.jpg phase 2
```

Rules:

- **`<card_id>`** is a stable slug you choose (e.g. `charizard-base-4-001`). It
  becomes the ledger `card_id`, so keep it unique per physical card.
- **`front_flat` and `back_flat` are the only v1 requirements.** Everything else
  is phase 2 and ignored by the v1 ingest.
- Prefer **JPEG straight off the camera roll** so EXIF survives (see section 5).
  `.jpg`, `.jpeg`, `.png`, `.heic` are accepted; HEIC is converted on ingest.
- Names are **case-insensitive** and the rake suffix is a compass letter
  (`N/E/S/W`). A misnamed file is skipped with a note, never silently remapped.

## 2. The centering shot (what v1 actually needs)

This is the whole game for v1. Centering is the only pillar PokeGrade measures deterministically — the OpenCV border-width detection has a correct answer in pixels. Both `front_flat` and `back_flat` must follow every point below or the measurement is flagged low-confidence and the card routes to IN_HAND_CHECK rather than SUBMIT. A sloppy centering shot doesn't just add noise; it corrupts the one number the engine can stand behind.

- **Flat.** Card on a flat surface, camera parallel to it. No tenting, no hand-held
  tilt. Tilt foreshortens one border and invents a centering defect that is not on
  the card.
- **Fill the frame.** The card should occupy most of the frame, all four edges
  visible with a small margin. More card pixels means more precise border-width
  ratios.
- **Square-on.** Shoot perpendicular, edges parallel to the frame. Even a few
  degrees of yaw skews the left/right border ratio.
- **Mid-grey or contrasting background, NOT matte black.** The OpenCV edge detector works by finding contrast between the card and the background. A card with a black border (modern sets, full-arts, many Japanese cards) on a black background has zero contrast—the detector simply cannot see the card edge and the measurement fails silently, producing wildly inaccurate ratios. Mid-grey, white, or any colour that contrasts with the card's outer border solves this. This single rule prevents the most common silent failure mode. Base-set yellow cards are fine on white/grey because the border is already light.
- **Lock exposure, focus, and white balance.** Tap-and-hold to lock (AE/AF lock on
  most phones). Auto-everything hunts between the two shots and changes the edge
  contrast the segmenter depends on.
- **HDR OFF. Sharpening / "clarity" OFF.** Phones invent or hide defects: HDR
  fuses frames and smears edges, computational sharpening paints halos that read
  as edge whitening, and noise reduction erases the micro-scratches surface
  adjudication needs to see. We want the dullest, most literal capture the phone
  can produce.
- Even, diffuse light. No single hard glare across a foil. No flash.

## 3. Value-and-centering-first gate (shoot doomed cards last)

Most cards that will SKIP are killed by EV math or centering before you even need to check the soft pillars. Both are cheap to check up front, so screen them first—don't waste a careful 10-shot session on a card the engine will reject anyway. The gate cuts down on wasted effort.

Order of operations per card:

1. **EV check first.** If `spread_9_10 <= fee` (the 9-to-10 upgrade's upside doesn't clear the grading fee), the card is economically not worth grading regardless of condition. SKIP. Do not photograph.

2. **Quick centering check.** Shoot one `front_flat` to spec. Let the engine measure the `worse_pct` (the larger of the two border ratios). If the worse axis is > 55% (e.g., 58/42, worse than the PSA-10 ceiling of 55/45), a PSA 10 is mathematically off the table—that's a hard 10-killer. The card SKIPs; no point photographing the rest. Past 60% (e.g., 62/38), the engine flags it `CENTERING_OUT_OF_BOUNDS` (clearly out of grading range).

3. **Only cards that pass EV and centering get the full ritual.** These are the ones worth `back_flat` plus the soft-pillar close-ups (phase 2: rake and corner macros).

This gate protects your time, not the engine's. A doomed card exits in two shots. A submittable card gets the full treatment.

## 4. Lens-distortion calibration (one-time, per phone)

Close-focus phone lenses have barrel distortion: straight card edges bow outward,
most at the frame edges. At the working distance a centering shot needs, that bow
corrupts border-width ratios, the exact pixels the verdict gates on. A 55/45 card
shot near the frame edge can read as 58/42 purely from the lens. Calibration
removes it.

- **Run once per phone (per lens):**

  ```
  pokegrade calibrate-lens
  ```

  Capture the printed chessboard target a handful of times across the frame as
  prompted. The CLI solves the camera's intrinsic + distortion coefficients and
  writes a profile (a `calibration_id`) under the engine data dir.
- **Why it matters:** undistorting with the profile straightens the edges before
  the segmenter measures them, so the ratio reflects the card, not the optics.
  This is why the same phone is worth calibrating once and reusing.
- **The web path runs with or without a profile.** If a calibration profile is
  loaded, the measurement uses it and carries the `calibration_id` in provenance.
  If none is loaded, the engine still produces a measurement but flags **reduced
  confidence** (a centering measurement near a ladder boundary cannot be trusted to
  the percentage point without it). No profile is never a hard failure, only a
  confidence downgrade.

## 5. Web vs CLI: the honest limitation

The two ingest paths are not equally trustworthy, and the protocol says so out
loud rather than pretending the web upload is as good as a controlled capture.

- **Browser uploads strip or alter EXIF.** Drag-drop and file pickers commonly
  re-encode, rotate, and discard the EXIF block, and mobile browsers may apply
  auto-HDR or scene enhancement on capture. So EXIF-based capture validation
  (confirming HDR was off, exposure was locked, focal length is known) is
  **degraded on the web path**. The engine cannot verify the shot followed the
  spec; it has to trust the pixels as given.
- **The local CLI ingest retains fuller validation.** Files dropped into a card
  folder keep their original EXIF, so the CLI can check capture settings, read
  focal length, match a lens profile, and reject obviously HDR-fused frames before
  measuring.
- Net: the web path is the convenient front door and will always work, but a card
  on the SUBMIT/SKIP boundary deserves the CLI path. The verdict's confidence field
  reflects which path produced it.

## 6. Phase 2 (deferred, NOT v1)

Listed so the folder convention is forward-compatible, not because any of it ships
in v1:

- **Raking-light surface capture** (`front_rake_N/E/S/W`): four low-angle shots to
  throw shadows across the foil and reveal micro-scratches and dents that the flat
  shot flattens out. Surface is the dominant hidden cap on modern foils, so this is
  the highest-value phase 2 addition.
- **Corner macros** (`corner_macro_*`): per-corner close-ups for whitening and
  fraying that the full-card shot is too coarse to resolve.
- **Cross-polarising film** over the lens and light to kill foil glare entirely,
  for a clean surface read.

None of these is required for a v1 verdict. v1 is centering-led, with corners /
edges / surface screened conservatively from the two flat shots and defaulted to
`could_not_assess`, which routes honestly to IN_HAND_CHECK.
