// Shared types for the converged PokeGrade verdict. Pure module — safe to
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
};

/** Verdict drives the headline colour and copy. SUBMIT is the rare green-light;
 * IN_HAND_CHECK (amber) is the honest, expected outcome for a clean-looking
 * card; SKIP (red) is the prosecutor succeeding. */
export function verdictMeta(v: Verdict): VerdictMeta {
  switch (v) {
    case "SUBMIT":
      return { label: "Submit", band: "mint", blurb: "Worth the grading fee" };
    case "IN_HAND_CHECK":
      return {
        label: "In-hand check",
        band: "mid",
        blurb: "Inspect under a loupe before deciding",
      };
    case "SKIP":
      return { label: "Skip", band: "low", blurb: "Don't pay to grade this one" };
  }
}

export const PILLAR_STATUS_LABEL: Record<PillarStatus, string> = {
  clean: "Looks clean",
  concern: "Concern",
  could_not_assess: "Can't confirm from photo",
};

/** Map a soft-pillar status to a band for its chip colour. */
export function statusBand(s: PillarStatus): BandKey {
  if (s === "clean") return "high";
  if (s === "concern") return "low";
  return "mid"; // could_not_assess — amber "check in hand"
}

/** Human label for a reason code emitted by the verdict engine. */
export function reasonLabel(code: string): string {
  const [key, arg] = code.split(":");
  const map: Record<string, string> = {
    CENTERING_CAPS_BELOW_10: "Measured centering caps this below a 10",
    CENTERING_OUT_OF_BOUNDS: "Centering is well past the PSA-10 cutoff",
    CENTERING_COULD_NOT_ASSESS: "Centering could not be measured from the photo",
    CENTERING_TEN_ELIGIBLE: "Measured centering is PSA-10 eligible",
    ALL_SOFT_PILLARS_CLEAN: "Corners, edges and surface look clean",
    EV_SPREAD_BELOW_FEE: "The 9-to-10 spread does not cover the grading fee",
    SOFT_PILLAR_COULD_NOT_ASSESS: arg
      ? `${PILLAR_LABEL[arg as Pillar] ?? arg} can't be confirmed from the photo`
      : "A soft pillar can't be confirmed from the photo",
    SOFT_PILLAR_CONCERN: arg
      ? `Possible ${arg} defect`
      : "A soft-pillar concern was flagged",
    SOFT_PILLAR_MAJOR: arg
      ? `A photo-visible ${arg} defect caps this card`
      : "A photo-visible defect caps this card",
  };
  return map[key] ?? code;
}
