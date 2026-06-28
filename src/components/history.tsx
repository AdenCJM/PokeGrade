"use client";

import { verdictMeta, type HistoryEntry } from "@/lib/types";

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
          const meta = verdictMeta(e.response.verdict);
          const name = e.response.soft_pillars.card_read.name;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e)}
              className={`band band-${meta.band} group w-28 shrink-0 text-left`}
            >
              <div className="relative overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.thumb}
                  alt={name ?? "Screened card"}
                  className="aspect-[3/4] w-full object-cover transition group-hover:opacity-90"
                />
                <span
                  className="absolute bottom-1 right-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: "var(--bbg)", color: "var(--bfg)" }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="mt-1 truncate text-xs text-muted">
                {name ?? "Unidentified"}
              </div>
              <div className="text-[11px] text-faint">{meta.blurb}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
