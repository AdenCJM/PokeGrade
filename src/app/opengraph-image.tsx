import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "PokeGrade: should you pay to grade this card? Measured centering, an honest maybe, and a public log.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#141418";
const FG = "#f4f4f6";
const MUTED = "#a3a3ad";
const FAINT = "#6f6f7a";
const CARD = "#7ee08a";
const BORDER = "#ff6a5c";

export default async function Image() {
  const [sans, mono] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/geist-600.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/geist-mono-500.ttf")),
  ]);

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
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", width: 40, height: 40, borderRadius: 10, background: FG, alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", width: 18, height: 26, border: `2.5px solid ${CARD}`, borderRadius: 2, alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 9, height: 15, border: `2px solid ${BORDER}` }} />
              </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>PokeGrade</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 700 }}>
            <div style={{ fontSize: 68, fontWeight: 600, letterSpacing: -2.5, lineHeight: 1.02 }}>
              Should you pay to grade this card?
            </div>
            <div style={{ fontSize: 28, color: MUTED, lineHeight: 1.3 }}>
              Measured centering. An honest maybe. A public log.
            </div>
          </div>
          <div style={{ display: "flex", fontFamily: "Geist Mono", fontSize: 20, color: FAINT, letterSpacing: 1 }}>
            an estimate to decide with, never a grade
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 330 }}>
          <div
            style={{
              display: "flex",
              width: 250,
              height: 350,
              borderRadius: 14,
              border: `3px solid ${CARD}`,
              background: "#1e1e24",
              paddingTop: 22,
              paddingBottom: 19,
              paddingLeft: 30,
              paddingRight: 18,
            }}
          >
            <div style={{ display: "flex", flex: 1, border: `2.5px solid ${BORDER}`, borderRadius: 4, background: "#26262d" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 22, fontFamily: "Geist Mono" }}>
            <div style={{ fontSize: 44, color: FG, letterSpacing: -1 }}>58.5 / 41.5</div>
            <div style={{ fontSize: 18, color: FAINT, marginTop: 6 }}>PSA-10 gate 55.0 · 3.5 past it</div>
          </div>
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
