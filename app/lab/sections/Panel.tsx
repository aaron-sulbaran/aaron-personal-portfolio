"use client";

import { useState } from "react";
import { Choice, Group, Hint, Slider, Toggle } from "./parts";
import { PanelSections } from "./PanelSections";
import { EASE_LABELS, PRESETS, RANGES, flatten, type EaseName, type LabSettings, type StickyStop } from "./settings";

// The lab's controls: plain chrome docked to the right edge (the page narrows
// while it is open; collapse it to judge the full width).

export const PANEL_WIDTH = 320;

export type WaveState = "loading" | "ok" | "failed" | "off";

interface PanelProps {
  s: LabSettings;
  edit: (next: Partial<LabSettings>) => void;
  replace: (next: LabSettings) => void;
  presetId: string | null;
  setPresetId: (id: string | null) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  systemReduced: boolean;
  simReduced: boolean;
  setSimReduced: (on: boolean) => void;
  wave: { state: WaveState; speed: number | null; retry: () => void };
}

const EASES = (Object.keys(EASE_LABELS) as EaseName[]).map((id) => ({ id, label: EASE_LABELS[id] }));
const STOPS: { id: StickyStop; label: string }[] = [
  { id: "section", label: "Section's end" },
  { id: "early", label: "Earlier, by offset" },
];

function flick(by: "screen" | "section") {
  const y = window.scrollY;
  let to = y + window.innerHeight * 1.5;
  if (by === "section") {
    const next = Array.from(document.querySelectorAll<HTMLElement>("[data-lab-section]"))
      .map((el) => el.getBoundingClientRect().top + y)
      .find((top) => top > y + 8);
    if (next !== undefined) to = next;
  }
  window.scrollTo({ top: to, behavior: "instant" });
}

