import { hiveStoryCopy } from "@/lib/content/hive-story";
import { LAYOUTS } from "@/lib/hive-story/flow";
import { GLYPHS, GLYPH_BOX, GLYPH_DOT, SCENARIOS, SCENARIO_BOX, type GlyphKey, type ScenarioKey } from "@/lib/hive-story/glyphs";
import { FlowSvg } from "./FlowSvg";
import { FlowSwarm } from "./FlowSwarm";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The hero: the whole flow in bees, a phone column under 1024 px and a row above it. */
export function HiveFlow() {
  return (
    <figure className="m-0">
      <FlowSwarm>
        <FlowSvg layout={LAYOUTS.tall} className="relative block w-full lg:hidden" />
        <FlowSvg layout={LAYOUTS.wide} className="relative hidden w-full lg:block" />
      </FlowSwarm>
      <figcaption className="sr-only">{hiveStoryCopy.flow.description}</figcaption>
    </figure>
  );
}

/** One step's glyph: dark bees on a honey disc, like Beekeeper's reactions. */
export function DotGlyph({ glyph, className }: { glyph: GlyphKey; className?: string }) {
  return (
    <svg viewBox={`0 0 ${GLYPH_BOX} ${GLYPH_BOX}`} className={className} aria-hidden="true" focusable="false">
      <circle cx={50} cy={50} r={50} fill="var(--hive-honey)" />
      <g fill="var(--hive-bee)">
        {GLYPHS[glyph].map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={GLYPH_DOT} />)}
      </g>
    </svg>
  );
}

/** A scenario's small swarm: sessions (open, since notes are next) into the Hive. */
export function ScenarioSwarm({ scenario }: { scenario: ScenarioKey }) {
  const s = SCENARIOS[scenario];
  return (
    <svg viewBox={`0 0 ${SCENARIO_BOX.width} ${SCENARIO_BOX.height}`} className="block h-auto w-full" aria-hidden="true" focusable="false">
      <g fill="var(--hive-bee)">
        <g fillOpacity={0.42}>{s.lanes.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={1.3} />)}</g>
        <g fillOpacity={0.9}>{s.comb.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={2.5} />)}</g>
      </g>
      <g fill="none" stroke="var(--hive-bee)" strokeWidth={1.2}>
        {s.sessions.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={1.7} />)}
        {s.check.map((p, i) => <circle key={`c${i}`} cx={r2(p.x)} cy={r2(p.y)} r={2.4} />)}
      </g>
      <g fill="var(--hive-honey)" stroke="var(--hive-bee)" strokeWidth={1.8}>
        {s.notes.map((p, i) => <circle key={i} cx={r2(p.x)} cy={r2(p.y)} r={4.6} />)}
      </g>
    </svg>
  );
}
