"use client";

import type { PreparedImage } from "@/lib/image";

export type ValueFields = {
  card_value: string;
  fee: string;
  spread_9_10: string;
};

export const EMPTY_VALUE: ValueFields = { card_value: "", fee: "", spread_9_10: "" };
export const MAX_CLOSEUPS = 6;

type PickProps = {
  onPick: (file: File) => void;
  /** capture="environment" opens the rear camera on phones. */
  capture?: boolean;
  multiple?: boolean;
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
};

// A <label> wrapping the file input, so a tap opens the native picker directly.
function PickButton({ onPick, capture, multiple, children, className, ariaLabel }: PickProps) {
  return (
    <label
      aria-label={ariaLabel}
      className={`${className ?? ""} cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)]`}
    >
      {children}
      <input
        type="file"
        accept="image/*"
        multiple={multiple}
        {...(capture ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          files.forEach((f) => onPick(f));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function CameraIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L19 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4m0 0L7 9m5-5 5 5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function Thumb({
  image,
  label,
  onClear,
}: {
  image: PreparedImage;
  label: string;
  onClear: () => void;
}) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-surface2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.thumb} alt={label} className="h-full w-full object-cover" />
      <span className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[12px] font-medium uppercase tracking-wide text-white">
        {label}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label}`}
        className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function EmptySlot({
  label,
  hint,
  required,
  onPick,
}: {
  label: string;
  hint: string;
  required?: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface2/40 p-3 text-center">
      <div>
        <div className="text-[14px] font-medium text-fg">
          {label}
          {required ? <span className="ml-1 font-mono text-[12px] text-faint">required</span> : null}
        </div>
        <div className="mt-0.5 text-[12px] text-faint">{hint}</div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <PickButton
          onPick={onPick}
          capture
          ariaLabel={`Take a photo of the ${label.toLowerCase()}`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-surface px-3 text-[13px] font-medium text-fg ring-1 ring-border transition hover:bg-surface3"
        >
          <CameraIcon />
          Camera
        </PickButton>
        <PickButton
          onPick={onPick}
          ariaLabel={`Upload a photo of the ${label.toLowerCase()}`}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-surface px-3 text-[13px] font-medium text-fg ring-1 ring-border transition hover:bg-surface3"
        >
          <UploadIcon />
          Upload
        </PickButton>
      </div>
    </div>
  );
}

function ValueInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="block truncate font-mono text-[12px] text-faint">{label}</span>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-surface px-2.5 focus-within:border-[var(--ring)]">
        <span className="text-[14px] text-faint">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="tabular w-full min-w-0 bg-transparent px-1.5 py-2 text-[15px] text-fg outline-none placeholder:text-faint"
        />
      </div>
    </label>
  );
}

function Chevron() {
  return (
    <svg className="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const CAPTURE_RULES = [
  "Card flat, camera parallel to it. Tilt invents a centering defect that is not on the card.",
  "Square-on and filling the frame, all four edges visible with a small margin.",
  "Mid-grey or white background. A black-bordered card on black hides the edge the engine measures.",
  "Lock exposure and focus (tap and hold). HDR, sharpening and clarity off.",
  "Even, diffuse light. No flash, no single hard glare across a foil.",
  "Add sharp close-ups of each corner and any suspect spot so a pillar can be ruled instead of routed to your loupe.",
];

export type UploaderProps = {
  front: PreparedImage | null;
  back: PreparedImage | null;
  closeups: PreparedImage[];
  preparing: boolean;
  error: string | null;
  value: ValueFields;
  onValueField: (name: keyof ValueFields, v: string) => void;
  onPickFront: (f: File) => void;
  onPickBack: (f: File) => void;
  onAddCloseup: (f: File) => void;
  onClearFront: () => void;
  onClearBack: () => void;
  onRemoveCloseup: (i: number) => void;
};

export default function Uploader(props: UploaderProps) {
  const {
    front,
    back,
    closeups,
    preparing,
    error,
    value,
    onValueField,
    onPickFront,
    onPickBack,
    onAddCloseup,
    onClearFront,
    onClearBack,
    onRemoveCloseup,
  } = props;

  const hasValue = value.card_value || value.fee || value.spread_9_10;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {front ? (
          <Thumb image={front} label="Front" onClear={onClearFront} />
        ) : (
          <EmptySlot label="Front" hint="flat, square-on, fills the frame" required onPick={onPickFront} />
        )}
        {back ? (
          <Thumb image={back} label="Back" onClear={onClearBack} />
        ) : (
          <EmptySlot label="Back" hint="optional, same rules" onPick={onPickBack} />
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[12px] text-faint">close-ups · optional · {closeups.length}/{MAX_CLOSEUPS}</span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {closeups.map((c, i) => (
            <div key={i} className="w-20 shrink-0 sm:w-24">
              <Thumb image={c} label={`${i + 1}`} onClear={() => onRemoveCloseup(i)} />
            </div>
          ))}
          {closeups.length < MAX_CLOSEUPS ? (
            <div className="aspect-[3/4] w-20 shrink-0 sm:w-24">
              <PickButton
                onPick={onAddCloseup}
                multiple
                ariaLabel="Add close-up photos"
                className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border-strong bg-surface2/40 text-faint transition hover:text-fg"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="text-[12px]">Add</span>
              </PickButton>
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-faint">
          Corners and any suspect spot. Without a close-up, no soft pillar can be
          called clean, so the card lands on an in-hand check.
        </p>
      </div>

      <details className="group rounded-xl border border-border bg-surface2/40" open={Boolean(hasValue)}>
        <summary className="flex items-center justify-between px-4 py-3 text-[14px] font-medium text-fg">
          <span>
            Value <span className="font-normal text-faint">(optional, makes the verdict fee-aware)</span>
          </span>
          <Chevron />
        </summary>
        <div className="border-t border-border px-4 py-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <ValueInput label="card value" value={value.card_value} onChange={(v) => onValueField("card_value", v)} placeholder="raw" />
            <ValueInput label="grading fee" value={value.fee} onChange={(v) => onValueField("fee", v)} placeholder="80" />
            <ValueInput label="9 to 10 spread" value={value.spread_9_10} onChange={(v) => onValueField("spread_9_10", v)} placeholder="diff" />
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-faint">
            If the 9-to-10 spread does not clear the fee, the verdict is skip no
            matter how the card looks. The verdict checks that before anything
            else.
          </p>
        </div>
      </details>

      <details className="group rounded-xl border border-border bg-surface2/40">
        <summary className="flex items-center justify-between px-4 py-3 text-[14px] font-medium text-fg">
          <span>How to shoot for a trustworthy read</span>
          <Chevron />
        </summary>
        <ol className="space-y-2 border-t border-border px-4 py-4">
          {CAPTURE_RULES.map((r, i) => (
            <li key={r} className="flex gap-3 text-[13px] leading-relaxed text-muted">
              <span className="mt-0.5 font-mono text-[12px] text-faint">{i + 1}</span>
              <span>{r}</span>
            </li>
          ))}
        </ol>
      </details>

      {preparing ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface2/60 px-3 py-2 text-[14px] text-muted" role="status">
          <span className="pulse-soft h-2 w-2 rounded-full bg-[var(--ov-card)]" aria-hidden="true" />
          Preparing photo
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="rounded-lg border px-3 py-2.5 text-[14px]"
          style={{
            borderColor: "var(--band-low-ring)",
            background: "var(--band-low-bg)",
            color: "var(--band-low-fg)",
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
