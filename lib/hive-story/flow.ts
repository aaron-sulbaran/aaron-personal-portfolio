import {
  checkDots,
  dedupe,
  dotsAlong,
  hexHalfWidth,
  hexLattice,
  preparePath,
  questionDots,
  roundedRectDots,
  seeded,
  type Path,
  type Point,
} from "./dots";

// The Hive's flow, drawn in bees: Discord and Drive into the archive every hour,
// the nightly fact check into the Hive, and, next, AI session notes down the
// fast lane and out to the team page, everyone's AI, and Beekeeper. Two layouts
// share one timeline: "wide" (a row, desktops) and "tall" (a column, phones).

export type NodeKey = "discord" | "drive" | "notes" | "archive" | "check" | "page" | "ai" | "bee";
export type PathKey = "d2a" | "r2a" | "a2c" | "c2h" | "cq" | "n2h" | "h2p" | "h2i" | "h2b";
export type LayoutName = "wide" | "tall";
export type Box = { x: number; y: number; w: number; h: number; r: number };
type Anchor = "start" | "middle";
type Label = { x: number; y: number; anchor: Anchor };

export type FlowLayout = {
  name: LayoutName;
  width: number;
  height: number;
  nodes: Record<NodeKey, Box>;
  hive: { cx: number; cy: number; R: number };
  question: { cx: number; cy: number; r: number; step: number };
  paths: Record<PathKey, Point[]>;
  labels: { hive: Label; hiveSub: Label; question: Label; lane: Label };
  rejects: { from: Point; to: Point }[];
  size: {
    label: number; sub: number; nodePad: number; labelY: number; subY: number;
    nodeDot: number; nodeStep: number; nextDot: number; nextStep: number;
    traceDot: number; traceStep: number; combDot: number; combStep: number;
    glyphDot: number; checkSize: number; checkDot: number; bee: number;
  };
};

/** What runs today versus what is next; next parts are drawn in open dots. */
export const NEXT_NODES: ReadonlySet<NodeKey> = new Set(["notes", "page", "ai", "bee"]);
export const NEXT_PATHS: ReadonlySet<PathKey> = new Set(["n2h", "h2p", "h2i", "h2b"]);

const right = (b: Box) => ({ x: b.x + b.w, y: b.y + b.h / 2 });
const left = (b: Box) => ({ x: b.x, y: b.y + b.h / 2 });
const bottom = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h });
const top = (b: Box) => ({ x: b.x + b.w / 2, y: b.y });
const across = (a: Box, b: Box) => { const p = right(a), q = left(b), mx = (p.x + q.x) / 2; return [p, { x: mx, y: p.y }, { x: mx, y: q.y }, q]; };
const down = (a: Box, b: Box) => { const p = bottom(a), q = top(b), my = (p.y + q.y) / 2; return [p, { x: p.x, y: my }, { x: q.x, y: my }, q]; };

function wide(): FlowLayout {
  const box = (x: number, y: number): Box => ({ x, y, w: 172, h: 58, r: 14 });
  const nodes: Record<NodeKey, Box> = {
    discord: box(40, 32), drive: box(40, 134), notes: box(40, 322),
    archive: box(320, 83), check: box(600, 83),
    page: box(1100, 84), ai: box(1100, 183), bee: box(1100, 282),
  };
  const hive = { cx: 930, cy: 212, R: 78 };
  const hl = hive.cx - hexHalfWidth(hive.R, 0);
  const hr = hive.cx + hexHalfWidth(hive.R, 0);
  const question = { cx: 930, cy: 366, r: 12, step: 6.5 };
  return {
    name: "wide", width: 1312, height: 424, nodes, hive, question,
    paths: {
      d2a: across(nodes.discord, nodes.archive), r2a: across(nodes.drive, nodes.archive), a2c: across(nodes.archive, nodes.check),
      c2h: [right(nodes.check), { x: 817, y: 112 }, { x: 817, y: 212 }, { x: hl, y: 212 }],
      cq: [right(nodes.check), { x: 817, y: 112 }, { x: 817, y: 366 }, { x: 912, y: 366 }],
      n2h: [right(nodes.notes), { x: 537, y: 351 }, { x: 537, y: 212 }, { x: hl, y: 212 }],
      h2p: [{ x: hr, y: 212 }, { x: 1049, y: 212 }, { x: 1049, y: 113 }, left(nodes.page)],
      h2i: [{ x: hr, y: 212 }, left(nodes.ai)],
      h2b: [{ x: hr, y: 212 }, { x: 1049, y: 212 }, { x: 1049, y: 311 }, left(nodes.bee)],
    },
    labels: {
      hive: { x: hive.cx, y: 112, anchor: "middle" }, hiveSub: { x: hive.cx, y: 127, anchor: "middle" },
      question: { x: 950, y: 371, anchor: "start" }, lane: { x: 232, y: 341, anchor: "start" },
    },
    rejects: [{ from: { x: 600, y: 112 }, to: { x: 548, y: 96 } }, { from: { x: 600, y: 112 }, to: { x: 548, y: 128 } }],
    size: {
      label: 15, sub: 12.5, nodePad: 16, labelY: 26, subY: 44,
      nodeDot: 1.7, nodeStep: 7, nextDot: 1.9, nextStep: 9, traceDot: 1.3, traceStep: 9,
      combDot: 2.6, combStep: 8.6, glyphDot: 2.4, checkSize: 24, checkDot: 2, bee: 3.4,
    },
  };
}

