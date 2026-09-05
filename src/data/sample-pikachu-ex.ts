import type { GradeResponse } from "@/lib/types";

// A real screening run, reconstructed from the engine's ledger row
// (predictions.run_id 06e2ea69) and the phone screenshots of that result.
// Only fields the ledger or the screenshots actually record are filled in.
// Fields the run produced but nothing preserved (Claude's narrative, the
// per-pillar observation text, the read evidence, the back's axis) are left at
// their empty defaults rather than invented. The card was photographed front
// and back on a phone, flat, with no close-ups and no lens calibration loaded.

export const SAMPLE_META = {
  slug: "pikachu-ex",
  title: "Pikachu ex 277/217",
  screened_on: "2026-07-06",
  screened_label: "6 July 2026",
  capture: "Front and back phone photos only. No close-ups, no lens calibration.",
  images: {
    front: "/samples/pikachu-ex/front.jpg",
    back: "/samples/pikachu-ex/back.jpg",
    overlay: "/samples/pikachu-ex/overlay.jpg",
  },
  provenance: {
    model: "claude-opus-4-8",
    prompt_version: "1.0.0",
    code_commit: "7c141ad",
  },
} as const;

export const SAMPLE_PIKACHU_EX: GradeResponse = {
  card_id: "9a585f2c-320c-49e0-bbef-8a2b8c1f222a",
  run_id: "06e2ea69-8f53-4960-a7e3-fd907d51c00e",
  verdict: "SKIP",
  confidence: "high",
  limiting_pillar: "centering",
  reason_codes: ["CENTERING_CAPS_BELOW_10"],
  centering: {
    front: {
      left_px: null,
      right_px: null,
      top_px: null,
      bottom_px: null,
      h_ratio: "58.5/41.5",
      v_ratio: "unknown",
      worse_axis: "h",
      worse_pct: 58.5,
      border_type: "bordered",
      confidence: "medium",
      assessable: true,
      grade_estimate: 9,
      overlay_png_b64: null,
      overlay_url: SAMPLE_META.images.overlay,
      notes: ["worse-axis centering past 10-eligible band"],
    },
    back: {
      left_px: null,
      right_px: null,
      top_px: null,
      bottom_px: null,
      h_ratio: "unknown",
      v_ratio: "unknown",
      worse_axis: "unknown",
      worse_pct: 53.8,
      worse_ratio: "53.8/46.2",
      border_type: "bordered",
      confidence: "medium",
      assessable: true,
      grade_estimate: 10,
      overlay_png_b64: null,
      notes: [],
    },
  },
  soft_pillars: {
    corners: { status: "could_not_assess", severity: "none", observation: "" },
    edges: { status: "could_not_assess", severity: "none", observation: "" },
    surface: { status: "could_not_assess", severity: "none", observation: "" },
    limiting_pillar_candidate: null,
    loupe_checklist: [
      {
        pillar: "surface",
        location:
          "central holo/textured area over Pikachu's body and crown gems (40-60% width, 40-70% height)",
        what_to_check:
          "Tilt under raking light for micro-scratches, scuffs, and pressure dents that the etched foil hides.",
      },
      {
        pillar: "surface",
        location: "upper name/HP silver band and 'Tera' foil strip",
        what_to_check:
          "Check the reflective metallic band for hairline scratches and print lines running horizontally.",
      },
      {
        pillar: "corners",
        location: "all four corners, especially top-right and bottom-left",
        what_to_check:
          "Look for whitening, fraying, or soft/rounded tips against the rainbow border under magnification.",
      },
      {
        pillar: "edges",
        location: "full perimeter, particularly left and right rainbow-foil edges",
        what_to_check:
          "Inspect for silvering, chipping, and factory rough-cut along the metallic border.",
      },
      {
        pillar: "edges",
        location: "card back blue border perimeter",
        what_to_check:
          "Check the dark blue back border for edge whitening, which shows sharply against the color.",
      },
    ],
    card_read: {
      name: "Pikachu ex",
      set: null,
      number: "277/217",
      language: "English",
      finish: "unknown",
      read_evidence: "",
      confidence: "high",
    },
    photo_quality: {
      gradeable: "limited",
      issues: [
        "Flat overhead only — no raking-light or angled shots",
        "Foil glare across textured surface masks micro-defects",
        "Resolution insufficient to confirm corner/edge integrity",
      ],
    },
    confidence: "low",
    narrative: "",
  },
  value: { card_value: 650, fee: 165, spread_9_10: 1000 },
  ev_estimate: 835,
  ev_worth: true,
  standards_version: "1.0.0",
  engine_version: "0.1.0",
  provenance: {
    received_at: "2026-07-06T04:08:38Z",
    model_id: "claude-opus-4-8",
    prompt_version: "1.0.0",
    standards_version: "1.0.0",
    code_commit: "7c141ad",
    calibration_id: "",
  },
  notes: [
    "No lens-distortion calibration profile loaded — centering confidence reduced; run `pokegrade calibrate-lens` for this phone.",
    "worse-axis centering past 10-eligible band",
  ],
};
