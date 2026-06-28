// Server-only grading config: the rubric system prompt, the structured-output
// JSON schema, model selection, and a validate/repair backstop.

import { z } from "zod";
import {
  CENTERING_RATIOS,
  PSA_GRADES,
  snapToPsa,
  PILLARS,
  type GradeResult,
} from "./types";

export const DEFAULT_MODEL = "claude-opus-4-8";

export function resolveModel(): string {
  return process.env.MODEL?.trim() || DEFAULT_MODEL;
}

// --- The rubric (system prompt) --------------------------------------------
// Anchored reference text so grades are reproducible, not vibes. The model is
// told to observe per pillar BEFORE grading, to cap any pillar the photos can't
// confirm, and to never invent a card ID it can't read.

export const SYSTEM_PROMPT = `You are an expert trading-card grader producing a PSA-style pre-grading ESTIMATE from photographs. This is a second opinion to help a collector triage and compare cards — it is NOT an official PSA, BGS, or CGC grade, and you must never imply otherwise.

You assess four pillars and an overall grade on the PSA scale: 10, 9, 8, 7, 6, 5, 4, 3, 2, 1.5, 1 (whole grades only; the only half-step is 1.5). There is no 9.5.

WORKFLOW — observe, then grade. For each pillar, first describe exactly what you can see in the photos (the observation). Only then assign the number. Ground every number in a specific visible feature.

CENTERING. Estimate the border ratios you actually see. Map the WORSE of left-right / top-bottom onto this front ladder:
  55/45 or better -> 10
  60/40 -> 9
  65/35 -> 8
  70/30 -> 7
  75/25-80/20 -> 6
  85/15 -> 5
  worse than 85/15 -> 4 or lower
The back is judged the same way but is more forgiving. If a photo is angled enough to distort the borders, do NOT report a ratio — say "reshoot square-on" and set the centering ratio to "unknown". If no back photo was provided, set the back ratios to "not-provided".

CORNERS. 10 = razor sharp under magnification; 9 = one corner with the very slightest touch of wear; 8 = light wear on one or two corners; 7 = light fraying/whitening visible; 5 = clear rounding or a ding. Whitening on a dark-bordered card is the most visible tell.

EDGES. 10 = clean, no whitening or nicks; 8 = minor whitening along an edge; 7 = whitening on multiple edges or a small nick; 5 = chipping or roughness.

SURFACE. 10 = flawless gloss, no print lines, scratches, dents, or stains; 9 = one tiny imperfection; 7 = a visible scratch, print line, or light scuffing; 5 = multiple scratches, a crease, or a stain. Holo cards scratch easily — look across the foil.

AGGREGATION. The overall grade may NOT exceed your lowest pillar subgrade. (The only allowance: if the lowest pillar is a strong 9 and every other pillar is a 10, an overall of 9 is appropriate — never bump above the weakest pillar otherwise.)

RESOLUTION HONESTY — this is critical. A photo shows absence of OBVIOUS defects, not flawlessness. For any pillar the photos cannot actually confirm (too low-res, glare over the area, shot at an angle, or no close-up):
  - say so in that pillar's observation,
  - set that pillar's "assessable" to "limited" or "no",
  - and CAP that subgrade: without a sharp, glare-free close-up confirming flawlessness, a pillar may not exceed 9. Do not award a 10 you cannot see.
Lower your overall confidence when pillars are not fully assessable. Better to estimate an honest 8 than guess a 10.

PHOTO QUALITY. Before grading, assess each image for glare, blur, colour cast, angle, and cropping. If glare covers a region, exclude that region from your surface/edge claims rather than calling it clean. Set photoQuality.overallGradeable to "no" if the photos are too poor to grade meaningfully.

CARD IDENTIFICATION — do not hallucinate. In readEvidence, state only the literal text and symbols you can actually read (card name as printed, the collector number e.g. "4/102", set symbol description, any "1st Edition" stamp, language of the text). Fill name/set/number ONLY from that evidence. If the set symbol or collector number is illegible, set those fields to null and lower the identification confidence — never infer the set from the artwork.

Write the summary in plain, honest English for a collector: the headline grade, what's holding it back, and how confident you are. List concrete photo-quality limitations in caveats. Be specific, never flattering.`;

// --- Structured-output JSON schema -----------------------------------------
// Sent as output_config.format. Enums do the constraining (JSON Schema here
// can't express numeric min/max). All objects use additionalProperties:false
// and list every property in required, as structured outputs expect.

const assessableEnum = { type: "string", enum: ["yes", "limited", "no"] };
const confidenceEnum = { type: "string", enum: ["low", "medium", "high"] };
const gradeEnum = { type: "number", enum: [...PSA_GRADES] };
const ratioEnum = { type: "string", enum: [...CENTERING_RATIOS] };
const nullableString = { type: ["string", "null"] };

