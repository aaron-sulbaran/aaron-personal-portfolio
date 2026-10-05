"use client";

import { useState } from "react";
import type { Theme } from "@/lib/theme";
import {
  A_LABELS,
  EASES,
  HINT_LABELS,
  LAYOUT_LABELS,
  ORDER_LABELS,
  PRESETS,
  SPLASH_LABELS,
  STRIKE_LABELS,
  TRIGGER_LABELS,
  beats,
  exportValues,
  sameSettings,
  type EaseKey,
  type Settings,
} from "./settings";
import { Check, Chip, Field, Segmented, Select, Slider } from "./ui";

export type View = { reduce: boolean; loop: boolean; collapsed: boolean };

type Props = {
  s: Settings;
  view: View;
  theme: Theme;
  osReduced: boolean;
  edit: (update: (s: Settings) => Settings) => void;
  setView: (update: (v: View) => View) => void;
  setTheme: (theme: Theme) => void;
};

const EASE_OPTIONS = (Object.keys(EASES) as EaseKey[]).map((k) => ({ value: k, label: EASES[k].name }));
const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <span className="text-[13px] font-semibold">{title}</span>
      {children}
    </div>
  );
}

export function Panel({ s, view, theme, osReduced, edit, setView, setTheme }: Props) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const preset = PRESETS.find((p) => sameSettings(p.settings, s));
  const values = exportValues(s, preset ? preset.name : "custom", theme);
  const b = beats(s);
  const set = <K extends keyof Settings>(key: K) => (value: Settings[K]) => edit((x) => ({ ...x, [key]: value }));

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
      <div className="z-20 mb-8 text-[12px] [font-family:system-ui] lg:fixed lg:right-4 lg:top-[88px] lg:mb-0">
        <Chip onClick={() => setView((v) => ({ ...v, collapsed: false }))}>Show controls</Chip>
      </div>
    );
  }

  return (
    <aside
      aria-label="Mark lab settings"
      className="z-20 mb-10 flex flex-col gap-5 rounded-2xl bg-[var(--menu-panel)] p-5 text-[12px] text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border)] [font-family:system-ui] lg:fixed lg:bottom-4 lg:right-4 lg:top-[88px] lg:mb-0 lg:w-[340px] lg:overflow-y-auto lg:[box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold">The strike</span>
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
      <Check label="Preview reduced motion" checked={view.reduce} onChange={(reduce) => setView((v) => ({ ...v, reduce }))} />
      {osReduced && <p className="leading-snug text-muted">Your system asks for reduced motion, so the page shows the static mark and a fade.</p>}
      <Slider label="Specimen size" value={s.sizePx} min={240} max={360} step={4} format={(n) => `${n}px`} onChange={set("sizePx")} />

      <Group title="1. The strike">
        <Select label="Strike" value={s.strike} options={options(STRIKE_LABELS)} onChange={set("strike")} />
        <Slider label="Strike duration" value={s.strikeMs} min={100} max={700} step={10} format={(n) => `${n}ms`} onChange={set("strikeMs")} />
        <Field label="Strike easing" value={EASES[s.strikeEase].export}>
          <Select label="Strike easing" value={s.strikeEase} options={EASE_OPTIONS} onChange={set("strikeEase")} />
        </Field>
        <Slider label="Pause at impact" value={s.pauseMs} min={0} max={400} step={10} format={(n) => `${n}ms`} onChange={set("pauseMs")} />
      </Group>

      <Group title="2. Impact and splash">
        <Select label="Splash" value={s.splash} options={options(SPLASH_LABELS)} onChange={set("splash")} />
        <Slider label="Splash size" value={s.splashSize} min={0.5} max={1.6} step={0.05} format={(n) => `${n.toFixed(2)}x`} onChange={set("splashSize")} />
        <Slider label="Splash duration" value={s.splashMs} min={200} max={1200} step={10} format={(n) => `${n}ms`} onChange={set("splashMs")} />
        <Field label="Splash easing" value={EASES[s.splashEase].export}>
          <Select label="Splash easing" value={s.splashEase} options={EASE_OPTIONS} onChange={set("splashEase")} />
        </Field>
        <Slider
          label="Flash"
          value={s.flash}
          min={0}
          max={0.16}
          step={0.01}
          format={(n) => (n === 0 ? "off" : n.toFixed(2))}
          hint="One flash of the surface at the landing: 60ms up, 440ms down, capped at 0.16. Never repeats. On paper a flash can only darken, so it reads as a shadow; off in light by default."
          onChange={set("flash")}
        />
        <Check label="Flash in the light theme too" checked={s.flashInLight} onChange={set("flashInLight")} />
        <Field label="Splash and flash color">
          <Segmented options={["accent", "ink"] as const} value={s.effect} onChange={set("effect")} />
        </Field>
      </Group>

      <Group title="3. The A">
        <Select label="The A" value={s.a} options={options(A_LABELS)} onChange={set("a")} />
        <Slider label="A duration" value={s.aMs} min={200} max={1200} step={10} format={(n) => `${n}ms`} onChange={set("aMs")} />
        <Field label="A easing" value={EASES[s.aEase].export}>
          <Select label="A easing" value={s.aEase} options={EASE_OPTIONS} onChange={set("aEase")} />
        </Field>
      </Group>

      <Group title="Overall">
        <Slider label="Speed" value={s.speed} min={0.25} max={2} step={0.05} format={(n) => `${n.toFixed(2)}x`} onChange={set("speed")} />
        <p className="tabular-nums leading-snug text-muted">
          Impact at {Math.round((b.impact / s.speed) * 1000)}ms, the mark settles at {Math.round((b.settle / s.speed) * 1000)}ms, everything is still at{" "}
          {Math.round((b.end / s.speed) * 1000)}ms.
        </p>
      </Group>

      <Group title="The card">
        <Field label="Layout">
          <Select label="Layout" value={s.layout} options={options(LAYOUT_LABELS)} onChange={set("layout")} />
        </Field>
        <Field label="Open order">
          <Segmented options={["strike-first", "card-first"] as const} value={s.order} format={(o) => ORDER_LABELS[o]} onChange={set("order")} />
        </Field>
        <Slider label="Mark in the card" value={s.cardMarkPx} min={96} max={220} step={4} format={(n) => `${n}px`} onChange={set("cardMarkPx")} />
      </Group>

      <Group title="How it is found">
        <Field label="Trigger">
          <Segmented options={["click-at-top", "double-click", "hold"] as const} value={s.trigger} format={(t) => TRIGGER_LABELS[t]} onChange={set("trigger")} />
        </Field>
        {s.trigger === "hold" && <Slider label="Hold to open" value={s.holdMs} min={400} max={1400} step={25} format={(n) => `${n}ms`} onChange={set("holdMs")} />}
        <Field label="Hint">
          <Segmented options={["none", "twitch", "glint"] as const} value={s.hint} format={(h) => HINT_LABELS[h]} onChange={set("hint")} />
        </Field>
      </Group>

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
