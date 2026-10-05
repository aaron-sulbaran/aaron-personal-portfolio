"use client";

import type { ReactNode } from "react";

// The panel's plain primitives: a labelled field, a segmented choice, a
// slider with its readout.

export function Field({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-foreground">{label}</span>
        {value !== undefined && <span className="tabular-nums text-muted">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({
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
      {options.map((option) => {
        const on = option === value;
        return (
          <button
            key={String(option)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option)}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              on
                ? "bg-accent text-background"
                : "text-foreground shadow-[inset_0_0_0_1px_var(--color-border)] hover:shadow-[inset_0_0_0_1px_var(--color-muted)]"
            }`}
          >
            {format(option)}
          </button>
        );
      })}
    </div>
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
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label} value={format(value)}>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={disabled ? "opacity-40" : ""}
      />
    </Field>
  );
}

export function PanelButton({ onClick, children, pressed }: { onClick: () => void; children: ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`rounded-md px-2.5 py-1.5 text-left transition-colors ${
        pressed
          ? "bg-accent text-background"
          : "text-foreground shadow-[inset_0_0_0_1px_var(--color-border)] hover:shadow-[inset_0_0_0_1px_var(--color-muted)]"
      }`}
    >
      {children}
    </button>
  );
}
