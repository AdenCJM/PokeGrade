// A centering ladder: the worse-axis share plotted against the PSA gates, with
// the regions labelled by consequence rather than by number.

type Segment = { from: number; to: number; band: "high" | "mid" | "low"; label: string };

const FRONT: { min: number; max: number; segments: Segment[] } = {
  min: 50,
  max: 70,
  segments: [
    { from: 50, to: 55, band: "high", label: "10 possible" },
    { from: 55, to: 60, band: "mid", label: "9 ceiling" },
    { from: 60, to: 70, band: "low", label: "8 or below" },
  ],
};

const BACK: { min: number; max: number; segments: Segment[] } = {
  min: 50,
  max: 85,
  segments: [
    { from: 50, to: 75, band: "high", label: "10 possible" },
    { from: 75, to: 85, band: "low", label: "caps the 10" },
  ],
};

const RING: Record<Segment["band"], string> = {
  high: "var(--band-high-ring)",
  mid: "var(--band-mid-ring)",
  low: "var(--band-low-ring)",
};

export function gapToGate(side: "front" | "back", value: number): string {
  const gate = side === "front" ? 55 : 75;
  const diff = Math.round((value - gate) * 10) / 10;
  if (diff > 0) return `${diff.toFixed(1)} past the 10 gate`;
  return `${Math.abs(diff).toFixed(1)} inside the 10 gate`;
}

export default function Ladder({
  side,
  value,
  ratio,
}: {
  side: "front" | "back";
  value: number;
  ratio: string;
}) {
  const scale = side === "front" ? FRONT : BACK;
  const clamped = Math.min(scale.max, Math.max(scale.min, value));
  const pct = ((clamped - scale.min) / (scale.max - scale.min)) * 100;
  const label = `${side === "front" ? "Front" : "Back"} ${ratio}, ${gapToGate(side, value)}`;
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 font-mono text-[12px]">
        <span className="text-faint">{side === "front" ? "front" : "back"}</span>
        <span className="text-fg tabular">{ratio}</span>
      </div>
      <div className="relative mt-2 h-2.5 w-full" role="img" aria-label={label}>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {scale.segments.map((s) => (
            <div
              key={s.label}
              style={{
                width: `${((s.to - s.from) / (scale.max - scale.min)) * 100}%`,
                background: `color-mix(in oklch, ${RING[s.band]} 55%, transparent)`,
              }}
            />
          ))}
        </div>
        <div
          className="pin absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[0_0_0_2px_var(--surface)]"
          style={{ left: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[12px] text-faint" aria-hidden="true">
        {scale.segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RING[s.band] }} />
            {s.label}
            <span className="text-faint/80">{s.from === scale.min ? `to ${s.to}` : s.to === scale.max ? `past ${s.from}` : `${s.from} to ${s.to}`}</span>
          </span>
        ))}
      </div>
      <p className="mt-1 text-[13px] text-muted">{gapToGate(side, value)}</p>
    </div>
  );
}
