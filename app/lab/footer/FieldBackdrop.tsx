"use client";

import { useEffect, useRef, useState } from "react";
import { canCreateWebGL2 } from "@/components/coil/webglProbe";
import { FIELD } from "@/lib/coil/field.glsl";
import { DEFAULT_DRIFT, DRIFT_PRESETS, fieldClocks } from "@/lib/coil/drift";
import type { Theme } from "@/lib/theme";
import { FIELD_RING_WIDTH, FIELD_SHINE, rippleAmp, rippleRadius, type EggShape, type EggState } from "./egg";
import { createFieldGl, MAX_RIPPLES, type RippleRing } from "./fieldGl";
import { heroFrame } from "./heroField";
import { createHeroFieldGl, type HeroLetters } from "./heroFieldGl";
import type { FooterSettings } from "./settings";
import { drawStandIn, posterBox, STANDIN_WIDTH } from "./standIn";
import { readDocumentTokens, readNameTokens, type FieldTokens, type NameTokens } from "./tokens";

// The footer's field. With WebGL 2: the hero's own (its field on its drift
// and framing, upsampled with its dither, the hero name's surface in the
// letters) or the lab's footer-framed field (rounds 1 to 3), the egg's
// ripple rings running through either. Without it, the poster stand-in.
// Paused off screen; under reduced motion it draws the poster's moment once
// and holds it.

export type BackdropKind = "webgl" | "standin" | "standin-forced";

type Props = {
  theme: Theme;
  field: FooterSettings["field"];
  canvasIntensity: number; // the footer backdrop's depth (the deeper of its two, fieldDepths)
  letters: HeroLetters | null; // hero backdrop, clip: the letters' band and the word
  wordMidY: number; // stage px: the word's middle, which the hero frame sets where the hero's name sits
  egg: EggState;
  eggShape: EggShape;
  unitPx: number; // the wordmark's ascender height
  forceStandIn: boolean;
  reduced: boolean;
  onKind: (kind: BackdropKind) => void;
};

const DRIFT_SECONDS = { calm: 40, visible: 22, lively: 14 } as const;

function dprCap() {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return Math.min(window.devicePixelRatio || 1, coarse ? 2 : 1.75);
}

// The live ripples as rings in canvas px (the canvas is flipped when the field is).
function ringsOf(egg: EggState, e: EggShape, now: number, unitPx: number, stageH: number, flip: boolean): RippleRing[] {
  return egg.ripples
    .slice(-MAX_RIPPLES)
    .map((r) => {
      const t = (now - r.t0) / 1000;
      const amp = rippleAmp(t, e.rippleDecay);
      return {
        x: r.x,
        y: flip ? stageH - r.y : r.y,
        radius: rippleRadius(t, e.rippleSpeed) * unitPx,
        push: t < 0 ? 0 : e.rippleField * unitPx * amp,
        shine: t < 0 ? 0 : Math.min(0.85, FIELD_SHINE * e.rippleField * amp),
      };
    });
}