function tall(): FlowLayout {
  const box = (x: number, y: number, w = 100): Box => ({ x, y, w, h: 46, r: 11 });
  const nodes: Record<NodeKey, Box> = {
    discord: box(16, 12), drive: box(129, 12), notes: box(242, 12),
    archive: box(106, 90, 130), check: box(106, 164, 130),
    page: box(16, 370), ai: box(129, 370), bee: box(242, 370),
  };
  const hive = { cx: 171, cy: 278, R: 44 };
  const laneY = 250;
  const hb = hive.cy + hive.R;
  return {
    name: "tall", width: 358, height: 428, nodes, hive,
    question: { cx: 60, cy: 272, r: 8, step: 5 },
    paths: {
      d2a: down(nodes.discord, nodes.archive), r2a: down(nodes.drive, nodes.archive), a2c: down(nodes.archive, nodes.check),
      c2h: [bottom(nodes.check), { x: hive.cx, y: hive.cy - hive.R }],
      cq: [left(nodes.check), { x: 60, y: 187 }, { x: 60, y: 254 }],
      n2h: [bottom(nodes.notes), { x: 292, y: laneY }, { x: hive.cx + hexHalfWidth(hive.R, laneY - hive.cy), y: laneY }],
      h2p: [{ x: hive.cx, y: hb }, { x: hive.cx, y: 346 }, { x: 66, y: 346 }, top(nodes.page)],
      h2i: [{ x: hive.cx, y: hb }, { x: hive.cx, y: 346 }, { x: 179, y: 346 }, top(nodes.ai)],
      h2b: [{ x: hive.cx, y: hb }, { x: hive.cx, y: 346 }, { x: 292, y: 346 }, top(nodes.bee)],
    },
    labels: {
      hive: { x: 216, y: 298, anchor: "start" }, hiveSub: { x: 216, y: 312, anchor: "start" },
      question: { x: 60, y: 312, anchor: "middle" }, lane: { x: 298, y: 156, anchor: "start" },
    },
    rejects: [{ from: { x: 171, y: 164 }, to: { x: 146, y: 146 } }, { from: { x: 171, y: 164 }, to: { x: 196, y: 146 } }],
    size: {
      label: 12, sub: 10.5, nodePad: 10, labelY: 20, subY: 35,
      nodeDot: 1.3, nodeStep: 5.5, nextDot: 1.45, nextStep: 7, traceDot: 1.05, traceStep: 7,
      combDot: 1.9, combStep: 6.4, glyphDot: 1.8, checkSize: 16, checkDot: 1.4, bee: 2.6,
    },
  };
}

export const LAYOUTS: Record<LayoutName, FlowLayout> = { wide: wide(), tall: tall() };

/** Where Beekeeper's check sits: the author's tap, drawn inside the Beekeeper node. */
export function checkCenter(l: FlowLayout): Point {
  const b = l.nodes.bee;
  return l.name === "wide" ? { x: b.x + b.w - 26, y: b.y + 22 } : { x: b.x + b.w - 15, y: b.y + 17 };
}

export type StaticDots = {
  traces: { p: Point; next: boolean }[];
  nodes: { p: Point; next: boolean }[];
  comb: Point[];
  question: Point[];
  check: Point[];
};

export function staticDots(l: FlowLayout): StaticDots {
  const s = l.size;
  const traces = (Object.keys(l.paths) as PathKey[]).flatMap((key) => {
    const next = NEXT_PATHS.has(key);
    return dotsAlong(preparePath(l.paths[key]), next ? s.traceStep * 1.9 : s.traceStep).map((p) => ({ p, next }));
  });
  const kept = new Set(dedupe(traces.map((t) => t.p), 4));
  const nodes = (Object.keys(l.nodes) as NodeKey[]).flatMap((key) => {
    const b = l.nodes[key];
    const next = NEXT_NODES.has(key);
    return roundedRectDots(b.x, b.y, b.w, b.h, b.r, next ? s.nextStep : s.nodeStep).map((p) => ({ p, next }));
  });
  const c = checkCenter(l);
  return {
    traces: traces.filter((t) => kept.has(t.p)),
    nodes,
    comb: hexLattice(l.hive.cx, l.hive.cy, l.hive.R, s.combStep),
    question: questionDots(l.question.cx, l.question.cy, l.question.r, l.question.step),
    check: checkDots(c.x, c.y, s.checkSize),
  };
}

