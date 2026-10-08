"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { METRICS, glyphFor, glyphPaths } from "./glyphs";
import { layoutWord } from "./wordLayout";
import { measureProfa, type ProfaMetrics } from "./profaMetrics";
import type { FooterSettings } from "./settings";
import { COMPOSITIONS, useWordMotion, type DiscFrame, type LetterFrame, type MotionConfig, type Point } from "./useWordMotion";

// The wordmark over the whole footer stage, in one SVG whose units are stage
// px. The letters live once in <defs> and are drawn by <use>: as ink, as the
// accent tint, and as holes in a paper cover when the field is clipped by
// the letters. One loop writes their transforms and stroke widths.

export type WordGeometry = {
  stageW: number;
  stageH: number;
  baselineY: number;
  wordTop: number; // the tallest swell's top
  clipBottom: number; // the letters are cut below this (the band's bottom with the row below)
};

type Props = {
  text: string;
  s: FooterSettings;
  size: number;
  geo: WordGeometry;
  reduced: boolean;
  replay: number;
  stage: RefObject<HTMLElement | null>;
};

// The paper cover and its mask run past the stage's edges, so no
// antialiased column or row of field shows at a fractional edge.
const BLEED_PX = 16;

const DISC_COMPS = [
  { disc: [0.74, 0.42, 0.36], slab: [0.22, 0.6, 0.3, 0.95, -10] },
  { disc: [0.3, 0.55, 0.44], slab: [0.8, 0.48, 0.16, 1.15, 14] },
  { disc: [0.56, 0.86, 0.58], slab: [0.48, 0.24, 0.72, 0.22, -4] },
] as const;

function useProfa(text: string, active: boolean) {
  const [metrics, setMetrics] = useState<ProfaMetrics | null>(null);
  useEffect(() => {
    if (!active || metrics) return;
    let live = true;
    measureProfa(text).then((m) => live && setMetrics(m));
    return () => {
      live = false;
    };
  }, [text, active, metrics]);
  return metrics;
}

