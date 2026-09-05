import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression: Codex review 2026-09-05 found the LIVE_GRADING gate was
// documented but never enforced. These tests pin the contract: on Vercel,
// grading needs BOTH ENGINE_URL and LIVE_GRADING=1; locally it is always
// allowed and the mode comes from probing the engine.

const ENV_KEYS = ["VERCEL", "ENGINE_URL", "LIVE_GRADING", "ENGINE_SHARED_SECRET"] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

async function load() {
  vi.resetModules();
  return await import("@/lib/engine");
}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
});

describe("liveGradingAllowed", () => {
  it("is always allowed off Vercel", async () => {
    const { liveGradingAllowed } = await load();
    expect(liveGradingAllowed()).toBe(true);
  });

  it("refuses on Vercel with only ENGINE_URL set", async () => {
    process.env.VERCEL = "1";
    process.env.ENGINE_URL = "https://engine.example";
    const { liveGradingAllowed } = await load();
    expect(liveGradingAllowed()).toBe(false);
  });

  it("refuses on Vercel with only LIVE_GRADING set", async () => {
    process.env.VERCEL = "1";
    process.env.LIVE_GRADING = "1";
    const { liveGradingAllowed } = await load();
    expect(liveGradingAllowed()).toBe(false);
  });

  it("allows on Vercel when both are set", async () => {
    process.env.VERCEL = "1";
    process.env.ENGINE_URL = "https://engine.example";
    process.env.LIVE_GRADING = "1";
    const { liveGradingAllowed } = await load();
    expect(liveGradingAllowed()).toBe(true);
  });
});

describe("detectMode", () => {
  it("returns demo on Vercel without touching the network when not allowed", async () => {
    process.env.VERCEL = "1";
    process.env.ENGINE_URL = "https://engine.example";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { detectMode } = await load();
    await expect(detectMode()).resolves.toEqual({ mode: "demo", engine: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns offline when the configured engine does not answer", async () => {
    process.env.VERCEL = "1";
    process.env.ENGINE_URL = "https://engine.example";
    process.env.LIVE_GRADING = "1";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { detectMode } = await load();
    await expect(detectMode()).resolves.toEqual({ mode: "offline", engine: null });
  });

  it("returns live with the engine's capabilities when /health answers", async () => {
    process.env.ENGINE_URL = "https://engine.example";
    const body = { status: "ok", adjudicator: false, calibration_loaded: false };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
    );
    const { detectMode } = await load();
    const result = await detectMode();
    expect(result.mode).toBe("live");
    expect(result.engine).toEqual(body);
  });

  // Regression: ISSUE-005 — a local engine outage was reported as the public
  // "demo build" state, telling a local user to "run npm run dev locally".
  // Found by /qa on 2026-09-05
  // Report: .gstack/qa-reports/qa-report-pokegrade-topaz-vercel-app-2026-09-05.md
  it("returns offline locally when nothing answers, never demo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const { detectMode } = await load();
    await expect(detectMode()).resolves.toEqual({ mode: "offline", engine: null });
  });
});

describe("engineHeaders", () => {
  it("forwards the shared secret as a bearer token when set", async () => {
    process.env.ENGINE_SHARED_SECRET = "s3cret";
    const { engineHeaders } = await load();
    expect(engineHeaders()).toEqual({ Authorization: "Bearer s3cret" });
  });

  it("sends nothing when no secret is configured", async () => {
    const { engineHeaders } = await load();
    expect(engineHeaders()).toEqual({});
  });
});
