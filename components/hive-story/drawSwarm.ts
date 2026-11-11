import { lerp, pointAt, type Point } from "@/lib/hive-story/dots";
import {
  CHECK_TICKS,
  FADE_OUT,
  GLOWS,
  REJECT,
  TAP_AT,
  beesFor,
  checkCenter,
  envelope,
  staticDots,
  type Bee,
  type FlowLayout,
} from "@/lib/hive-story/flow";

// One frame of the Hive's bees, drawn on the canvas that sits under the static
// SVG: the glow where bees arrive, the bees themselves, the nightly check's
// ticks and the author's tap. The SVG above it owns every still dot and word.

export type SwarmModel = { layout: FlowLayout; bees: Bee[] };
export type SwarmColors = { bee: string; glow: string };

export function buildSwarm(layout: FlowLayout): SwarmModel {
  return { layout, bees: beesFor(layout, staticDots(layout)) };
}

const seg = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function hexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 90);
    if (k) ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
    else ctx.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
  }
  ctx.closePath();
}

function beeAt(b: Bee, t: number): { p: Point; alpha: number; landed: number } | null {
  const u = (t - b.start) / b.duration;
  if (u < 0) return null;
  const hop = b.slot ? 0.22 : 0;
  if (u >= 1) {
    if (!b.slot) return null;
    const landed = ((u - 1) * b.duration) / 0.5;
    return landed < 1 ? { p: b.slot, alpha: 0, landed } : null;
  }
  let alpha = Math.min(1, u / 0.08);
  if (u < 1 - hop || !b.slot) {
    const g = easeInOut(Math.min(1, u / (1 - hop)));
    const on = pointAt(b.path, g);
    const wobble = Math.sin(Math.PI * g);
    if (!b.slot && g > 0.85) alpha *= (1 - g) / 0.15;
    return { p: { x: on.x + b.jitter.x * wobble, y: on.y + b.jitter.y * wobble }, alpha, landed: -1 };
  }
  const end = b.path.pts[b.path.pts.length - 1];
  const k = easeOut((u - (1 - hop)) / hop);
  return { p: { x: lerp(end.x, b.slot.x, k), y: lerp(end.y, b.slot.y, k) }, alpha, landed: -1 };
}

export function drawSwarm(ctx: CanvasRenderingContext2D, model: SwarmModel, t: number, colors: SwarmColors) {
  const { layout: l, bees } = model;
  const tall = l.name === "tall";
  const out = 1 - seg(t, FADE_OUT[0], FADE_OUT[1]);

  for (const [key, at] of GLOWS) {
    const e = envelope(t - at) * out;
    if (e <= 0) continue;
    ctx.globalAlpha = e * 0.6;
    ctx.fillStyle = colors.glow;
    if (key === "hive") hexagon(ctx, l.hive.cx, l.hive.cy, l.hive.R + (tall ? 7 : 10));
    else {
      const b = l.nodes[key];
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, b.r);
    }
    ctx.fill();
  }

  ctx.fillStyle = colors.bee;
  ctx.strokeStyle = colors.bee;
  const check = l.nodes.check;
  const ticks = seg(t, CHECK_TICKS[0], CHECK_TICKS[1]);
  if (t > CHECK_TICKS[0] && t < CHECK_TICKS[1] + 0.6) {
    ctx.globalAlpha = out;
    for (let i = 0; i < 3; i++) if (ticks > i / 3) dot(ctx, check.x + check.w - (tall ? 30 : 44) + i * (tall ? 8 : 12), check.y + check.h / 2, tall ? 2.2 : 3);
  }

  const r = l.size.bee;
  ctx.lineWidth = tall ? 1 : 1.3;
  for (const b of bees) {
    const at = beeAt(b, t);
    if (!at) continue;
    if (at.landed >= 0) {
      ctx.globalAlpha = (1 - at.landed) * 0.5 * out;
      ring(ctx, at.p.x, at.p.y, r * (1.2 + 2 * at.landed));
    } else {
      ctx.globalAlpha = at.alpha * out;
      dot(ctx, at.p.x, at.p.y, r);
    }
  }

  l.rejects.forEach((rj, i) => {
    const u = (t - REJECT.start - i * REJECT.stagger) / REJECT.duration;
    if (u < 0 || u > 1) return;
    const e = easeOut(u);
    ctx.globalAlpha = (1 - u) * out;
    ring(ctx, lerp(rj.from.x, rj.to.x, e), lerp(rj.from.y, rj.to.y, e), r * 0.85);
  });

  const tap = envelope(t - TAP_AT) * out;
  if (tap > 0) {
    const c = checkCenter(l);
    ctx.globalAlpha = tap * 0.6;
    ring(ctx, c.x, c.y, (tall ? 10 : 14) + tap * 4);
  }
  ctx.globalAlpha = 1;
}
