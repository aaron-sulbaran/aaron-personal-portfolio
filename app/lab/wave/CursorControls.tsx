"use client";

import { Choice, Group, Slider, Toggle } from "./panelParts";
import { CURSOR_MODES, CURSOR_RANGES, type CursorSettings } from "./settings";

// The pointer's touch on the path's dots. Fine pointers only; nothing for
// touch and nothing under reduced motion.
export function CursorControls({ cursor, onChange }: { cursor: CursorSettings; onChange: (patch: Partial<CursorSettings>) => void }) {
  const R = CURSOR_RANGES;
  const mode = CURSOR_MODES.find((m) => m.id === cursor.mode);
  const pushes = cursor.mode === "push" || cursor.mode === "blend";
  return (
    <Group title="Pointer">
      <Choice options={CURSOR_MODES} value={cursor.mode} onChange={(next) => onChange({ mode: next })} />
      <p className="mt-1 text-xs leading-snug text-muted">{mode?.note}</p>
      {cursor.mode !== "none" && (
        <>
          <Slider label="Radius" unit="px" value={cursor.radius} {...R.radius} onChange={(radius) => onChange({ radius })} />
          <Slider label="Strength" value={cursor.strength} {...R.strength} onChange={(strength) => onChange({ strength })} />
          <Slider label="Recovery" unit="s" value={cursor.recovery} {...R.recovery} onChange={(recovery) => onChange({ recovery })} />
        </>
      )}
      {pushes && <Slider label="Push saturates at" unit="px/s" value={cursor.saturate} {...R.saturate} onChange={(saturate) => onChange({ saturate })} />}
      {cursor.mode === "blend" && (
        <>
          <Slider label="Mix: push" value={cursor.mix.push} {...R.mix} onChange={(push) => onChange({ mix: { ...cursor.mix, push } })} />
          <Slider label="Mix: carve (the clearing)" value={cursor.mix.carve} {...R.mix} onChange={(carve) => onChange({ mix: { ...cursor.mix, carve } })} />
          <Slider label="Mix: swell (the ring)" value={cursor.mix.swell} {...R.mix} onChange={(swell) => onChange({ mix: { ...cursor.mix, swell } })} />
        </>
      )}
      {cursor.mode !== "none" && <ScatterControls cursor={cursor} onChange={onChange} />}
    </Group>
  );
}

function ScatterControls({ cursor, onChange }: { cursor: CursorSettings; onChange: (patch: Partial<CursorSettings>) => void }) {
  const R = CURSOR_RANGES;
  const sc = cursor.scatter;
  const set = (patch: Partial<CursorSettings["scatter"]>) => onChange({ scatter: { ...sc, ...patch } });
  return (
    <>
      <Toggle label="Scatter: a fast pass throws the dots" checked={sc.on} onChange={(on) => set({ on })} />
      {sc.on && (
        <>
          <p className="mt-1 text-xs leading-snug text-muted">
            Each dot the pointer passes faster than the threshold flies off on its own path, slows with drag, then springs home without overshooting. Sits on top of the mode above.
          </p>
          <Slider label="Speed threshold" unit="px/s" value={sc.threshold} {...R.threshold} onChange={(threshold) => set({ threshold })} />
          <Slider label="Launch (share of pointer speed)" value={sc.launch} {...R.launch} onChange={(launch) => set({ launch })} />
          <Slider label="Spread (per dot)" value={sc.spread} {...R.spread} onChange={(spread) => set({ spread })} />
          <Slider label="Drag" unit="per s" value={sc.drag} {...R.drag} onChange={(drag) => set({ drag })} />
          <Slider label="Return time" unit="s" value={sc.returnS} {...R.returnS} onChange={(returnS) => set({ returnS })} />
        </>
      )}
    </>
  );
}
