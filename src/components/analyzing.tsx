"use client";

import { useEffect, useState } from "react";

const PHASES = [
  "Detecting the card edge",
  "Measuring centering",
  "Reading the card",
  "Ruling corners, edges, surface",
  "Weighing the verdict",
];

export default function Analyzing({
  frontUrl,
  replay = false,
}: {
  frontUrl: string;
  /** Replaying a stored run: faster phases, and labelled as a replay. */
  replay?: boolean;
}) {
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const step = replay ? 780 : 3500;
    const t = setInterval(() => {
      setPhase((p) => (p < PHASES.length - 1 ? p + 1 : p));
    }, step);
    const s = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(t);
      clearInterval(s);
    };
  }, [replay]);

  return (
    <div className="rise rounded-[var(--r-lg)] border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
        <div className="relative aspect-[3/4] w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-surface2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frontUrl} alt="" className="h-full w-full object-cover" />
          <div
            className="scanline pointer-events-none absolute inset-x-0 top-0 h-6"
            style={{
              background:
                "linear-gradient(to bottom, transparent, color-mix(in oklch, var(--ov-card) 55%, transparent), transparent)",
            }}
            aria-hidden="true"
          />
        </div>

        <div className="w-full flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="text-[15px] font-semibold text-fg">
                {replay ? "Replaying the 6 July run" : "Screening your card"}
              </div>
              <p className="mt-1 text-[13px] text-faint">
                {replay
                  ? "A stored run, played back at speed. The verdict is the real one."
                  : "Measuring centering, then ruling the soft pillars. Usually 15 to 40 seconds."}
              </p>
            </div>
            {!replay ? (
              <span className="font-mono text-[12px] tabular text-faint" aria-hidden="true">
                {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
              </span>
            ) : null}
          </div>

          <ol className="mt-5 space-y-2.5" aria-label="Screening steps">
            {PHASES.map((label, i) => {
              const done = i < phase;
              const active = i === phase;
              return (
                <li key={label} className="flex items-center gap-3 text-[14px]">
                  <span
                    className={`grid h-4.5 w-4.5 place-items-center rounded-full ${
                      done
                        ? "bg-[var(--band-high-ring)]"
                        : active
                          ? "ring-2 ring-[var(--ov-card)]"
                          : "ring-1 ring-border"
                    }`}
                    aria-hidden="true"
                  >
                    {done ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : active ? (
                      <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-[var(--ov-card)]" />
                    ) : null}
                  </span>
                  <span className={done || active ? "text-fg" : "text-faint"}>{label}</span>
                </li>
              );
            })}
          </ol>
          <p className="sr-only" aria-live="polite">
            {PHASES[phase]}
          </p>
        </div>
      </div>
    </div>
  );
}