const pillarObservation = { type: "string" };
const subgradeObj = {
  type: "object",
  additionalProperties: false,
  required: ["grade", "assessable"],
  properties: { grade: gradeEnum, assessable: assessableEnum },
};

export const GRADE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "scale",
    "photoQuality",
    "identification",
    "observations",
    "centering",
    "subgrades",
    "overall",
    "confidence",
    "defects",
    "summary",
    "caveats",
  ],
  properties: {
    scale: { type: "string", enum: ["PSA"] },
    photoQuality: {
      type: "object",
      additionalProperties: false,
      required: ["overallGradeable", "issues"],
      properties: {
        overallGradeable: assessableEnum,
        issues: { type: "array", items: { type: "string" } },
      },
    },
    identification: {
      type: "object",
      additionalProperties: false,
      required: [
        "readEvidence",
        "name",
        "set",
        "number",
        "language",
        "finish",
        "confidence",
      ],
      properties: {
        readEvidence: { type: "string" },
        name: nullableString,
        set: nullableString,
        number: nullableString,
        language: nullableString,
        finish: {
          type: "string",
          enum: ["holo", "reverse-holo", "full-art", "non-holo", "unknown"],
        },
        confidence: confidenceEnum,
      },
    },
    observations: {
      type: "object",
      additionalProperties: false,
      required: ["centering", "corners", "edges", "surface"],
      properties: {
        centering: pillarObservation,
        corners: pillarObservation,
        edges: pillarObservation,
        surface: pillarObservation,
      },
    },
    centering: {
      type: "object",
      additionalProperties: false,
      required: ["frontRatioLR", "frontRatioTB", "backRatioLR", "backRatioTB"],
      properties: {
        frontRatioLR: ratioEnum,
        frontRatioTB: ratioEnum,
        backRatioLR: ratioEnum,
        backRatioTB: ratioEnum,
      },
    },
    subgrades: {
      type: "object",
      additionalProperties: false,
      required: ["centering", "corners", "edges", "surface"],
      properties: {
        centering: subgradeObj,
        corners: subgradeObj,
        edges: subgradeObj,
        surface: subgradeObj,
      },
    },
    overall: gradeEnum,
    confidence: confidenceEnum,
    defects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["dimension", "severity", "location", "description"],
        properties: {
          dimension: {
            type: "string",
            enum: ["centering", "corners", "edges", "surface"],
          },
          severity: { type: "string", enum: ["minor", "moderate", "major"] },
          location: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    summary: { type: "string" },
    caveats: { type: "array", items: { type: "string" } },
  },
} as const;

// --- Validation + repair (zod backstop) ------------------------------------

const assessable = z.enum(["yes", "limited", "no"]);
const confidence = z.enum(["low", "medium", "high"]);
const ratio = z.enum(CENTERING_RATIOS);
const subgrade = z.object({ grade: z.number(), assessable });

const Schema = z.object({
  scale: z.literal("PSA").catch("PSA"),
  photoQuality: z.object({
    overallGradeable: assessable,
    issues: z.array(z.string()),
  }),
  identification: z.object({
    readEvidence: z.string(),
    name: z.string().nullable(),
    set: z.string().nullable(),
    number: z.string().nullable(),
    language: z.string().nullable(),
    finish: z.enum(["holo", "reverse-holo", "full-art", "non-holo", "unknown"]),
    confidence,
  }),
  observations: z.object({
    centering: z.string(),
    corners: z.string(),
    edges: z.string(),
    surface: z.string(),
  }),
  centering: z.object({
    frontRatioLR: ratio,
    frontRatioTB: ratio,
    backRatioLR: ratio,
    backRatioTB: ratio,
  }),
  subgrades: z.object({
    centering: subgrade,
    corners: subgrade,
    edges: subgrade,
    surface: subgrade,
  }),
  overall: z.number(),
  confidence,
  defects: z.array(
    z.object({
      dimension: z.enum(["centering", "corners", "edges", "surface"]),
      severity: z.enum(["minor", "moderate", "major"]),
      location: z.string(),
      description: z.string(),
    }),
  ),
  summary: z.string(),
  caveats: z.array(z.string()),
});

/**
 * Validate the model's JSON and repair soft issues. Throws on a structurally
 * broken payload (the caller retries once). Repairs: snap grades to the PSA
 * scale, and enforce overall <= lowest subgrade.
 */
export function validateAndRepair(raw: unknown): GradeResult {
  const parsed = Schema.parse(raw);

  for (const p of PILLARS) {
    parsed.subgrades[p].grade = snapToPsa(parsed.subgrades[p].grade);
  }
  parsed.overall = snapToPsa(parsed.overall);

  const lowest = Math.min(...PILLARS.map((p) => parsed.subgrades[p].grade));
  if (parsed.overall > lowest) parsed.overall = lowest;

  return parsed as GradeResult;
}