export function FieldBackdrop({ theme, field, canvasIntensity, letters, wordMidY, egg, eggShape, unitPx, forceStandIn, reduced, onKind }: Props) {
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const standCanvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ field, canvasIntensity, letters, wordMidY, eggShape, unitPx, reduced, tokens: null as FieldTokens | null, name: null as NameTokens | null });
  const kick = useRef<() => void>(() => {});
  // Mounted only on the client (the stage renders it after measuring), so
  // the probe can run in the initializer.
  const [webglOk] = useState(() => canCreateWebGL2());
  const [glFailed, setGlFailed] = useState(false);
  const kind: BackdropKind = forceStandIn ? "standin-forced" : webglOk && !glFailed ? "webgl" : "standin";
  const mode = field.backdrop;

  useEffect(() => {
    Object.assign(live.current, { field, canvasIntensity, letters, wordMidY, eggShape, unitPx, reduced });
    kick.current();
  }, [field, canvasIntensity, letters, wordMidY, eggShape, unitPx, reduced]);

  useEffect(() => {
    const tokens = readDocumentTokens(theme === "dark");
    live.current.tokens = tokens;
    live.current.name = readNameTokens(tokens.paper);
    kick.current();
  }, [theme]);

  useEffect(() => onKind(kind), [kind, onKind]);

  useEffect(() => {
    if (kind !== "webgl" || !glCanvas.current) return;
    const canvas = glCanvas.current;
    const hero = mode === "hero" ? createHeroFieldGl(canvas) : null;
    const plain = mode === "hero" ? null : createFieldGl(canvas);
    if (!hero && !plain) {
      const id = requestAnimationFrame(() => setGlFailed(true));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    let visible = true;
    let last = performance.now();
    let elapsed = 0; // the field's clock, s: it runs only while drawn, as the hero's does
    const size = () => {
      if (hero) hero.resize(canvas.clientWidth, canvas.clientHeight, dprCap());
      else plain?.resize(canvas.clientWidth / FIELD.divisor, canvas.clientHeight / FIELD.divisor);
    };
    const frame = (now: number) => {
      raf = 0;
      const { tokens, name, field: f, reduced: still } = live.current;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (!still) elapsed += dt;
      const t = still ? 0 : elapsed;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const rings = still ? [] : ringsOf(egg, live.current.eggShape, now, live.current.unitPx, h, f.flip);
      const ringWidthPx = FIELD_RING_WIDTH * live.current.unitPx;
      if (tokens && name && hero) {
        const frameOf = heroFrame(w, h, window.innerHeight, f.flip ? h - live.current.wordMidY : live.current.wordMidY);
        const clocks = fieldClocks(t, false, DEFAULT_DRIFT);
        hero.draw({
          orange: clocks.orange,
          weather: clocks.weather,
          warp: DRIFT_PRESETS[DEFAULT_DRIFT].warp,
          intensity: 1,
          tokens,
          aspect: frameOf.aspect,
          frameY: frameOf.frameY,
          frameY0: frameOf.frameY0,
          stagePx: [w, h],
          rings,
          ringWidthPx,
          behind: f.intensity,
          letters: live.current.letters,
          name,
          surfaceS: t,
          flip: f.flip,
          viewportH: window.innerHeight,
        });
      } else if (tokens && plain) {
        const clocks = fieldClocks(t, false, f.drift);
        plain.draw({
          orange: clocks.orange,
          weather: clocks.weather,
          warp: DRIFT_PRESETS[f.drift].warp,
          intensity: live.current.canvasIntensity,
          tokens,
          aspect: canvas.width / Math.max(1, canvas.height),
          frameY: 1,
          frameY0: 0,
          stagePx: [w, h],
          rings,
          ringWidthPx,
        });
      }
      if (visible && !still) raf = requestAnimationFrame(frame);
    };
    kick.current = () => {
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const resize = new ResizeObserver(() => {
      size();
      kick.current();
    });
    resize.observe(canvas);
    const onViewport = () => kick.current();
    window.addEventListener("resize", onViewport);
    const seen = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      kick.current();
    });
    seen.observe(canvas);
    size();
    kick.current();
    return () => {
      cancelAnimationFrame(raf);
      kick.current = () => {};
      resize.disconnect();
      seen.disconnect();
      window.removeEventListener("resize", onViewport);
      hero?.dispose();
      plain?.dispose();
    };
  }, [kind, mode, egg]);

  const intensity = canvasIntensity;
  useEffect(() => {
    if (kind === "webgl" || !standCanvas.current) return;
    const canvas = standCanvas.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let cancelled = false;
    const image = new Image();
    const draw = () => {
      if (cancelled || !image.naturalWidth) return;
      const tokens = readDocumentTokens(theme === "dark");
      const stageW = Math.max(1, canvas.clientWidth);
      const stageH = Math.max(1, canvas.clientHeight);
      const scale = STANDIN_WIDTH / stageW;
      ctx.canvas.width = STANDIN_WIDTH;
      ctx.canvas.height = mode === "hero" ? Math.max(1, Math.round(stageH * scale)) : Math.round((STANDIN_WIDTH * image.naturalHeight * (1 - FIELD.seamFade)) / image.naturalWidth);
      const mid = field.flip ? stageH - wordMidY : wordMidY;
      const box = posterBox(mode, ctx.canvas.width, ctx.canvas.height, image.naturalWidth, image.naturalHeight, window.innerHeight * scale, mid * scale);
      drawStandIn(ctx, image, box, tokens, intensity);
    };
    image.onload = draw;
    image.src = `/coil/field-${theme}.avif`;
    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    return () => {
      cancelled = true;
      resize.disconnect();
    };
  }, [kind, theme, intensity, mode, wordMidY, field.flip]);

  if (kind === "webgl") return <canvas key={`gl-${mode}`} ref={glCanvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
  return (
    <canvas
      key="standin"
      ref={standCanvas}
      aria-hidden="true"
      className={`footer-lab-drift absolute inset-0 h-full w-full ${mode === "hero" ? "" : "object-cover"}`}
      style={{ animationDuration: `${DRIFT_SECONDS[mode === "hero" ? DEFAULT_DRIFT : field.drift]}s`, animationPlayState: reduced ? "paused" : "running" }}
    />
  );
}
