import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Ladder, { gapToGate } from "@/components/result/ladder";
import Result from "@/components/result/result";
import { SAMPLE_META, SAMPLE_PIKACHU_EX } from "@/data/sample-pikachu-ex";

const images = { front: SAMPLE_META.images.front, back: SAMPLE_META.images.back, closeups: [] };

describe("Result", () => {
  it("renders the verdict, the measured ratio and every loupe check", () => {
    render(<Result result={SAMPLE_PIKACHU_EX} images={images} kind="sample" />);
    expect(screen.getByRole("heading", { name: "Skip" })).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.classList.contains("readout") === true && el.textContent === "58.5 / 41.5")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Front 58.5\/41.5, 3.5 past the 10 gate/ })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(SAMPLE_PIKACHU_EX.soft_pillars.loupe_checklist.length);
    expect(screen.getByText("Estimate · not an official PSA, BGS or CGC grade")).toBeInTheDocument();
  });

  // Regression: Codex review 2026-09-05. Two results on one page (the sample
  // plus a live one) produced duplicate aria-labelledby targets.
  it("keeps aria ids unique when two results share a page", () => {
    const { container } = render(
      <>
        <Result result={SAMPLE_PIKACHU_EX} images={images} kind="sample" />
        <Result result={{ ...SAMPLE_PIKACHU_EX, verdict: "IN_HAND_CHECK" }} images={images} kind="live" />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    const regions = screen.getAllByRole("region");
    for (const region of regions) {
      const labelledBy = region.getAttribute("aria-labelledby");
      if (labelledBy) expect(within(region).getByText((_, el) => el?.id === labelledBy)).toBeInTheDocument();
    }
  });

  // Regression: Codex review 2026-09-05. A null ev_worth (fee or spread
  // missing) was described as if the spread had cleared the fee.
  it("describes an incomplete value input honestly", () => {
    render(
      <Result
        result={{
          ...SAMPLE_PIKACHU_EX,
          value: { card_value: 650, fee: null, spread_9_10: null },
          ev_estimate: null,
          ev_worth: null,
        }}
        images={images}
        kind="live"
      />,
    );
    expect(screen.getByText(/Give both the fee and the 9 to 10 spread/)).toBeInTheDocument();
    expect(screen.queryByText(/The spread clears the fee/)).not.toBeInTheDocument();
  });
});

describe("Ladder", () => {
  it("reports the distance to the right gate for each side", () => {
    expect(gapToGate("front", 58.5)).toBe("3.5 past the 10 gate");
    expect(gapToGate("front", 52)).toBe("3.0 inside the 10 gate");
    expect(gapToGate("back", 53.8)).toBe("21.2 inside the 10 gate");
    expect(gapToGate("back", 76)).toBe("1.0 past the 10 gate");
  });

  it("clamps an off-scale value onto the bar without breaking the label", () => {
    render(<Ladder side="front" value={90} ratio="90.0/10.0" />);
    expect(screen.getByRole("img", { name: "Front 90.0/10.0, 35.0 past the 10 gate" })).toBeInTheDocument();
  });
});
