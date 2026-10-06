"use client";

import { Fragment, useState, useSyncExternalStore } from "react";
import { Choice, Group, Slider, Toggle } from "./panelParts";
import { PathControls } from "./PathControls";
import { CursorControls } from "./CursorControls";
import { MotionControls } from "./MotionControls";
import type { SpineChoice } from "./spineChoice";
import type { RuleReport } from "./spineRules";
import { readTokens, textContrast, type Contrast, type ThemeTokens } from "./readout";
import { DEFAULT_PRESET_ID, LOOPS, PLACEMENTS, POSITION, PRESETS, RANGES, type ThemeName, type WaveSettings } from "./settings";

// The lab's controls: plain chrome, docked to the right edge so it never sits
// over the reading column (the page narrows while it is open; collapse it to
// judge the full width).

export const PANEL_WIDTH = 320;

type Patch = (patch: Partial<WaveSettings>) => void;

interface PanelProps {
  choice: SpineChoice;
  report: RuleReport | null;
  settings: WaveSettings;
  patch: Patch;
  replace: (next: WaveSettings) => void;
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  systemReduced: boolean;
  simReduced: boolean;
  setSimReduced: (on: boolean) => void;
}

// Tokens are read from the stylesheet once; a null (sheet not ready) retries on the next render.
let tokenCache: Record<ThemeName, ThemeTokens> | null = null;
const getTokens = () => (tokenCache ??= readTokens());
const noSubscribe = () => () => {};

export function Panel(props: PanelProps) {
  const { settings: s, patch, open, setOpen } = props;
  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET_ID);
  const [copied, setCopied] = useState<string | null>(null);
  const tokens = useSyncExternalStore(noSubscribe, getTokens, () => null);
  const loop = LOOPS.find((l) => l.id === s.loop);
  const position = POSITION[s.placement];
  const alpha = s.alpha[props.theme];
  const preset = PRESETS.find((p) => p.id === presetId);

  const edit: Patch = (next) => {
    setPresetId(null);
    patch(next);
  };
  const setAlpha = (key: "muted" | "accent", value: number) =>
    edit({ alpha: { ...s.alpha, [props.theme]: { ...alpha, [key]: value } } });

  const copy = async () => {
    // A Path's spine goes out with it, in the page-relative terms of spines.ts.
    const g = props.choice.generated;
    const spineDefinition = {
      ...props.choice.def,
      ...(g ? { seed: g.seed, usedSeed: g.usedSeed, fallback: g.fallback } : {}),
    };
    const json = JSON.stringify(s.placement === "path" ? { ...s, spineDefinition } : s, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied("Copied to the clipboard.");
    } catch {
      console.log(json);
      setCopied("The clipboard refused; the values are in the console.");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[70] rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground shadow-sm"
      >
        Wave lab
      </button>
    );
  }

  return (
    <aside
      aria-label="Wave lab controls"
      className="fixed inset-y-0 right-0 z-[70] overflow-y-auto border-l border-border bg-background px-5 pb-10 pt-5 text-sm text-foreground"
      style={{ width: PANEL_WIDTH, cursor: "auto" }}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg">Wave lab</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted underline underline-offset-2">
          Collapse
        </button>
      </div>
      <p className="mt-1 text-xs leading-snug text-muted">No audio here; music is simulated. Collapse the panel to see the page at full width.</p>

      <Group title="Presets">
        <div className="flex flex-col gap-1">
          {PRESETS.map((p, i) => (
            <Fragment key={p.id}>
            {p.parked && !PRESETS[i - 1]?.parked && <p className="mt-2 text-xs text-muted">Parked</p>}
            <button
              type="button"
              onClick={() => {
                setPresetId(p.id);
                props.replace(p.values);
              }}
              className={`rounded border px-2 py-1 text-left ${presetId === p.id ? "border-accent text-accent" : "border-border"}`}
            >
              {p.label}
            </button>
            </Fragment>
          ))}
        </div>
        {preset && <p className="mt-2 text-xs leading-snug text-muted">{preset.why}</p>}
        <button type="button" onClick={copy} className="mt-3 rounded border border-border px-2 py-1">
          Copy values
        </button>
        {copied && <p className="mt-1 text-xs text-muted">{copied}</p>}
      </Group>

      <Group title="Placement">
        <Choice options={PLACEMENTS} value={s.placement} onChange={(placement) => edit({ placement })} />
        <p className="mt-1 text-xs leading-snug text-muted">{PLACEMENTS.find((p) => p.id === s.placement)?.note}</p>
      </Group>

      {s.placement === "path" ? (
        <>
          <PathControls path={s.path} choice={props.choice} report={props.report} onChange={(path) => edit({ path: { ...s.path, ...path } })} />
          <CursorControls cursor={s.cursor} onChange={(cursor) => edit({ cursor: { ...s.cursor, ...cursor } })} />
        </>
      ) : (
        <Group title="Loop">
          <Choice options={LOOPS} value={s.loop} onChange={(next) => edit({ loop: next })} />
          <p className="mt-1 text-xs leading-snug text-muted">{loop?.note}</p>
        </Group>
      )}

      <Group title="Music, simulated">
        <Toggle label="Music on" checked={s.music} onChange={(music) => edit({ music })} />
        <Toggle label="Beat" checked={s.beat} onChange={(beat) => edit({ beat })} />
        <Slider label="Intensity" value={s.intensity} {...RANGES.intensity} onChange={(intensity) => edit({ intensity })} />
        <MotionControls motion={s.motion} onChange={(motion) => edit({ motion: { ...s.motion, ...motion } })} />
      </Group>

      <Group title="Theme and alpha">
        <Choice
          options={[
            { id: "light", label: "Light" },
            { id: "dark", label: "Dark" },
          ]}
          value={props.theme}
          onChange={props.setTheme}
        />
        <Slider label={`Muted dots, ${props.theme}`} value={alpha.muted} {...RANGES.alpha} onChange={(v) => setAlpha("muted", v)} />
        <Slider label={`Accent dots, ${props.theme}`} value={alpha.accent} {...RANGES.alpha} onChange={(v) => setAlpha("accent", v)} />
        <Readout tokens={tokens} settings={s} />
      </Group>

      <Group title="Shape">
        <Slider label="Amplitude" unit="px" value={s.amplitude} {...RANGES.amplitude} onChange={(amplitude) => edit({ amplitude })} />
        <Slider label="Rows cap, a side" value={s.maxThick} {...RANGES.maxThick} onChange={(maxThick) => edit({ maxThick })} />
        <Slider label="Dot size" unit="x" value={s.dotScale} {...RANGES.dotScale} onChange={(dotScale) => edit({ dotScale })} />
        <Slider label="Column spacing" unit="px" value={s.spacing} {...RANGES.spacing} onChange={(spacing) => edit({ spacing })} />
      </Group>

      <Group title="Motion">
        {s.placement !== "path" && (
          <>
        <Slider label="Loop period" unit="s" value={s.period} {...RANGES.period} onChange={(period) => edit({ period })} />
        <Slider
          label={loop?.usesSpeed ? "Speed" : "Speed (unused by this loop)"}
          unit="px/s"
          value={s.speed}
          {...RANGES.speed}
          onChange={(speed) => edit({ speed })}
        />
        <Slider label="Scroll influence" value={s.scrollInfluence} {...RANGES.scrollInfluence} onChange={(scrollInfluence) => edit({ scrollInfluence })} />
          </>
        )}
        <Toggle
          label={props.systemReduced ? "Reduced motion (on in the system)" : "Preview reduced motion"}
          checked={props.systemReduced || props.simReduced}
          disabled={props.systemReduced}
          onChange={props.setSimReduced}
        />
      </Group>

      <Group title="Place">
        {s.placement !== "path" && (
          <>
        <Slider
          label={position.label}
          unit={position.unit}
          value={s.position[s.placement]}
          min={position.min}
          max={position.max}
          step={position.step}
          onChange={(v) => edit({ position: { ...s.position, [s.placement]: v } })}
        />
        <Slider
          label={s.placement === "rail" ? "Rail width" : "Strip height"}
          unit="px"
          value={s.stripHeight[s.placement]}
          {...RANGES.stripHeight}
          onChange={(v) => edit({ stripHeight: { ...s.stripHeight, [s.placement]: v } })}
        />
        <Slider label="Edge fade" unit="of length" value={s.edgeFade} {...RANGES.edgeFade} onChange={(edgeFade) => edit({ edgeFade })} />
          </>
        )}
        <Toggle label="Show the music capsule" checked={s.capsule} onChange={(capsule) => edit({ capsule })} />
      </Group>
    </aside>
  );
}

