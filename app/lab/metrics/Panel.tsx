"use client";

import { useState } from "react";
import { Field, PanelButton, Segmented, Slider } from "../type/controls";
import { accentRamp } from "./skyline/maths";
import { setLabTheme, useLabTheme } from "./labTheme";
import {
  COMPANION_NAMES,
  LEAD_NAMES,
  WINDOW_NAMES,
  PLACEMENT_NAMES,
  PLACEMENT_NOTES,
  PRESETS,
  exportValues,
  sameSettings,
  type Companions,
  type Lead,
  type Placement,
  type Settings,
} from "./settings";

// The control panel: fixed on the right from lg up, a plain block above the
// page below that. Panel chrome is system type on purpose, so it never reads
// as part of the design under review.

type PanelProps = {
  settings: Settings;
  onChange: (update: (s: Settings) => Settings) => void;
  pin: number | null;
  onPin: (pin: number | null) => void;
  onReplay: () => void;
};

const PLACEMENTS: readonly Placement[] = ["section", "inside", "strip", "divider"];
const COMPANIONS: readonly Companions[] = ["stats", "numbers", "alone"];
const LEADS: readonly Lead[] = ["streak", "total", "days"];

export function Panel({ settings: s, onChange, pin, onPin, onReplay }: PanelProps) {
  const theme = useLabTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange((prev) => ({ ...prev, [key]: value }));
  const preset = PRESETS.find((p) => sameSettings(p.settings, s));
  const companionsApply = s.placement === "section" || s.placement === "inside";
  const skylineShown = s.placement !== "divider";
  const numbersShown = companionsApply && s.companions === "numbers";
  const futureApplies = s.window === "year";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportValues(s, theme), null, 2));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 1600);
  };

  const shell =
    "z-40 rounded-2xl bg-[var(--menu-panel)] text-[12px] text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border)] [font-family:system-ui] lg:fixed lg:right-4 lg:top-[88px] lg:[box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)]";

  if (collapsed) {
    return (
      <div className={shell + " mx-6 mb-8 p-2 lg:mx-0 lg:mb-0"}>
        <PanelButton onClick={() => setCollapsed(false)}>Metrics controls</PanelButton>
      </div>
    );
  }

  return (
    <aside aria-label="Metrics lab controls" className={shell + " mx-6 mb-10 flex flex-col gap-5 p-5 lg:bottom-4 lg:mx-0 lg:mb-0 lg:w-[320px] lg:overflow-y-auto"}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold">Metrics lab</span>
        <button type="button" onClick={() => setCollapsed(true)} className="text-muted underline underline-offset-2 hover:text-foreground">
          Hide
        </button>
      </div>

      <Field label="Presets">
        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((p) => (
            <PanelButton key={p.id} pressed={sameSettings(p.settings, s)} onClick={() => onChange(() => p.settings)}>
              {p.name}
            </PanelButton>
          ))}
        </div>
        <p className="leading-snug text-muted">{preset?.note ?? "Custom settings."}</p>
      </Field>

      <Field label="Where it lives">
        <Segmented options={PLACEMENTS} value={s.placement} onChange={(v) => set("placement", v)} format={(v) => PLACEMENT_NAMES[v]} />
        <p className="leading-snug text-muted">{PLACEMENT_NOTES[s.placement]}</p>
      </Field>

      <Field label="What shows with it">
        <div className={companionsApply ? "" : "pointer-events-none opacity-40"}>
          <Segmented options={COMPANIONS} value={s.companions} onChange={(v) => set("companions", v)} format={(v) => COMPANION_NAMES[v]} />
        </div>
      </Field>

      <Field label="Numbers row leads with">
        <div className={numbersShown ? "" : "pointer-events-none opacity-40"}>
          <Segmented options={LEADS} value={s.lead} onChange={(v) => set("lead", v)} format={(v) => LEAD_NAMES[v]} />
        </div>
      </Field>

      <Field label="Window">
        <Segmented options={["6mo", "12mo", "year"] as const} value={s.window} onChange={(v) => set("window", v)} format={(v) => WINDOW_NAMES[v]} />
      </Field>

      <Field label="Data">
        <Segmented
          options={["real", "sample"] as const}
          value={s.data}
          onChange={(v) => set("data", v)}
          format={(v) => (v === "real" ? "My real data" : "Sample year (comparison)")}
        />
      </Field>

      <Field label="After today">
        <div className={futureApplies ? "" : "pointer-events-none opacity-40"}>
          <Segmented
            options={["omit", "slabs"] as const}
            value={s.future}
            onChange={(v) => set("future", v)}
            format={(v) => (v === "omit" ? "Stop at today" : "Empty slabs to Dec 31")}
          />
        </div>
      </Field>

      <Field label="Theme">
        <Segmented options={["light", "dark"] as const} value={theme} onChange={setLabTheme} />
      </Field>

      <div className={skylineShown ? "flex flex-col gap-5" : "pointer-events-none flex flex-col gap-5 opacity-40"}>
        <Field label="Opens as">
          <Segmented
            options={["2d", "3d"] as const}
            value={s.view}
            onChange={(v) => set("view", v)}
            format={(v) => (v === "2d" ? "Flat (2D)" : "Skyline (3D), rises when seen")}
          />
        </Field>

        <Slider label="Lightest step, share of accent" value={s.share} min={8} max={70} step={1} format={(n) => n + "%"} onChange={(v) => set("share", v)} />
        <div className="flex gap-1" aria-hidden="true">
          {accentRamp(s.share).map((c) => (
            <span key={c} className="h-3 flex-1 rounded-sm" style={{ background: c }} />
          ))}
        </div>

        <Field label="Height curve">
          <Segmented
            options={["power", "sqrt", "log"] as const}
            value={s.curve}
            onChange={(v) => set("curve", v)}
            format={(v) => (v === "power" ? "Original (0.85)" : v === "sqrt" ? "Square root" : "Log")}
          />
        </Field>
        <Field label="Colour steps">
          <Segmented
            options={["linear", "sqrt"] as const}
            value={s.levels}
            onChange={(v) => set("levels", v)}
            format={(v) => (v === "linear" ? "Quarters (original)" : "Square root")}
          />
        </Field>
        <Field label="Tallest bar stands for">
          <Segmented
            options={[1, 0.98, 0.95] as const}
            value={s.heightCap}
            onChange={(v) => set("heightCap", v)}
            format={(v) => (v === 1 ? "Busiest day" : Math.round(v * 100) + "th percentile")}
          />
        </Field>
        <Slider label="Height scale" value={s.heightScale} min={0.3} max={2} step={0.05} format={(n) => n.toFixed(2) + "x"} onChange={(v) => set("heightScale", v)} />
        <Slider label="Morph duration" value={s.duration} min={300} max={3000} step={50} format={(n) => n + " ms"} onChange={(v) => set("duration", v)} />

        <Field label="Pin the morph" value={pin === null ? "off" : pin.toFixed(2)}>
          <div className="flex items-center gap-2">
            <PanelButton pressed={pin !== null} onClick={() => onPin(pin === null ? 0.5 : null)}>
              {pin === null ? "Pin" : "Release"}
            </PanelButton>
            <input
              type="range"
              aria-label="Morph position"
              min={0}
              max={1}
              step={0.01}
              value={pin ?? 0.5}
              disabled={pin === null}
              onChange={(e) => onPin(Number(e.target.value))}
              className={"flex-1 " + (pin === null ? "opacity-40" : "")}
            />
          </div>
        </Field>

        <Field label="Surface">
          <Segmented options={["off", "on"] as const} value={s.card ? "on" : "off"} onChange={(v) => set("card", v === "on")} format={(v) => (v === "on" ? "Card (the original's)" : "No card (the site's)")} />
        </Field>
      </div>

      <Field label="A question for the visitor (mock)">
        <Segmented options={["off", "on"] as const} value={s.question ? "on" : "off"} onChange={(v) => set("question", v === "on")} />
      </Field>

      <div className="grid grid-cols-2 gap-1.5">
        <PanelButton onClick={onReplay}>Replay entrance</PanelButton>
        <PanelButton onClick={copy}>{copied === "done" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy values"}</PanelButton>
      </div>
    </aside>
  );
}
