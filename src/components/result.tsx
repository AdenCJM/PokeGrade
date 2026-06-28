"use client";

import {
  PILLAR_LABEL,
  PILLAR_STATUS_LABEL,
  reasonLabel,
  statusBand,
  verdictMeta,
  type GradeResponse,
  type Pillar,
  type SoftPillarFlag,
} from "@/lib/types";

export type ResultImages = {
  front: string;
  back: string | null;
  closeups: string[];
};

function VerdictHero({ r }: { r: GradeResponse }) {
  const meta = verdictMeta(r.verdict);
  return (
    <div className={`band band-${meta.band}`}>
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-faint">
        Verdict
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
        <span
          className="grade-figure rounded-2xl px-5 py-3 text-4xl font-bold sm:text-5xl"
          style={{ background: "var(--bbg)", color: "var(--bfg)" }}
        >
          {meta.label}
        </span>
        <div className="space-y-1.5">
          <div className="text-sm font-medium text-fg">{meta.blurb}</div>
          <div className="text-sm text-muted">Confidence: {r.confidence}</div>
          {r.limiting_pillar ? (
            <div className="text-xs text-faint">
              Limiting pillar: {PILLAR_LABEL[r.limiting_pillar]}
            </div>
          ) : null}
          <span className="inline-block rounded-md border border-border px-2 py-1 text-[11px] text-faint">
            Estimate · not an official PSA / BGS / CGC grade
          </span>
        </div>
      </div>
    </div>
  );
}

