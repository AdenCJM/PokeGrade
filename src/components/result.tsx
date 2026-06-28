"use client";

import {
  PILLARS,
  gradeBand,
  gradeLabel,
  type GradeResult,
  type Pillar,
  type Subgrade,
} from "@/lib/types";

const PILLAR_LABEL: Record<Pillar, string> = {
  centering: "Centering",
  corners: "Corners",
  edges: "Edges",
  surface: "Surface",
};

export type ResultImages = {
  front: string;
  back: string | null;
  closeups: string[];
};

function Gauge({ grade }: { grade: number }) {
  const filled = Math.round(grade);
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 flex-1 rounded-[2px]"
          style={{
            background: i < filled ? "var(--bring)" : "var(--border)",
          }}
        />
      ))}
    </div>
  );
}

function AssessTag({ a }: { a: Subgrade["assessable"] }) {
  if (a === "yes") return null;
  const label = a === "no" ? "not assessable" : "limited view";
  return (
    <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-faint">
      {label}
    </span>
  );
}

function SubgradeCell({
  pillar,
  sg,
  ratio,
}: {
  pillar: Pillar;
  sg: Subgrade;
  ratio?: string | null;
}) {
  return (
    <div
      className={`band band-${gradeBand(sg.grade)} rounded-xl border border-border bg-surface2/50 p-3.5`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
          {PILLAR_LABEL[pillar]}
        </span>
        <AssessTag a={sg.assessable} />
      </div>
      <div className="mt-1 flex items-end justify-between">
        <span className="grade-figure text-4xl font-semibold text-fg">
          {sg.grade}
        </span>
        {ratio ? (
          <span className="mb-1 font-mono text-[11px] text-faint">{ratio}</span>
        ) : null}
      </div>
      <div className="mt-2.5">
        <Gauge grade={sg.grade} />
      </div>
    </div>
  );
}

function SeverityDots({ severity }: { severity: "minor" | "moderate" | "major" }) {
  const n = severity === "major" ? 3 : severity === "moderate" ? 2 : 1;
  return (
    <span className="flex gap-[3px]" aria-label={`${severity} severity`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-[1px]"
          style={{
            background: i < n ? "var(--band-mid-ring)" : "var(--border)",
          }}
        />
      ))}
    </span>
  );
}

function Identification({ id }: { id: GradeResult["identification"] }) {
  const finishLabel: Record<string, string> = {
    holo: "Holo",
    "reverse-holo": "Reverse holo",
    "full-art": "Full art",
    "non-holo": "Non-holo",
    unknown: "Finish unknown",
  };
  const bits = [
    id.set,
    id.number ? `#${id.number}` : null,
    id.language,
    finishLabel[id.finish],
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-border bg-surface2/40 p-4">
      <div className="text-base font-semibold text-fg">
        {id.name ?? "Card not identified"}
      </div>
      {bits.length ? (
        <div className="mt-0.5 text-sm text-muted">{bits.join(" · ")}</div>
      ) : null}
      <div className="mt-2 text-xs text-faint">
        ID confidence: {id.confidence}
      </div>
      {id.readEvidence ? (
        <details className="mt-2 text-xs text-faint">
          <summary className="cursor-pointer select-none hover:text-muted">
            What the model could read
          </summary>
          <p className="mt-1 leading-relaxed">{id.readEvidence}</p>
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
  result: GradeResult;
  images: ResultImages;
  onReset: () => void;
}) {
  const band = gradeBand(result.overall);
  const isGem = result.overall >= 10;
  const ratioFor: Record<Pillar, string | null> = {
    centering:
      result.centering.frontRatioLR &&
      result.centering.frontRatioLR !== "unknown" &&
      result.centering.frontRatioLR !== "not-provided"
        ? `${result.centering.frontRatioLR}`
        : null,
    corners: null,
    edges: null,
    surface: null,
  };

  const defectsByPillar = PILLARS.map((p) => ({
    pillar: p,
    items: result.defects.filter((d) => d.dimension === p),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left rail: images + identification */}
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
          <Identification id={result.identification} />
        </div>

        {/* Right: hero + subgrades + defects */}
        <div className="space-y-6">
          <div className={`band band-${band}`}>
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-faint">
              Estimated grade
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
              <div
                className={`grid h-28 w-28 place-items-center rounded-2xl border border-border bg-surface2/60 ${
                  isGem ? "gem-ring" : ""
                }`}
                style={!isGem ? { boxShadow: `0 0 0 1px var(--bring)` } : undefined}
              >
                <span className="grade-figure text-6xl font-bold text-fg">
                  {result.overall}
                </span>
              </div>
              <div className="space-y-2">
                <span
                  className="inline-block rounded-full px-3 py-1 text-sm font-semibold"
                  style={{ background: "var(--bbg)", color: "var(--bfg)" }}
                >
                  PSA {result.overall} · {gradeLabel(result.overall)}
                </span>
                <div className="text-sm text-muted">
                  Confidence: {result.confidence}
                </div>
                <span
                  className={`inline-block rounded-md border px-2 py-1 text-[11px] ${
                    result.confidence === "low"
                      ? "border-[var(--band-mid-ring)] text-[var(--band-mid-fg)]"
                      : "border-border text-faint"
                  }`}
                >
                  Estimate · not an official PSA / BGS / CGC grade
                </span>
              </div>
            </div>
          </div>

          {result.summary ? (
            <p className="text-[15px] leading-relaxed text-muted">
              {result.summary}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {PILLARS.map((p) => (
              <SubgradeCell
                key={p}
                pillar={p}
                sg={result.subgrades[p]}
                ratio={ratioFor[p]}
              />
            ))}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
              Defects
            </h3>
            {defectsByPillar.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface2/40 px-3 py-2.5 text-sm text-muted">
                No notable defects detected in the photos provided.
              </p>
            ) : (
              <div className="space-y-1.5">
                {defectsByPillar.map((group) =>
                  group.items.map((d, i) => (
                    <div
                      key={`${group.pillar}-${i}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-surface2/40 px-3 py-2.5"
                    >
                      <SeverityDots severity={d.severity} />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
                          {PILLAR_LABEL[group.pillar]}
                        </span>
                        <p className="text-sm text-fg">{d.description}</p>
                      </div>
                      {d.location ? (
                        <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-faint">
                          {d.location}
                        </span>
                      ) : null}
                    </div>
                  )),
                )}
              </div>
            )}
          </div>

          {result.caveats.length || result.photoQuality.issues.length ? (
            <div className="rounded-lg border border-border bg-surface2/30 p-3.5">
              <div className="text-xs font-medium uppercase tracking-wide text-faint">
                Caveats
              </div>
              <ul className="mt-1.5 space-y-1 text-sm text-muted">
                {[...result.photoQuality.issues, ...result.caveats].map((c, i) => (
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
        Grade another card
      </button>
    </div>
  );
}
