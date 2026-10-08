import { BAR_D, BAR_PTS, BOLT_D, BOLT_PTS, BOLT_SPINE, GROUND_Y, IMPACT, LEG_D, LEG_PTS, type Point } from "@/lib/mark/geometry";

// The cel strike: hand-animated FX in code. Nothing here tweens. The strike is
// a list of frames on a stepped clock (12 to 30fps), each frame a full redraw,
// the way an FX animator works on twos: drawn poses that strobe on and off,
// each bigger and lower, the last one the mark's own bolt; a peak with spikes,
// whips and a keyed impact; then the excess energy breaks into shards that
// shrink and drift into sparks while the light on the ground decays.
//
// Every drawing is generated from the mark's own geometry by a seeded jagged
// outline routine (kinked spine ribbons for the build poses, an offset sheath
// for the peak, thorns for the spikes and shards) whose ranges were curated by eye against
// the reference; a seed is a take, and the site ships seed 7. The module
// is pure: no DOM and no GSAP, so the frame plan can be tested and reused.

type V = [number, number];
type Rand = () => number;

export type CelImpact = "crown" | "star" | "spray";
export type CelTone = "night" | "paper";
export type CelA = "flash" | "sparks";
export type CelSettings = {
  celFps: number;
  celFpp: number;
  celPoses: number;
  celBlanks: boolean;
  celBoil: number;
  celArcs: boolean;
  celGlowRadius: number;
  celGlow: number;
  celPoolSize: number;
  celPool: number;
  celImpact: CelImpact;
  celShards: number;
  celDrift: number;
  celFlash: number;
  celReach: number;
  celAfterglowMs: number;
  celTone: CelTone;
  celA: CelA;
  celSeed: number;
};

