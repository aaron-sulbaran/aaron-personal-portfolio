"use client";

import { useState } from "react";
import { FACES, GROUP_LABELS, faceById, type FaceGroup } from "./faces";
import { Field, PanelButton, Segmented, Slider } from "./controls";
import { COLOR_ROLES, PRESETS, ROLES, ROLE_LABELS, SITE_TODAY, exportValues, withFace, type Settings } from "./settings";
import { editB, flipView, setLab, setTheme, useLab, useTheme } from "./store";

// The control panel: fixed on the right from lg up (the bench reserves its
// width, so it never covers a specimen), a plain block above the bench below
// that. Every edit lands on B; A is a pinned copy to flip against.
const GROUPS: readonly FaceGroup[] = ["control", "family", "google", "disk"];
const same = (x: Settings, y: Settings) => JSON.stringify(x) === JSON.stringify(y);

export function Panel() {
  const lab = useLab();
  const theme = useTheme();
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const b = lab.b;
  const face = faceById(b.face);
  const shown = lab.view === "a" && lab.a ? lab.a : b;
  const shownLabel = lab.view === "a" && lab.a ? "A" : "B";
  const values = { ...exportValues(shown, shownLabel), theme, pinnedA: lab.a ? exportValues(lab.a, "A") : null };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 1600);
  };

  if (lab.collapsed) {
    return (
      <div className="type-lab-panel z-20 mb-8 text-[12px] [font-family:system-ui] lg:fixed lg:right-4 lg:top-[88px] lg:mb-0">
        <PanelButton onClick={() => setLab((s) => ({ ...s, collapsed: false }))}>Controls, showing {shownLabel}</PanelButton>
      </div>
    );
  }

  return (
    <aside
      aria-label="Label face controls"
      className="type-lab-panel z-20 mb-10 flex flex-col gap-5 rounded-2xl bg-[var(--menu-panel)] p-5 text-[12px] text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border)] [font-family:system-ui] lg:fixed lg:bottom-4 lg:right-4 lg:top-[88px] lg:mb-0 lg:w-[340px] lg:overflow-y-auto lg:[box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold">Label face</span>
        <button type="button" onClick={() => setLab((s) => ({ ...s, collapsed: true }))} className="text-muted underline underline-offset-2 hover:text-foreground">
          Hide
        </button>
      </div>

      <Field label="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((preset, i) => (
            <PanelButton key={preset.id} pressed={same(b, preset.settings)} onClick={() => editB(() => preset.settings)}>
              {i === 0 ? `${preset.name} (pick)` : preset.name}
            </PanelButton>
          ))}
        </div>
        <PanelButton pressed={same(b, SITE_TODAY)} onClick={() => editB(() => SITE_TODAY)}>
          Site today (Inter, nothing switched)
        </PanelButton>
        <p className="leading-snug text-muted">{PRESETS.find((p) => same(b, p.settings))?.note ?? "Custom settings."}</p>
      </Field>

      <Field label="Face">
        <select
          aria-label="Face"
          value={b.face}
          onChange={(e) => editB((s) => withFace(s, e.target.value))}
          className="rounded-md bg-background px-2 py-1.5 text-foreground shadow-[inset_0_0_0_1px_var(--color-border)]"
        >
          {GROUPS.map((group) => (
            <optgroup key={group} label={GROUP_LABELS[group]}>
              {FACES.filter((f) => f.group === group).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="leading-snug text-muted">{face.why}</p>
      </Field>

      <Field label="Weight, regular text">
        <Segmented options={face.weights} value={b.weight} onChange={(weight) => editB((s) => ({ ...s, weight }))} />
      </Field>
      <Field label="Weight, text the site sets medium">
        <Segmented options={face.weights} value={b.strongWeight} onChange={(strongWeight) => editB((s) => ({ ...s, strongWeight }))} />
      </Field>

      <Slider label="Size, times the real size" value={b.scale} min={0.8} max={1.3} step={0.01} format={(n) => `${n.toFixed(2)}x`} onChange={(scale) => editB((s) => ({ ...s, scale }))} />
      <Slider label="Letter spacing" value={b.tracking} min={-0.03} max={0.08} step={0.0025} format={(n) => `${n.toFixed(4)}em`} onChange={(tracking) => editB((s) => ({ ...s, tracking }))} />
      {face.stretch ? (
        <Slider label="Width" value={b.stretch} min={face.stretch.min} max={face.stretch.max} step={0.5} format={(n) => `${n}%`} onChange={(stretch) => editB((s) => ({ ...s, stretch }))} />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={b.leading !== null} onChange={(e) => editB((s) => ({ ...s, leading: e.target.checked ? 1.5 : null }))} />
          <span>Override line height (the band credit and multi-line meta)</span>
        </label>
        {b.leading !== null && (
          <Slider label="Line height" value={b.leading} min={1} max={2} step={0.05} format={(n) => n.toFixed(2)} onChange={(leading) => editB((s) => ({ ...s, leading }))} />
        )}
      </div>

      <Field label="Color">
        <Segmented options={COLOR_ROLES} value={b.color} format={(c) => (c === "site" ? "as on site" : c)} onChange={(color) => editB((s) => ({ ...s, color }))} />
      </Field>

      <Field label="Roles in the label face">
        <div className="flex flex-col gap-1">
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={b.roles.includes(r)}
                onChange={(e) => editB((s) => ({ ...s, roles: e.target.checked ? ROLES.filter((x) => x === r || s.roles.includes(x)) : s.roles.filter((x) => x !== r) }))}
              />
              <span>{ROLE_LABELS[r]}</span>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Theme">
        <Segmented options={["light", "dark"] as const} value={theme} onChange={setTheme} />
      </Field>

      <Field label={`A and B, showing ${shownLabel}`}>
        <div className="flex flex-wrap gap-1.5">
          <PanelButton onClick={() => setLab((s) => ({ ...s, a: s.b }))}>Pin B as A</PanelButton>
          <PanelButton onClick={flipView} pressed={lab.view === "a"}>
            Flip (F)
          </PanelButton>
          {lab.a && <PanelButton onClick={() => setLab((s) => ({ ...s, a: null, view: "b" }))}>Clear A</PanelButton>}
        </div>
        <p className="leading-snug text-muted">
          {lab.a ? `A is ${faceById(lab.a.face).name}. Any edit shows B again.` : "Nothing pinned yet."}
        </p>
      </Field>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <PanelButton onClick={copy}>{copied === "done" ? "Copied" : copied === "failed" ? "Copy failed, the values are below" : "Copy values (JSON)"}</PanelButton>
        <details>
          <summary className="cursor-pointer text-muted">Show values</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-snug text-muted">{JSON.stringify(values, null, 2)}</pre>
        </details>
      </div>
    </aside>
  );
}
