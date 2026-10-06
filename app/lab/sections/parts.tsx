"use client";

import type { ReactNode } from "react";

// The panel's plain controls, in the wave lab's chrome.

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-border pt-3">
      <p className="mb-2 text-xs text-muted">{title}</p>
      {children}
    </section>
  );
}

export function Choice<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`rounded border px-2 py-0.5 text-xs ${o.id === value ? "border-accent bg-accent text-background" : "border-border"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`mt-1 flex items-center gap-2 text-xs ${disabled ? "opacity-50" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      {label}
    </label>
  );
}

export function Slider(props: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  const { label, value, min, max, step, unit, onChange } = props;
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return (
    <label className="mt-2 block text-xs">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted">
          {value.toFixed(digits)}
          {unit ? ` ${unit}` : ""}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-accent" />
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs leading-snug text-muted">{children}</p>;
}
