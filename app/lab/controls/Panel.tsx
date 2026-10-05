"use client";

import { useState } from "react";
import type { Theme } from "@/lib/theme";
import type { MusicState } from "./NoteGlyph";
import { NOTE_KEYS, noteName } from "./notes";
import {
  ALLOWED,
  COLORWAY_LABELS,
  CONTROL_LABELS,
  EASES,
  PRESETS,
  VARIANT_LABELS,
  exportValues,
  sameSettings,
  type Colorway,
  type ControlKey,
  type EaseKey,
  type HeroSurface,
  type NoteAnim,
  type Origin,
  type Settings,
  type Variant,
} from "./settings";
import { Check, Chip, Field, Segmented, Select, Slider } from "./ui";

export type View = {
  scrubOn: boolean;
  scrub: number;
  reduce: boolean;
  moving: boolean;
  music: MusicState;
  cycle: boolean;
  collapsed: boolean;
};

type Props = {
  s: Settings;
  view: View;
  theme: Theme;
  edit: (update: (s: Settings) => Settings) => void;
  setView: (update: (v: View) => View) => void;
  setTheme: (theme: Theme) => void;
};

const CONTROLS = Object.keys(CONTROL_LABELS) as ControlKey[];
const COLORWAYS = Object.keys(COLORWAY_LABELS) as Colorway[];
const ALL_VARIANTS = Object.keys(VARIANT_LABELS) as Variant[];
const ANIMS: readonly NoteAnim[] = ["arcs", "levels", "move", "none"];
const ANIM_LABELS: Record<NoteAnim, string> = { arcs: "x to arcs", levels: "levels", move: "the note moves", none: "none" };

function setControl(s: Settings, key: ControlKey, patch: Partial<Settings["controls"][ControlKey]>): Settings {
  return { ...s, controls: { ...s.controls, [key]: { ...s.controls[key], ...patch } } };
}

