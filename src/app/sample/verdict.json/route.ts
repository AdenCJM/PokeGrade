import { SAMPLE_META, SAMPLE_PIKACHU_EX } from "@/data/sample-pikachu-ex";

// The reconstructed engine response for the real sample run, as JSON. Static.
export const dynamic = "force-static";

export function GET() {
  const body = {
    note:
      "A real PokeGrade screening run, reconstructed from the engine's ledger row and screenshots of the result. Only fields the ledger or the screenshots recorded are filled in; the model's narrative, per-pillar observation text and read evidence were not retained and are left empty rather than invented. Front-end-only fields: centering.front.overlay_url, centering.back.worse_ratio.",
    meta: SAMPLE_META,
    response: SAMPLE_PIKACHU_EX,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
