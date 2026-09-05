"use client";

// A tiny shared store for the engine mode so the nav badge and the screener
// share one probe. Probes /api/health on first use and again on window focus.
import { useCallback, useEffect, useSyncExternalStore } from "react";

export type EngineMode = "live" | "offline" | "demo";

export type EngineInfo = {
  adjudicator: boolean | null;
  calibration_loaded: boolean | null;
};

export type EngineState = {
  mode: EngineMode | null; // null until the first probe answers
  engine: EngineInfo | null;
  checking: boolean;
};

let state: EngineState = { mode: null, engine: null, checking: false };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
let focusBound = false;

function emit(next: EngineState) {
  state = next;
  listeners.forEach((l) => l());
}

export async function probeEngineMode(): Promise<void> {
  if (inflight) return inflight;
  emit({ ...state, checking: true });
  inflight = (async () => {
    try {
      const res = await fetch("/api/health", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      const body = (await res.json()) as {
        mode: EngineMode;
        engine: EngineInfo | null;
      };
      emit({ mode: body.mode, engine: body.engine, checking: false });
    } catch {
      // A failed probe from the browser means the site itself is unreachable
      // or slow; treat as demo so the page stays usable.
      emit({ mode: state.mode ?? "demo", engine: state.engine, checking: false });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!focusBound && typeof window !== "undefined") {
    focusBound = true;
    window.addEventListener("focus", () => {
      void probeEngineMode();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

const SERVER_STATE: EngineState = { mode: null, engine: null, checking: false };

export function useEngineMode(): EngineState & { refresh: () => Promise<void> } {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
  useEffect(() => {
    if (state.mode === null && !inflight) void probeEngineMode();
  }, []);
  const refresh = useCallback(() => probeEngineMode(), []);
  return { ...snapshot, refresh };
}
