"use client";

import Link from "next/link";
import { useId, useState } from "react";
import Ladder from "@/components/result/ladder";
import { SAMPLE_META } from "@/data/sample-pikachu-ex";
import { buildSummary } from "@/lib/summary";
import {
  PILLAR_LABEL,
  PILLAR_STATUS_LABEL,
  axisLabel,
  formatMoney,
  overlaySrc,
  reasonLabel,
  statusBand,
  verdictMeta,
  worseRatio,
  type Confidence,
  type GradeResponse,
  type Pillar,
} from "@/lib/types";

export type ResultImages = {
  front: string;
  back: string | null;
  closeups: string[];
};

export type ResultKind = "live" | "sample" | "history";

// ---------------------------------------------------------------------------

function ConfidenceChip({ c, label = "confidence" }: { c: Confidence; label?: string }) {
  const dots = c === "high" ? 3 : c === "medium" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 font-mono text-[12px] text-muted">
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: i < dots ? "var(--fg)" : "var(--border-strong)" }}
          />
        ))}
      </span>
      {c} {label}
    </span>
  );
}

function CopySummary({ r, kind }: { r: GradeResponse; kind: ResultKind }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(
            buildSummary(r, {
              sampleLabel: kind === "sample" ? `Real screening run, ${SAMPLE_META.screened_label}` : undefined,
            }),
          );
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-strong px-3 text-[13px] font-medium text-fg transition hover:bg-surface2"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </svg>
      {copied ? "Copied" : "Copy summary"}
    </button>
  );
}

// ---------------------------------------------------------------------------

