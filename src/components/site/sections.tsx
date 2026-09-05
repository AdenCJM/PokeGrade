import Link from "next/link";
import snapshot from "@/data/ledger-snapshot.json";
import { GITHUB_URL } from "@/components/site/nav";
import { verdictMeta, type Verdict } from "@/lib/types";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  className = "",
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="display mt-3 text-[1.9rem] text-fg sm:text-[2.4rem]">{title}</h2>
          {lead ? <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">{lead}</p> : null}
        </div>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}

function VerdictChip({ v }: { v: Verdict }) {
  const m = verdictMeta(v);
  return (
    <span
      className={`band band-${m.band} inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[12px] font-medium`}
      style={{ background: "var(--bbg)", color: "var(--bfg)" }}
    >
      {m.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// How it works + the three verdicts
// ---------------------------------------------------------------------------

function MeasureGlyph() {
  return (
    <svg viewBox="0 0 120 120" className="h-16 w-16" aria-hidden="true">
      <rect x="30" y="14" width="60" height="92" rx="5" fill="none" strokeWidth="2.5"  style={{ stroke: "var(--ov-card)" }}/>
      <rect x="43" y="24" width="38" height="66" rx="2" fill="none" strokeWidth="2"  style={{ stroke: "var(--ov-border)" }}/>
      <path d="M30 60h13M81 60h9M60 14v10M60 90v16" strokeWidth="2" strokeLinecap="round"  style={{ stroke: "var(--ov-border)" }}/>
    </svg>
  );
}

function RuleGlyph() {
  return (
    <svg viewBox="0 0 120 120" className="h-16 w-16" aria-hidden="true">
      <rect x="18" y="26" width="70" height="90" rx="5" fill="none" strokeWidth="2"  style={{ stroke: "var(--border-strong)" }}/>
      <circle cx="82" cy="34" r="22" strokeWidth="2.5"  style={{ fill: "var(--surface)", stroke: "var(--fg)" }}/>
      <path d="M97 49l14 14" strokeWidth="3" strokeLinecap="round"  style={{ stroke: "var(--fg)" }}/>
      <path d="M70 30v12h12" fill="none" strokeWidth="2.5" strokeLinecap="round"  style={{ stroke: "var(--ov-border)" }}/>
    </svg>
  );
}

function DecideGlyph() {
  return (
    <svg viewBox="0 0 120 120" className="h-16 w-16" aria-hidden="true">
      <path d="M20 30h30M20 60h30M20 90h30" strokeWidth="2" strokeLinecap="round"  style={{ stroke: "var(--border-strong)" }}/>
      <path d="M50 30q20 0 20 30t20 0h10M50 60h50M50 90q20 0 20-30t20 0" fill="none" strokeWidth="2.5" strokeLinecap="round"  style={{ stroke: "var(--fg)" }}/>
      <rect x="86" y="52" width="16" height="16" rx="3"  style={{ fill: "var(--band-mid-ring)" }}/>
    </svg>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Measure",
    glyph: <MeasureGlyph />,
    body: "Detect the card, warp it square and measure the four border widths in pixels. The worse axis maps onto the PSA centering ladder, and past 55/45 on the front a 10 is off the table whatever the rest of the card looks like.",
  },
  {
    n: "02",
    title: "Rule",
    glyph: <RuleGlyph />,
    body: "Claude Opus 4.8 reads corners, edges and surface from your photos. Its default answer is could not assess. Without a close-up a pillar is never called clean, because a flat photo shows the absence of obvious defects, not flawlessness.",
  },
  {
    n: "03",
    title: "Decide",
    glyph: <DecideGlyph />,
    body: "Deterministic gates turn the evidence into one call. The 9-to-10 spread must clear the fee, the centering must clear the gate, and any unproven pillar sends the card to an in-hand check. Claude never emits the verdict.",
  },
];

const VERDICT_TILES: { v: Verdict; body: string }[] = [
  {
    v: "SUBMIT",
    body: "Measured centering clears the PSA-10 gate, nothing in your photos argues against a 10, and the 9-to-10 spread beats the fee. Pack it and send it. This is the rarest of the three calls, and that is deliberate.",
  },
  {
    v: "IN_HAND_CHECK",
    body: "Centering looks fine, but a flat photo cannot prove a corner or a foil surface is clean. Rather than flatter the card, PokeGrade gives you a checklist with the pillar, the spot on the card and what to look for under a loupe. Ten minutes at your desk usually turns this into a submit or a skip.",
  },
  {
    v: "SKIP",
    body: "A measured fact rules the 10 out, usually centering past 55/45, or the 9-to-10 spread does not cover the fee. Either way the money says no. Keep the card raw, or submit it for the slab rather than for the number.",
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      eyebrow="How it works"
      title={
        <>
          Three steps. Only one of them is a judgement call, and it says so.
        </>
      }
      lead="Most pre-grading apps let a vision model eyeball everything from one photo. PokeGrade splits the job by what can actually be measured."
    >
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="rounded-[var(--r-lg)] border border-border bg-surface p-6">
            <div className="flex items-start justify-between">
              {s.glyph}
              <span className="font-mono text-[12px] text-faint">{s.n}</span>
            </div>
            <h3 className="mt-4 text-lg font-semibold text-fg">{s.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-14">
        <p className="eyebrow">The three verdicts</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {VERDICT_TILES.map(({ v, body }) => {
            const m = verdictMeta(v);
            return (
              <div key={v} className={`band band-${m.band} rounded-[var(--r-lg)] border border-border bg-surface p-6`}>
                <div className="flex items-center gap-3">
                  <span
                    className="readout rounded-lg px-2.5 py-1.5 text-[1.35rem] font-medium"
                    style={{ background: "var(--bbg)", color: "var(--bfg)" }}
                  >
                    {m.label}
                  </span>
                </div>
                <p className="mt-3 text-[14px] font-medium text-fg">{m.blurb}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
                {v === "SKIP" ? (
                  <p className="mt-3 text-[13px] text-faint">
                    The one real card screened so far landed here: 58.5/41.5 on the front, $165 fee not spent.{" "}
                    <a href="#real-run" className="underline decoration-border-strong underline-offset-4 hover:text-fg">
                      See the run
                    </a>
                    .
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="mt-6 max-w-3xl space-y-3 text-[15px] leading-relaxed text-muted">
          <p>
            Expect in-hand check on most clean-looking cards shot front and
            back only. A flat photo cannot see a 0.2 mm nick on a corner or a
            hairline across a foil, and anything that calls those cards clean
            is guessing with your submission fee. So you get a checklist with
            locations instead of a number, and shooting corner close-ups
            settles a lot of these cards before you even start.
          </p>
          <p>
            The share of runs landing on in-hand check is published in the log
            alongside the error rates. If that share never comes down, it is a
            failure, and you will be able to see it.
          </p>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// The maths
// ---------------------------------------------------------------------------

const MATHS = [
  {
    figure: "$79.99",
    sub: "PSA Regular, per card",
    body: "PSA's entry tier at the time of writing, with Express at $149, before postage and insurance both ways and a wait measured in weeks. The sub-$25 value tiers were paused in mid-2026. Fees checked September 2026.",
  },
  {
    figure: "55 / 45",
    sub: "the PSA-10 centering gate",
    body: "Worse than this on either front axis and the 10 is gone before condition is even discussed. It is the one part of grading you can check with a ruler, so PokeGrade checks it first.",
  },
  {
    figure: "58.5 / 41.5",
    sub: "the one real card so far",
    body: "Past the gate on the front, so a 10 was off the table before corners, edges or surface mattered. Verdict: skip. The $165 fee its owner had budgeted stayed unspent.",
  },
];

export function Maths() {
  return (
    <section className="border-y border-border bg-surface2/50">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        <p className="eyebrow">The maths this saves you</p>
        <div className="mt-6 grid gap-8 md:grid-cols-3 md:gap-6">
          {MATHS.map((m) => (
            <div key={m.figure}>
              <div className="readout text-[2.3rem] font-medium text-fg">{m.figure}</div>
              <div className="mt-2 font-mono text-[12px] text-faint">{m.sub}</div>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">{m.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// What it won't pretend to see
// ---------------------------------------------------------------------------

const LIMITS = [
  {
    title: "Surface, on modern foils",
    body: "Flat photos miss the micro-scratches and hairline whitening that separate a 9 from a 10 on textured and etched foils. Raking-light surface capture is on the roadmap. Until then, surface is the pillar most likely to land on could not assess.",
  },
  {
    title: "The 9 versus 10 line",
    body: "The difference is often not in the pixels a phone captures at all. Anything that calls it confidently from a flat shot is guessing with your fee, so PokeGrade routes it to your loupe instead.",
  },
  {
    title: "Your phone's lens",
    body: "Close-focus phone lenses bow straight edges, and a 55/45 card shot near the frame edge can read as 58/42 from the optics alone. Without a per-phone calibration profile the engine caps centering confidence at medium, and says so on the verdict.",
  },
  {
    title: "Browser uploads",
    body: "Phones strip or rewrite EXIF on upload, so the web path cannot verify that HDR was off or exposure was locked. The local command-line ingest keeps that validation, and a card on the submit-or-skip boundary deserves it.",
  },
];

export function Honesty() {
  return (
    <Section
      id="honesty"
      eyebrow="Limits"
      title="What it won't pretend to see"
      lead="Four blind spots matter for a photo-based screen. This is what each one hides and what the engine does when it hits it."
    >
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {LIMITS.map((l) => (
          <div key={l.title} className="border-t border-border pt-5">
            <h3 className="text-[15px] font-semibold text-fg">{l.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{l.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// The log, before the results
// ---------------------------------------------------------------------------

type Row = {
  date: string;
  name: string | null;
  set_name: string | null;
  number: string | null;
  verdict: Verdict;
  confidence: string;
  limiting_pillar: string | null;
  centering_front: string | null;
  centering_back: string | null;
  reason_codes: string;
  ev_estimate: number | null;
  psa_grade: number | null;
  cert: string | null;
};

const RULES = [
  "Every card screened goes in the log, including the calls that were wrong.",
  "Both error rates are published with denominators: submits that came back under a 10, and skips that gemmed.",
  "Coverage is published too: the share of runs that resolved to a firm submit or skip rather than an in-hand check.",
  "Cards the tool told me to skip get submitted anyway on a sample basis. You cannot measure a skip you never tested.",
  "Nothing is removed from the log after the fact.",
];

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function VerifiedLog() {
  const rows = snapshot.rows as Row[];
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
      return acc;
    },
    {} as Record<Verdict, number>,
  );
  const unnamed = rows.filter((r) => !r.name).length;
  return (
    <Section
      id="log"
      eyebrow="The verified log"
      title="The log, before the results"
      lead={
        <>
          {snapshot.predictions} cards screened since {fmtDate(snapshot.first_prediction)}. {snapshot.psa_returns === 0 ? "Zero PSA returns, because none have come back yet." : `${snapshot.psa_returns} PSA returns recorded.`}{" "}
          The rules are fixed now, while there is no data to flatter.
        </>
      }
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <ol className="space-y-3">
            {RULES.map((r, i) => (
              <li key={r} className="flex gap-3 text-[14px] leading-relaxed text-muted">
                <span className="mt-0.5 font-mono text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[14px] leading-relaxed text-muted">
            The first PSA returns will be posted here when they land. Until
            then this section stays at zero, which is the honest number. As of
            June 2026 the closest thing in the category is SnapGradeAI&rsquo;s
            page, which shows aggregate accuracy publicly and keeps the full
            table with misses behind a signup.
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[12px] text-faint">
            <span>
              submit {counts.SUBMIT ?? 0} · in-hand check {counts.IN_HAND_CHECK ?? 0} · skip {counts.SKIP ?? 0}
            </span>
            <span>snapshot {fmtDate(snapshot.snapshot_date)}</span>
          </div>
          <div className="mt-3 overflow-x-auto rounded-[var(--r-lg)] border border-border bg-surface">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border font-mono text-[12px] text-faint">
                  <th className="px-4 py-3 font-normal">Date</th>
                  <th className="px-4 py-3 font-normal">Card</th>
                  <th className="px-4 py-3 font-normal">Verdict</th>
                  <th className="px-4 py-3 font-normal">Front</th>
                  <th className="px-4 py-3 font-normal">Limiting</th>
                  <th className="px-4 py-3 font-normal">PSA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-border last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-faint">{fmtDate(r.date)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-fg">
                      {r.name ?? <span className="text-faint">Unnamed test card</span>}
                      {r.number ? <span className="ml-1.5 font-mono text-[12px] text-faint">{r.number}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <VerdictChip v={r.verdict} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-fg">{r.centering_front ?? "n/a"}</td>
                    <td className="px-4 py-3 capitalize text-muted">{r.limiting_pillar ?? "none"}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] text-faint">
                      {r.psa_grade != null ? `PSA ${r.psa_grade}` : "awaiting"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unnamed > 0 ? (
            <p className="mt-3 text-[13px] leading-relaxed text-faint">
              {unnamed} of the June rows are repeated runs of one unnamed test
              card while the engine was being built. They stay in, because
              nothing is removed from the log after the fact.
            </p>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Run it yourself
// ---------------------------------------------------------------------------

const QUICKSTART = `gh repo clone AdenCJM/PokeGrade && cd PokeGrade
npm install && uv sync --project engine
cp .env.local.example .env.local  # add your Anthropic key
npm run dev                       # web + engine on :3000`;

export function RunItYourself() {
  return (
    <Section
      id="run"
      eyebrow="Run it yourself"
      title="The engine runs on your machine, so it can grade for real."
      lead="It runs on your own API key and writes to your own ledger. Five minutes from clone to a verdict on a card you are holding."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <pre className="overflow-x-auto rounded-[var(--r-lg)] border border-border bg-surface p-5 font-mono text-[13px] leading-relaxed text-fg">
          <code>{QUICKSTART}</code>
        </pre>
        <div className="space-y-4 text-[14px] leading-relaxed text-muted">
          <p>
            Add <code className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[12px] text-fg">npm run dev:lan</code> and
            open the printed network address on your phone to shoot cards
            straight into the screener over your own wifi.
          </p>
          <p>
            On the local build your photos go to the engine on your machine and
            to Claude for the analysis. Nothing is kept: the ledger stores the
            verdict and a hash of each image, not the image.
          </p>
          <p>
            The repo also ships a command-line ingest with fuller capture
            validation, a lens-calibration routine for your phone, and the
            tests for the two parts with objectively right answers: the
            centering maths and the verdict gates.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-fg transition hover:opacity-90"
            >
              Open on GitHub
            </a>
            <Link
              href="/sample/verdict.json"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center rounded-xl border border-border-strong px-4 text-[14px] font-medium text-fg transition hover:bg-surface2"
            >
              Raw verdict JSON
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
