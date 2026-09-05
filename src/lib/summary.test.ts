import { describe, expect, it } from "vitest";
import { SAMPLE_PIKACHU_EX } from "@/data/sample-pikachu-ex";
import { buildSummary } from "@/lib/summary";

describe("buildSummary", () => {
  const text = buildSummary(SAMPLE_PIKACHU_EX, { sampleLabel: "Real screening run, 6 July 2026" });

  it("leads with the verdict and confidence", () => {
    expect(text.split("\n")[0]).toBe("PokeGrade verdict: SKIP (high confidence)");
  });

  it("carries the measured centering, the loupe checks and the net upside", () => {
    expect(text).toContain("Centering (measured): 58.5/41.5 on the worse axis, about PSA 9 on centering, medium confidence");
    expect(text).toContain("Back centering: 53.8/46.2");
    expect(text).toContain("- Surface: Tilt under raking light");
    expect(text).toContain("Upside net of fee: +$835");
    expect(text).toContain("Real screening run, 6 July 2026");
  });

  it("ends with the estimate disclaimer", () => {
    expect(text.trimEnd().endsWith("An estimate to decide with, not an official PSA, BGS or CGC grade.")).toBe(true);
  });

  it("omits the value block when no value inputs were given", () => {
    const noValue = buildSummary({
      ...SAMPLE_PIKACHU_EX,
      value: { card_value: null, fee: null, spread_9_10: null },
      ev_estimate: null,
      ev_worth: null,
    });
    expect(noValue).not.toContain("Grading fee");
    expect(noValue).not.toContain("Upside net of fee");
  });
});
