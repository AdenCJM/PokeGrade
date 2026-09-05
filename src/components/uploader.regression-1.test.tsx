// Regression: ISSUE-001 — the Camera / Upload / Add pickers wrap a visually
// hidden file input, so keyboard focus landed on an invisible 1px element and
// the button-shaped label showed no focus ring at all.
// Found by /qa on 2026-09-05
// Report: .gstack/qa-reports/qa-report-pokegrade-topaz-vercel-app-2026-09-05.md
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Uploader, { EMPTY_VALUE } from "@/components/uploader";

function renderUploader() {
  const noop = vi.fn();
  return render(
    <Uploader
      front={null}
      back={null}
      closeups={[]}
      preparing={false}
      error={null}
      value={EMPTY_VALUE}
      onValueField={noop}
      onPickFront={noop}
      onPickBack={noop}
      onAddCloseup={noop}
      onClearFront={noop}
      onClearBack={noop}
      onRemoveCloseup={noop}
    />,
  );
}

describe("file picker focus visibility", () => {
  const pickerInputs = () =>
    Array.from(document.querySelectorAll<HTMLInputElement>("label[aria-label] input[type=file]"));

  it("gives every picker label a focus-within ring for its hidden input", () => {
    renderUploader();
    const inputs = pickerInputs();
    expect(inputs.length).toBe(5);
    for (const input of inputs) {
      const label = input.closest("label")!;
      expect(label.className).toMatch(/focus-within:outline-2/);
      expect(label.className).toMatch(/focus-within:outline-\[var\(--ring\)\]/);
    }
  });

  it("keeps the inputs keyboard-reachable rather than display:none", () => {
    renderUploader();
    const input = document.querySelector<HTMLInputElement>('label[aria-label="Upload a photo of the front"] input')!;
    input.focus();
    expect(document.activeElement).toBe(input);
    expect(input.className).toContain("sr-only");
  });
});
