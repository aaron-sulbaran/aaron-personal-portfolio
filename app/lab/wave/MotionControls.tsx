"use client";

import { Choice, Slider, Toggle } from "./panelParts";
import { MOTION_RANGES, MUSIC_SOURCES, SITE_MOTION, type MotionSettings } from "./settings";

// The music's source and motion rates, inside the music group. Speed scales
// all the others at once (the track's clock too), so it comes first after the
// source; the simulation's own knobs only show for it.

export function MotionControls(props: { motion: MotionSettings; onChange: (patch: Partial<MotionSettings>) => void }) {
  const { motion: m, onChange } = props;
  const R = MOTION_RANGES;
  const simulated = m.source === "simulated";
  const siteRates = m.attack === SITE_MOTION.attack && m.release === SITE_MOTION.release && (!simulated || (m.beatStrength === 1 && m.softness === 1));
  return (
    <>
      <p className="mt-3 text-xs text-muted">Source</p>
      <Choice options={MUSIC_SOURCES} value={m.source} onChange={(source) => onChange({ source })} />
      <p className="mt-1 text-xs leading-snug text-muted">{MUSIC_SOURCES.find((x) => x.id === m.source)?.note}</p>
      <p className="mt-3 text-xs text-muted">Motion</p>
      <button
        type="button"
        disabled={siteRates}
        onClick={() => onChange({ attack: SITE_MOTION.attack, release: SITE_MOTION.release, beatStrength: 1, softness: 1 })}
        className="mt-1 rounded border border-border px-2 py-0.5 text-xs disabled:opacity-50"
      >
        {siteRates ? "The site's responsiveness" : "Back to the site's responsiveness"}
      </button>
      <Slider label="Motion speed (scales every rate)" unit="x" value={m.speed} {...R.speed} onChange={(speed) => onChange({ speed })} />
      <Slider label="Level attack (the site: 0.05)" unit="s" value={m.attack} {...R.attack} onChange={(attack) => onChange({ attack })} />
      <Slider label="Level release (the site: 0.17)" unit="s" value={m.release} {...R.release} onChange={(release) => onChange({ release })} />
      {simulated && (
        <>
          <Slider label="Tempo" unit="BPM" value={m.tempo} {...R.tempo} onChange={(tempo) => onChange({ tempo })} />
          <Slider label="Beat strength" value={m.beatStrength} {...R.beatStrength} onChange={(beatStrength) => onChange({ beatStrength })} />
          <Slider label="Transient softness (1 snaps, 8 swells)" unit="x" value={m.softness} {...R.softness} onChange={(softness) => onChange({ softness })} />
          <Slider label="Level wander" unit="Hz" value={m.wander} {...R.wander} onChange={(wander) => onChange({ wander })} />
        </>
      )}
      <Slider label="Shimmer rate" unit="x clock" value={m.shimmerRate} {...R.shimmerRate} onChange={(shimmerRate) => onChange({ shimmerRate })} />
      <Slider label="Shimmer depth (soft shimmer)" value={m.shimmerDepth} {...R.shimmerDepth} onChange={(shimmerDepth) => onChange({ shimmerDepth })} />
      <Toggle label="Rows grow in (Path; no popping rows)" checked={m.softRows} onChange={(softRows) => onChange({ softRows })} />
      <p className="mt-1 text-xs leading-snug text-muted">
        Attack and release are the levels&apos; time constants; they move only the dots, never the line&apos;s shape. Console: window.__waveLab.musicProbe() measures the beat on the page over the last 2 s; beatCompare() and motionProbe() measure offline.
      </p>
    </>
  );
}