export function Wordmark({ text, s, size, geo, reduced, replay, stage }: Props) {
  const id = useId().replace(/:/g, "");
  const chars = useMemo(() => [...text], [text]);
  const profa = useProfa(text, s.face === "profa");
  const isProfa = s.face === "profa" && profa !== null;
  const letters = useRef<(SVGGElement | null)[]>([]);
  const disc = useRef<SVGCircleElement>(null);
  const slab = useRef<SVGRectElement>(null);
  const discGroup = useRef<SVGGElement>(null);
  const lastComp = useRef(-1);

  const paths = useMemo(() => chars.map((c) => glyphPaths(c, size)), [chars, size]);
  const fontSize = profa ? size / profa.ascent : size;
  const swell = isProfa ? 0 : s.swellAmount;
  const riseDistance = (METRICS.ascender - METRICS.descender + s.weight + swell) * size + 4;

  // Where each letter sits at rest, for the swell's distances.
  const rest = useMemo(() => {
    if (isProfa && profa) {
      const track = s.tracking * size;
      const width = profa.starts[chars.length - 1] * fontSize + profa.advances[chars.length - 1] * fontSize + track * (chars.length - 1);
      const offset = (geo.stageW - width) / 2;
      const xs = chars.map((_, i) => offset + profa.starts[i] * fontSize + track * i);
      const centers: Point[] = xs.map((x, i) => ({ x: x + (profa.advances[i] * fontSize) / 2, y: geo.baselineY - profa.mids[i] * fontSize }));
      return { centers, xs, pivots: profa.advances.map((a) => (a * fontSize) / 2) };
    }
    const base = layoutWord(text, size, [s.weight], s.tracking);
    const offset = (geo.stageW - base.width) / 2;
    const centers: Point[] = base.placements.map((p) => ({ x: offset + p.centerX, y: geo.baselineY - p.centerY }));
    return { centers, xs: base.placements.map((p) => offset + p.inkX), pivots: chars.map((c) => (glyphFor(c).width * size) / 2) };
  }, [isProfa, profa, chars, text, size, fontSize, s.weight, s.tracking, geo.stageW, geo.baselineY]);

  const config = useRef<MotionConfig>({ settings: s, size, centers: rest.centers, reduced, apply: () => {} });
  useEffect(() => {
    config.current = {
      settings: s,
      size,
      centers: rest.centers,
      reduced,
      apply: (frames: readonly LetterFrame[], d: DiscFrame) => {
        let xs = rest.xs;
        if (!isProfa && s.reflow) {
          const flow = layoutWord(text, size, frames.map((f) => f.weight), s.tracking);
          const offset = (geo.stageW - flow.width) / 2;
          xs = flow.placements.map((p) => offset + p.inkX);
        }
        frames.forEach((f, i) => {
          const g = letters.current[i];
          if (!g) return;
          const pivot = rest.pivots[i];
          const y = geo.baselineY + (1 - f.rise) * riseDistance;
          g.setAttribute(
            "transform",
            `translate(${(xs[i] + pivot).toFixed(2)} ${y.toFixed(2)}) rotate(${f.lean.toFixed(3)}) scale(${f.grow.toFixed(4)} ${(f.grow * f.squash).toFixed(4)}) translate(${(-pivot).toFixed(2)} 0)`,
          );
          if (!isProfa) g.setAttribute("stroke-width", (f.weight * size).toFixed(2));
        });
        if (discGroup.current) discGroup.current.setAttribute("transform", `translate(${d.dx.toFixed(2)} ${d.dy.toFixed(2)})`);
        if (d.comp !== lastComp.current && disc.current && slab.current) {
          lastComp.current = d.comp;
          const c = DISC_COMPS[d.comp % COMPOSITIONS];
          const [cx, cy, r] = c.disc;
          const [sx, sy, sw, sh, rot] = c.slab;
          disc.current.style.transform = `translate(${cx * geo.stageW}px, ${cy * geo.stageH}px) scale(${r * geo.stageH})`;
          slab.current.style.transform = `translate(${sx * geo.stageW}px, ${sy * geo.stageH}px) rotate(${rot}deg) scale(${sw * geo.stageW}, ${sh * geo.stageH})`;
        }
      },
    };
    lastComp.current = -1;
  }, [s, size, rest, reduced, isProfa, text, geo, riseDistance]);

  useWordMotion(stage, config, chars.length, replay);

  const clip = s.field.on && s.field.ending === "clip";
  const tintTop = clip ? s.field.letterTint : 1;
  const inkColor = s.ink === "accent" ? "var(--color-accent)" : "var(--color-foreground)";
  const capRound = s.caps === "round";

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" width={geo.stageW} height={geo.stageH} viewBox={`0 0 ${geo.stageW} ${geo.stageH}`}>
      <defs>
        <g id={`${id}-word`}>
          {chars.map((c, i) => (
            <g key={`${c}-${i}`} ref={(el) => void (letters.current[i] = el)} transform={`translate(${rest.xs[i]} ${geo.baselineY})`} strokeWidth={s.weight * size}>
              {isProfa ? (
                <text x={0} y={0} fontSize={fontSize} stroke="none" style={{ fontFamily: "var(--font-display)", fontWeight: 900 }}>
                  {c}
                </text>
              ) : (
                <>
                  <path d={paths[i].d} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap={capRound ? "round" : "butt"} strokeLinejoin={capRound ? "round" : "miter"} />
                  <path d={paths[i].dots} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap={capRound ? "round" : "square"} />
                </>
              )}
            </g>
          ))}
        </g>
        <clipPath id={`${id}-rise`} clipPathUnits="userSpaceOnUse">
          <rect x={0} y={0} width={geo.stageW} height={Math.max(0, geo.clipBottom)} />
        </clipPath>
        {/* In each letter's own space (baseline at 0), so the fade rides with the rise and the press. */}
        <linearGradient id={`${id}-ink`} gradientUnits="userSpaceOnUse" x1={0} y1={-(1 + s.weight / 2) * size} x2={0} y2={0}>
          <stop offset={0} style={{ stopColor: inkColor, stopOpacity: tintTop }} />
          <stop offset={1} style={{ stopColor: inkColor, stopOpacity: tintTop * (1 - s.inkFade) }} />
        </linearGradient>
        {clip && (
          <mask id={`${id}-holes`} maskUnits="userSpaceOnUse" x={-BLEED_PX} y={-BLEED_PX} width={geo.stageW + 2 * BLEED_PX} height={geo.stageH + 2 * BLEED_PX}>
            <rect x={-BLEED_PX} y={-BLEED_PX} width={geo.stageW + 2 * BLEED_PX} height={geo.stageH + 2 * BLEED_PX} fill="white" />
            <g clipPath={`url(#${id}-rise)`}>
              <use href={`#${id}-word`} stroke="black" fill="black" />
            </g>
          </mask>
        )}
      </defs>
      {s.disc.on && (
        <g ref={discGroup}>
          <circle ref={disc} cx={0} cy={0} r={1} className="transition-transform duration-[900ms] ease-out" style={{ fill: "var(--color-accent)", opacity: 0.14 }} />
          <rect ref={slab} x={-0.5} y={-0.5} width={1} height={1} className="transition-transform duration-[900ms] ease-out" style={{ fill: "var(--color-foreground)", opacity: 0.06 }} />
        </g>
      )}
      {/* Starts 2px over the line where the field turns back on, so no antialiased row of field shows. */}
      {clip && (
        <rect
          x={-BLEED_PX}
          y={geo.wordTop - 2}
          width={geo.stageW + 2 * BLEED_PX}
          height={Math.max(0, geo.stageH - geo.wordTop + 2 + BLEED_PX)}
          mask={`url(#${id}-holes)`}
          style={{ fill: "var(--color-background)" }}
        />
      )}
      {(!clip || s.field.letterTint > 0) && (
        <g clipPath={`url(#${id}-rise)`}>
          <use href={`#${id}-word`} stroke={`url(#${id}-ink)`} fill={`url(#${id}-ink)`} />
        </g>
      )}
    </svg>
  );
}