export function Panel(p: PanelProps) {
  const { s, edit } = p;
  const [copied, setCopied] = useState<string | null>(null);
  const preset = PRESETS.find((x) => x.id === p.presetId);
  const grammar = s.source === "grammar";

  const copy = async () => {
    const json = JSON.stringify({ preset: p.presetId ?? "edited", ...flatten(s) }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied("Copied to the clipboard.");
    } catch {
      console.log(json);
      setCopied("The clipboard refused; the values are in the console.");
    }
  };

  if (!p.open) {
    return (
      <button type="button" onClick={() => p.setOpen(true)} className="fixed bottom-6 right-6 z-[70] rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground shadow-sm">
        Sections lab
      </button>
    );
  }

  return (
    <aside
      aria-label="Sections lab controls"
      className="fixed inset-y-0 right-0 z-[70] overflow-y-auto border-l border-border bg-background px-5 pb-10 pt-5 text-sm text-foreground"
      style={{ width: PANEL_WIDTH, cursor: "auto" }}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg">Sections lab</p>
        <button type="button" onClick={() => p.setOpen(false)} className="text-muted underline underline-offset-2">
          Collapse
        </button>
      </div>
      <Hint>How the text under the band arrives as you scroll. Native scroll throughout: no smoothing, no pinning.</Hint>

      <Group title="Presets">
        <div className="flex flex-col gap-1">
          {PRESETS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                p.setPresetId(x.id);
                p.replace(x.values);
              }}
              className={`rounded border px-2 py-1 text-left ${p.presetId === x.id ? "border-accent text-accent" : "border-border"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        {preset && <Hint>{preset.why}</Hint>}
        <button type="button" onClick={copy} className="mt-3 rounded border border-border px-2 py-1">
          Copy values
        </button>
        {copied && <Hint>{copied}</Hint>}
      </Group>

      <Group title="Page">
        <Choice options={[{ id: "grammar", label: "Grammar" }, { id: "today", label: "Site today" }] as const} value={s.source} onChange={(source) => edit({ source })} />
        <Choice options={[{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }] as const} value={p.theme} onChange={p.setTheme} />
        <Toggle label="Simulate reduced motion" checked={p.simReduced} onChange={p.setSimReduced} />
        {p.systemReduced && <Hint>The system asks for reduced motion: final states, no scrub.</Hint>}
        <div className="mt-2 flex gap-1">
          <button type="button" onClick={() => flick("screen")} className="rounded border border-border px-2 py-0.5 text-xs">
            Flick 1.5 screens
          </button>
          <button type="button" onClick={() => flick("section")} className="rounded border border-border px-2 py-0.5 text-xs">
            Jump to next section
          </button>
        </div>
        <Hint>Instant jumps, to watch the text catch up.</Hint>
      </Group>

      <fieldset disabled={!grammar} className={grammar ? "" : "opacity-50"}>
        <Group title="Lag and timing">
          <Toggle label="Scrubbed (reversible); off plays once" checked={s.scrub} onChange={(scrub) => edit({ scrub })} />
          <Slider label="Lag, shared" {...RANGES.lag} unit="s" value={s.lag} onChange={(lag) => edit({ lag })} />
          <Hint>{s.scrub ? "How long every element takes to settle behind the scroll." : "Played once, each element's duration."}</Hint>
          <Slider label="Lag added per element" {...RANGES.lagStep} unit="s" value={s.lagStep} onChange={(lagStep) => edit({ lagStep })} />
          <Slider label="Overlap of lines and rows" {...RANGES.spread} value={s.spread} onChange={(spread) => edit({ spread })} />
          <Slider label="Band starts (block top at)" {...RANGES.bandStart} unit="%" value={s.bandStart} onChange={(bandStart) => edit({ bandStart })} />
          <Slider label="Band ends (block top at)" {...RANGES.bandEnd} unit="%" value={s.bandEnd} onChange={(bandEnd) => edit({ bandEnd })} />
          <Slider label="Bodies follow headings by" {...RANGES.follow} unit="%" value={s.follow} onChange={(follow) => edit({ follow })} />
          <Hint>{"The words grammar runs from the band's start to the paragraph's bottom."}</Hint>
          <p className="mt-2 text-xs">Ease</p>
          <Choice options={EASES} value={s.ease} onChange={(ease) => edit({ ease })} />
          <Slider label="Rise" {...RANGES.rise} unit="px" value={s.rise} onChange={(rise) => edit({ rise })} />
          <Slider label="Blur" {...RANGES.blur} unit="px" value={s.blur} onChange={(blur) => edit({ blur })} />
          <Slider label="Unread word opacity" {...RANGES.dim} value={s.dim} onChange={(dim) => edit({ dim })} />
        </Group>

        <Group title="Sticky headings">
          <Slider label="Holds at" {...RANGES.stickyTop} unit="px" value={s.stickyTop} onChange={(stickyTop) => edit({ stickyTop })} />
          <p className="mt-2 text-xs">Lets go at</p>
          <Choice options={STOPS} value={s.stickyStop} onChange={(stickyStop) => edit({ stickyStop })} />
          {s.stickyStop === "early" && <Slider label="Before the end by" {...RANGES.stopOffset} unit="px" value={s.stopOffset} onChange={(stopOffset) => edit({ stopOffset })} />}
          <p className="mt-2 text-xs">Kicker face</p>
          <Choice options={[{ id: "profa", label: "Profa Bold (label spec)" }, { id: "inter", label: "Inter (today)" }] as const} value={s.kickerFace} onChange={(kickerFace) => edit({ kickerFace })} />
        </Group>

        <PanelSections s={s} edit={edit} />
      </fieldset>

      <Group title="Wave">
        <Toggle label="Show the wave behind" checked={s.wave.show} onChange={(show) => edit({ wave: { ...s.wave, show } })} />
        <Toggle label="Draw speed follows the lag" checked={s.wave.link} onChange={(link) => edit({ wave: { ...s.wave, link } })} />
        <Hint>
          {p.wave.state === "ok" && `The wave lab's default (Aaron's pick), draw speed cap ${p.wave.speed ?? "?"} px/s. Answer the band to start it.`}
          {p.wave.state === "loading" && "Loading the wave lab's path layer."}
          {p.wave.state === "off" && "Hidden."}
          {p.wave.state === "failed" && "The wave lab did not load (it may be mid-edit)."}
        </Hint>
        {p.wave.state === "failed" && (
          <button type="button" onClick={p.wave.retry} className="mt-1 rounded border border-border px-2 py-0.5 text-xs">
            Retry the wave
          </button>
        )}
      </Group>
    </aside>
  );
}