function Identity({ r, kind }: { r: GradeResponse; kind: ResultKind }) {
  const cr = r.soft_pillars.card_read;
  const bits = [cr.set, cr.number ? `#${cr.number}` : null, cr.language, cr.finish !== "unknown" ? cr.finish : null].filter(Boolean);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {kind === "sample" ? (
          <p className="mb-2 inline-flex items-center gap-2 rounded-md border border-border-strong px-2 py-1 font-mono text-[12px] text-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--ov-card)]" aria-hidden="true" />
            Real screening run · {SAMPLE_META.screened_label}
          </p>
        ) : kind === "history" ? (
          <p className="mb-2 inline-flex items-center rounded-md border border-border px-2 py-1 font-mono text-[12px] text-faint">
            From this device&rsquo;s history
          </p>
        ) : null}
        <h2 className="display text-[1.7rem] text-fg sm:text-[2.1rem]">{cr.name ?? "Card not identified"}</h2>
        {bits.length ? <p className="mt-1 text-[15px] text-muted">{bits.join(" · ")}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConfidenceChip c={cr.confidence} label="ID confidence" />
          {cr.read_evidence ? (
            <details className="text-[13px] text-faint">
              <summary className="cursor-pointer select-none hover:text-fg">What the model could read</summary>
              <p className="mt-1 max-w-prose leading-relaxed">{cr.read_evidence}</p>
            </details>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <CopySummary r={r} kind={kind} />
      </div>
    </div>
  );
}

function VerdictHero({ r, id }: { r: GradeResponse; id: string }) {
  const meta = verdictMeta(r.verdict);
  const headingId = `${id}-verdict`;
  return (
    <section
      className={`band band-${meta.band} rounded-[var(--r-lg)] p-6 sm:p-8`}
      style={{ background: "var(--bbg)" }}
      aria-labelledby={headingId}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-10">
        <div>
          <p className="eyebrow" style={{ color: "var(--bfg)" }}>
            Verdict
          </p>
          <h3 id={headingId} className="display mt-2 text-[2.9rem] sm:text-[3.8rem]" style={{ color: "var(--bfg)" }}>
            {meta.label}
          </h3>
          <p className="mt-3 text-[17px] font-medium text-fg">{meta.blurb}</p>
          <p className="mt-1 text-[15px] text-muted">{meta.action}</p>
          <span className="mt-4 inline-block rounded-md border border-border-strong bg-surface/60 px-2 py-1 font-mono text-[12px] text-muted">
            Estimate · not an official PSA, BGS or CGC grade
          </span>
        </div>
        <div className="w-full md:max-w-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ConfidenceChip c={r.confidence} />
            {r.limiting_pillar ? (
              <span className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 font-mono text-[12px] text-muted">
                limiting pillar · {PILLAR_LABEL[r.limiting_pillar].toLowerCase()}
              </span>
            ) : null}
          </div>
          {r.reason_codes.length ? (
            <ul className="mt-4 space-y-2">
              {r.reason_codes.map((c, i) => (
                <li key={`${c}-${i}`} className="flex gap-2.5 text-[14px] leading-snug text-fg">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--bring)" }} aria-hidden="true" />
                  <span>{reasonLabel(c)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {r.soft_pillars.narrative ? (
            <p className="mt-4 text-[14px] leading-relaxed text-muted">{r.soft_pillars.narrative}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function CenteringPanel({ r, id }: { r: GradeResponse; id: string }) {
  const headingId = `${id}-centering`;
  const f = r.centering.front;
  const b = r.centering.back;
  const src = overlaySrc(f);
  const fr = worseRatio(f);
  const br = worseRatio(b);
  const axis = f ? axisLabel(f.worse_axis) : null;
  return (
    <section className="panel-primary p-5 sm:p-6" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="eyebrow">
          Centering, measured
        </h3>
        {f ? <ConfidenceChip c={f.confidence} /> : null}
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-xl border border-border bg-surface2 sm:mx-0" style={{ aspectRatio: "63 / 88" }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="The engine's centering overlay: green is the detected card edge, red is the printed border and the four measured gaps." className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center p-6 text-center text-[13px] text-faint">No overlay: the card edge was not detected.</div>
          )}
          <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[12px] text-white">
            engine overlay
          </span>
        </div>

        <div className="min-w-0">
          {f && f.assessable && f.worse_pct != null && fr ? (
            <>
              <div className="readout text-[2.6rem] font-medium text-fg sm:text-[3rem]">
                {fr.split("/")[0]}
                <span className="text-faint"> / </span>
                {fr.split("/")[1]}
              </div>
              <p className="mt-2 font-mono text-[12px] text-faint">
                front · worse axis{axis ? ` · ${axis}` : ""}
                {f.grade_estimate != null ? ` · about PSA ${f.grade_estimate} on centering` : ""}
              </p>
              <div className="mt-5 space-y-5">
                <Ladder side="front" value={f.worse_pct} ratio={fr} />
                {b && b.assessable && b.worse_pct != null && br ? (
                  <Ladder side="back" value={b.worse_pct} ratio={br} />
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-[15px] leading-relaxed text-muted">
              Could not measure a reliable ratio
              {f?.border_type === "borderless" ? " (borderless art)" : ""}. Centering routes to an in-hand check.
            </p>
          )}
          {f?.notes.length ? (
            <ul className="mt-4 space-y-1 text-[13px] text-faint">
              {f.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Pillars({ r, id }: { r: GradeResponse; id: string }) {
  const sp = r.soft_pillars;
  const headingId = `${id}-pillars`;
  return (
    <section className="panel-primary p-5 sm:p-6" aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="eyebrow">
          Corners · Edges · Surface
        </h3>
        <span className="font-mono text-[12px] text-faint">ruled by Claude</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {(["corners", "edges", "surface"] as Pillar[]).map((p) => {
          const flag = sp[p as "corners" | "edges" | "surface"];
          const band = statusBand(flag.status);
          return (
            <div key={p} className={`band band-${band} rounded-xl border border-border bg-surface2/50 p-3.5`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="text-[14px] font-semibold text-fg">{PILLAR_LABEL[p]}</div>
                <div
                  className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[12px] font-medium"
                  style={{ background: "var(--bbg)", color: "var(--bfg)" }}
                >
                  {PILLAR_STATUS_LABEL[flag.status]}
                  {flag.status === "concern" && flag.severity !== "none" ? ` · ${flag.severity}` : ""}
                </div>
              </div>
              <p className="mt-2 text-[13px] leading-snug text-muted">
                {flag.observation ||
                  (flag.status === "could_not_assess"
                    ? "A flat photo cannot prove this clean. A close-up lets it be ruled."
                    : "")}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Loupe({ r, id }: { r: GradeResponse; id: string }) {
  const items = r.soft_pillars.loupe_checklist;
  const headingId = `${id}-loupe`;
  if (!items.length) return null;
  return (
    <section className="panel-secondary pt-6" aria-labelledby={headingId}>
      <div className="flex items-center justify-between">
        <h3 id={headingId} className="eyebrow">
          Inspect in hand
        </h3>
        <span className="font-mono text-[12px] text-faint">{items.length} checks</span>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 rounded-xl border border-border bg-surface p-4">
            <span className="mt-0.5 shrink-0 rounded bg-surface2 px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-wide text-faint">
              {PILLAR_LABEL[it.pillar]}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] leading-snug text-fg">{it.what_to_check}</p>
              {it.location ? <p className="mt-1 font-mono text-[12px] leading-relaxed text-faint">{it.location}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EVPanel({ r, id }: { r: GradeResponse; id: string }) {
  const v = r.value;
  const headingId = `${id}-ev`;
  if (v.card_value == null && v.fee == null && v.spread_9_10 == null) return null;
  const row = (label: string, val: number | null) =>
    val == null ? null : (
      <div className="flex items-center justify-between gap-4 text-[14px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono tabular text-fg">{formatMoney(val)}</span>
      </div>
    );
  return (
    <section className="panel-primary p-5 sm:p-6" aria-labelledby={headingId}>
      <h3 id={headingId} className="eyebrow">
        Expected value
      </h3>
      <div className="mt-3 space-y-1.5">
        {row("Card value, raw or as a 9", v.card_value)}
        {row("Grading fee", v.fee)}
        {row("9 to 10 spread", v.spread_9_10)}
        {r.ev_estimate != null ? (
          <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-2.5 text-[15px]">
            <span className="font-medium text-fg">Upside net of fee</span>
            <span
              className="readout text-[1.5rem] font-medium"
              style={{ color: r.ev_worth === false ? "var(--band-low-fg)" : "var(--band-high-fg)" }}
            >
              {r.ev_estimate >= 0 ? "+" : ""}
              {formatMoney(r.ev_estimate)}
            </span>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-faint">
        {r.ev_worth === false
          ? "The spread does not clear the fee, so the verdict is skip regardless of condition."
          : r.ev_worth === true
            ? "The spread clears the fee, so the money question passes and the card is judged on its condition."
            : "Give both the fee and the 9 to 10 spread for the verdict to check that the upside clears the fee."}
      </p>
    </section>
  );
}

function Photos({ images }: { images: ResultImages }) {
  const all = [
    { src: images.front, label: "Front" },
    ...(images.back ? [{ src: images.back, label: "Back" }] : []),
    ...images.closeups.map((c, i) => ({ src: c, label: `Close-up ${i + 1}` })),
  ];
  return (
    <section className="panel-secondary pt-6" aria-label="Photos submitted">
      <h3 className="eyebrow">Photos submitted</h3>
      <div className="mt-4 flex flex-wrap gap-3">
        {all.map((p) => (
          <figure key={p.label} className="w-24 sm:w-28">
            <div className="overflow-hidden rounded-lg border border-border bg-surface2" style={{ aspectRatio: "3 / 4" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.label} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <figcaption className="mt-1 font-mono text-[12px] text-faint">{p.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Limits({ r, kind }: { r: GradeResponse; kind: ResultKind }) {
  const caveats = [...r.soft_pillars.photo_quality.issues, ...r.notes.filter((n) => !r.soft_pillars.photo_quality.issues.includes(n))];
  const prov = r.provenance ?? {};
  const rows: [string, string | undefined][] = [
    ["run", r.run_id],
    ["card", r.card_id],
    ["engine", r.engine_version],
    ["standards", r.standards_version],
    ["model", prov.model_id],
    ["prompt", prov.prompt_version],
    ["commit", prov.code_commit],
    ["lens profile", prov.calibration_id || "none"],
  ];
  return (
    <section className="panel-secondary pt-6">
      <details className="group">
        <summary className="flex items-center justify-between">
          <span className="eyebrow">
            Limits and provenance · {caveats.length} caveat{caveats.length === 1 ? "" : "s"}
          </span>
          <svg className="chev text-faint" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <ul className="space-y-1.5 text-[13px] leading-relaxed text-muted">
            {caveats.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-faint" aria-hidden="true">·</span>
                <span>{c}</span>
              </li>
            ))}
            {kind === "sample" ? (
              <li className="flex gap-2 text-faint">
                <span aria-hidden="true">·</span>
                <span>Verdict and measurements from the ledger; the model&rsquo;s written narrative was not retained.</span>
              </li>
            ) : null}
          </ul>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-[12px]">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-faint">{k}</dt>
                  <dd className="truncate text-muted">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------------------

export default function Result({
  result,
  images,
  kind,
  onReset,
}: {
  result: GradeResponse;
  images: ResultImages;
  kind: ResultKind;
  /** Omit for a standalone render (the sample section and /sample page). */
  onReset?: () => void;
}) {
  // Several results can be on one page (the sample plus a live one), so every
  // aria-labelledby target is scoped to this instance.
  const id = useId();
  return (
    <div className="rise space-y-6">
      <Identity r={result} kind={kind} />
      <VerdictHero r={result} id={id} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <CenteringPanel r={result} id={id} />
        <div className="space-y-6">
          <EVPanel r={result} id={id} />
          <Pillars r={result} id={id} />
        </div>
      </div>
      <Loupe r={result} id={id} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Photos images={images} />
        <Limits r={result} kind={kind} />
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-accent-fg transition hover:opacity-90"
          >
            Screen another card
          </button>
        ) : (
          <Link
            href="/#screen"
            className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-accent-fg transition hover:opacity-90"
          >
            Screen a card
          </Link>
        )}
        {kind === "sample" ? (
          <>
            <Link
              href="/sample"
              className="inline-flex h-11 items-center rounded-xl border border-border-strong px-4 text-[14px] font-medium text-fg transition hover:bg-surface2"
            >
              Open this verdict on its own page
            </Link>
            <Link
              href="/sample/verdict.json"
              className="inline-flex h-11 items-center rounded-xl border border-border-strong px-4 text-[14px] font-medium text-fg transition hover:bg-surface2"
            >
              Raw JSON
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
