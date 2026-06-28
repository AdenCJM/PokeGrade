// Shared types for a PSA-style grade ESTIMATE. Pure module — safe to import
// from both client and server (no SDK / node deps here).

export type Assessable = "yes" | "limited" | "no";
export type Confidence = "low" | "medium" | "high";
export type Severity = "minor" | "moderate" | "major";
export type Pillar = "centering" | "corners" | "edges" | "surface";
export type Finish =
  | "holo"
  | "reverse-holo"
  | "full-art"
  | "non-holo"
  | "unknown";

/** PSA uses whole grades plus a 1.5 (Fair). No 9.5 / half grades. */
export const PSA_GRADES = [1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const CENTERING_RATIOS = [
  "50/50",
  "55/45",
  "60/40",
  "65/35",
  "70/30",
  "75/25",
  "80/20",
  "85/15",
  "90/10",
  "unknown",
  "not-provided",
] as const;
export type CenteringRatio = (typeof CENTERING_RATIOS)[number];

export type Subgrade = {
  /** 1-10 PSA scale (1.5 allowed). */
  grade: number;
  /** Could the photos actually confirm this pillar? */
  assessable: Assessable;
};

export type GradeResult = {
  scale: "PSA";
  photoQuality: {
    overallGradeable: Assessable;
    issues: string[];
  };
  identification: {
    /** Literal text/symbols the model can actually read on the card. */
    readEvidence: string;
    name: string | null;
    set: string | null;
    number: string | null;
    language: string | null;
    finish: Finish;
    confidence: Confidence;
  };
  observations: Record<Pillar, string>;
  centering: {
    frontRatioLR: CenteringRatio;
    frontRatioTB: CenteringRatio;
    backRatioLR: CenteringRatio;
    backRatioTB: CenteringRatio;
  };
  subgrades: Record<Pillar, Subgrade>;
  /** Overall estimated PSA grade. */
  overall: number;
  confidence: Confidence;
  defects: Array<{
    dimension: Pillar;
    severity: Severity;
    location: string;
    description: string;
  }>;
  summary: string;
  caveats: string[];
};

/** A graded card as stored in browser history. */
export type HistoryEntry = {
  id: string;
  at: number;
  thumb: string; // small data URL
  result: GradeResult;
};

// --- Grade presentation -----------------------------------------------------

export type BandKey = "gem" | "mint" | "high" | "mid" | "low";

/** PSA grade label for a numeric grade. */
export function gradeLabel(n: number): string {
  const map: Record<string, string> = {
    "10": "Gem Mint",
    "9": "Mint",
    "8": "NM-MT",
    "7": "Near Mint",
    "6": "EX-MT",
    "5": "Excellent",
    "4": "VG-EX",
    "3": "Very Good",
    "2": "Good",
    "1.5": "Fair",
    "1": "Poor",
  };
  return map[String(n)] ?? "—";
}

/**
 * Band drives colour. Only hue rotates across the ramp; 10 is structurally
 * special (gold). Keep these keys in sync with the band tokens in globals.css.
 */
export function gradeBand(n: number): BandKey {
  if (n >= 10) return "gem";
  if (n >= 9) return "mint";
  if (n >= 7) return "high";
  if (n >= 5) return "mid";
  return "low";
}

/** Round a model number to the nearest valid PSA grade. */
export function snapToPsa(n: number): number {
  let best = PSA_GRADES[0] as number;
  let bestD = Infinity;
  for (const g of PSA_GRADES) {
    const d = Math.abs(g - n);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

export const PILLARS: Pillar[] = ["centering", "corners", "edges", "surface"];
