import HeroDiagram from "@/components/site/hero-diagram";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-14 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-20 lg:pt-20">
        <div className="max-w-xl">
          <p className="eyebrow">Pre-grade screening for Pokémon cards</p>
          <h1 className="display mt-4 text-[2.6rem] text-fg sm:text-[3.4rem] lg:text-[3.9rem]">
            Should you pay to grade this card?
          </h1>
          <p className="mt-5 text-[1.15rem] font-medium leading-snug text-fg sm:text-[1.3rem]">
            Centering is measured. Everything else admits when it is guessing.
          </p>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-muted sm:text-base">
            An OpenCV engine measures your card&rsquo;s centering from your photos.
            Claude rules on corners, edges and surface, and says <em className="not-italic text-fg">could not assess</em> whenever
            a flat photo cannot prove clean. You get one call: submit, check it
            in hand, or skip. An estimate to decide with, never a grade.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#screen"
              className="inline-flex h-11 items-center rounded-xl bg-accent px-5 text-[15px] font-semibold text-accent-fg transition hover:opacity-90"
            >
              Screen a card
            </a>
            <a
              href="#real-run"
              className="inline-flex h-11 items-center rounded-xl border border-border-strong px-5 text-[15px] font-medium text-fg transition hover:bg-surface2"
            >
              See a real verdict
            </a>
          </div>
          <p className="mt-6 max-w-[56ch] text-[13px] leading-relaxed text-faint">
            Built for modern Pokémon cards with a printed border the engine can
            measure. Borderless full-art cards route centering to an in-hand
            check, and vintage and Japanese cards are untested so far.
          </p>
        </div>

        <div className="relative">
          <div className="ruler pointer-events-none absolute -inset-6 -z-10 rounded-[28px]" aria-hidden="true" />
          <div className="rounded-[var(--r-lg)] border border-border bg-surface p-5 shadow-[0_1px_0_0_var(--border)] sm:p-7">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Centering, measured</span>
              <span className="font-mono text-[12px] text-faint">front · worse axis</span>
            </div>
            <div className="mx-auto mt-2 max-w-[360px]">
              <HeroDiagram />
            </div>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-t border-border pt-5">
              <div>
                <div className="readout text-[2.6rem] font-medium text-fg sm:text-[3rem]">
                  58.5<span className="text-faint"> / </span>41.5
                </div>
                <div className="mt-2 font-mono text-[12px] text-faint">
                  PSA-10 gate 55.0 · 3.5 past it
                </div>
              </div>
              <div className="band band-low inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-[12px]" style={{ background: "var(--bbg)", color: "var(--bfg)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bring)" }} aria-hidden="true" />
                10 off the table
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
