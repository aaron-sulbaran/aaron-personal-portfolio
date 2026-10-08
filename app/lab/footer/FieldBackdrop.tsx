"use client";

import { useEffect, useRef, useState } from "react";
import { canCreateWebGL2 } from "@/components/coil/webglProbe";
import { FIELD } from "@/lib/coil/field.glsl";
import { DRIFT_PRESETS, fieldClocks, type DriftPreset } from "@/lib/coil/drift";
import type { Theme } from "@/lib/theme";
import { createFieldGl, type FieldGl } from "./fieldGl";
import { readDocumentTokens, type FieldTokens } from "./tokens";

// The footer's field: the site's shader in WebGL 2 when a context can be
// made, else the hero's own poster (public/coil/field-{light,dark}.avif, the
// live field's first frame) recolored in a 2D canvas with the same intensity
// law and drifted by CSS. Aaron's Chrome has graphics acceleration off, so
// the stand-in is a real surface, not a courtesy.

export type BackdropKind = "webgl" | "standin" | "standin-forced";

type Props = {
  theme: Theme;
  intensity: number;
  drift: DriftPreset;
  forceStandIn: boolean;
  reduced: boolean;
  onKind: (kind: BackdropKind) => void;
};

// The poster carries the hero's seam fade in its last 14 percent; the
// stand-in crops it off, since the footer draws its own endings.
const POSTER_CROP = 1 - FIELD.seamFade;
const STANDIN_WIDTH = 480;
const DRIFT_SECONDS: Record<DriftPreset, number> = { calm: 40, visible: 22, lively: 14 };

function recolor(ctx: CanvasRenderingContext2D, image: HTMLImageElement, tokens: FieldTokens, intensity: number) {
  const { width, height } = ctx.canvas;
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight * POSTER_CROP, 0, 0, width, height);
  if (intensity === 1) return;
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  const paper = tokens.paper.map((c) => c * 255);
  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, paper[c] + (px[i + c] - paper[c]) * intensity));
  }
  ctx.putImageData(data, 0, 0);
}

export function FieldBackdrop({ theme, intensity, drift, forceStandIn, reduced, onKind }: Props) {
  const glCanvas = useRef<HTMLCanvasElement>(null);
  const standCanvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ intensity, drift, reduced, tokens: null as FieldTokens | null });
  // Mounted only on the client (the stage renders it after measuring), so
  // the probe can run in the initializer.
  const [webglOk] = useState(() => canCreateWebGL2());
  const [glFailed, setGlFailed] = useState(false);
  const kind: BackdropKind = forceStandIn ? "standin-forced" : webglOk && !glFailed ? "webgl" : "standin";

  useEffect(() => {
    live.current.intensity = intensity;
    live.current.drift = drift;
    live.current.reduced = reduced;
  }, [intensity, drift, reduced]);

  useEffect(() => {
    live.current.tokens = readDocumentTokens(theme === "dark");
  }, [theme]);

  useEffect(() => onKind(kind), [kind, onKind]);

  useEffect(() => {
    if (kind !== "webgl" || !glCanvas.current) return;
    const canvas = glCanvas.current;
    const field: FieldGl | null = createFieldGl(canvas);
    if (!field) {
      const id = requestAnimationFrame(() => setGlFailed(true));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    let visible = true;
    const start = performance.now();
    const size = () => field.resize(canvas.clientWidth / FIELD.divisor, canvas.clientHeight / FIELD.divisor);
    const frame = (now: number) => {
      const { tokens, drift: preset, reduced: still } = live.current;
      if (tokens) {
        const clocks = fieldClocks(still ? 0 : (now - start) / 1000, false, preset);
        field.draw({ orange: clocks.orange, weather: clocks.weather, warp: DRIFT_PRESETS[preset].warp, intensity: live.current.intensity, tokens });
      }
      raf = visible ? requestAnimationFrame(frame) : 0;
    };
    const resize = new ResizeObserver(size);
    resize.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    seen.observe(canvas);
    size();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      seen.disconnect();
      field.dispose();
    };
  }, [kind]);

  useEffect(() => {
    if (kind === "webgl" || !standCanvas.current) return;
    const ctx = standCanvas.current.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const tokens = readDocumentTokens(theme === "dark");
      ctx.canvas.width = STANDIN_WIDTH;
      ctx.canvas.height = Math.round((STANDIN_WIDTH * image.naturalHeight * POSTER_CROP) / image.naturalWidth);
      recolor(ctx, image, tokens, intensity);
    };
    image.src = `/coil/field-${theme}.avif`;
    return () => {
      cancelled = true;
    };
  }, [kind, theme, intensity]);

  if (kind === "webgl") return <canvas key="gl" ref={glCanvas} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
  return (
    <canvas
      key="standin"
      ref={standCanvas}
      aria-hidden="true"
      className="footer-lab-drift absolute inset-0 h-full w-full object-cover"
      style={{ animationDuration: `${DRIFT_SECONDS[drift]}s`, animationPlayState: reduced ? "paused" : "running" }}
    />
  );
}