/* ---------- the timeline, in seconds ---------- */

export type Ending = "absorb" | "hive" | "question";
type Group = { path: PathKey; start: number; count: number; stagger: number; duration: number; ending: Ending };

export const LOOP_SECONDS = 15;
export const FADE_OUT: readonly [number, number] = [14.2, 14.9];

const HOURS = [0.25, 1.45, 2.65];
export const GROUPS: readonly Group[] = [
  ...HOURS.flatMap((t): Group[] => [
    { path: "d2a", start: t, count: 4, stagger: 0.1, duration: 0.85, ending: "absorb" },
    { path: "r2a", start: t + 0.05, count: 2, stagger: 0.12, duration: 0.85, ending: "absorb" },
  ]),
  { path: "a2c", start: 4.0, count: 12, stagger: 0.07, duration: 0.6, ending: "absorb" },
  { path: "c2h", start: 5.4, count: 8, stagger: 0.09, duration: 0.95, ending: "hive" },
  { path: "cq", start: 5.5, count: 2, stagger: 0.15, duration: 1.1, ending: "question" },
  { path: "n2h", start: 7.3, count: 3, stagger: 0.25, duration: 1.15, ending: "hive" },
  { path: "h2p", start: 9.1, count: 2, stagger: 0.12, duration: 0.8, ending: "absorb" },
  { path: "h2i", start: 9.1, count: 2, stagger: 0.12, duration: 0.8, ending: "absorb" },
  { path: "h2b", start: 10.4, count: 1, stagger: 0, duration: 0.8, ending: "absorb" },
];
export const REJECT = { start: 5.4, stagger: 0.12, duration: 0.75 };
/** When each part lights up as bees reach it. */
export const GLOWS: readonly [NodeKey | "hive", number][] = [
  ["archive", 1.1], ["archive", 2.3], ["archive", 3.5], ["check", 4.5], ["check", 4.95],
  ["hive", 6.4], ["hive", 8.6], ["page", 9.9], ["ai", 9.9], ["bee", 11.2],
];
export const CHECK_TICKS: readonly [number, number] = [4.6, 5.3];
export const TAP_AT = 11.2;
/** The clock: the real schedule (:17 past each hour, 2:30 at night), then minutes in a sprint. */
export const CLOCK: readonly { at: number; time: string; caption: number }[] = [
  { at: 0, time: "13:17", caption: 0 }, { at: 1.2, time: "14:17", caption: 0 }, { at: 2.4, time: "15:17", caption: 0 },
  { at: 3.8, time: "02:30", caption: 1 }, { at: 7.0, time: "21:04", caption: 2 }, { at: 8.9, time: "21:05", caption: 3 },
  { at: 10.2, time: "21:06", caption: 4 },
];

/** The flow's steps for reading it by hand, one per caption: the hours, the night, the fast lane, the read, the tap. */
export const FLOW_STEPS: readonly { start: number; end: number }[] = [
  { start: 0, end: 3.7 }, { start: 3.8, end: 6.95 }, { start: 7.0, end: 8.85 }, { start: 8.9, end: 10.15 }, { start: 10.2, end: 12.6 },
];

export function flowStepAt(t: number): number {
  let index = 0;
  FLOW_STEPS.forEach((step, i) => { if (t >= step.start) index = i; });
  return index;
}

/** The still frame a step shows under reduced motion: its bees caught mid-way. */
export const stillAt = (step: number) => FLOW_STEPS[step].start + 0.55 * (FLOW_STEPS[step].end - FLOW_STEPS[step].start);

export function clockAt(t: number) {
  return CLOCK.reduce((current, entry) => (t >= entry.at ? entry : current), CLOCK[0]);
}

/** A glow's strength t seconds after it fires: a soft rise, a hold, a slow fall. */
export function envelope(t: number): number {
  if (t < 0 || t > 1.1) return 0;
  if (t < 0.25) return t / 0.25;
  if (t < 0.5) return 1;
  return 1 - (t - 0.5) / 0.6;
}

export type Bee = { path: Path; start: number; duration: number; ending: Ending; jitter: Point; slot: Point | null };

export function beesFor(l: FlowLayout, dots: StaticDots): Bee[] {
  const random = seeded(23);
  const spread = l.name === "wide" ? 9 : 6;
  return GROUPS.flatMap((g) => {
    const path = preparePath(l.paths[g.path]);
    return Array.from({ length: g.count }, (_, i) => {
      const pool = g.ending === "hive" ? dots.comb : g.ending === "question" ? dots.question : null;
      return {
        path,
        start: g.start + i * g.stagger,
        duration: g.duration,
        ending: g.ending,
        jitter: { x: (random() - 0.5) * spread, y: (random() - 0.5) * spread },
        slot: pool ? pool[Math.floor(random() * pool.length)] : null,
      };
    });
  });
}
