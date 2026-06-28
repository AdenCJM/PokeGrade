"use client";

import { useCallback, useEffect, useState } from "react";
import { isImageFile, prepareImage, shrinkDataUrl, type PreparedImage } from "@/lib/image";
import type { GradeResult, HistoryEntry } from "@/lib/types";
import Uploader from "@/components/uploader";
import Analyzing from "@/components/analyzing";
import Result, { type ResultImages } from "@/components/result";
import History from "@/components/history";

type Status = "idle" | "grading" | "done";

const HISTORY_KEY = "pokegrade.history.v1";
const HISTORY_CAP = 24;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  let list = entries.slice(0, HISTORY_CAP);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      return;
    } catch {
      // QuotaExceededError — drop the oldest half and retry.
      if (list.length <= 1) return;
      list = list.slice(0, Math.ceil(list.length / 2));
    }
  }
}

export default function Home() {
  const [front, setFront] = useState<PreparedImage | null>(null);
  const [back, setBack] = useState<PreparedImage | null>(null);
  const [closeups, setCloseups] = useState<PreparedImage[]>([]);

  const [status, setStatus] = useState<Status>("idle");
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [resultImages, setResultImages] = useState<ResultImages | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const pick = useCallback(
    async (file: File, set: (img: PreparedImage) => void) => {
      setError(null);
      if (!isImageFile(file)) {
        setError("That file isn't an image. Use a JPEG, PNG, or HEIC.");
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
    },
    [],
  );

  const grade = useCallback(async () => {
    if (!front) return;
    setStatus("grading");
    setError(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          front: { base64: front.base64 },
          back: back ? { base64: back.base64 } : undefined,
          closeups: closeups.map((c) => ({ base64: c.base64 })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Grading failed. Please try again.");
        setStatus("idle");
        return;
      }
      const graded = data.result as GradeResult;
      const images: ResultImages = {
        front: front.dataUrl,
        back: back?.dataUrl ?? null,
        closeups: closeups.map((c) => c.dataUrl),
      };
      setResult(graded);
      setResultImages(images);
      setStatus("done");

      // Persist to history with a small thumbnail (best-effort).
      try {
        const thumb = await shrinkDataUrl(front.dataUrl, 256);
        const entry: HistoryEntry = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : String(Date.now()),
          at: Date.now(),
          thumb,
          result: graded,
        };
        setHistory((prev) => {
          const next = [entry, ...prev].slice(0, HISTORY_CAP);
          saveHistory(next);
          return next;
        });
      } catch {
        /* history is best-effort */
      }
    } catch {
      setError("Couldn't reach the grader. Is the dev server running?");
      setStatus("idle");
    }
  }, [front, back, closeups]);

  const reset = useCallback(() => {
    setFront(null);
    setBack(null);
    setCloseups([]);
    setResult(null);
    setResultImages(null);
    setError(null);
    setStatus("idle");
  }, []);

  const openHistory = useCallback((e: HistoryEntry) => {
    setResult(e.result);
    setResultImages({ front: e.thumb, back: null, closeups: [] });
    setStatus("done");
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="grade-figure text-2xl font-bold tracking-tight text-fg">
            PokeGrade
          </h1>
          <p className="mt-1 text-sm text-muted">
            A PSA-style grade estimate from your photos.
          </p>
        </div>
        <span className="hidden text-right text-xs text-faint sm:block">
          Estimate, not an
          <br />
          official grade
        </span>
      </header>

      {status === "done" && result && resultImages ? (
        <Result result={result} images={resultImages} onReset={reset} />
      ) : status === "grading" && front ? (
        <Analyzing frontUrl={front.dataUrl} />
      ) : (
        <div className="space-y-8">
          <Uploader
            front={front}
            back={back}
            closeups={closeups}
            busy={false}
            preparing={preparing}
            canGrade={!!front && !preparing}
            error={error}
            onPickFront={(f) => pick(f, setFront)}
            onPickBack={(f) => pick(f, setBack)}
            onAddCloseup={(f) =>
              pick(f, (img) => setCloseups((prev) => [...prev, img]))
            }
            onClearFront={() => setFront(null)}
            onClearBack={() => setBack(null)}
            onRemoveCloseup={(i) =>
              setCloseups((prev) => prev.filter((_, idx) => idx !== i))
            }
            onGrade={grade}
          />

          <History
            entries={history}
            onOpen={openHistory}
            onClear={clearHistory}
          />

          <p className="text-xs leading-relaxed text-faint">
            For the best read: fill the frame, shoot square-on, kill the glare,
            and add close-ups of the corners. This is an estimate to help you
            triage and compare cards, not a substitute for professional grading.
          </p>
        </div>
      )}
    </main>
  );
}
