import { arcDots, clamp, dotsAlong, lerp, preparePath, seeded, type Point } from "./dots";

// The aside beside "Why I built it": an illustration of the exhibit the Hive
// serves. A swarm wanders, someone walks up, the bees settle into their outline,
// and when they wave the bees on their arm move with them. Pure: positions are a
// function of time, so the server's still frame and the canvas agree.

export const EXHIBIT_BOX = { width: 300, height: 340 };
export const EXHIBIT_LOOP = 12;
export const EXHIBIT_STEPS: readonly { start: number; end: number; still: number }[] = [
  { start: 0, end: 2.4, still: 1.2 },
  { start: 2.4, end: 3.6, still: 3.4 },
  { start: 3.6, end: 6.4, still: 6.3 },
  { start: 6.4, end: 10.4, still: 7.4 },
];
export const BEE_R = 2.6;
const STEP = 10;
const PIVOT: Point = { x: 190, y: 112 };
const ARM = { length: 86, half: 9 };
const REST_ANGLE = (-48 * Math.PI) / 180;

const BODY: Point[] = [
  { x: 140, y: 92 }, { x: 108, y: 106 }, { x: 94, y: 150 }, { x: 90, y: 205 }, { x: 98, y: 214 }, { x: 106, y: 205 },
  { x: 112, y: 150 }, { x: 122, y: 132 }, { x: 124, y: 232 }, { x: 122, y: 322 }, { x: 144, y: 322 }, { x: 150, y: 250 },
  { x: 156, y: 322 }, { x: 178, y: 322 }, { x: 176, y: 232 }, { x: 178, y: 132 }, { x: 192, y: 106 }, { x: 160, y: 92 }, { x: 140, y: 92 },
];

/** The arm's outline in its own frame: along +x from the shoulder, a capsule. */
function armLocal(): Point[] {
  const { length, half } = ARM;
  const edge = preparePath([{ x: 4, y: -half }, { x: length, y: -half }]);
  const tip = arcDots(length, 0, half, -Math.PI / 2, Math.PI / 2, STEP).slice(1, -1);
  const back = preparePath([{ x: length, y: half }, { x: 4, y: half }]);
  return [...dotsAlong(edge, STEP), ...tip, ...dotsAlong(back, STEP)];
}

const BODY_DOTS = [...arcDots(150, 62, 28, 0, Math.PI * 2, STEP).slice(1), ...dotsAlong(preparePath(BODY), STEP)];
const ARM_DOTS = armLocal();

/** The waving arm's angle: at rest raised, then two slow waves. */
export function armAngle(t: number): number {
  const s = EXHIBIT_STEPS[3];
  const into = clamp((t - s.start) / (s.end - s.start), 0, 1);
  const fade = Math.sin(Math.PI * into);
  return REST_ANGLE + ((20 * Math.PI) / 180) * fade * Math.sin(2 * Math.PI * 2 * into);
}

function rotate(p: Point, angle: number): Point {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: PIVOT.x + p.x * c - p.y * s, y: PIVOT.y + p.x * s + p.y * c };
}

/** Where every bee belongs on the person at time t (the arm follows its angle). */
export function outlineAt(t: number): Point[] {
  const a = armAngle(t);
  return [...BODY_DOTS, ...ARM_DOTS.map((p) => rotate(p, a))];
}

type Bee = { home: Point; ph: [number, number]; delay: number };
const random = seeded(7);
export const BEES: Bee[] = outlineAt(0).map((_, i, all) => ({
  home: { x: 20 + random() * (EXHIBIT_BOX.width - 40), y: 20 + random() * (EXHIBIT_BOX.height - 40) },
  ph: [random() * Math.PI * 2, random() * Math.PI * 2],
  delay: (i / all.length) * 1.4,
}));

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** One frame of the swarm: every bee's position, and how strongly the faint outline shows. */
export function exhibitFrame(t: number): { bees: Point[]; outline: number } {
  const loop = (2 * Math.PI) / EXHIBIT_LOOP;
  const targets = outlineAt(t);
  const disperse = easeInOut(clamp((t - 11.2) / 0.8, 0, 1));
  const bees = BEES.map((bee, i) => {
    const wander = { x: bee.home.x + Math.sin(loop * 2 * t + bee.ph[0]) * 14, y: bee.home.y + Math.cos(loop * 3 * t + bee.ph[1]) * 12 };
    const settle = easeInOut(clamp((t - EXHIBIT_STEPS[2].start - bee.delay) / 1.4, 0, 1)) * (1 - disperse);
    const target = targets[i];
    return { x: lerp(wander.x, target.x, settle), y: lerp(wander.y, target.y, settle) };
  });
  const outline = clamp((t - EXHIBIT_STEPS[1].start) / 1.2, 0, 1) * (1 - clamp((t - 10.6) / 0.6, 0, 1));
  return { bees, outline };
}

export function exhibitStepAt(t: number): number {
  let index = 0;
  EXHIBIT_STEPS.forEach((s, i) => { if (t >= s.start) index = i; });
  return index;
}
