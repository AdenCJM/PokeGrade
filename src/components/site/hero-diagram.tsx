// The product's core idea as a diagram: a card, its detected edge (green), its
// printed inner border (red), and the four border widths the engine measures.
// Geometry is chosen so the left-right split is exactly 58.5 / 41.5, the real
// sample card's measurement. Pure SVG + CSS; no JS.

const W = 420;
const H = 560;
// Card rectangle.
const CX = 70;
const CY = 50;
const CW = 280;
const CH = 392;
// Border gaps in canvas px. Left / right sum to 48 so 28.08 / 19.92 = 58.5 / 41.5.
const L = 28.08;
const R = 19.92;
const T = 24;
const B = 21;
const IX = CX + L;
const IY = CY + T;
const IW = CW - L - R;
const IH = CH - T - B;
const MIDY = CY + CH / 2;
const MIDX = CX + CW / 2;

export default function HeroDiagram() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label="A card outline with its printed border measured on all four sides. The left border is wider than the right, a 58.5 to 41.5 split."
    >
      <defs>
        <linearGradient id="stock" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0"  style={{ stopColor: "var(--surface-3)" }}/>
          <stop offset="1"  style={{ stopColor: "var(--surface-2)" }}/>
        </linearGradient>
      </defs>

      {/* Card body and art well. */}
      <rect x={CX} y={CY} width={CW} height={CH} rx="12" fill="url(#stock)" />
      <rect x={IX} y={IY} width={IW} height={IH} rx="4"  style={{ fill: "var(--surface)" }}/>

      {/* Detected card edge (green) and inner border (red) draw in. */}
      <rect
        className="draw"
        x={CX}
        y={CY}
        width={CW}
        height={CH}
        rx="12"
        fill="none"
       
        strokeWidth="2.5"
       style={{ stroke: "var(--ov-card)" }}/>
      <rect
        className="draw"
        x={IX}
        y={IY}
        width={IW}
        height={IH}
        rx="4"
        fill="none"
       
        strokeWidth="2"
       style={{ stroke: "var(--ov-border)" }}/>

      {/* Measurement ticks: the four gaps. */}
      <g strokeWidth="2" strokeLinecap="round" className="draw-late" style={{ stroke: "var(--ov-border)" }}>
        <path d={`M${CX} ${MIDY} H${IX}`} />
        <path d={`M${CX + CW} ${MIDY} H${IX + IW}`} />
        <path d={`M${MIDX} ${CY} V${IY}`} />
        <path d={`M${MIDX} ${CY + CH} V${IY + IH}`} />
      </g>

      {/* Callouts. */}
      <g className="fade-late" fontFamily="var(--font-mono)" fontSize="13" style={{ fill: "var(--fg)" }}>
        <g>
          <line x1={CX - 8} y1={MIDY} x2={CX - 34} y2={MIDY} strokeWidth="1"  style={{ stroke: "var(--border-strong)" }}/>
          <text x={CX - 40} y={MIDY + 4} textAnchor="end">
            28.1
          </text>
        </g>
        <g>
          <line x1={CX + CW + 8} y1={MIDY} x2={CX + CW + 34} y2={MIDY} strokeWidth="1"  style={{ stroke: "var(--border-strong)" }}/>
          <text x={CX + CW + 40} y={MIDY + 4}>
            19.9
          </text>
        </g>
        <text x={MIDX} y={CY - 14} textAnchor="middle">
          24.0
        </text>
        <text x={MIDX} y={CY + CH + 26} textAnchor="middle">
          21.0
        </text>
      </g>

      {/* Axis labels. */}
      <g className="fade-late" fontFamily="var(--font-mono)" fontSize="11" style={{ fill: "var(--fg-faint)" }}>
        <text x={CX} y={H - 40}>
          left-right
        </text>
        <text x={CX + CW} y={H - 40} textAnchor="end">
          58.5 / 41.5
        </text>
        <text x={CX} y={H - 22}>
          top-bottom
        </text>
        <text x={CX + CW} y={H - 22} textAnchor="end">
          53.3 / 46.7
        </text>
      </g>
    </svg>
  );
}
