// Regression: ISSUE-002 — "Copy summary" failed silently when the clipboard
// API was refused, so the user got no feedback and nothing on the clipboard.
// Found by /qa on 2026-09-05
// Report: .gstack/qa-reports/qa-report-pokegrade-topaz-vercel-app-2026-09-05.md
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Result, { copyText } from "@/components/result/result";
import { SAMPLE_META, SAMPLE_PIKACHU_EX } from "@/data/sample-pikachu-ex";

const images = { front: SAMPLE_META.images.front, back: SAMPLE_META.images.back, closeups: [] };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("copyText", () => {
  it("uses the async clipboard when it works", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to a selection copy when the clipboard API is refused", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("reports failure when both paths fail", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    await expect(copyText("hello")).resolves.toBe(false);
  });
});

describe("Copy summary button", () => {
  it("tells the user when nothing could be copied", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    render(<Result result={SAMPLE_PIKACHU_EX} images={images} kind="sample" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));
    });
    expect(screen.getByRole("button", { name: "Could not copy" })).toBeInTheDocument();
  });

  it("confirms a successful copy", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<Result result={SAMPLE_PIKACHU_EX} images={images} kind="sample" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