function Readout({ tokens, settings }: { tokens: Record<ThemeName, ThemeTokens> | null; settings: WaveSettings }) {
  if (!tokens) return <p className="mt-2 text-xs text-muted">Contrast readout unavailable: the tokens could not be read.</p>;
  return (
    <div className="mt-3 rounded border border-border p-2">
      <p className="text-xs leading-snug text-muted">
        Text over the most inked dot pixel (a dot&apos;s centre). Accent dots only appear on loud music. The line marks 4.5 to 1. Information, not a gate.
      </p>
      {settings.placement === "path" && (
        <p className="mt-1 text-xs leading-snug text-muted">Path crosses words on purpose; these numbers apply wherever it passes behind them.</p>
      )}
      {settings.placement === "seams" && (
        <p className="mt-1 text-xs leading-snug text-muted">Seams sit in the gaps, never under words; these numbers only bite if a seam is nudged into text.</p>
      )}
      {(["light", "dark"] as const).map((theme) => (
        <div key={theme} className="mt-2">
          <p className="text-xs">{theme === "light" ? "Light" : "Dark"}</p>
          <Ratio label="Muted text" contrast={textContrast(tokens[theme], settings.alpha[theme], "muted")} />
          <Ratio label="Body text" contrast={textContrast(tokens[theme], settings.alpha[theme], "foreground")} />
        </div>
      ))}
    </div>
  );
}

const SCALE_MAX = 8;

function Ratio({ label, contrast }: { label: string; contrast: Contrast }) {
  const pct = (v: number) => `${(Math.min(v, SCALE_MAX) / SCALE_MAX) * 100}%`;
  const pass = contrast.worst >= 4.5;
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={pass ? "text-foreground" : "text-accent"}>
          {contrast.worst.toFixed(2)} to 1
        </span>
      </div>
      <p className="text-[11px] tabular-nums text-muted">
        over a muted dot {contrast.overMuted.toFixed(2)}, over an accent dot {contrast.overAccent.toFixed(2)}, bare {contrast.bare.toFixed(2)}
      </p>
      <div className="relative mt-1 h-1.5 rounded-full bg-border">
        <div className="absolute inset-y-0 left-0 rounded-full bg-muted" style={{ width: pct(contrast.worst) }} />
        <div className="absolute -inset-y-1 w-px bg-foreground" style={{ left: pct(4.5) }} title="4.5 to 1" />
      </div>
    </div>
  );
}
