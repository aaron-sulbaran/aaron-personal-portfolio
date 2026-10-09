"use client";

import { useState } from "react";
import type { Theme } from "@/lib/theme";
import { Check, Chip, Field, Segmented, Slider } from "../controls/ui";
import { EggControls } from "./EggControls";
import type { BackdropKind } from "./FieldBackdrop";
import { FieldControls } from "./FieldControls";
import { FIT_SHARE, type Readout } from "./FooterStage";
import type { RiseEase } from "./motion";
import { LettersControls } from "./LettersControls";
import { PointerControls } from "./PointerControls";
import { PRESETS, RANGES, exportValues, sameSettings, type ConnectPlacement, type FooterSettings, type Ink } from "./settings";
import type { Typeface } from "./useTypeface";

export type View = { reduce: boolean; forceStandIn: boolean; collapsed: boolean };

type Props = {
  s: FooterSettings;
  typeface: Typeface;
  view: View;
  theme: Theme;
  backdrop: BackdropKind | null;
  readout: Readout;
  systemReduced: boolean;
  edit: (update: (s: FooterSettings) => FooterSettings) => void;
  setView: (update: (v: View) => View) => void;
  setTheme: (theme: Theme) => void;
  onReplay: () => void;
  onDrop: () => void;
};

const fx = (digits: number, unit = "") => (n: number) => `${n.toFixed(digits)}${unit}`;
const ms = (n: number) => `${Math.round(n)}ms`;

