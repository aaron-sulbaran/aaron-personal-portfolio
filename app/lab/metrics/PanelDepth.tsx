"use client";

import { Field, PanelButton, Segmented, Slider } from "../type/controls";
import type { FlatDepth } from "./skyline/draw";
import { DEPTH_NAMES, DEPTH_NOTES, FAST_SCROLL_PX_S, SEEN_RULE, type Settings } from "./settings";
import { fastScroll } from "./useScrollMorph";

// Round 4's controls: the seen-morph rule with its fast-scroll test, the
// toggle's morph, and the flat view's depth.

type Set = <K extends keyof Settings>(key: K, value: Settings[K]) => void;

const DEPTHS: readonly FlatDepth[] = ["none", "lift", "bevel", "inset"];

export function SeenControls({ s, set }: { s: Settings; set: Set }) {
  const play = s.morph === "play";
  const waits = play && s.morphWaitsForView;
  return (
    <>
      <Field label="Morph waits to be seen (play only)">
        <div className={play ? "" : "pointer-events-none opacity-40"}>
          <Segmented
            options={["off", "on"] as const}
            value={s.morphWaitsForView ? "on" : "off"}
            onChange={(v) => set("morphWaitsForView", v === "on")}
          />
        </div>
        <p className={"leading-snug text-muted " + (play ? "" : "opacity-40")}>{SEEN_RULE}</p>
      </Field>
      <Slider
        label="In view, share of the chart"
        value={s.inViewShare}
        min={30}
        max={100}
        step={5}
        disabled={!waits}
        format={(n) => n + "%"}
        onChange={(v) => set("inViewShare", v)}
      />
      <Slider
        label="Settled: scroll under"
        value={s.settleSpeed}
        min={100}
        max={1200}
        step={50}
        disabled={!waits}
        format={(n) => n + " px/s"}
        onChange={(v) => set("settleSpeed", v)}
      />
      <Slider
        label="Settled: for"
        value={s.settledMs}
        min={40}
        max={400}
        step={10}
        disabled={!waits}
        format={(n) => n + " ms"}
        onChange={(v) => set("settledMs", v)}
      />
      <PanelButton onClick={() => fastScroll(s.duration)}>
        Fast scroll: top to footer at {FAST_SCROLL_PX_S} px/s
      </PanelButton>
      <p className="leading-snug text-muted">
        The block should pass flat on the way down; scroll back up to it and the morph plays as you arrive. Any wheel or key stops the pass.
      </p>
      <Field label="A click on Flat or Skyline">
        <div className={s.morph === "load" ? "pointer-events-none opacity-40" : ""}>
          <Segmented
            options={["morph", "snap"] as const}
            value={s.toggleMorphs ? "morph" : "snap"}
            onChange={(v) => set("toggleMorphs", v === "morph")}
            format={(v) => (v === "morph" ? "Plays the morph" : "Snaps")}
          />
        </div>
      </Field>
    </>
  );
}

export function DepthControls({ s, set }: { s: Settings; set: Set }) {
  const on = s.flatDepth !== "none";
  return (
    <>
      <Field label="Flat depth">
        <Segmented options={DEPTHS} value={s.flatDepth} onChange={(v) => set("flatDepth", v)} format={(v) => DEPTH_NAMES[v]} />
        <p className="leading-snug text-muted">{DEPTH_NOTES[s.flatDepth]}</p>
      </Field>
      <Slider
        label={s.flatDepth === "lift" ? "Cell lift, shadow offset" : s.flatDepth === "inset" ? "Cell lift, wall depth" : "Cell lift, edge width"}
        value={s.cellLift}
        min={0}
        max={3}
        step={0.25}
        disabled={!on}
        format={(n) => n.toFixed(2) + " px"}
        onChange={(v) => set("cellLift", v)}
      />
      <Slider
        label="Edge hairline, ink alpha"
        value={s.edgeAlpha}
        min={0}
        max={0.3}
        step={0.01}
        disabled={!on}
        format={(n) => n.toFixed(2)}
        onChange={(v) => set("edgeAlpha", v)}
      />
      <Slider
        label="Inner highlight, active days"
        value={s.innerHighlight}
        min={0}
        max={150}
        step={5}
        disabled={!on}
        format={(n) => n + "% of the Coil's"}
        onChange={(v) => set("innerHighlight", v)}
      />
      <Slider
        label="Paper tone, empty days"
        value={s.paperTone}
        min={0}
        max={12}
        step={0.5}
        disabled={!on}
        format={(n) => n.toFixed(1) + "% ink"}
        onChange={(v) => set("paperTone", v)}
      />
    </>
  );
}
