import { describe, expect, it } from "vitest";
import {
  formatMoney,
  reasonLabel,
  verdictMeta,
  worseRatio,
  type SideCentering,
} from "@/lib/types";

const side = (over: Partial<SideCentering>): SideCentering => ({
  left_px: null,
  right_px: null,
  top_px: null,
  bottom_px: null,
  h_ratio: "unknown",
  v_ratio: "unknown",
  worse_axis: "unknown",
  worse_pct: null,
  border_type: "bordered",
  confidence: "medium",
  assessable: true,
  grade_estimate: null,
  overlay_png_b64: null,
  notes: [],
  ...over,
});

describe("reasonLabel", () => {
  it("names the pillar for soft-pillar codes", () => {
    expect(reasonLabel("SOFT_PILLAR_COULD_NOT_ASSESS:corners")).toBe(
      "Corners cannot be proven clean from the photo",
    );
    expect(reasonLabel("SOFT_PILLAR_MAJOR:surface")).toBe(
      "A photo-visible surface defect caps this card",
    );
  });

  it("falls back to the raw code for anything unknown", () => {
    expect(reasonLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });

  it("uses the engine's centering wording without em dashes", () => {
    const label = reasonLabel("CENTERING_CAPS_BELOW_10");
    expect(label).toBe("Measured centering caps this card below a 10");
    expect(label).not.toContain("—");
  });
});

describe("worseRatio", () => {
  it("follows the worse axis when the engine reports one", () => {
    expect(worseRatio(side({ worse_axis: "h", h_ratio: "58.5/41.5", v_ratio: "52.0/48.0" }))).toBe("58.5/41.5");
    expect(worseRatio(side({ worse_axis: "v", h_ratio: "51.0/49.0", v_ratio: "57.0/43.0" }))).toBe("57.0/43.0");
  });

  it("uses the reconstructed worse_ratio when the axis is unknown", () => {
    expect(worseRatio(side({ worse_ratio: "53.8/46.2" }))).toBe("53.8/46.2");
  });

  it("returns null for an unassessable side", () => {
    expect(worseRatio(side({ assessable: false, h_ratio: "58.5/41.5", worse_axis: "h" }))).toBeNull();
    expect(worseRatio(null)).toBeNull();
  });
});

describe("verdictMeta", () => {
  it("maps each verdict to its band", () => {
    expect(verdictMeta("SUBMIT").band).toBe("mint");
    expect(verdictMeta("IN_HAND_CHECK").band).toBe("mid");
    expect(verdictMeta("SKIP").band).toBe("low");
  });
});

describe("formatMoney", () => {
  it("formats whole and fractional amounts", () => {
    expect(formatMoney(1000)).toBe("$1,000");
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(formatMoney(-40)).toBe("-$40");
  });
});
