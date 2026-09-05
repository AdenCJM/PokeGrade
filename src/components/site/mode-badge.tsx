"use client";

import { useEngineMode } from "@/lib/engine-mode";

export default function ModeBadge() {
  const { mode, checking } = useEngineMode();
  const label =
    mode === "live" ? "Engine live" : mode === "offline" ? "Engine offline" : mode === "demo" ? "Demo build" : "Checking engine";
  const dot =
    mode === "live"
      ? "var(--band-high-ring)"
      : mode === "offline"
        ? "var(--band-low-ring)"
        : "var(--fg-faint)";
  return (
    <span
      className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 font-mono text-[12px] text-muted"
      title={
        mode === "live"
          ? "The grading engine answered. Screening runs for real."
          : mode === "offline"
            ? "The grading engine did not answer. Start it and the badge will turn live."
            : "No grading engine is attached to this build."
      }
      aria-live="polite"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${checking || mode === null ? "pulse-soft" : ""}`}
        style={{ background: dot }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
