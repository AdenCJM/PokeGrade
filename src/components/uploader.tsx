"use client";

import type { PreparedImage } from "@/lib/image";

export type ValueFields = {
  card_value: string;
  fee: string;
  spread_9_10: string;
};

type PickProps = {
  onPick: (file: File) => void;
  /** capture="environment" opens the rear camera on mobile. */
  capture?: boolean;
  children: React.ReactNode;
  className?: string;
  ariaLabel: string;
};

// A <label> wrapping the file input, so a tap opens the native picker directly.
function PickButton({ onPick, capture, children, className, ariaLabel }: PickProps) {
  return (
    <label aria-label={ariaLabel} className={`${className ?? ""} cursor-pointer`}>
      {children}
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </label>
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
    <div className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-surface2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.thumb} alt={label} className="h-full w-full object-cover" />
      <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
        {label}
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove ${label}`}
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function EmptySlot({
  label,
  hint,
  onPick,
}: {
  label: string;
  hint?: string;
  onPick: (file: File) => void;
}) {
  return (
    <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface2/40 p-3 text-center">
      <div>
        <div className="text-sm font-medium text-fg">{label}</div>
        {hint ? <div className="mt-0.5 text-xs text-faint">{hint}</div> : null}
      </div>
      <div className="flex gap-2">
        <PickButton
          onPick={onPick}
          capture
          ariaLabel={`Take photo for ${label}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-fg ring-1 ring-border transition hover:bg-surface2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8a2 2 0 0 1 2-2h2l1.4-2h7.2L19 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Camera
        </PickButton>
        <PickButton
          onPick={onPick}
          ariaLabel={`Upload file for ${label}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-fg ring-1 ring-border transition hover:bg-surface2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4m0 0L7 9m5-5 5 5" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
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
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="mt-1 flex items-center rounded-lg border border-border bg-surface2/60 px-2.5 focus-within:border-[var(--band-mint-ring)]">
        <span className="text-sm text-faint">$</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hint}
          className="w-full bg-transparent px-1.5 py-2 text-sm text-fg outline-none placeholder:text-faint"
        />
      </div>
    </label>
  );
}

export type UploaderProps = {
  front: PreparedImage | null;
  back: PreparedImage | null;
  closeups: PreparedImage[];
  busy: boolean;
  preparing?: boolean;
  canGrade: boolean;
  error: string | null;
  value: ValueFields;
  onValueField: (name: keyof ValueFields, v: string) => void;
  onPickFront: (f: File) => void;
  onPickBack: (f: File) => void;
  onAddCloseup: (f: File) => void;
  onClearFront: () => void;
  onClearBack: () => void;
  onRemoveCloseup: (i: number) => void;
  onGrade: () => void;
};

const MAX_CLOSEUPS = 6;

export default function Uploader(props: UploaderProps) {
  const {
    front,
    back,
    closeups,
    busy,
    preparing,
    canGrade,
    error,
    value,
    onValueField,
    onPickFront,
    onPickBack,
    onAddCloseup,
    onClearFront,
    onClearBack,
    onRemoveCloseup,
    onGrade,
  } = props;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {front ? (
          <Thumb image={front} label="Front" onClear={onClearFront} />
        ) : (
          <EmptySlot label="Front" hint="Required · flat, square-on" onPick={onPickFront} />
        )}
        {back ? (
          <Thumb image={back} label="Back" onClear={onClearBack} />
        ) : (
          <EmptySlot label="Back" hint="Optional" onPick={onPickBack} />
        )}
      </div>

      <p className="rounded-lg border border-border bg-surface2/30 px-3 py-2 text-xs leading-relaxed text-faint">
        Centering is <span className="text-muted">measured</span>, not eyeballed.
        Shoot the front flat and square-on, fill the frame, and use a plain
        mid-grey background so the card edge reads cleanly.
      </p>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            Close-ups (optional)
          </span>
          <span className="text-xs text-faint">
            {closeups.length}/{MAX_CLOSEUPS}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {closeups.map((c, i) => (
            <Thumb
              key={i}
              image={c}
              label={`${i + 1}`}
              onClear={() => onRemoveCloseup(i)}
            />
          ))}
          {closeups.length < MAX_CLOSEUPS ? (
            <div className="aspect-[3/4]">
              <PickButton
                onPick={onAddCloseup}
                ariaLabel="Add a close-up photo"
                className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface2/40 text-faint transition hover:text-fg"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="text-[11px]">Add</span>
              </PickButton>
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-faint">
          Sharp close-ups of corners and any suspect spot let the model rule the
          soft pillars instead of routing them to an in-hand check.
        </p>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
          Value (optional · makes the verdict EV-aware)
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ValueInput
            label="Card value"
            value={value.card_value}
            onChange={(v) => onValueField("card_value", v)}
            hint="raw / 9"
          />
          <ValueInput
            label="Grading fee"
            value={value.fee}
            onChange={(v) => onValueField("fee", v)}
            hint="25"
          />
          <ValueInput
            label="9 → 10 spread"
            value={value.spread_9_10}
            onChange={(v) => onValueField("spread_9_10", v)}
            hint="diff"
          />
        </div>
      </div>

      {preparing ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface2/50 px-3 py-2 text-sm text-muted">
          <span className="pulse-soft h-2 w-2 rounded-full bg-[var(--band-mint-ring)]" />
          Preparing photo…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-[var(--band-low-ring)] bg-[var(--band-low-bg)] px-3 py-2 text-sm text-[var(--band-low-fg)]">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onGrade}
        disabled={!canGrade || busy}
        className="w-full rounded-xl bg-fg px-4 py-3 text-center text-sm font-semibold text-bg transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Screening…" : "Screen card"}
      </button>
      {!front ? (
        <p className="text-center text-xs text-faint">
          Add a front photo to screen this card.
        </p>
      ) : null}
    </div>
  );
}
