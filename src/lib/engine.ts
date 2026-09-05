// Server-only helpers for reaching the PokeGrade engine (FastAPI, OpenCV,
// Claude adjudicator). Import from route handlers only: never from client code.
//
// Modes:
//   live     the engine answered /health, grading works
//   offline  ENGINE_URL is configured but the engine did not answer
//   demo     no engine is configured and nothing answers on localhost, so the
//            public build shows the real sample verdict instead of grading
//
// On Vercel there is no engine unless ENGINE_URL points at a hosted one, so the
// probe is skipped and the mode is demo. Every live grade is a paid Claude
// Opus vision call, which is exactly why the public build does not attach one.
import "server-only";

export type EngineMode = "live" | "offline" | "demo";

export type EngineHealth = {
  status: string;
  engine_version?: string;
  standards_version?: string;
  adjudicator?: boolean;
  calibration_loaded?: boolean;
};

const DEFAULT_ENGINE_URL = "http://127.0.0.1:8000";

export function engineConfigured(): boolean {
  return Boolean(process.env.ENGINE_URL?.trim());
}

/** Whether this deployment may grade at all. Locally (no VERCEL env) grading
 * is always allowed. On Vercel it needs BOTH an explicit engine and the
 * LIVE_GRADING=1 opt-in, so setting ENGINE_URL alone can never expose paid
 * grading on a public URL. */
export function liveGradingAllowed(): boolean {
  if (!process.env.VERCEL) return true;
  return engineConfigured() && process.env.LIVE_GRADING?.trim() === "1";
}

export function engineUrl(): string {
  return process.env.ENGINE_URL?.trim().replace(/\/+$/, "") || DEFAULT_ENGINE_URL;
}

/** Forward-compatible with the v2 engine trust boundary: when a shared secret
 * is set, every engine call carries it. The v1 engine ignores the header. */
export function engineHeaders(): HeadersInit {
  const secret = process.env.ENGINE_SHARED_SECRET?.trim();
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}

export async function probeEngine(
  timeoutMs = 1500,
): Promise<EngineHealth | null> {
  try {
    const res = await fetch(`${engineUrl()}/health`, {
      headers: engineHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as EngineHealth;
    return body?.status === "ok" ? body : null;
  } catch {
    return null;
  }
}

export async function detectMode(): Promise<{
  mode: EngineMode;
  engine: EngineHealth | null;
}> {
  const configured = engineConfigured();
  // On Vercel, demo unless live grading is explicitly allowed; nothing to probe.
  if (!liveGradingAllowed()) return { mode: "demo", engine: null };
  const engine = await probeEngine();
  if (engine) return { mode: "live", engine };
  return { mode: configured ? "offline" : "demo", engine: null };
}
