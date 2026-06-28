"use client";

import { gradeBand, gradeLabel, type HistoryEntry } from "@/lib/types";

export default function History({
  entries,
  onOpen,
  onClear,
}: {
  entries: HistoryEntry[];
  onOpen: (e: HistoryEntry) => void;
  onClear: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          This session
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-faint transition hover:text-muted"
        >
          Clear
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {entries.map((e) => {
          const band = gradeBand(e.result.overall);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e)}
              className={`band band-${band} group w-28 shrink-0 text-left`}
            >
              <div className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.thumb}
                  alt={e.result.identification.name ?? "Graded card"}
                  className="aspect-[3/4] w-full object-cover transition group-hover:opacity-90"
                />
                <span
                  className="grade-figure absolute bottom-1 right-1 rounded-md px-1.5 py-0.5 text-sm font-bold"
                  style={{ background: "var(--bbg)", color: "var(--bfg)" }}
                >
                  {e.result.overall}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-muted">
                {e.result.identification.name ?? "Unidentified"}
              </div>
              <div className="text-[11px] text-faint">
                {gradeLabel(e.result.overall)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
