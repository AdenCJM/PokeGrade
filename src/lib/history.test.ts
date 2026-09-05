import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_PIKACHU_EX } from "@/data/sample-pikachu-ex";
import type { HistoryEntry } from "@/lib/types";

const KEY = "pokegrade.history.v2";

function entry(id: string): HistoryEntry {
  return { id, at: Date.now(), thumb: "data:image/jpeg;base64,", response: SAMPLE_PIKACHU_EX };
}

async function load() {
  vi.resetModules();
  return await import("@/lib/history");
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("history store", () => {
  it("persists new entries newest first and caps the list", async () => {
    const h = await load();
    for (let i = 0; i < h.HISTORY_CAP + 3; i++) h.addHistory(entry(`e${i}`));
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[];
    expect(stored).toHaveLength(h.HISTORY_CAP);
    expect(stored[0].id).toBe(`e${h.HISTORY_CAP + 2}`);
  });

  it("clears storage and notifies subscribers", async () => {
    const h = await load();
    h.addHistory(entry("a"));
    h.clearHistory();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  // Regression: Codex review 2026-09-05. The module cache outlived the
  // storage listener, so entries cleared in another tab came back from the
  // dead on the next write.
  it("re-reads storage when a subscriber attaches after all others left", async () => {
    const h = await load();
    h.addHistory(entry("keep"));
    // Simulate another tab clearing storage while nothing is subscribed.
    localStorage.removeItem(KEY);
    // First subscriber after the gap: the cache must be dropped.
    const { renderHook, act } = await import("@testing-library/react");
    const { result, unmount } = renderHook(() => h.useHistory());
    expect(result.current).toEqual([]);
    act(() => h.addHistory(entry("fresh")));
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[];
    expect(stored.map((e) => e.id)).toEqual(["fresh"]);
    unmount();
  });
});
