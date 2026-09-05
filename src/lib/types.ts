// Shared types for the converged PokeGrade verdict. Pure module, safe to
// import from client and server. Mirrors the FastAPI engine's GradeResponse
// (engine/pokegrade/models.py). The engine measures centering deterministically,
// Claude rules the soft pillars, and a deterministic step returns an EV-aware
// SUBMIT / IN_HAND_CHECK / SKIP verdict. This is a pre-grade estimate, never an
// official PSA/BGS/CGC grade.

export type Verdict = "SUBMIT" | "IN_HAND_CHECK" | "SKIP";
export type Confidence = "high" | "medium" | "low";
export type Pillar = "centering" | "corners" | "edges" | "surface";
export type PillarStatus = "clean" | "concern" | "could_not_assess";
export type Severity = "none" | "minor" | "moderate" | "major";
export type BorderType = "bordered" | "borderless";
export type Finish =
  | "holo"
  | "reverse-holo"
  | "full-art"
  | "non-holo"
  | "unknown";

export type SideCentering = {
  left_px: number | null;
  right_px: number | null;
  top_px: number | null;
  bottom_px: number | null;
  h_ratio: string;
  v_ratio: string;
  worse_axis: string;
  worse_pct: number | null;
  border_type: BorderType;
  confidence: Confidence;
  assessable: boolean;
  grade_estimate: number | null;
  overlay_png_b64: string | null;
  notes: string[];
  /** Front-end only: a static overlay image (used by the reconstructed sample). */
  overlay_url?: string | null;
  /** Front-end only: the worse-axis ratio when the axis itself is unknown. */
  worse_ratio?: string | null;
};

export type CenteringMeasurement = {
  front: SideCentering | null;
  back: SideCentering | null;
};

export type SoftPillarFlag = {
  status: PillarStatus;
  severity: Severity;
  observation: string;
};

export type LoupeItem = {
  pillar: Pillar;
  location: string;
  what_to_check: string;
};

export type CardRead = {
  name: string | null;
  set: string | null;
  number: string | null;
  language: string | null;
  finish: Finish;
  read_evidence: string;
  confidence: Confidence;
};

export type PhotoQuality = {
  gradeable: string;
  issues: string[];
};

export type SoftPillarAssessment = {
  corners: SoftPillarFlag;
  edges: SoftPillarFlag;
  surface: SoftPillarFlag;
  limiting_pillar_candidate: Pillar | null;
  loupe_checklist: LoupeItem[];
  card_read: CardRead;
  photo_quality: PhotoQuality;
  confidence: Confidence;
  narrative: string;
};

export type ValueInputs = {
  card_value: number | null;
  fee: number | null;
  spread_9_10: number | null;
};

export type Provenance = {
  received_at?: string;
  model_id?: string;
  prompt_version?: string;
  prompt_hash?: string;
  packet_hash?: string;
  standards_version?: string;
  code_commit?: string;
  calibration_id?: string;
};

export type GradeResponse = {
  card_id: string;
  run_id: string;
  verdict: Verdict;
  confidence: Confidence;
  limiting_pillar: Pillar | null;
  reason_codes: string[];
  centering: CenteringMeasurement;
  soft_pillars: SoftPillarAssessment;
  value: ValueInputs;
  ev_estimate: number | null;
  ev_worth: boolean | null;
  standards_version: string;
  engine_version: string;
  provenance?: Provenance;
  notes: string[];
};

/** A graded card as stored in browser history. */
export type HistoryEntry = {
  id: string;
  at: number;
  thumb: string; // small data URL
  response: GradeResponse;
};

// --- presentation -----------------------------------------------------------

export type BandKey = "gem" | "mint" | "high" | "mid" | "low";

export const PILLARS: Pillar[] = ["centering", "corners", "edges", "surface"];

export const PILLAR_LABEL: Record<Pillar, string> = {
  centering: "Centering",
  corners: "Corners",
  edges: "Edges",
  surface: "Surface",
};

export type VerdictMeta = {
  label: string;
  band: BandKey;
  blurb: string;
  action: string;
};

