"use client";

import { useId, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { FOOTER } from "@/lib/footer/constants";
import { REST_POSE, askEgg, type EggPose, type EggState } from "@/lib/footer/egg";
import { glyphOutline, glyphPose } from "@/lib/footer/face";
import { eggTransform, letterTransform, periodBox } from "@/lib/footer/frame";
import { reachInk, rippleReach, swelledXs, type FooterGeometry, type WordRest } from "@/lib/footer/geometry";
import type { LetterFrame } from "@/lib/footer/word";
import { useWordMotion, type MotionConfig } from "./useWordMotion";

// The wordmark over the whole footer, in one SVG whose units are the footer's
// px. The letters live once in <defs> and are drawn twice by <use>: as holes
// in a paper cover over the field (the letters are windows onto it) and as
// the accent tint. The loop writes their transforms and, as they swell and
// press, their outlines (bars and dots keep their thickness through the
// press), and the period's egg and its shadow. A button over the period
// starts the egg. The SVG is decorative; the footer carries the word's text.

type Props = {
  text: string;
  eggLabel: string;
  geo: FooterGeometry;
  rest: WordRest;
  reduced: boolean;
  stage: RefObject<HTMLElement | null>;
  egg: EggState;
};

const poseAt = (swell: number, squash: number) => glyphPose(FOOTER.face, FOOTER.swell.amount, swell, squash);

export function Wordmark({ text, eggLabel, geo, rest, reduced, stage, egg }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const chars = useMemo(() => [...text], [text]);
  const letters = useRef<(SVGGElement | null)[]>([]);
  const outlines = useRef<(SVGPathElement | null)[]>([]);
  const shadow = useRef<SVGEllipseElement>(null);
  const written = useRef<string[]>([]);
  const drawn = useRef<string[]>([]);
  const restOutlines = useMemo(() => chars.map((c) => glyphOutline(c, geo.size, poseAt(0, 1))), [chars, geo.size]);
  const inkTop = useMemo(() => reachInk(text).top, [text]);
  const period = chars.indexOf(".");
  const box = useMemo(() => (period >= 0 ? periodBox(rest.centers[period].y, geo.baselineY, rest.halfWidths[period]) : null), [period, rest, geo.baselineY]);
  const restX = period >= 0 ? rest.xs[period] + rest.halfWidths[period] : 0;
  const config = useRef<MotionConfig>({ size: geo.size, centers: rest.centers, reduced, egg: null, apply: () => {} });
  const motion = useWordMotion(stage, config, chars.length);

  // Before the loop's own layout effect on mount, and before every paint of
  // a new geometry: the next frame is written at the new size at once.
  useLayoutEffect(() => {
    written.current = [];
    drawn.current = [];
    const landing = { x: restX, y: geo.baselineY };
    let shownPhase = "";
    config.current = {
      size: geo.size,
      centers: rest.centers,
      reduced,
      egg: period >= 0 ? { state: egg, index: period, landing, reach: rippleReach(geo, landing) } : null,
      apply: (frames: readonly LetterFrame[], pose: EggPose, phase) => {
        const swelling = frames.some((f) => f.swell > 0);
        const xs = swelling ? swelledXs(text, geo, frames.map((f) => f.swell)) : rest.xs;
        frames.forEach((f, i) => {
          const g = letters.current[i];
          if (!g) return;
          const y = geo.baselineY + (1 - f.rise) * geo.riseDistance;
          const hop = i === period && box !== null && pose !== REST_POSE ? eggTransform(pose, box, geo.size, inkTop) : undefined;
          const transform = letterTransform(xs[i], y, rest.halfWidths[i], f.squash, hop);
          if (written.current[i] !== transform) {
            written.current[i] = transform;
            g.setAttribute("transform", transform);
          }
          const outline = outlines.current[i];
          const key = `${f.swell.toFixed(4)} ${f.squash.toFixed(4)}`;
          if (outline && drawn.current[i] !== key) {
            drawn.current[i] = key;
            outline.setAttribute("d", glyphOutline(chars[i], geo.size, poseAt(f.swell, f.squash)));
          }
        });
        const ground = shadow.current;
        if (ground && box) {
          const alpha = FOOTER.egg.shadow * pose.shadow;
          if (alpha <= 0.001) ground.setAttribute("display", "none");
          else {
            ground.removeAttribute("display");
            ground.setAttribute("cx", (xs[period] + rest.halfWidths[period]).toFixed(2));
            ground.setAttribute("rx", (0.75 * box.side * pose.shadowScale).toFixed(2));
            ground.setAttribute("ry", Math.max(1.5, 0.16 * box.side * pose.shadowScale).toFixed(2));
            ground.setAttribute("opacity", alpha.toFixed(3));
          }
        }
        if (phase !== shownPhase) {
          shownPhase = phase;
          stage.current?.setAttribute("data-word", phase);
        }
      },
    };
    motion.current.paint();
  }, [text, chars, geo, rest, reduced, egg, period, box, restX, inkTop, stage, motion]);

  const W = geo.stageW;
  const H = geo.stageH;
  const B = FOOTER.bleedPx;
  const coverTop = geo.wordTop - FOOTER.field.bandLeadPx;
  const hit = box ? Math.max(box.side + FOOTER.hitPx.pad, FOOTER.hitPx.min) : 0;

  return (
    <>
      <svg
        aria-hidden="true"
        focusable="false"
        data-wordmark
        data-baseline={geo.baselineY.toFixed(2)}
        data-size={geo.size.toFixed(2)}
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      >
        <defs>
          {chars.map((c, i) => (
            <path
              key={`glyph-${i}`}
              id={`${id}-glyph-${i}`}
              ref={(el) => {
                outlines.current[i] = el;
              }}
              d={restOutlines[i]}
            />
          ))}
          <g id={`${id}-word`}>
            {chars.map((c, i) => (
              <g
                key={`letter-${i}`}
                data-letter={c}
                ref={(el) => {
                  letters.current[i] = el;
                }}
              >
                <use href={`#${id}-glyph-${i}`} />
              </g>
            ))}
          </g>
          <clipPath id={`${id}-rise`} clipPathUnits="userSpaceOnUse">
            <rect x={0} y={0} width={W} height={Math.max(0, geo.clipBottom)} />
          </clipPath>
          <radialGradient id={`${id}-shadow`}>
            <stop offset={0} style={{ stopColor: "var(--color-accent)", stopOpacity: 1 }} />
            <stop offset={0.55} style={{ stopColor: "var(--color-accent)", stopOpacity: 0.55 }} />
            <stop offset={1} style={{ stopColor: "var(--color-accent)", stopOpacity: 0 }} />
          </radialGradient>
          <mask id={`${id}-holes`} maskUnits="userSpaceOnUse" x={-B} y={-B} width={W + 2 * B} height={H + 2 * B}>
            <rect x={-B} y={-B} width={W + 2 * B} height={H + 2 * B} fill="white" />
            <g clipPath={`url(#${id}-rise)`}>
              <use href={`#${id}-word`} fill="black" />
            </g>
          </mask>
        </defs>
        <rect
          data-footer-cover
          x={-B}
          y={coverTop}
          width={W + 2 * B}
          height={Math.max(0, H - coverTop + B)}
          mask={`url(#${id}-holes)`}
          style={{ fill: "var(--color-background)" }}
        />
        {box && (
          <ellipse
            ref={shadow}
            cx={restX}
            cy={geo.baselineY + 0.06 * box.side}
            rx={0.75 * box.side}
            ry={Math.max(1.5, 0.16 * box.side)}
            display="none"
            fill={`url(#${id}-shadow)`}
            mask={`url(#${id}-holes)`}
          />
        )}
        <g clipPath={`url(#${id}-rise)`} opacity={FOOTER.letterTint}>
          <use data-footer-tint href={`#${id}-word`} style={{ fill: "var(--color-accent)" }} />
        </g>
      </svg>
      {box && (
        <button
          type="button"
          aria-label={eggLabel}
          data-egg="period"
          onClick={() => {
            askEgg(egg);
            motion.current.wake();
          }}
          className="absolute z-20 cursor-pointer rounded-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          style={{ left: restX - hit / 2, top: geo.baselineY + box.cy - hit / 2, width: hit, height: hit }}
        />
      )}
    </>
  );
}
