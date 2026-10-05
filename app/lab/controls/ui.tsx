"use client";

import type { ReactNode } from "react";

// The panel's plain primitives and the specimen frame. Lab chrome is set in
// system-ui on purpose, so it never reads as part of what is being judged.

export function Field({ label, value, hint, children }: { label: string; value?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-foreground">{label}</span>
        {value !== undefined && <span className="tabular-nums text-muted">{value}</span>}
      </div>
      {children}
      {hint && <p className="leading-snug text-muted">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  format = String,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  format?: (option: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <Chip key={option} pressed={option === value} onClick={() => onChange(option)}>
          {format(option)}
        </Chip>
      ))}
    </div>
  );
}

export function Chip({ onClick, children, pressed }: { onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`rounded-md px-2.5 py-1 text-left transition-colors ${
        pressed
          ? "bg-accent text-background"
          : "text-foreground shadow-[inset_0_0_0_1px_var(--color-border)] hover:shadow-[inset_0_0_0_1px_var(--color-muted)]"
      }`}
    >
      {children}
    </button>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (next: number) => void;
  hint?: string;
}) {
  return (
    <Field label={label} value={format(value)} hint={hint}>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="min-w-0 rounded-md bg-background px-2 py-1.5 text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Specimen({ index, title, source, note, children }: { index: string; title: string; source: string; note?: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-12 first:border-t-0 first:pt-0">
      <header className="mb-8 flex flex-col gap-1 text-[12px] [font-family:system-ui]">
        <div className="flex items-baseline gap-3">
          <span className="tabular-nums text-muted">{index}</span>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        </div>
        <span className="text-muted">{source}</span>
        {note && <p className="mt-1 max-w-[62ch] leading-snug text-muted">{note}</p>}
      </header>
      {children}
    </section>
  );
}

export function Caption({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-[11px] leading-snug text-muted [font-family:system-ui]">{children}</p>;
}
