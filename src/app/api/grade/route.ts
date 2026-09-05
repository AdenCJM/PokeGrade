import { NextResponse } from "next/server";
import { engineConfigured, engineHeaders, engineUrl } from "@/lib/engine";

// Node runtime: this route proxies multipart uploads to the FastAPI engine
// (deterministic centering + EV verdict + ledger + Claude adjudicator). The
// engine owns grading; this route is a thin, fail-closed proxy. It does NOT
// fall back to an LLM-only grade if the engine is down: that would reintroduce
// the eyeballed-centering defect the converged design exists to fix.
export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MAX_CLOSEUPS = 6;
// Reject obviously-oversized uploads before buffering the whole body. Generous
// (front + back + 6 close-ups of original phone photos), but bounds memory.
const MAX_REQUEST_BYTES = 200 * 1024 * 1024;
// Stay inside maxDuration so a hung adjudication surfaces as a clean 503
// rather than a platform timeout the browser cannot interpret.
const ENGINE_TIMEOUT_MS = 110_000;

function engineDown(detail?: string) {
  const configured = engineConfigured();
  return NextResponse.json(
    {
      error: configured
        ? "The grading engine is not answering. Check the ENGINE_URL host and try again."
        : "No grading engine is attached to this build. Run `npm run dev` locally to grade for real, or open the sample verdict.",
      code: configured ? "engine_down" : "demo",
      detail,
    },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  const declaredLen = Number(req.headers.get("content-length") ?? 0);
  if (declaredLen > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "Those photos are too large. Use fewer or smaller images." },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form upload." }, { status: 400 });
  }

  const front = form.get("front");
  if (!(front instanceof File) || front.size === 0) {
    return NextResponse.json(
      { error: "A front photo is required." },
      { status: 400 },
    );
  }

  // Rebuild a clean multipart body for the engine (raw original bytes pass
  // straight through, no canvas re-encode).
  const out = new FormData();
  out.append("front", front, "front_flat.jpg");

  const back = form.get("back");
  if (back instanceof File && back.size > 0) out.append("back", back, "back_flat.jpg");

  const closeups = form
    .getAll("closeups")
    .filter((c): c is File => c instanceof File && c.size > 0);
  closeups
    .slice(0, MAX_CLOSEUPS)
    .forEach((c, i) => out.append("closeups", c, `closeup_${i + 1}.jpg`));

  for (const field of ["card_value", "fee", "spread_9_10"] as const) {
    const v = form.get(field);
    if (typeof v === "string" && v.trim() !== "") out.append(field, v.trim());
  }

  let res: Response;
  try {
    res = await fetch(`${engineUrl()}/grade`, {
      method: "POST",
      body: out,
      headers: engineHeaders(),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
  } catch (err) {
    return engineDown(err instanceof Error ? err.message : String(err));
  }

  if (!res.ok) {
    let detail = `Engine returned ${res.status}.`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body */
    }
    if (res.status >= 500) return engineDown(detail);
    return NextResponse.json({ error: detail }, { status: res.status });
  }

  const result = await res.json();
  return NextResponse.json({ result });
}