/** Verdict drives the headline colour and copy. SUBMIT is the rare green
 * light; IN_HAND_CHECK (amber) is the honest, expected outcome for a
 * clean-looking card; SKIP (red) is the prosecutor succeeding. */
export function verdictMeta(v: Verdict): VerdictMeta {
  switch (v) {
    case "SUBMIT":
      return {
        label: "Submit",
        band: "mint",
        blurb: "Worth the grading fee",
        action: "Pack it and send it.",
      };
    case "IN_HAND_CHECK":
      return {
        label: "In-hand check",
        band: "mid",
        blurb: "Look before you pay",
        action: "Ten minutes under a loupe turns this into a submit or a skip.",
      };
    case "SKIP":
      return {
        label: "Skip",
        band: "low",
        blurb: "Do not pay to grade this one",
        action: "Keep it raw, or submit for the slab rather than the number.",
      };
  }
}

export const PILLAR_STATUS_LABEL: Record<PillarStatus, string> = {
  clean: "Looks clean",
  concern: "Concern",
  could_not_assess: "Not provable from photo",
};

/** Map a soft-pillar status to a band for its chip colour. */
export function statusBand(s: PillarStatus): BandKey {
  if (s === "clean") return "high";
  if (s === "concern") return "low";
  return "mid"; // could_not_assess, amber "check in hand"
}

/** Human label for a reason code emitted by the verdict engine. */
export function reasonLabel(code: string): string {
  const [key, arg] = code.split(":");
  const pillar = arg ? (PILLAR_LABEL[arg as Pillar] ?? arg) : null;
  const map: Record<string, string> = {
    CENTERING_CAPS_BELOW_10: "Measured centering caps this card below a 10",
    CENTERING_OUT_OF_BOUNDS: "Centering is well past the PSA-10 cutoff",
    CENTERING_COULD_NOT_ASSESS:
      "Centering could not be measured from the photo",
    CENTERING_TEN_ELIGIBLE: "Measured centering is PSA-10 eligible",
    ALL_SOFT_PILLARS_CLEAN: "Corners, edges and surface look clean",
    EV_SPREAD_BELOW_FEE: "The 9-to-10 spread does not cover the grading fee",
    SOFT_PILLAR_COULD_NOT_ASSESS: pillar
      ? `${pillar} cannot be proven clean from the photo`
      : "A soft pillar cannot be proven clean from the photo",
    SOFT_PILLAR_CONCERN: pillar
      ? `Possible ${pillar.toLowerCase()} defect`
      : "A soft-pillar concern was flagged",
    SOFT_PILLAR_MAJOR: pillar
      ? `A photo-visible ${pillar.toLowerCase()} defect caps this card`
      : "A photo-visible defect caps this card",
  };
  return map[key] ?? code;
}

/** The worse-axis ratio string for a side, whichever axis it is. */
export function worseRatio(side: SideCentering | null): string | null {
  if (!side || !side.assessable) return null;
  if (side.worse_axis === "h" && side.h_ratio !== "unknown") return side.h_ratio;
  if (side.worse_axis === "v" && side.v_ratio !== "unknown") return side.v_ratio;
  if (side.worse_ratio) return side.worse_ratio;
  if (side.h_ratio !== "unknown") return side.h_ratio;
  if (side.v_ratio !== "unknown") return side.v_ratio;
  return null;
}

export function axisLabel(axis: string): string | null {
  if (axis === "h") return "left-right";
  if (axis === "v") return "top-bottom";
  return null;
}

/** Overlay image source for a side: the engine's base64 PNG, or a static file. */
export function overlaySrc(side: SideCentering | null): string | null {
  if (!side) return null;
  if (side.overlay_png_b64) return `data:image/png;base64,${side.overlay_png_b64}`;
  return side.overlay_url ?? null;
}

export function formatMoney(n: number): string {
  const abs = Math.abs(n);
  const s = Number.isInteger(abs)
    ? abs.toLocaleString("en-AU")
    : abs.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}$${s}`;
}