function Reasons({ codes }: { codes: string[] }) {
  if (!codes.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
        Why
      </h3>
      <ul className="space-y-1.5">
        {codes.map((c, i) => (
          <li
            key={`${c}-${i}`}
            className="flex gap-2.5 rounded-lg border border-border bg-surface2/40 px-3 py-2 text-sm text-fg"
          >
            <span className="mt-0.5 text-faint">·</span>
            <span>{reasonLabel(c)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Centering({ r }: { r: GradeResponse }) {
  const f = r.centering.front;
  if (!f) return null;
  const overlay = f.overlay_png_b64
    ? `data:image/png;base64,${f.overlay_png_b64}`
    : null;
  return (
    <div className="rounded-xl border border-border bg-surface2/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          Centering — measured
        </span>
        <span className="text-[11px] text-faint">{f.confidence} confidence</span>
      </div>
      {f.assessable && f.worse_pct != null ? (
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="grade-figure text-3xl font-semibold text-fg">
            {f.worse_axis === "h" ? f.h_ratio : f.v_ratio}
          </span>
          <span className="text-sm text-muted">
            worse axis ({f.worse_axis === "h" ? "left-right" : "top-bottom"})
          </span>
          {f.grade_estimate != null ? (
            <span className="font-mono text-xs text-faint">
              ~PSA {f.grade_estimate} on centering
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Could not measure a reliable ratio
          {f.border_type === "borderless" ? " (borderless art)" : ""} — assess by
          eye.
        </p>
      )}
      {overlay ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={overlay} alt="Centering overlay" className="w-full" />
        </div>
      ) : null}
    </div>
  );
}

function SoftPillars({ r }: { r: GradeResponse }) {
  const sp = r.soft_pillars;
  const flags: Record<Pillar, SoftPillarFlag | null> = {
    centering: null,
    corners: sp.corners,
    edges: sp.edges,
    surface: sp.surface,
  };
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
        Corners · Edges · Surface
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {(["corners", "edges", "surface"] as Pillar[]).map((p) => {
          const flag = flags[p]!;
          const band = statusBand(flag.status);
          return (
            <div
              key={p}
              className={`band band-${band} rounded-xl border border-border bg-surface2/50 p-3`}
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-faint">
                {PILLAR_LABEL[p]}
              </div>
              <div
                className="mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium"
                style={{ background: "var(--bbg)", color: "var(--bfg)" }}
              >
                {PILLAR_STATUS_LABEL[flag.status]}
              </div>
              {flag.observation ? (
                <p className="mt-1.5 text-xs leading-snug text-muted">
                  {flag.observation}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Loupe({ r }: { r: GradeResponse }) {
  const items = r.soft_pillars.loupe_checklist;
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
        Inspect in hand
      </h3>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface2/40 px-3 py-2.5"
          >
            <span className="mt-0.5 shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
              {PILLAR_LABEL[it.pillar]}
            </span>
            <div className="min-w-0">
              <div className="text-sm text-fg">{it.what_to_check}</div>
              {it.location ? (
                <div className="font-mono text-[11px] text-faint">{it.location}</div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EV({ r }: { r: GradeResponse }) {
  const v = r.value;
  if (v.card_value == null && v.fee == null && v.spread_9_10 == null) return null;
  const cell = (label: string, val: number | null, money = true) =>
    val == null ? null : (
      <div className="flex items-center justify-between">
        <span className="text-faint">{label}</span>
        <span className="font-mono text-fg">
          {money ? "$" : ""}
          {val}
        </span>
      </div>
    );
  return (
    <div className="rounded-xl border border-border bg-surface2/40 p-4 text-sm">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
        Expected value
      </div>
      <div className="space-y-1">
        {cell("Card value (raw / 9)", v.card_value)}
        {cell("Grading fee", v.fee)}
        {cell("9 → 10 spread", v.spread_9_10)}
        {r.ev_estimate != null ? (
          <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-muted">Upside net of fee</span>
            <span
              className="font-mono font-semibold"
              style={{
                color:
                  r.ev_worth === false
                    ? "var(--band-low-fg)"
                    : "var(--band-high-fg)",
              }}
            >
              {r.ev_estimate >= 0 ? "+" : ""}
              ${r.ev_estimate}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardReadPanel({ r }: { r: GradeResponse }) {
  const cr = r.soft_pillars.card_read;
  const bits = [cr.set, cr.number ? `#${cr.number}` : null, cr.language].filter(
    Boolean,
  );
  return (
    <div className="rounded-xl border border-border bg-surface2/40 p-4">
      <div className="text-base font-semibold text-fg">
        {cr.name ?? "Card not identified"}
      </div>
      {bits.length ? (
        <div className="mt-0.5 text-sm text-muted">{bits.join(" · ")}</div>
      ) : null}
      <div className="mt-2 text-xs text-faint">ID confidence: {cr.confidence}</div>
      {cr.read_evidence ? (
        <details className="mt-2 text-xs text-faint">
          <summary className="cursor-pointer select-none hover:text-muted">
            What the model could read
          </summary>
          <p className="mt-1 leading-relaxed">{cr.read_evidence}</p>
        </details>
      ) : null}
    </div>
  );
}

export default function Result({
  result,
  images,
  onReset,
}: {
  result: GradeResponse;
  images: ResultImages;
  onReset: () => void;
}) {
  const caveats = [...result.soft_pillars.photo_quality.issues, ...result.notes];
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left rail: images + card read */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images.front} alt="Card front" className="aspect-[3/4] w-full object-cover" />
            </div>
            {images.back ? (
              <div className="overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images.back} alt="Card back" className="aspect-[3/4] w-full object-cover" />
              </div>
            ) : null}
          </div>
          {images.closeups.length ? (
            <div className="grid grid-cols-4 gap-2">
              {images.closeups.map((c, i) => (
                <div key={i} className="overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c} alt={`Close-up ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
          <CardReadPanel r={result} />
        </div>

        {/* Right: verdict + reasons + evidence */}
        <div className="space-y-6">
          <VerdictHero r={result} />
          {result.soft_pillars.narrative ? (
            <p className="text-[15px] leading-relaxed text-muted">
              {result.soft_pillars.narrative}
            </p>
          ) : null}
          <Reasons codes={result.reason_codes} />
          <Centering r={result} />
          <SoftPillars r={result} />
          <Loupe r={result} />
          <EV r={result} />

          {caveats.length ? (
            <div className="rounded-lg border border-border bg-surface2/30 p-3.5">
              <div className="text-xs font-medium uppercase tracking-wide text-faint">
                Caveats
              </div>
              <ul className="mt-1.5 space-y-1 text-sm text-muted">
                {caveats.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-faint">·</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-fg transition hover:bg-surface2 sm:w-auto sm:px-8"
      >
        Screen another card
      </button>
    </div>
  );
}
