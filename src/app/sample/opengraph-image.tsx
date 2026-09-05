import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "PokeGrade verdict: Skip. Pikachu ex measured 58.5/41.5 on the front, past the PSA-10 centering gate.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#141418";
const FG = "#f4f4f6";
const MUTED = "#a3a3ad";
const FAINT = "#6f6f7a";
const SKIP_BG = "#3a1f1f";
const SKIP_FG = "#ff8a80";

export default async function Image() {
  const [sans, mono, overlay] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/geist-600.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/geist-mono-500.ttf")),
    readFile(join(process.cwd(), "src/assets/og-overlay.jpg")),
  ]);
  const overlaySrc = `data:image/jpeg;base64,${overlay.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BG,
          color: FG,
          fontFamily: "Geist",
          padding: 64,
          gap: 56,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>PokeGrade · real screening run</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ display: "flex", background: SKIP_BG, color: SKIP_FG, fontSize: 64, fontWeight: 600, letterSpacing: -2, padding: "6px 22px", borderRadius: 16 }}>
                Skip
              </div>
              <div style={{ display: "flex", flexDirection: "column", color: MUTED, fontSize: 24, lineHeight: 1.25 }}>
                <span>Pikachu ex 277/217</span>
                <span>front and back photos only</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Geist Mono" }}>
              <div style={{ fontSize: 60, letterSpacing: -1.5 }}>58.5 / 41.5</div>
              <div style={{ fontSize: 22, color: FAINT, marginTop: 6 }}>front, worse axis · gate 55.0 · 3.5 past it</div>
            </div>
            <div style={{ fontSize: 26, color: MUTED, lineHeight: 1.3, maxWidth: 620 }}>
              A 10 was off the table before condition mattered. The $165 fee stayed unspent.
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 18, color: FAINT, letterSpacing: 1 }}>
            6 July 2026 · an estimate, not an official grade
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={overlaySrc} width={360} height={506} style={{ borderRadius: 14, objectFit: "cover" }} alt="" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: sans, weight: 600, style: "normal" },
        { name: "Geist Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}