// mulberry32: tiny, fast, and the same take on every machine.
export function seeded(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 1831565813) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const add = (a: Point, b: Point): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Point, b: Point): V => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Point, k: number): V => [a[0] * k, a[1] * k];
const len = (a: Point) => Math.hypot(a[0], a[1]);
const unit = (a: Point): V => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
const perp = (a: Point): V => [-a[1], a[0]];
const lerp = (a: Point, b: Point, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const range = (r: Rand, lo: number, hi: number) => lo + (hi - lo) * r();
const signed = (r: Rand) => r() * 2 - 1;

function d(points: readonly Point[]) {
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}Z`;
}

const TIP: Point = BOLT_PTS[1];
const SPINE: readonly Point[] = [...BOLT_SPINE.slice(0, -1), IMPACT];
const CENTROID: Point = [140, 120];

function resample(line: readonly Point[], step: number) {
  const out: { p: V; tan: V; t: number }[] = [];
  const lengths = line.slice(1).map((p, i) => len(sub(p, line[i])));
  const total = lengths.reduce((a, b) => a + b, 0);
  const count = Math.max(2, Math.round(total / step));
  for (let k = 0; k <= count; k++) {
    let at = (k / count) * total;
    let i = 0;
    while (i < lengths.length - 1 && at > lengths[i]) at -= lengths[i++];
    const a = line[i];
    const b = line[i + 1];
    out.push({ p: lerp(a, b, at / lengths[i]), tan: unit(sub(b, a)), t: k / count });
  }
  return out;
}

// A build pose: a tapered ribbon along the bolt's own spine, scaled and
// turned about the bolt's top tip so each pose is bigger and lower. The spine
// is broken into hard zigzag kinks (the reference's poses are lines that kink,
// not blobs), the core is narrow with pinched necks and a few thorns, and a
// wider sheath sits behind it in the glow color.
function ribbon(r: Rand, scale: number, turn: number, width: number, boil: number) {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const spine = SPINE.map((p): V => {
    const v = mul(sub(p, TIP), scale);
    return add(TIP, [v[0] * cos - v[1] * sin, v[0] * sin + v[1] * cos]);
  });
  const samples = resample(spine, 2.6);
  const kinks: { t: number; o: number }[] = [{ t: 0, o: 0 }];
  let side = r() < 0.5 ? -1 : 1;
  for (let t = range(r, 0.06, 0.12); t < 0.94; t += range(r, 0.07, 0.13)) {
    kinks.push({ t, o: side * range(r, 2.5, 6.5) * (0.5 + scale) + boil * signed(r) * 1.4 });
    side = -side;
  }
  kinks.push({ t: 1, o: 0 });
  const offsetAt = (t: number) => {
    let k = 0;
    while (k < kinks.length - 2 && t > kinks[k + 1].t) k++;
    const a = kinks[k];
    const b = kinks[k + 1];
    return a.o + (b.o - a.o) * ((t - a.t) / (b.t - a.t || 1));
  };
  const coreL: V[] = [];
  const coreR: V[] = [];
  const sheathL: V[] = [];
  const sheathR: V[] = [];
  samples.forEach(({ p, tan, t }, i) => {
    const n = perp(tan);
    const profile = t < 0.18 ? 0.35 + 3.6 * t : Math.pow((1 - t) / 0.82, 0.75);
    let w = width * profile * range(r, 0.8, 1.15);
    if (i > 2 && r() < 0.1) w *= 0.3;
    const c = add(p, mul(n, offsetAt(t)));
    let wl = w / 2;
    let wr = w / 2;
    if (r() < 0.07) wl += range(r, 5, 12) * scale;
    if (r() < 0.07) wr += range(r, 5, 12) * scale;
    coreL.push(add(c, mul(n, wl)));
    coreR.push(sub(c, mul(n, wr)));
    const halo = w / 2 + (1.8 + 2.4 * scale) * range(r, 0.85, 1.2);
    sheathL.push(add(c, mul(n, halo)));
    sheathR.push(sub(c, mul(n, halo)));
  });
  const first = samples[0];
  const last = samples[samples.length - 1];
  const top = sub(first.p, mul(first.tan, 4 * scale));
  const tip = add(last.p, mul(last.tan, 3));
  return { core: d([top, ...coreL, tip, ...coreR.reverse()]), sheath: d([top, ...sheathL, tip, ...sheathR.reverse()]) };
}

function outward(points: readonly Point[]) {
  let area = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    area += p[0] * q[1] - q[0] * p[1];
  });
  const sign = area > 0 ? 1 : -1;
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    const e = sub(q, p);
    return mul(unit([e[1], -e[0]]), sign);
  });
}

// The peak's sheath: the bolt grown by a few units with mostly straight
// edges and a few V bites, in the glow color behind the white bolt. It also
// returns its rim (with outward normals) for thorns and shards.
function sheath(r: Rand, offset: number, boil: number, shape: readonly Point[] = BOLT_PTS) {
  const normals = outward(shape);
  const out: V[] = [];
  const rim: { p: V; n: V }[] = [];
  shape.forEach((p, i) => {
    const prev = normals[(i + normals.length - 1) % normals.length];
    const next = normals[i];
    const bis = unit(add(prev, next));
    const miter = Math.min(2.4, 1 / Math.max(0.3, bis[0] * next[0] + bis[1] * next[1]));
    out.push(add(p, mul(bis, offset * miter * range(r, 0.8, 1.3))));
    const q = shape[(i + 1) % shape.length];
    const steps = Math.ceil(len(sub(q, p)) / 8);
    for (let k = 1; k < steps; k++) {
      let push = offset * range(r, 0.7, 1.35) + boil * signed(r) * 1.6;
      if (r() < 0.2) push = offset * 0.15;
      const at = add(lerp(p, q, k / steps), mul(next, push));
      out.push(at);
      rim.push({ p: at, n: next });
    }
  });
  return { d: d(out), rim };
}

// White thorns off the sheath at the peak: long, narrow, sharp.
function thorns(r: Rand, rim: readonly { p: V; n: V }[], count: number) {
  return Array.from({ length: count }, () => {
    const { p, n } = rim[Math.floor(r() * rim.length)];
    const a = Math.atan2(n[1], n[0]) + signed(r) * 0.55;
    const dir: V = [Math.cos(a), Math.sin(a)];
    const base = mul(perp(dir), range(r, 1.6, 2.4));
    return d([add(p, base), add(p, mul(dir, range(r, 11, 28))), sub(p, base)]);
  });
}

// A shard or spark: a thorn, sharp at both ends with a bent belly.
function thorn(c: Point, angle: number, length: number, width: number, bend: number) {
  const along: V = [Math.cos(angle), Math.sin(angle)];
  const across = perp(along);
  const at = (x: number, y: number) => add(c, add(mul(along, x), mul(across, y)));
  return d([at(-length / 2, 0), at(-length / 7, -width / 2 - bend), at(length / 2, 0), at(length / 6, width / 2 - bend * 0.4)]);
}

function speck(c: Point, radius: number) {
  const k = radius;
  return d([add(c, [-k, 0]), add(c, [0, -k]), add(c, [k, 0]), add(c, [0, k])]);
}

// A whip: a tapered crescent beside the bolt, curved on its first frame and
// thrown straighter and wider on its second.
function whip(r: Rand, side: 1 | -1, frame: number) {
  const x = side === -1 ? range(r, 40, 58) : range(r, 214, 232);
  const y0 = range(r, 38, 70);
  const y1 = y0 + range(r, 52, 72);
  const out = frame * 12 * side;
  const start: V = [x + out + side * 6 * frame, y0 - frame * 6];
  const end: V = [x + out - side * (8 + frame * 14), y1 + frame * 4];
  const control: V = [x + out + side * (frame === 0 ? 26 : 8), (y0 + y1) / 2];
  const width = frame === 0 ? 3.4 : 2.2;
  const left: V[] = [];
  const right: V[] = [];
  for (let k = 0; k <= 14; k++) {
    const t = k / 14;
    const p = add(add(mul(start, (1 - t) * (1 - t)), mul(control, 2 * t * (1 - t))), mul(end, t * t));
    const tan = unit(add(mul(sub(control, start), 2 * (1 - t)), mul(sub(end, control), 2 * t)));
    const w = width * Math.pow(Math.sin(Math.PI * t), 0.8);
    left.push(add(p, mul(perp(tan), w / 2)));
    right.push(sub(p, mul(perp(tan), w / 2)));
  }
  return d([...left, ...right.reverse()]);
}

function crown(r: Rand, frame: number, scale: number) {
  const shapes: string[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const a = (-160 + (140 * i) / (count - 1) + signed(r) * 7) * (Math.PI / 180);
    const dir: V = [Math.cos(a), Math.sin(a)];
    const reach = [range(r, 14, 24), range(r, 30, 46), range(r, 42, 58)][frame] * scale;
    const from = [1, 9, 28][frame] * scale;
    const w = [4.6, 3, 1.6][frame];
    const base = add(IMPACT, mul(dir, from));
    const side = mul(perp(dir), w / 2);
    shapes.push(d([add(base, side), add(IMPACT, mul(dir, reach)), sub(base, side)]));
  }
  return shapes;
}

function star(r: Rand, frame: number, scale: number) {
  const c: V = [IMPACT[0], IMPACT[1] - 3];
  if (frame === 2) {
    return [0, 1, 2, 3].map((k) => {
      const a = (k * Math.PI) / 2 - Math.PI / 2 + 0.2;
      return speck(add(c, mul([Math.cos(a), Math.sin(a)], 30 * scale)), 1.1);
    });
  }
  const size = (frame === 0 ? 14 : 30) * scale;
  const pinch = frame === 0 ? 0.22 : 0.1;
  const twist = 0.12 + frame * 0.1 + signed(r) * 0.05;
  const points: V[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 - Math.PI / 2 + twist;
    const reach = k % 2 === 0 ? size * (k % 4 === 0 ? 1.25 : 0.9) : size * pinch;
    points.push(add(c, mul([Math.cos(a), Math.sin(a)], reach)));
  }
  return [d(points)];
}

type Shard = { c: V; angle: number; length: number; width: number; bend: number; dir: V; speed: number; life: number; ground: boolean };

function shardsFrom(r: Rand, rim: readonly { p: V; n: V }[], count: number, drift: number, impactSpray: boolean) {
  const shards: Shard[] = [];
  for (let i = 0; i < count; i++) {
    const k = Math.floor((i + r() * 0.8) * (rim.length / count)) % rim.length;
    const { p, n } = rim[k];
    const tan = perp(n);
    const ground = p[1] > 206;
    const away = unit(sub(p, CENTROID));
    const side = p[0] < IMPACT[0] ? -1 : 1;
    const dir: V = ground ? [side, -0.08] : unit(add(away, [signed(r) * 0.3, 0.15]));
    shards.push({
      c: [p[0], p[1]],
      angle: Math.atan2(tan[1], tan[0]) + signed(r) * 0.5,
      length: range(r, 13, 25),
      width: range(r, 3, 5.5),
      bend: signed(r) * 1.8,
      dir,
      speed: drift * (ground ? range(r, 34, 60) : range(r, 12, 30)),
      life: range(r, 0.55, 1),
      ground,
    });
  }
  const sprays = impactSpray ? Math.round(count * 0.6) : Math.round(count * 0.3);
  for (let i = 0; i < sprays; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    shards.push({
      c: [IMPACT[0] + side * range(r, 2, 8), GROUND_Y - range(r, 1, 5)],
      angle: side === 1 ? range(r, -0.25, 0) : Math.PI + range(r, 0, 0.25),
      length: range(r, 7, 13),
      width: range(r, 1.6, 2.6),
      bend: signed(r) * 0.6,
      dir: [side, -range(r, 0.02, 0.16)],
      speed: drift * range(r, 38, 78),
      life: range(r, 0.6, 1),
      ground: true,
    });
  }
  return shards;
}

function shardAt(s: Shard, u: number) {
  if (u >= s.life) return null;
  const v = u / s.life;
  const eased = 1 - (1 - v) * (1 - v);
  const c = add(s.c, add(mul(s.dir, s.speed * eased), [0, s.ground ? 0 : 5 * v * v]));
  const size = Math.pow(1 - v, 0.9);
  const angle = s.ground ? Math.atan2(s.dir[1], s.dir[0]) : s.angle;
  if (size > 0.5) return thorn(c, angle, s.length * size, s.width * size, s.bend * size);
  if (size > 0.18) return thorn(c, Math.atan2(s.dir[1], s.dir[0]), s.length * (0.35 + size), 1.1, 0);
  return speck(c, 1);
}

// The "sparks" A: pieces of the peak's sheath that fly down into the A's
// outline instead of out, so the excess energy is what makes the letter.
function returning(r: Rand, rim: readonly { p: V; n: V }[], count: number) {
  const outline = [...LEG_PTS, ...BAR_PTS];
  return Array.from({ length: count }, (_, i) => {
    const a = outline[Math.floor(r() * outline.length)];
    const b = outline[Math.floor(r() * outline.length)];
    const end = lerp(a, b, r() * 0.3);
    const start = rim[Math.floor(((i + r()) * rim.length) / count) % rim.length].p;
    return { start, end };
  });
}

export type CelFrame = {
  sheath: string[];
  fx: string[];
  bolt: boolean;
  a: boolean;
  glow: number;
  pool: number;
  bloom: number;
};

export type CelPlan = {
  fps: number;
  lead: number;
  frames: CelFrame[];
  impactFrame: number;
  aFrame: number;
  tone: CelTone;
  fullFlash: number;
  glowRadius: number;
  poolSize: number;
};

// When things happen, in frames. Pure arithmetic, shared with the beats the
// card and the panel read.
export function celSchedule(s: CelSettings) {
  const fps = s.celFps;
  const fpp = s.celFpp;
  const build = (s.celPoses - 1) * (fpp + (s.celBlanks ? 1 : 0));
  const impactFrame = build;
  const peak = Math.max(2, fpp);
  const aFrame = impactFrame + 1 + (s.celA === "sparks" ? 4 : 0);
  const breakup = Math.max(4, Math.round(0.4 * fps));
  const afterglow = Math.max(2, Math.round((s.celAfterglowMs / 1000) * fps));
  const breakupFrom = s.celA === "sparks" ? aFrame - impactFrame : peak;
  const count = Math.max(impactFrame + breakupFrom + breakup, aFrame + afterglow) + 1;
  const lead = s.celTone === "night" ? 0.1 : 0;
  const lift = s.celTone === "night" ? 0.3 : 0;
  return { fps, fpp, peak, impactFrame, aFrame, breakup, afterglow, count, lead, lift };
}

export function celPlan(s: CelSettings): CelPlan {
  const sch = celSchedule(s);
  const { fpp, impactFrame, aFrame, peak, breakup, afterglow, count } = sch;
  const frames: CelFrame[] = [];
  const boil = s.celBoil;
  const size = s.celPoolSize;
  const poseScales = Array.from({ length: s.celPoses - 1 }, (_, k) => 0.3 + (0.42 * k) / Math.max(1, s.celPoses - 2));

  // The rim the shards break from: the sheath of the last peak frame.
  const rim = sheath(seeded(s.celSeed * 31 + 5), 5.5, 0).rim;
  const shards = shardsFrom(seeded(s.celSeed * 17 + 3), rim, s.celShards, s.celDrift, s.celImpact === "spray");
  const sparks = returning(seeded(s.celSeed * 13 + 11), rim, 16);
  const breakupFrom = s.celA === "sparks" ? aFrame - impactFrame : peak;

  let f = 0;
  let pool = 0;
  poseScales.forEach((scale, k) => {
    const level = ((k + 1) / s.celPoses) * s.celPool;
    for (let h = 0; h < fpp; h++, f++) {
      // Each pose is its own drawing (its own seed); a held frame boils.
      const r = seeded(s.celSeed * 977 + k * 131 + h * 7);
      const turn = (k % 2 === 0 ? -1 : 1) * 0.08 + signed(seeded(s.celSeed + k)) * 0.04;
      pool = level;
      const pose = ribbon(r, scale, turn, 4 + 7 * scale, h * boil);
      frames.push({ sheath: [pose.sheath], fx: [pose.core], bolt: false, a: false, glow: 1, pool, bloom: 0 });
    }
    if (s.celBlanks) {
      pool *= 0.55;
      frames.push({ sheath: [], fx: [], bolt: false, a: false, glow: 0, pool, bloom: 0 });
      f++;
    }
  });

  for (; f < count; f++) {
    const i = f - impactFrame;
    const fx: string[] = [];
    const sheaths: string[] = [];
    const r = seeded(s.celSeed * 389 + f * 17);
    if (i < peak) {
      const peakSheath = sheath(r, 7.5 + boil, i === 0 ? 0 : boil);
      sheaths.push(peakSheath.d);
      fx.push(...thorns(r, peakSheath.rim, 10));
      if (s.celArcs && i < 2) fx.push(whip(seeded(s.celSeed * 7 + 1 + i), -1, i), whip(seeded(s.celSeed * 7 + 2 + i), 1, i));
    }
    if (i < 3) {
      if (s.celImpact === "crown") fx.push(...crown(seeded(s.celSeed * 3 + i), i, 1));
      if (s.celImpact === "star") fx.push(...star(seeded(s.celSeed * 3 + i), i, 1));
    }
    // The A arrives charged: one frame in its own sheath, then bare.
    if (f === aFrame) {
      sheaths.push(sheath(seeded(s.celSeed * 59 + 1), 4.5, 0, LEG_PTS).d, sheath(seeded(s.celSeed * 59 + 2), 4, 0, BAR_PTS).d);
    }
    if (i >= breakupFrom && i < breakupFrom + breakup) {
      const u = (i - breakupFrom + 1) / breakup;
      shards.forEach((shard) => {
        const shape = shardAt(shard, u);
        if (shape) fx.push(shape);
      });
    }
    if (s.celA === "sparks" && f > impactFrame && f < aFrame) {
      const u = (f - impactFrame) / (aFrame - impactFrame);
      sparks.forEach(({ start, end }) => {
        const p = lerp(start, end, u * u);
        const dir = sub(end, start);
        fx.push(thorn(p, Math.atan2(dir[1], dir[0]), 6 + 12 * (1 - u), 2.4, 0));
      });
    }
    const sinceA = f - aFrame;
    let glow = f < aFrame ? 1 : Math.max(0, 1 - Math.pow(sinceA / afterglow, 1.5));
    if (sinceA === Math.round(afterglow * 0.7)) glow = Math.min(1, glow + 0.45);
    const sinceImpact = Math.max(0, i);
    pool = s.celPool * Math.max(0, 1 - sinceImpact / (breakupFrom + breakup)) * (i < peak ? 1 : 0.85);
    frames.push({
      sheath: sheaths,
      fx,
      bolt: true,
      a: f >= aFrame,
      glow: f === count - 1 ? 0 : glow,
      pool: f === count - 1 ? 0 : pool,
      bloom: i === 0 ? s.celFlash : 0,
    });
  }

  return {
    fps: sch.fps,
    lead: sch.lead,
    frames,
    impactFrame,
    aFrame,
    tone: s.celTone,
    fullFlash: s.celReach >= 1 ? s.celFlash : 0,
    glowRadius: s.celGlowRadius,
    poolSize: size,
  };
}

// One frame as SVG markup. Colors come from --cel-core and --cel-glow, set on
// the layer from tokens; the last frame has no glow and is the three exact
// paths, so the swap to AsMark is invisible.
export function celMarkup(plan: CelPlan, index: number, ids: { glow: string; wide: string; pool: string; bloom: string }, s: CelSettings) {
  const frame = plan.frames[index];
  if (!frame) return "";
  const mark = `${frame.bolt ? `<path d="${BOLT_D}"/>` : ""}${frame.a ? `<path d="${LEG_D}"/><path d="${BAR_D}"/>` : ""}`;
  const fx = frame.fx.map((shape) => `<path d="${shape}"/>`).join("");
  const parts: string[] = [];
  if (frame.pool > 0.01) {
    const k = plan.poolSize;
    parts.push(
      `<g opacity="${frame.pool.toFixed(3)}" filter="url(#${ids.pool})" style="fill:var(--cel-glow)">` +
        `<ellipse cx="${IMPACT[0]}" cy="${GROUND_Y + 3}" rx="${58 * k}" ry="3.4"/>` +
        `<ellipse cx="${IMPACT[0] - 14 * k}" cy="${GROUND_Y + 7}" rx="${78 * k}" ry="2"/>` +
        `<ellipse cx="${IMPACT[0] + 10 * k}" cy="${GROUND_Y + 10}" rx="${44 * k}" ry="1.6"/></g>`,
    );
  }
  if (frame.bloom > 0 && s.celReach < 1) {
    parts.push(
      `<circle cx="${IMPACT[0]}" cy="${IMPACT[1] - 60}" r="${50 + s.celReach * 110}" opacity="${frame.bloom.toFixed(3)}" filter="url(#${ids.bloom})" style="fill:var(--cel-glow)"/>`,
    );
  }
  const sheathMarkup = frame.sheath.map((shape) => `<path d="${shape}"/>`).join("");
  const glow = frame.glow * s.celGlow;
  if (glow > 0.01) {
    const body = `${sheathMarkup}${fx}${mark}`;
    parts.push(`<g opacity="${glow.toFixed(3)}" filter="url(#${ids.wide})" style="fill:var(--cel-glow);stroke:var(--cel-glow);stroke-width:4">${body}</g>`);
    parts.push(`<g opacity="${glow.toFixed(3)}" filter="url(#${ids.glow})" style="fill:var(--cel-glow);stroke:var(--cel-glow);stroke-width:2">${body}</g>`);
  }
  if (sheathMarkup) parts.push(`<g style="fill:var(--cel-glow)">${sheathMarkup}</g>`);
  parts.push(`<g style="fill:var(--cel-core)">${fx}${mark}</g>`);
  return parts.join("");
}

// The strike's beats in seconds: the frames run after the night dip's lead,
// and the mark is settled once the dip has lifted.
export function celBeats(s: CelSettings) {
  const c = celSchedule(s);
  const framesEnd = c.lead + c.count / c.fps;
  return { impact: c.lead + c.impactFrame / c.fps, aStart: c.lead + c.aFrame / c.fps, framesEnd, settle: framesEnd + c.lift };
}
