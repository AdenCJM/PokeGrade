import {
  PILLAR_LABEL,
  PILLAR_STATUS_LABEL,
  formatMoney,
  reasonLabel,
  verdictMeta,
  worseRatio,
  type GradeResponse,
} from "@/lib/types";

/** Plain-text verdict for pasting into a chat or a forum thread. */
export function buildSummary(r: GradeResponse, opts?: { sampleLabel?: string }): string {
  const meta = verdictMeta(r.verdict);
  const cr = r.soft_pillars.card_read;
  const card = [cr.name ?? "Unidentified card", cr.set, cr.number ? `#${cr.number}` : null]
    .filter(Boolean)
    .join(" · ");
  const lines: string[] = [];
  lines.push(`PokeGrade verdict: ${meta.label.toUpperCase()} (${r.confidence} confidence)`);
  lines.push(card);
  if (opts?.sampleLabel) lines.push(opts.sampleLabel);
  lines.push("");
  const f = r.centering.front;
  const fr = worseRatio(f);
  if (f && fr) {
    lines.push(
      `Centering (measured): ${fr} on the worse axis${f.grade_estimate != null ? `, about PSA ${f.grade_estimate} on centering` : ""}, ${f.confidence} confidence`,
    );
  } else {
    lines.push("Centering: could not be measured from the photo");
  }
  const b = r.centering.back;
  const br = worseRatio(b);
  if (b && br) lines.push(`Back centering: ${br}`);
  for (const p of ["corners", "edges", "surface"] as const) {
    const flag = r.soft_pillars[p];
    lines.push(`${PILLAR_LABEL[p]}: ${PILLAR_STATUS_LABEL[flag.status]}${flag.observation ? ` (${flag.observation})` : ""}`);
  }
  if (r.reason_codes.length) {
    lines.push("");
    lines.push("Why:");
    for (const c of r.reason_codes) lines.push(`- ${reasonLabel(c)}`);
  }
  if (r.soft_pillars.loupe_checklist.length) {
    lines.push("");
    lines.push("Inspect in hand:");
    for (const it of r.soft_pillars.loupe_checklist) {
      lines.push(`- ${PILLAR_LABEL[it.pillar]}: ${it.what_to_check}${it.location ? ` [${it.location}]` : ""}`);
    }
  }
  const v = r.value;
  if (v.fee != null || v.spread_9_10 != null || v.card_value != null) {
    lines.push("");
    if (v.card_value != null) lines.push(`Card value: ${formatMoney(v.card_value)}`);
    if (v.fee != null) lines.push(`Grading fee: ${formatMoney(v.fee)}`);
    if (v.spread_9_10 != null) lines.push(`9 to 10 spread: ${formatMoney(v.spread_9_10)}`);
    if (r.ev_estimate != null) lines.push(`Upside net of fee: ${r.ev_estimate >= 0 ? "+" : ""}${formatMoney(r.ev_estimate)}`);
  }
  lines.push("");
  lines.push("An estimate to decide with, not an official PSA, BGS or CGC grade.");
  return lines.join("\n");
}