export function Panel({ s, typeface, view, theme, backdrop, readout, systemReduced, edit, setView, setTheme, onReplay, onDrop }: Props) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const preset = PRESETS.find((p) => sameSettings(p.settings, s));
  const backdropName = !s.field.on ? "off" : (backdrop ?? "pending");
  const faceName = "label" in typeface ? `${typeface.label} (${typeface.kind})` : typeface.kind;
  const values = exportValues(s, preset ? preset.name : "custom", theme, backdropName, readout, faceName);
  const set = (patch: Partial<FooterSettings>) => edit((x) => ({ ...x, ...patch }));
  const R = RANGES;

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
      <div className="z-30 p-6 text-[12px] [font-family:system-ui] lg:fixed lg:right-4 lg:top-[88px] lg:p-0">
        <Chip onClick={() => setView((v) => ({ ...v, collapsed: false }))}>Show controls</Chip>
      </div>
    );
  }

  return (
    <aside
      aria-label="Footer lab settings"
      className="z-30 m-4 flex flex-col gap-5 rounded-2xl bg-[var(--menu-panel)] p-5 text-[12px] text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border)] [font-family:system-ui] lg:fixed lg:bottom-4 lg:right-4 lg:top-[88px] lg:m-0 lg:w-[340px] lg:overflow-y-auto lg:[box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold">build.stuff</span>
        <button type="button" onClick={() => setView((v) => ({ ...v, collapsed: true }))} className="text-muted underline underline-offset-2 hover:text-foreground">
          Hide
        </button>
      </div>

      <Field label="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p) => (
            <div key={p.id} className={p.tag ? "col-span-2 grid" : "grid"}>
              <Chip pressed={sameSettings(s, p.settings)} onClick={() => edit(() => p.settings)}>
                {p.tag ? `${p.name} (${p.tag})` : p.name}
              </Chip>
            </div>
          ))}
        </div>
        <p className="leading-snug text-muted">{preset?.note ?? "Custom settings."}</p>
      </Field>

      <Field label="Theme">
        <Segmented options={["light", "dark"] as const} value={theme} onChange={setTheme} />
      </Field>

      <LettersControls s={s} typeface={typeface} edit={edit} />

      <Section title="The wordmark">
        <Slider
          label="Letter height"
          value={s.heightVw}
          {...R.heightVw}
          format={(n) => `${n.toFixed(2)}% (${Math.round(readout.sizePx)}px)`}
          hint={`Ascender height as a share of the footer's width (the viewport on the site). The word spans ${Math.round(readout.spanPct)}% of ${Math.round(readout.stageWidth)}px.${
            readout.fittedVw === null ? "" : ` This face is wide: held to ${readout.fittedVw.toFixed(2)}% so it spans at most ${Math.round(FIT_SHARE * 100)}% at rest.`
          }`}
          onChange={(heightVw) => set({ heightVw })}
        />
        <Slider label="Tracking" value={s.tracking} {...R.tracking} format={fx(3)} onChange={(tracking) => set({ tracking })} />
        <Field label="Ink">
          <Segmented options={["accent", "foreground"] as readonly Ink[]} value={s.ink} format={(i) => (i === "accent" ? "sea blue (accent)" : "ink")} onChange={(ink) => set({ ink })} />
        </Field>
        <Slider label="Ink fades toward the baseline" value={s.inkFade} {...R.inkFade} format={fx(2)} onChange={(inkFade) => set({ inkFade })} />
        <Slider label="Gap above the wordmark" value={s.gap} {...R.gap} format={fx(2)} hint="In letter heights, from the row above to the tallest swell." onChange={(gap) => set({ gap })} />
        <Slider
          label="Floor"
          value={s.floor}
          {...R.floor}
          format={(n) => (n === 0 ? "whole" : `${n.toFixed(2)} (${Math.round(readout.croppedPct)}% cropped)`)}
          hint="How the word meets the bottom edge: 0 rests it whole just above the edge, its swell included; 0.30 crops 30 percent of the letters' height."
          onChange={(floor) => set({ floor })}
        />
      </Section>

      <Section title="Pointer">
        <PointerControls s={s} typeface={typeface} edit={edit} />
      </Section>

      <Section title="Rise, the first time it is seen">
        <Slider label="Duration" value={s.riseMs} {...R.riseMs} format={(n) => (n === 0 ? "off" : ms(n))} onChange={(riseMs) => set({ riseMs })} />
        <Slider label="Stagger" value={s.riseStaggerMs} {...R.riseStaggerMs} format={(n) => (n === 0 ? "none, as one" : ms(n))} hint="0 rises the word as one." onChange={(riseStaggerMs) => set({ riseStaggerMs })} />
        <Field label="Ease">
          <Segmented options={["expo", "cubic", "back"] as readonly RiseEase[]} value={s.riseEase} format={(e) => (e === "back" ? "back (overshoot)" : `out ${e}`)} onChange={(riseEase) => set({ riseEase })} />
        </Field>
        <Chip onClick={onReplay}>Replay the rise</Chip>
      </Section>

      <Section title="The period, an Easter egg">
        <EggControls s={s} edit={edit} onDrop={onDrop} />
      </Section>

      <Section title="The field">
        <FieldControls s={s} backdrop={backdrop} forceStandIn={view.forceStandIn} setForceStandIn={(forceStandIn) => setView((v) => ({ ...v, forceStandIn }))} edit={edit} />
      </Section>

      <Section title="Around it">
        <Field label="Connect row">
          <Segmented options={["above", "below"] as readonly ConnectPlacement[]} value={s.connect} format={(c) => `${c} the wordmark`} onChange={(connect) => set({ connect })} />
        </Field>
        <Check label="Kiln's disc and slab (lean, click turns them)" checked={s.disc.on} onChange={(on) => edit((x) => ({ ...x, disc: { ...x.disc, on } }))} />
        {s.disc.on && <Slider label="Lean" value={s.disc.lean} {...R.discLean} format={fx(0, "px")} onChange={(lean) => edit((x) => ({ ...x, disc: { ...x.disc, lean } }))} />}
        <Check label={systemReduced ? "Reduced motion (on in this system)" : "Simulate reduced motion"} checked={view.reduce || systemReduced} onChange={(reduce) => setView((v) => ({ ...v, reduce }))} />
      </Section>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <span className="text-[13px] font-semibold">{title}</span>
      {children}
    </div>
  );
}
