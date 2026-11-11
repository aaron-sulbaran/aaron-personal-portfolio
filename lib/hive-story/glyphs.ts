import {
  arcDots,
  centerOn,
  checkDots,
  dotsAlong,
  hexLattice,
  preparePath,
  questionDots,
  roundedRectDots,
  segmentDots,
  type Point,
} from "./dots";

// The small drawings on /hive-story, in the same bees as the flow: one glyph per
// step of a fact's trip (drawn on a honey disc, like Beekeeper's reactions) and
// one small swarm per scenario. All in fixed boxes, so each is one SVG viewBox.

export const GLYPH_BOX = 100;
export const GLYPH_DOT = 5.6;

export type GlyphKey = "message" | "quote" | "check" | "judge" | "link" | "question";

const deg = Math.PI / 180;

function message(): Point[] {
  return [...roundedRectDots(20, 22, 60, 42, 13, 13.5), { x: 34, y: 76 }];
}

function quote(): Point[] {
  const mark = (x: number) => [{ x, y: 40 }, { x: x - 2, y: 52 }, { x: x - 8, y: 62 }];
  return centerOn([...mark(40), ...mark(66)], 50, 50);
}

function judge(): Point[] {
  return [...checkDots(33, 50, 34), ...checkDots(67, 50, 34)];
}

function link(): Point[] {
  // Back to the source: an arrow pointing left whose tail hooks down.
  const shaft = [{ x: 0, y: 0 }, ...segmentDots({ x: 0, y: 0 }, { x: 30, y: 0 }, 14)];
  const hook = arcDots(30, 19, 19, -90 * deg, 0, 14).slice(1);
  const tail = segmentDots({ x: 49, y: 19 }, { x: 49, y: 34 }, 14);
  const wings = [{ x: 11.6, y: -13.8 }, { x: 11.6, y: 13.8 }];
  return centerOn([...shaft, ...hook, ...tail, ...wings], 50, 50);
}

export const GLYPHS: Record<GlyphKey, Point[]> = {
  message: message(),
  quote: quote(),
  check: checkDots(50, 50, 52),
  judge: judge(),
  link: link(),
  question: questionDots(50, 50, 15, 13),
};

/* ---------- scenario swarms ---------- */

export const SCENARIO_BOX = { width: 320, height: 150 };
const HIVE = { cx: 250, cy: 75, R: 50 };

export type ScenarioKey = "prototypes" | "ideas" | "sprint";
export type Scenario = {
  sessions: Point[];
  lanes: Point[];
  comb: Point[];
  notes: Point[];
  check: Point[];
};

const sessionRing = (c: Point) => roundedRectDots(c.x - 13, c.y - 13, 26, 26, 13, 6.5);
const lane = (pts: Point[]) => dotsAlong(preparePath(pts), 8);

function build(sessions: Point[], routes: Point[][], notes: Point[], check: Point[] = []): Scenario {
  return {
    sessions: sessions.flatMap(sessionRing),
    lanes: routes.flatMap(lane),
    comb: hexLattice(HIVE.cx, HIVE.cy, HIVE.R, 9.5),
    notes,
    check,
  };
}

export const SCENARIOS: Record<ScenarioKey, Scenario> = {
  // Three versions of one part, side by side in the Hive, each still unconfirmed.
  prototypes: build(
    [{ x: 34, y: 30 }, { x: 34, y: 75 }, { x: 34, y: 120 }],
    [30, 75, 120].map((y) => [{ x: 47, y }, { x: 130, y }, { x: 130, y: 75 }, { x: 207, y: 75 }]),
    [{ x: 236, y: 75 }, { x: 250, y: 75 }, { x: 264, y: 75 }],
  ),
  // Two ideas kept apart: each lands in its own corner of the Hive.
  ideas: build(
    [{ x: 34, y: 42 }, { x: 34, y: 108 }],
    [
      [{ x: 47, y: 42 }, { x: 222, y: 42 }],
      [{ x: 47, y: 108 }, { x: 222, y: 108 }],
    ],
    [{ x: 240, y: 50 }, { x: 254, y: 50 }, { x: 240, y: 100 }, { x: 254, y: 100 }],
  ),
  // Five people at once: one fast lane in, and the author's check on the way out.
  sprint: build(
    [18, 46.5, 75, 103.5, 132].map((y) => ({ x: 26, y })),
    [
      ...[18, 46.5, 75, 103.5, 132].map((y) => [{ x: 39, y }, { x: 96, y }, { x: 96, y: 75 }]),
      [{ x: 96, y: 75 }, { x: 207, y: 75 }],
    ],
    [{ x: 236, y: 62 }, { x: 250, y: 62 }, { x: 264, y: 62 }, { x: 243, y: 75 }, { x: 257, y: 75 }],
    checkDots(296, 130, 22),
  ),
};
