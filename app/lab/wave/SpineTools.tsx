"use client";

import { BEHAVIOURS, STRETCHES, type Behaviour, type Move, type Side, type StretchKey } from "./compose";
import { Slider, Toggle } from "./panelParts";
import type { PathSettings } from "./settings";
import type { SpineChoice } from "./spineChoice";
import { RULES, type RuleReport, type RuleSettings } from "./spineRules";
import { sessionSeed } from "./useLabSettings";

// The irregular line's tools: the seeded generator, the per-stretch editor
// and the rules readout for whichever spine is showing.

const STRETCH_LABELS: Record<StretchKey, string> = {
  band: "Band",
  gap0: "gap",
  about: "About",
  gap1: "gap",
  who: "Who I am",
  gap2: "gap",
  up: "Up to now",
  gap3: "gap",
  connect: "Connect",
  gap4: "gap",
  footer: "Footer",
};

type Patch = (patch: Partial<PathSettings>) => void;

export function Generator({ path, choice, onChange }: { path: PathSettings; choice: SpineChoice; onChange: Patch }) {
  const g = choice.generated;
  return (
    <div className="mt-3 rounded border border-border p-2">
      <p className="text-xs text-muted">Generator</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          Seed
          <input
            type="number"
            value={path.seed}
            onChange={(e) => onChange({ spine: "generated", seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
            className="w-24 rounded border border-border bg-background px-1 py-0.5 tabular-nums"
          />
        </label>
        <button
          type="button"
          onClick={() => onChange({ spine: "generated", seed: 1 + Math.floor(Math.random() * 0x7ffffffe) })}
          className="rounded border border-border px-2 py-0.5"
        >
          Reseed
        </button>
        <button
          type="button"
          disabled={!g}
          onClick={() => g && onChange({ spine: "custom", custom: g.moves })}
          className="rounded border border-border px-2 py-0.5"
        >
          Keep this one
        </button>
      </div>
      {g && path.spine === "generated" && (
        <p className="mt-1 text-[11px] text-muted">
          {g.fallback ? `No candidate passed in ${g.attempts} tries; the authored fallback stands in.` : `Accepted on try ${g.attempts} (derived seed ${g.usedSeed}).`}{" "}
          {choice.genMs.toFixed(1)} ms to generate and check.
        </p>
      )}
      <Slider label="Through words, versus off screen" value={path.gen.through} min={0} max={1} step={0.01} onChange={(through) => onChange({ spine: "generated", gen: { ...path.gen, through } })} />
      <Slider label="Unevenness" value={path.gen.uneven} min={0} max={1} step={0.01} onChange={(uneven) => onChange({ spine: "generated", gen: { ...path.gen, uneven } })} />
      <Slider label="How far off screen" value={path.gen.offscreen} min={0} max={1} step={0.01} onChange={(offscreen) => onChange({ spine: "generated", gen: { ...path.gen, offscreen } })} />
      <Toggle
        label="New line each visit (one seed per browser session)"
        checked={path.newEachVisit}
        onChange={(newEachVisit) => onChange(newEachVisit ? { newEachVisit, spine: "generated", seed: sessionSeed() } : { newEachVisit })}
      />
      <p className="mt-1 text-[11px] leading-snug text-muted">Add ?seed=N to the address to reproduce a line exactly.</p>
    </div>
  );
}

export function RulesReadout({ report, rules }: { report: RuleReport | null; rules: RuleSettings }) {
  if (!report) return null;
  const row = (label: string, value: string, ok: boolean) => (
    <p className="flex justify-between text-[11px] tabular-nums">
      <span className="text-muted">{label}</span>
      <span className={ok ? "text-foreground" : "text-accent"}>{value}</span>
    </p>
  );
  const px = (v: number) => (Number.isFinite(v) ? `${Math.round(v)} px` : "none");
  return (
    <div className="mt-3 rounded border border-border p-2">
      <p className="text-xs text-muted">Rules, on this page at this width {report.failed.length ? `(${report.failed.length} broken)` : "(all kept)"}</p>
      {row("Tightest bend, times the reach", report.bendRatio.toFixed(2), report.bendRatio >= RULES.minBendRatio)}
      {row("Climbs back on itself", `${report.backtrackPx.toFixed(0)} px`, report.backtrackPx <= RULES.maxBacktrackPx)}
      {row("Longest flat run in words", px(report.flatRunPx), report.flatRunPx <= RULES.maxFlatRunPx)}
      {row(
        `Longest scroll with no wave (max ${rules.maxEmptyVh}${rules.alwaysVisible ? ", unused" : ""})`,
        `${report.empty.longestVh.toFixed(2)} vh`,
        rules.alwaysVisible || report.empty.longestVh <= rules.maxEmptyVh,
      )}
      {row("Always some wave on screen (every 50px)", report.visible.worstGapPx ? `no, ${report.visible.worstGapPx} px gap at ${Math.round(report.visible.atY)}` : "yes", !rules.alwaysVisible || !report.visible.worstGapPx)}
      {row(
        "Head reaches the end at max scroll",
        report.end.shortPx > 1 ? `no, short by ${Math.round(report.end.shortPx)} px` : report.end.endsOff ? "yes" : "yes, but ends on screen",
        !rules.endReached || (report.end.shortPx <= 1 && report.end.endsOff),
      )}
      {row("Closest dot to a heading", px(report.headingClearPx), !rules.headingClearPx || report.headingClearPx >= rules.headingClearPx)}
      {row("Closest dot to the link list", px(report.linksClearPx), !rules.linksClear || report.linksClearPx >= 0)}
      {row("Longest run along a hairline", px(report.hairlineRunPx), !rules.hairlineGapPx || report.hairlineRunPx <= rules.hairlineRunPx)}
      {row("Longest run down a text edge", px(report.edgeRunPx), !rules.edgeGapPx || report.edgeRunPx <= rules.edgeRunPx)}
      {row("Most turning in one section", `${Math.round(report.turnDeg)} deg`, !rules.maxTurnDeg || report.turnDeg <= rules.maxTurnDeg)}
      {row("Longest flat run on screen", px(report.flatAnyPx), !rules.flatAnySlope || report.flatAnyPx <= rules.flatAnyPx)}
      {row("Entry from the band's right end", px(report.entryPx), !rules.entryNearBandPx || report.entryPx <= rules.entryNearBandPx)}
      {row("Ends past an edge", report.exitOffscreen ? "yes" : "no", !rules.exitAtEdge || report.exitOffscreen)}
      {row("Character: turning, direction changes", `${Math.round(report.totalTurnDeg)} deg, ${report.dirChanges}`, (!rules.minTurnDeg || report.totalTurnDeg >= rules.minTurnDeg) && (!rules.minDirChanges || report.dirChanges >= rules.minDirChanges))}
    </div>
  );
}

export function RuleControls({ rules, onChange }: { rules: RuleSettings; onChange: (rules: RuleSettings) => void }) {
  const set = (patch: Partial<RuleSettings>) => onChange({ ...rules, ...patch });
  return (
    <div className="mt-3 rounded border border-border p-2">
      <p className="text-xs text-muted">Rule settings (0 switches one off)</p>
      <Slider label="Max scroll with no wave" unit="vh" value={rules.maxEmptyVh} min={0.2} max={2} step={0.05} onChange={(maxEmptyVh) => set({ maxEmptyVh })} />
      <Slider label="Heading clearance" unit="px" value={rules.headingClearPx} min={0} max={80} step={1} onChange={(headingClearPx) => set({ headingClearPx })} />
      <Slider label="Hairline: gap" unit="px" value={rules.hairlineGapPx} min={0} max={80} step={1} onChange={(hairlineGapPx) => set({ hairlineGapPx })} />
      <Slider label="Text edge: gap" unit="px" value={rules.edgeGapPx} min={0} max={80} step={1} onChange={(edgeGapPx) => set({ edgeGapPx })} />
      <Slider label="Turning in one section" unit="deg" value={rules.maxTurnDeg} min={0} max={360} step={5} onChange={(maxTurnDeg) => set({ maxTurnDeg })} />
      <Slider label="Flat anywhere: slope" value={rules.flatAnySlope} min={0} max={0.4} step={0.01} onChange={(flatAnySlope) => set({ flatAnySlope })} />
      <Slider label="Entry near the band" unit="px" value={rules.entryNearBandPx} min={0} max={400} step={5} onChange={(entryNearBandPx) => set({ entryNearBandPx })} />
      <Slider label="Character: least turning" unit="deg" value={rules.minTurnDeg} min={0} max={360} step={5} onChange={(minTurnDeg) => set({ minTurnDeg })} />
      <Slider label="Character: direction changes" value={rules.minDirChanges} min={0} max={6} step={1} onChange={(minDirChanges) => set({ minDirChanges })} />
      <Slider label="Hairline: longest run" unit="px" value={rules.hairlineRunPx} min={80} max={600} step={10} onChange={(hairlineRunPx) => set({ hairlineRunPx })} />
      <Toggle label="Keep off Connect's link list" checked={rules.linksClear} onChange={(linksClear) => set({ linksClear })} />
      <Toggle label="End past an edge" checked={rules.exitAtEdge} onChange={(exitAtEdge) => set({ exitAtEdge })} />
      <Toggle label="Always some wave on screen (replaces the empty-scroll limit)" checked={rules.alwaysVisible} onChange={(alwaysVisible) => set({ alwaysVisible })} />
      <Toggle label="Head reaches the end at max scroll" checked={rules.endReached} onChange={(endReached) => set({ endReached })} />
    </div>
  );
}

export function StretchEditor({ moves, onChange }: { moves: Move[]; onChange: (moves: Move[]) => void }) {
  const byStretch = new Map(moves.map((m) => [m.at, m]));
  const set = (at: StretchKey, next: Move | null) => {
    const rest = moves.filter((m) => m.at !== at);
    onChange(next ? [...rest, next] : rest);
  };
  return (
    <div className="mt-3 rounded border border-border p-2">
      <p className="text-xs text-muted">Stretch by stretch (custom)</p>
      {STRETCHES.map((at) => {
        const m = byStretch.get(at);
        return (
          <div key={at} className="mt-1 flex items-center gap-1 text-[11px]">
            <span className={`w-16 shrink-0 ${at.startsWith("gap") ? "pl-2 text-muted" : ""}`}>{STRETCH_LABELS[at]}</span>
            <select
              value={m?.kind ?? "none"}
              onChange={(e) =>
                set(at, e.target.value === "none" ? null : { at, kind: e.target.value as Behaviour, side: m?.side ?? "right", reach: m?.reach ?? 0.3, slope: m?.slope ?? 0.6, centre: m?.centre })
              }
              className="w-[84px] rounded border border-border bg-background"
            >
              <option value="none">Free</option>
              {BEHAVIOURS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            {m && (
              <>
                <button type="button" onClick={() => set(at, { ...m, side: (m.side === "right" ? "left" : "right") as Side })} className="w-9 rounded border border-border">
                  {m.side === "right" ? "R" : "L"}
                </button>
                <input
                  type="range"
                  title="Reach"
                  min={0}
                  max={0.9}
                  step={0.01}
                  value={m.reach}
                  onChange={(e) => set(at, { ...m, reach: Number(e.target.value) })}
                  className="w-12 accent-accent"
                />
                <input
                  type="range"
                  title="Slope"
                  min={0.2}
                  max={0.9}
                  step={0.01}
                  value={m.slope}
                  onChange={(e) => set(at, { ...m, slope: Number(e.target.value) })}
                  className="w-12 accent-accent"
                />
              </>
            )}
          </div>
        );
      })}
      <p className="mt-1 text-[11px] leading-snug text-muted">Side, then reach and slope. Free leaves the stretch to the curve between its neighbours.</p>
    </div>
  );
}
