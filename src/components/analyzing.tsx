"use client";

import { useEffect, useState } from "react";

const PHASES = [
  "Reading the card",
  "Assessing centering",
  "Inspecting corners",
  "Inspecting edges",
  "Scanning the surface",
  "Weighing the grade",
];

export default function Analyzing({ frontUrl }: { frontUrl: string }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setPhase((p) => (p < PHASES.length - 1 ? p + 1 : p));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <div className="relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frontUrl} alt="Card being analysed" className="h-full w-full object-cover" />
          <div
            className="scanline pointer-events-none absolute inset-x-0 top-0 h-8"
            style={{
              background:
                "linear-gradient(to bottom, transparent, color-mix(in oklch, var(--band-mint-ring) 45%, transparent), transparent)",
            }}
          />
        </div>

        <div className="flex-1 self-stretch">
          <div className="text-sm font-medium text-fg">Analysing your card</div>
          <p className="mt-1 text-xs text-faint">
            A careful read takes about 15-40 seconds.
          </p>

          <ul className="mt-4 space-y-2.5">
            {PHASES.map((label, i) => {
              const done = i < phase;
              const active = i === phase;
              return (
                <li key={label} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full ${
                      done
                        ? "bg-[var(--band-high-ring)]"
                        : active
                          ? "ring-2 ring-[var(--band-mint-ring)]"
                          : "ring-1 ring-border"
                    }`}
                  >
                    {done ? (
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : active ? (
                      <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-[var(--band-mint-ring)]" />
                    ) : null}
                  </span>
                  <span className={done || active ? "text-fg" : "text-faint"}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
