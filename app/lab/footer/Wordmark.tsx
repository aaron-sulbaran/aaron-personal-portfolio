"use client";

import { useEffect, useId, useMemo, useRef, type RefObject } from "react";
import { glyphFor, glyphPaths } from "./glyphs";
import { layoutWord, typesetRow, type InkExtent } from "./wordLayout";
import type { FooterSettings, TypeResponse } from "./settings";
import type { TypesetFace } from "./useTypeface";
import { COMPOSITIONS, useWordMotion, type DiscFrame, type LetterFrame, type MotionConfig, type Point } from "./useWordMotion";
import { poseAt, variationSettings } from "./webFont";

// The wordmark over the whole footer stage, in one SVG whose units are stage
// px. The letters live once in <defs> and are drawn by <use>: as ink, as the
// accent tint, and as holes in a paper cover when the field is clipped by
// the letters. One loop writes their transforms, stroke widths and axes.

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
  ink: InkExtent;
  face: TypesetFace | null; // null draws the procedural alphabet
  response: TypeResponse;
  letterVeil: number; // clip only: paper over the letters, so they show the field shallower than the cover's
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

export function Wordmark({ text, s, size, geo, ink, face, response, letterVeil, reduced, replay, stage }: Props) {
  const id = useId().replace(/:/g, "");
  const chars = useMemo(() => [...text], [text]);
  const letters = useRef<(SVGGElement | null)[]>([]);
  const glyphText = useRef<(SVGTextElement | null)[]>([]);
  const written = useRef<string[]>([]);
  const disc = useRef<SVGCircleElement>(null);
  const slab = useRef<SVGRectElement>(null);
  const discGroup = useRef<SVGGElement>(null);
  const lastComp = useRef(-1);

  const paths = useMemo(() => chars.map((c) => glyphPaths(c, size, s.corners)), [chars, size, s.corners]);
  const fontSize = face ? size / face.metrics.ascent : size;
  const riseDistance = (ink.top + ink.bottom + 0.04) * size + 4;
  const swellAxes = face !== null && response === "swell" && face.canSwell;

  // Where each letter sits at rest, for the swell's distances.
  const rest = useMemo(() => {
    if (face) {
      const m = face.metrics;
      const row = typesetRow(m, fontSize, s.tracking * size);
      const offset = (geo.stageW - row.width) / 2;
      const xs = row.xs.map((x) => offset + x);
      const centers: Point[] = xs.map((x, i) => ({ x: x + (m.advances[i] * fontSize) / 2, y: geo.baselineY - m.mids[i] * fontSize }));
      return { centers, xs, pivots: m.advances.map((a) => (a * fontSize) / 2) };
    }
    const base = layoutWord(text, size, [s.weight], s.tracking);
    const offset = (geo.stageW - base.width) / 2;
    const centers: Point[] = base.placements.map((p) => ({ x: offset + p.centerX, y: geo.baselineY - p.centerY }));
    return { centers, xs: base.placements.map((p) => offset + p.inkX), pivots: chars.map((c) => (glyphFor(c).width * size) / 2) };
  }, [face, chars, text, size, fontSize, s.weight, s.tracking, geo.stageW, geo.baselineY]);

  const config = useRef<MotionConfig>({ settings: s, size, centers: rest.centers, reduced, typeset: false, response: "swell", apply: () => {} });
  useEffect(() => {
    // A render may have reset the axes to rest; write them again.
    written.current = [];
    config.current = {
      settings: s,
      size,
      centers: rest.centers,
      reduced,
      typeset: face !== null,
      response,
      apply: (frames: readonly LetterFrame[], d: DiscFrame) => {
        let xs = rest.xs;
        if (s.reflow && !face) {
          const flow = layoutWord(text, size, frames.map((f) => f.weight), s.tracking);
          const offset = (geo.stageW - flow.width) / 2;
          xs = flow.placements.map((p) => offset + p.inkX);
        } else if (s.reflow && face && swellAxes) {
          const flow = typesetRow(face.metrics, fontSize, s.tracking * size, frames.map((f) => f.swell));
          const offset = (geo.stageW - flow.width) / 2;
          xs = flow.xs.map((x) => offset + x);
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
          if (!face) g.setAttribute("stroke-width", (f.weight * size).toFixed(2));
          const t = glyphText.current[i];
          if (face && swellAxes && t) {
            const axes = variationSettings(poseAt(face.rest, face.heavy, f.swell));
            if (written.current[i] !== axes) {
              written.current[i] = axes;
              t.style.fontVariationSettings = axes;
            }
          }
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
  }, [s, size, rest, reduced, face, response, swellAxes, fontSize, text, geo, riseDistance]);

  useWordMotion(stage, config, chars.length, replay);

  const clip = s.field.on && s.field.ending === "clip";
  const tintTop = clip ? s.field.letterTint : 1;
  const inkColor = s.ink === "accent" ? "var(--color-accent)" : "var(--color-foreground)";
  const paper = "var(--color-background)";

  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" width={geo.stageW} height={geo.stageH} viewBox={`0 0 ${geo.stageW} ${geo.stageH}`}>
      <defs>
        <g id={`${id}-word`}>
          {chars.map((c, i) => (
            <g key={`${c}-${i}`} ref={(el) => void (letters.current[i] = el)} transform={`translate(${rest.xs[i]} ${geo.baselineY})`} strokeWidth={s.weight * size}>
              {face ? (
                <text
                  ref={(el) => void (glyphText.current[i] = el)}
                  x={0}
                  y={0}
                  fontSize={fontSize}
                  stroke="none"
                  style={{
                    fontFamily: face.family,
                    fontWeight: face.restWeight,
                    fontVariationSettings: variationSettings(face.rest),
                    fontVariantLigatures: "none",
                    fontSynthesis: "none",
                  }}
                >
                  {c}
                </text>
              ) : (
                <>
                  <path d={paths[i].d} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap={s.caps} strokeLinejoin={s.join} />
                  <path d={paths[i].dots} fill="none" vectorEffect="non-scaling-stroke" strokeLinecap={s.caps === "round" ? "round" : "square"} />
                </>
              )}
            </g>
          ))}
        </g>
        <clipPath id={`${id}-rise`} clipPathUnits="userSpaceOnUse">
          <rect x={0} y={0} width={geo.stageW} height={Math.max(0, geo.clipBottom)} />
        </clipPath>
        {/* In each letter's own space (baseline at 0), so the fade rides with the rise and the press. */}
        <linearGradient id={`${id}-ink`} gradientUnits="userSpaceOnUse" x1={0} y1={-ink.top * size} x2={0} y2={0}>
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
          style={{ fill: paper }}
        />
      )}
      {clip && letterVeil > 0.001 && (
        <g clipPath={`url(#${id}-rise)`} opacity={letterVeil}>
          <use href={`#${id}-word`} style={{ fill: paper, stroke: paper }} />
        </g>
      )}
      {(!clip || s.field.letterTint > 0) && (
        <g clipPath={`url(#${id}-rise)`}>
          <use href={`#${id}-word`} stroke={`url(#${id}-ink)`} fill={`url(#${id}-ink)`} />
        </g>
      )}
    </svg>
  );
}
