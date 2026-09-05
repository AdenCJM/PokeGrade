"use client";

// Browser-local history of screened cards, exposed as an external store so
// components read it with useSyncExternalStore (no effect-time setState and no
// hydration mismatch: the server snapshot is always empty). Best effort:
// localStorage may be missing or full, and nothing here may break grading.
import { useSyncExternalStore } from "react";
import type { HistoryEntry } from "@/lib/types";

const HISTORY_KEY = "pokegrade.history.v2";
export const HISTORY_CAP = 24;

const EMPTY: HistoryEntry[] = [];
let cache: HistoryEntry[] | null = null;
const listeners = new Set<() => void>();

function read(): HistoryEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(entries: HistoryEntry[]) {
  let list = entries.slice(0, HISTORY_CAP);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
      break;
    } catch {
      if (list.length <= 1) break;
      list = list.slice(0, Math.ceil(list.length / 2));
    }
  }
  cache = list;
  listeners.forEach((l) => l());
}

export function addHistory(entry: HistoryEntry) {
  write([entry, ...read()]);
}

export function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  cache = [];
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  // Re-read storage on (re)subscribe: another tab may have changed it while no
  // component was mounted and the storage event had no listener.
  if (listeners.size === 0) cache = null;
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === HISTORY_KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : String(Date.now());
}
