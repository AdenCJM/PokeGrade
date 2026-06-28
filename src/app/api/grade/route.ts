import { NextResponse } from "next/server";
import { gradeCard, GradeError, type GradeInput, type InputImage } from "@/lib/anthropic";

// Node runtime (the SDK + env key must stay server-side, never the edge bundle).
export const runtime = "nodejs";
// maxDuration is a no-op under `next dev` but bounds the function if ever
// deployed to a serverless platform — opus vision can take 15-40s.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MAX_CLOSEUPS = 6;
// Base64 inflates ~1.33x; this caps the summed payload so a stray huge upload
// can't wedge the request. (Escape hatch if you ever hit 413: switch the client
// to multipart FormData and base64 server-side.)
const MAX_TOTAL_B64 = 28 * 1024 * 1024;

function asImage(v: unknown): InputImage | null {
  if (v && typeof v === "object" && typeof (v as InputImage).base64 === "string") {
    const b64 = (v as InputImage).base64.trim();
    if (b64) return { base64: b64 };
  }
  return null;
}

export async function POST(req: Request) {
  // Distinguish "no key configured" from "key rejected" (handled downstream).
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "No Anthropic API key found. Copy .env.local.example to .env.local, paste your key, and restart the dev server.",
        code: "no_key",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const front = asImage(b.front);
  if (!front) {
    return NextResponse.json(
      { error: "A front photo is required." },
      { status: 400 },
    );
  }
  const back = asImage(b.back) ?? undefined;
  const closeups: InputImage[] = Array.isArray(b.closeups)
    ? b.closeups.map(asImage).filter((x): x is InputImage => x !== null).slice(0, MAX_CLOSEUPS)
    : [];

  const total =
    front.base64.length +
    (back?.base64.length ?? 0) +
    closeups.reduce((n, c) => n + c.base64.length, 0);
  if (total > MAX_TOTAL_B64) {
    return NextResponse.json(
      { error: "Those photos are too large. Use fewer or smaller images." },
      { status: 413 },
    );
  }

  const input: GradeInput = { front, back, closeups };

  try {
    const result = await gradeCard(input);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof GradeError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("[grade] unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong grading the card. Please try again." },
      { status: 500 },
    );
  }
}
