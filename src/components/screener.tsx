"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { isImageFile, prepareImage, shrinkDataUrl, type PreparedImage } from "@/lib/image";
import { useEngineMode } from "@/lib/engine-mode";
import { addHistory, clearHistory, newId, useHistory } from "@/lib/history";
import type { GradeResponse, HistoryEntry } from "@/lib/types";
import { SAMPLE_META, SAMPLE_PIKACHU_EX } from "@/data/sample-pikachu-ex";
import Uploader, { EMPTY_VALUE, MAX_CLOSEUPS, type ValueFields } from "@/components/uploader";
import Analyzing from "@/components/analyzing";
import Result, { type ResultImages, type ResultKind } from "@/components/result/result";
import History from "@/components/history";

type Status = "idle" | "grading" | "replaying" | "done";

const REPLAY_MS = 4400;

const SAMPLE_IMAGES: ResultImages = {
  front: SAMPLE_META.images.front,
  back: SAMPLE_META.images.back,
  closeups: [],
};

export default function Screener() {
  const { mode, engine, refresh } = useEngineMode();
  const history = useHistory();

  const [front, setFront] = useState<PreparedImage | null>(null);
  const [back, setBack] = useState<PreparedImage | null>(null);
  const [closeups, setCloseups] = useState<PreparedImage[]>([]);
  const [value, setValue] = useState<ValueFields>(EMPTY_VALUE);

  const [status, setStatus] = useState<Status>("idle");
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    response: GradeResponse;
    images: ResultImages;
    kind: ResultKind;
  } | null>(null);

  const replayTimer = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (replayTimer.current) window.clearTimeout(replayTimer.current);
    };
  }, []);

  const scrollToPanel = useCallback(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const pick = useCallback(async (file: File, set: (img: PreparedImage) => void) => {
    setError(null);
    if (!isImageFile(file)) {
      setError("That file is not an image. Use a JPEG, PNG or HEIC.");
      return;
    }
    setPreparing(true);
    try {
      set(await prepareImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that image.");
    } finally {
      setPreparing(false);
    }
  }, []);

  const onValueField = useCallback((name: keyof ValueFields, v: string) => {
    setValue((prev) => ({ ...prev, [name]: v }));
  }, []);

  const playSample = useCallback(() => {
    setError(null);
    setStatus("replaying");
    scrollToPanel();
    replayTimer.current = window.setTimeout(() => {
      setResult({ response: SAMPLE_PIKACHU_EX, images: SAMPLE_IMAGES, kind: "sample" });
      setStatus("done");
    }, REPLAY_MS);
  }, [scrollToPanel]);

  const grade = useCallback(async () => {
    if (!front) return;
    setStatus("grading");
    setError(null);
    scrollToPanel();
    try {
      const fd = new FormData();
      fd.append("front", front.file, front.file.name || "front.jpg");
      if (back) fd.append("back", back.file, back.file.name || "back.jpg");
      closeups.forEach((c, i) => fd.append("closeups", c.file, c.file.name || `closeup_${i + 1}.jpg`));
      for (const k of ["card_value", "fee", "spread_9_10"] as const) {
        if (value[k].trim() !== "") fd.append(k, value[k].trim());
      }

      const res = await fetch("/api/grade", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Screening failed. Please try again.");
        setStatus("idle");
        void refresh();
        return;
      }
      const graded = data.result as GradeResponse;
      const images: ResultImages = {
        front: front.thumb,
        back: back?.thumb ?? null,
        closeups: closeups.map((c) => c.thumb),
      };
      setResult({ response: graded, images, kind: "live" });
      setStatus("done");

      try {
        const thumb = await shrinkDataUrl(front.thumb, 256);
        const entry: HistoryEntry = { id: newId(), at: Date.now(), thumb, response: graded };
        addHistory(entry);
      } catch {
        /* history is best effort */
      }
    } catch {
      setError("Could not reach the site. Check your connection and try again.");
      setStatus("idle");
    }
  }, [front, back, closeups, value, refresh, scrollToPanel]);

  const reset = useCallback(() => {
    setFront(null);
    setBack(null);
    setCloseups([]);
    setValue(EMPTY_VALUE);
    setResult(null);
    setError(null);
    setStatus("idle");
  }, []);

  const openHistory = useCallback(
    (e: HistoryEntry) => {
      setResult({
        response: e.response,
        images: { front: e.thumb, back: null, closeups: [] },
        kind: "history",
      });
      setStatus("done");
      scrollToPanel();
    },
    [scrollToPanel],
  );

  const live = mode === "live";
  const canGrade = live && !!front && !preparing;

  return (
    <div ref={panelRef} className="scroll-mt-20">
      {status === "done" && result ? (
        <Result
          result={result.response}
          images={result.images}
          kind={result.kind}
          onReset={reset}
        />
      ) : status === "grading" && front ? (
        <Analyzing frontUrl={front.thumb} />
      ) : status === "replaying" ? (
        <Analyzing frontUrl={SAMPLE_META.images.front} replay />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[var(--r-lg)] border border-border bg-surface p-4 sm:p-6">
            {mode === "demo" ? (
              <DemoBar onPlay={playSample} />
            ) : mode === "offline" ? (
              <OfflineBar onRetry={() => void refresh()} />
            ) : null}

            <div className={mode === "demo" || mode === "offline" ? "mt-5" : ""}>
              <Uploader
                front={front}
                back={back}
                closeups={closeups}
                preparing={preparing}
                error={error}
                value={value}
                onValueField={onValueField}
                onPickFront={(f) => pick(f, setFront)}
                onPickBack={(f) => pick(f, setBack)}
                onAddCloseup={(f) =>
                  pick(f, (img) => setCloseups((prev) => (prev.length < MAX_CLOSEUPS ? [...prev, img] : prev)))
                }
                onClearFront={() => setFront(null)}
                onClearBack={() => setBack(null)}
                onRemoveCloseup={(i) => setCloseups((prev) => prev.filter((_, idx) => idx !== i))}
              />
            </div>

            {/* Action bar: sticky on phones so the primary action stays in reach. */}
            <div className="safe-bottom sticky bottom-0 -mx-4 mt-5 border-t border-border bg-surface/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:backdrop-blur-none">
              {live ? (
                <>
                  <button
                    type="button"
                    onClick={grade}
                    disabled={!canGrade}
                    className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-fg transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Screen this card
                  </button>
                  <p className="mt-2 text-center text-[12px] text-faint">
                    {front
                      ? "Photos go to the engine on this machine and to Claude for the analysis. Nothing is kept."
                      : "Add a front photo to screen this card."}
                    {engine && engine.adjudicator === false
                      ? " No API key on the engine, so corners, edges and surface will route to an in-hand check."
                      : null}
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={playSample}
                    className="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-fg transition hover:opacity-90"
                  >
                    Play the real screening run
                  </button>
                  <p className="mt-2 text-center text-[12px] text-faint">
                    {front
                      ? "This build cannot analyse your photos. They stay in this browser."
                      : mode === null
                        ? "Checking for a grading engine."
                        : "Pikachu ex, front and back only, screened 6 July 2026."}
                  </p>
                </>
              )}
            </div>
          </div>

          <aside className="space-y-6">
            <History entries={history} onOpen={openHistory} onClear={clearHistory} />
            <div className="rounded-[var(--r-lg)] border border-border bg-surface2/40 p-5 text-[13px] leading-relaxed text-muted">
              <p className="eyebrow mb-2">What you get back</p>
              <ul className="space-y-1.5">
                <li>One verdict: submit, in-hand check or skip.</li>
                <li>Measured centering with the overlay the engine drew.</li>
                <li>A ruling on corners, edges and surface, or an honest could not assess.</li>
                <li>A loupe checklist with coordinates.</li>
                <li>Upside net of fee, if you gave it the numbers.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function DemoBar({ onPlay }: { onPlay: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-surface2/60 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-md border border-border-strong px-1.5 py-0.5 font-mono text-[12px] text-fg">
          Demo build
        </span>
        <p className="text-[14px] leading-relaxed text-muted">
          The engine runs on a machine, not on this page, so nothing here will
          analyse your card. What you can do instead: play a real screening run
          end to end on a card I shot myself, read the raw JSON it produced, or
          clone the repo and run the whole thing locally in about five minutes.
          Nothing you add to this page leaves your browser.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPlay}
          className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-fg transition hover:opacity-90"
        >
          Play the real run
        </button>
        <Link
          href="/sample/verdict.json"
          className="inline-flex h-9 items-center rounded-lg border border-border-strong px-3 text-[13px] font-medium text-fg transition hover:bg-surface"
        >
          Raw verdict JSON
        </Link>
        <a
          href="#run"
          className="inline-flex h-9 items-center rounded-lg border border-border-strong px-3 text-[13px] font-medium text-fg transition hover:bg-surface"
        >
          Run it locally
        </a>
      </div>
    </div>
  );
}

function OfflineBar({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-[14px]"
      style={{ borderColor: "var(--band-low-ring)", background: "var(--band-low-bg)", color: "var(--band-low-fg)" }}
      role="status"
    >
      <span>
        An engine is configured but did not answer. Start it with <code className="font-mono text-[13px]">npm run dev</code>, then retry.
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-current px-2.5 py-1 text-[13px] font-medium"
      >
        Retry
      </button>
    </div>
  );
}
