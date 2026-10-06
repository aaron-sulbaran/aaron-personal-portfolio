"use client";

import { Slider, Toggle } from "./panelParts";
import { MOTION_RANGES, type MotionSettings } from "./settings";

// The music's motion rates, inside the "Music, simulated" group. Speed scales
// all the others at once, so it comes first.

export function MotionControls(props: { motion: MotionSettings; onChange: (patch: Partial<MotionSettings>) => void }) {
  const { motion: m, onChange } = props;
  const R = MOTION_RANGES;
  return (
    <>
      <p className="mt-3 text-xs text-muted">Motion</p>
      <Slider label="Motion speed (scales every rate)" unit="x" value={m.speed} {...R.speed} onChange={(speed) => onChange({ speed })} />
      <Slider label="Tempo" unit="BPM" value={m.tempo} {...R.tempo} onChange={(tempo) => onChange({ tempo })} />
      <Slider label="Beat strength" value={m.beatStrength} {...R.beatStrength} onChange={(beatStrength) => onChange({ beatStrength })} />
      <Slider label="Transient softness (1 snaps, 8 swells)" unit="x" value={m.softness} {...R.softness} onChange={(softness) => onChange({ softness })} />
      <Slider label="Level attack" unit="s" value={m.attack} {...R.attack} onChange={(attack) => onChange({ attack })} />
      <Slider label="Level release" unit="s" value={m.release} {...R.release} onChange={(release) => onChange({ release })} />
      <Slider label="Level wander" unit="Hz" value={m.wander} {...R.wander} onChange={(wander) => onChange({ wander })} />
      <Slider label="Shimmer rate" unit="x clock" value={m.shimmerRate} {...R.shimmerRate} onChange={(shimmerRate) => onChange({ shimmerRate })} />
      <Slider label="Shimmer depth (soft shimmer)" value={m.shimmerDepth} {...R.shimmerDepth} onChange={(shimmerDepth) => onChange({ shimmerDepth })} />
      <Toggle label="Rows grow in (Path; no popping rows)" checked={m.softRows} onChange={(softRows) => onChange({ softRows })} />
      <p className="mt-1 text-xs leading-snug text-muted">
        Attack and release are the levels&apos; time constants. Wander is the fastest of the slow drifts. Console: window.__waveLab.motionProbe() measures the current rates.
      </p>
    </>
  );
}
