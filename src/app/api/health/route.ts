import { NextResponse } from "next/server";
import { detectMode } from "@/lib/engine";

// Tells the browser whether grading is live (engine reachable), offline (an
// engine is configured but not answering) or demo (no engine attached, as on
// the public build). The browser never talks to the engine directly.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { mode, engine } = await detectMode();
  return NextResponse.json(
    {
      mode,
      engine: engine
        ? {
            adjudicator: engine.adjudicator ?? null,
            calibration_loaded: engine.calibration_loaded ?? null,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