export function Panel({ s, view, theme, edit, setView, setTheme }: Props) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const preset = PRESETS.find((p) => sameSettings(p.settings, s));
  const values = exportValues(s, preset ? preset.name : "custom", theme, noteName(s.note));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 1600);
  };

  if (view.collapsed) {
    return (
      <div className="controls-lab-panel z-20 mb-8 text-[12px] [font-family:system-ui] lg:fixed lg:right-4 lg:top-[88px] lg:mb-0">
        <Chip onClick={() => setView((v) => ({ ...v, collapsed: false }))}>Show controls</Chip>
      </div>
    );
  }

  return (
    <aside
      aria-label="Controls lab settings"
      className="controls-lab-panel z-20 mb-10 flex flex-col gap-5 rounded-2xl bg-[var(--menu-panel)] p-5 text-[12px] text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border)] [font-family:system-ui] lg:fixed lg:bottom-4 lg:right-4 lg:top-[88px] lg:mb-0 lg:w-[340px] lg:overflow-y-auto lg:[box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold">Fill and note</span>
        <button type="button" onClick={() => setView((v) => ({ ...v, collapsed: true }))} className="text-muted underline underline-offset-2 hover:text-foreground">
          Hide
        </button>
      </div>

      <Field label="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p, i) => (
            <Chip key={p.id} pressed={sameSettings(s, p.settings)} onClick={() => edit(() => p.settings)}>
              {i === 0 ? `${p.name} (pick)` : p.name}
            </Chip>
          ))}
        </div>
        <p className="leading-snug text-muted">{preset?.note ?? "Custom settings."}</p>
      </Field>

      <Field label="Theme">
        <Segmented options={["light", "dark"] as const} value={theme} onChange={setTheme} />
      </Field>

      <Field label="Label face" hint="Profa 700 at 1.06x, 0.01em, in the accent: the type lab pick. Inter flips the face only.">
        <Segmented options={["profa", "inter"] as const} value={s.face} format={(f) => (f === "profa" ? "Profa 700" : "Inter (today)")} onChange={(face) => edit((x) => ({ ...x, face }))} />
      </Field>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-[13px] font-semibold">The fill</span>
        <Field label="Every control" hint="Sets each control to this fill where it can take it.">
          <div className="grid grid-cols-2 gap-1.5">
            <Select
              label="Fill for every control"
              value={"" as Variant}
              options={[{ value: "" as Variant, label: "Fill..." }, ...ALL_VARIANTS.map((v) => ({ value: v, label: VARIANT_LABELS[v] }))]}
              onChange={(variant) =>
                variant &&
                edit((x) => CONTROLS.reduce((acc, key) => (ALLOWED[key].includes(variant) ? setControl(acc, key, { variant }) : acc), x))
              }
            />
            <Select
              label="Colorway for every control"
              value={"" as Colorway}
              options={[{ value: "" as Colorway, label: "Colorway..." }, ...COLORWAYS.map((c) => ({ value: c, label: COLORWAY_LABELS[c] }))]}
              onChange={(colorway) => colorway && edit((x) => CONTROLS.reduce((acc, key) => setControl(acc, key, { colorway }), x))}
            />
          </div>
        </Field>
        {CONTROLS.map((key) => (
          <Field key={key} label={CONTROL_LABELS[key]}>
            <div className="grid grid-cols-2 gap-1.5">
              <Select
                label={`${CONTROL_LABELS[key]} fill`}
                value={s.controls[key].variant}
                options={ALLOWED[key].map((v) => ({ value: v, label: VARIANT_LABELS[v] }))}
                onChange={(variant) => edit((x) => setControl(x, key, { variant }))}
              />
              <Select
                label={`${CONTROL_LABELS[key]} colorway`}
                value={s.controls[key].colorway}
                options={COLORWAYS.map((c) => ({ value: c, label: COLORWAY_LABELS[c] }))}
                onChange={(colorway) => edit((x) => setControl(x, key, { colorway }))}
              />
            </div>
          </Field>
        ))}
        <Slider label="Duration" value={s.durationMs} min={150} max={1200} step={10} format={(n) => `${n}ms`} onChange={(durationMs) => edit((x) => ({ ...x, durationMs }))} />
        <Field label="Easing" value={EASES[s.ease].css.replace("cubic-bezier", "")}>
          <Select label="Easing" value={s.ease} options={(Object.keys(EASES) as EaseKey[]).map((k) => ({ value: k, label: EASES[k].name }))} onChange={(ease) => edit((x) => ({ ...x, ease }))} />
        </Field>
        <Field label="Wipe origin" hint="Applies to the directional wipe.">
          <Segmented options={["start", "end", "top", "bottom", "center"] as readonly Origin[]} value={s.origin} onChange={(origin) => edit((x) => ({ ...x, origin }))} />
        </Field>
        <Slider
          label="Corner radius"
          value={s.radiusPx}
          min={0}
          max={24}
          step={1}
          format={(n) => `${n}px`}
          hint="Text links, nav and Connect rows; pills stay pills."
          onChange={(radiusPx) => edit((x) => ({ ...x, radiusPx }))}
        />
        <Check label="Arrow swap" checked={s.arrowSwap} onChange={(arrowSwap) => edit((x) => ({ ...x, arrowSwap }))} />
        <Check label="Pin every fill mid-transition" checked={view.scrubOn} onChange={(scrubOn) => setView((v) => ({ ...v, scrubOn }))} />
        {view.scrubOn && (
          <Slider label="Progress" value={view.scrub} min={0} max={1} step={0.01} format={(n) => n.toFixed(2)} onChange={(scrub) => setView((v) => ({ ...v, scrub }))} />
        )}
        <Check label="Simulate reduced motion" checked={view.reduce} onChange={(reduce) => setView((v) => ({ ...v, reduce }))} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-[13px] font-semibold">Hero controls</span>
        <Field label="Surface" hint="Pill: the Menu pill's glass and 8px blur. Solid: paper, no blur. Bare: text on the scene.">
          <Segmented options={["pill", "solid", "bare"] as readonly HeroSurface[]} value={s.heroSurface} onChange={(heroSurface) => edit((x) => ({ ...x, heroSurface }))} />
        </Field>
        <Slider
          label="Toggle trailing edge"
          value={s.toggleLagPct}
          min={0}
          max={60}
          step={1}
          format={(n) => `${n}% (${Math.round((s.durationMs * n) / 100)}ms)`}
          hint="0 slides the fill; more lets the leading edge run ahead so it flows."
          onChange={(toggleLagPct) => edit((x) => ({ ...x, toggleLagPct }))}
        />
        <Check label="Glyphs on the toggle" checked={s.toggleGlyphs} onChange={(toggleGlyphs) => edit((x) => ({ ...x, toggleGlyphs }))} />
        <Check label="Backdrop moves" checked={view.moving} onChange={(moving) => setView((v) => ({ ...v, moving }))} />
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <span className="text-[13px] font-semibold">The note</span>
        <Field label="Note">
          <Select label="Note" value={s.note} options={NOTE_KEYS.map((k) => ({ value: k, label: noteName(k) }))} onChange={(note) => edit((x) => ({ ...x, note }))} />
        </Field>
        <Field label="State animation">
          <Segmented options={ANIMS} value={s.noteAnim} format={(a) => ANIM_LABELS[a]} onChange={(noteAnim) => edit((x) => ({ ...x, noteAnim }))} />
        </Field>
        <Field label="State">
          <Segmented options={["off", "on", "paused"] as readonly MusicState[]} value={view.music} onChange={(music) => setView((v) => ({ ...v, music, cycle: false }))} />
        </Field>
        <Check label="Cycle off, on, paused every 1.6s" checked={view.cycle} onChange={(cycle) => setView((v) => ({ ...v, cycle }))} />
        <Slider label="Speed" value={s.noteSpeed} min={0.25} max={2} step={0.05} format={(n) => `${n.toFixed(2)}x`} onChange={(noteSpeed) => edit((x) => ({ ...x, noteSpeed }))} />
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Chip onClick={copy}>{copied === "done" ? "Copied" : copied === "failed" ? "Copy failed, the values are below" : "Copy values (JSON)"}</Chip>
        <details>
          <summary className="cursor-pointer text-muted">Show values</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-snug text-muted">{JSON.stringify(values, null, 2)}</pre>
        </details>
      </div>
    </aside>
  );
}
