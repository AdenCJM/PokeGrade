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
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">Screened on this device</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[13px] text-faint transition hover:text-fg"
        >
          Clear
        </button>
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
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
              <div className="relative overflow-hidden rounded-lg border border-border bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.thumb}
                  alt={name ?? "Screened card"}
                  className="aspect-[3/4] w-full object-cover transition group-hover:opacity-90"
                />
                <span
                  className="absolute bottom-1.5 right-1.5 rounded-md px-1.5 py-0.5 font-mono text-[12px] font-medium"
                  style={{ background: "var(--bbg)", color: "var(--bfg)" }}
                >
                  {meta.label}
                </span>
              </div>
              <div className="mt-1.5 truncate text-[13px] text-fg">{name ?? "Unidentified"}</div>
              <div className="text-[12px] text-faint">
                {new Date(e.at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
