import { arcAtY, sampleSpine, type SpineSamples } from "./spineGeometry";
import { AUTHORED, composePoints, derivedSeed, generateLine, type GenHints, type GenParams, type Move } from "./compose";
import { SECTION_KEYS, resolveSpine, type Anchors, type Rect, type SpinePoint } from "./spines";

// The rules a good line keeps, as a pure function of the points and a
// measured page (section boxes at one width): the line is sampled here, never
// in the DOM. The generator only hands out lines that pass; authored ones show
// their numbers in the panel so a breach is visible, not silent.

export const RULES = {
  minBendRatio: 1.4, // the bend's radius over the wave's reach (0.55 of the amplitude), where on screen
  maxBacktrackPx: 6, // y never climbs back more than this, so the line cannot cross itself
  maxFlatRunPx: 240, // the longest near-flat stretch allowed inside a section's words
  flatSlope: 0.12, // |dy/ds| under this is "flat": a run that would sit on a heading's baseline
  tries: 8, // seeds tried before falling back to an authored line
};

// The adjustable rules (settings.path.rules). Zero or false switches one off;
// "Aaron's pick" keeps round 3's set, "reviewed" turns the reviewer's on.
export interface RuleSettings {
  maxEmptyVh: number; // the longest scroll with no wave on screen, with the train
  headingClearPx: number; // the wave's dots stay this far from a display heading's ink
  linksClear: boolean; // no dot on Connect's link list
  hairlineGapPx: number; // a run this close to a section hairline...
  hairlineRunPx: number; // ...for longer than this reads as a second rule
  edgeGapPx: number; // a near-vertical run this close to a text block's edge...
  edgeRunPx: number; // ...for longer than this traces the line ends
  maxTurnDeg: number; // total turning inside one section (no wrapping a text block)
  flatAnySlope: number; // flat anywhere on screen: |dy/ds| under this...
  flatAnyPx: number; // ...for longer than this is a rule, not a wave
  entryNearBandPx: number; // the line first appears within this of the band's right end
  exitAtEdge: boolean; // the line ends past an edge, never mid-screen
  minTurnDeg: number; // character: at least this much turning on screen in all (a ruler line has none)
  minDirChanges: number; // character: at least this many changes of horizontal direction (off-screen turns count)
}

export type RuleId = "bend" | "crossing" | "flat" | "empty" | "heading" | "links" | "hairline" | "edge" | "turning" | "flatAny" | "entry" | "exit" | "character";

export const RULE_IDS: RuleId[] = ["bend", "crossing", "flat", "empty", "heading", "links", "hairline", "edge", "turning", "flatAny", "entry", "exit", "character"];

export interface RuleReport {
  bendRatio: number;
  backtrackPx: number;
  flatRunPx: number;
  offscreenVh: number; // the longest stretch of page wholly off screen, information
  empty: EmptyReport;
  headingClearPx: number; // the closest any dot comes to a heading's ink (negative: overlapping)
  linksClearPx: number;
  hairlineRunPx: number;
  edgeRunPx: number;
  turnDeg: number; // the most turning inside one section
  flatAnyPx: number;
  entryPx: number; // from where the line first appears to the band's right end
  exitOffscreen: boolean;
  totalTurnDeg: number; // all the turning on screen
  headingPoint: { x: number; y: number } | null; // where the line comes closest to a heading
  dirChanges: number; // changes of horizontal direction along the whole line
  failed: RuleId[];
  violations: string[];
}

export interface CheckOptions {
  amplitude: number;
  viewport: number;
  headAt: number;
  train: number | null; // px, or null when everything behind the head stays drawn
  rules: RuleSettings;
}

export function checkLine(points: SpinePoint[], anchors: Anchors, opts: CheckOptions): RuleReport {
  return checkSamples(sampleSpine(resolveSpine({ points }, anchors), 4), anchors, opts);
}

const rectDistance = (r: Rect, x: number, y: number) => {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
};

// The gaps and slopes the measures use when a rule is switched off, so the
// readout still reports what the reviewed rule would see.
const MEASURE = { hairlineGapPx: 40, edgeGapPx: 32, flatAnySlope: 0.2 };

export function checkSamples(samples: SpineSamples, anchors: Anchors, opts: CheckOptions): RuleReport {
  const R = opts.rules;
  const headings = anchors.headings ?? [];
  const links = anchors.links ?? [];
  const hairlines = anchors.hairlines ?? [];
  const blocks = anchors.blocks ?? [];
  const hairGap = R.hairlineGapPx || MEASURE.hairlineGapPx;
  const edgeGap = R.edgeGapPx || MEASURE.edgeGapPx;
  const flatSlope = R.flatAnySlope || MEASURE.flatAnySlope;
  let totalTurn = 0;
  let dirChanges = 0;
  let lastDir = 0;
  const width = anchors.width;
  const reach = Math.max(1, opts.amplitude * 0.55);
  const { count, x, y, radius, yMax, step } = samples;
  const margin = 40;
  let bend = Infinity;
  let backtrack = 0;
  let flatRun = 0;
  let offscreen = 0;
  let headingClear = Infinity;
  let headingAt = -1;
  let linksClear = Infinity;
  let hairRun = 0;
  let edgeRun = 0;
  let flatAny = 0;
  let entry = Infinity;
  let flatStart = -1;
  let offStart = -1;
  let hairStart = -1;
  let edgeStart = -1;
  let flatAnyStart = -1;
  const turning = new Map<string, number>();
  const run = (start: number, i: number) => (i - start) * step;

  for (let i = 0; i < count; i++) {
    const on = x[i] > -margin && x[i] < width + margin;
    const inside = x[i] > 0 && x[i] < width;
    if (on) bend = Math.min(bend, radius[i] / reach);
    backtrack = Math.max(backtrack, yMax[i] - y[i]);
    if (inside && !Number.isFinite(entry)) {
      const band = anchors.box.band;
      entry = Math.hypot(width - x[i], Math.max(0, Math.abs(y[i] - (band.top + band.bottom) / 2) - (band.bottom - band.top) / 2));
    }
    const tx = i > 0 ? (x[i] - x[i - 1]) / step : 1;
    const ty = i > 0 ? (y[i] - y[i - 1]) / step : 0;
    const slope = Math.abs(ty);

    let inWords = false;
    for (const key of SECTION_KEYS) {
      const w = anchors.words[key];
      if (y[i] >= w.top && y[i] <= w.bottom) {
        inWords = true;
        break;
      }
    }
    const flat = inside && inWords && slope < RULES.flatSlope;
    if (flat && flatStart < 0) flatStart = i;
    if (!flat && flatStart >= 0) {
      flatRun = Math.max(flatRun, run(flatStart, i));
      flatStart = -1;
    }
    if (!on && offStart < 0) offStart = i;
    if (on && offStart >= 0) {
      offscreen = Math.max(offscreen, (y[i] - y[offStart]) / opts.viewport);
      offStart = -1;
    }

    if (on) {
      for (const h of headings) {
        const c = rectDistance(h, x[i], y[i]) - reach;
        if (c < headingClear) {
          headingClear = c;
          headingAt = i;
        }
      }
      for (const l of links) linksClear = Math.min(linksClear, rectDistance(l, x[i], y[i]) - reach);
    }

    const nearHair = inside && hairlines.some((h) => Math.abs(y[i] - h) < hairGap);
    if (nearHair && hairStart < 0) hairStart = i;
    if (!nearHair && hairStart >= 0) {
      hairRun = Math.max(hairRun, run(hairStart, i));
      hairStart = -1;
    }

    const vertical = Math.abs(tx) < 0.35;
    const nearEdge =
      inside && vertical && blocks.some((b) => y[i] >= b.top && y[i] <= b.bottom && (Math.abs(x[i] - b.left) < edgeGap || Math.abs(x[i] - b.right) < edgeGap));
    if (nearEdge && edgeStart < 0) edgeStart = i;
    if (!nearEdge && edgeStart >= 0) {
      edgeRun = Math.max(edgeRun, run(edgeStart, i));
      edgeStart = -1;
    }

    const flatHere = inside && slope < flatSlope;
    if (flatHere && flatAnyStart < 0) flatAnyStart = i;
    if (!flatHere && flatAnyStart >= 0) {
      flatAny = Math.max(flatAny, run(flatAnyStart, i));
      flatAnyStart = -1;
    }

    // Direction changes count the whole line, off screen too: a line that
    // leaves by one edge and comes back has reversed, even if the turn is unseen.
    const dir = tx > 0.3 ? 1 : tx < -0.3 ? -1 : 0;
    if (dir !== 0) {
      if (lastDir !== 0 && dir !== lastDir) dirChanges++;
      lastDir = dir;
    }
    if (inside && i > 1) {
      const a0 = Math.atan2(y[i - 1] - y[i - 2], x[i - 1] - x[i - 2]);
      const a1 = Math.atan2(ty, tx);
      let d = a1 - a0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      totalTurn += Math.abs(d);
      for (const key of ["about", "who", "up", "connect"] as const) {
        const b = anchors.box[key];
        if (y[i] >= b.top && y[i] < b.bottom) turning.set(key, (turning.get(key) ?? 0) + Math.abs(d));
      }
    }
  }
  if (flatStart >= 0) flatRun = Math.max(flatRun, run(flatStart, count));
  if (offStart >= 0) offscreen = Math.max(offscreen, (y[count - 1] - y[offStart]) / opts.viewport);
  if (hairStart >= 0) hairRun = Math.max(hairRun, run(hairStart, count));
  if (edgeStart >= 0) edgeRun = Math.max(edgeRun, run(edgeStart, count));
  if (flatAnyStart >= 0) flatAny = Math.max(flatAny, run(flatAnyStart, count));
  let turnDeg = 0;
  turning.forEach((v) => (turnDeg = Math.max(turnDeg, (v * 180) / Math.PI)));
  const exitOffscreen = x[count - 1] < 0 || x[count - 1] > width;
  const empty = emptyScreen(samples, anchors, opts.viewport, opts.headAt, opts.train);

  const failed: RuleId[] = [];
  const violations: string[] = [];
  const fail = (id: RuleId, why: string) => {
    failed.push(id);
    violations.push(why);
  };
  if (bend < RULES.minBendRatio) fail("bend", `a bend tighter than ${RULES.minBendRatio} times the wave's reach`);
  if (backtrack > RULES.maxBacktrackPx) fail("crossing", "the line climbs back on itself (it could cross)");
  if (flatRun > RULES.maxFlatRunPx) fail("flat", `a flat run of ${Math.round(flatRun)}px inside a text block`);
  if (empty.longestVh > R.maxEmptyVh) fail("empty", `${empty.longestVh.toFixed(2)} viewports of scroll with no wave on screen`);
  if (R.headingClearPx > 0 && headingClear < R.headingClearPx) fail("heading", `dots within ${Math.round(headingClear)}px of a heading`);
  if (R.linksClear && linksClear < 0) fail("links", "dots on Connect's link list");
  if (R.hairlineGapPx > 0 && hairRun > R.hairlineRunPx) fail("hairline", `${Math.round(hairRun)}px along a section hairline`);
  if (R.edgeGapPx > 0 && edgeRun > R.edgeRunPx) fail("edge", `${Math.round(edgeRun)}px tracing a text block's edge`);
  if (R.maxTurnDeg > 0 && turnDeg > R.maxTurnDeg) fail("turning", `${Math.round(turnDeg)} degrees of turning inside one section`);
  if (R.flatAnySlope > 0 && flatAny > R.flatAnyPx) fail("flatAny", `a flat run of ${Math.round(flatAny)}px on screen`);
  if (R.entryNearBandPx > 0 && entry > R.entryNearBandPx) fail("entry", `first appears ${Math.round(entry)}px from the band's right end`);
  if (R.exitAtEdge && !exitOffscreen) fail("exit", "ends on screen");
  const totalTurnDeg = (totalTurn * 180) / Math.PI;
  if ((R.minTurnDeg > 0 && totalTurnDeg < R.minTurnDeg) || (R.minDirChanges > 0 && dirChanges < R.minDirChanges))
    fail("character", `too little character: ${Math.round(totalTurnDeg)} degrees of turning, ${dirChanges} changes of direction`);
  return {
    bendRatio: bend,
    backtrackPx: backtrack,
    flatRunPx: flatRun,
    offscreenVh: offscreen,
    empty,
    headingClearPx: headingClear,
    linksClearPx: linksClear,
    hairlineRunPx: hairRun,
    edgeRunPx: edgeRun,
    turnDeg,
    flatAnyPx: flatAny,
    entryPx: entry,
    exitOffscreen,
    totalTurnDeg,
    dirChanges,
    headingPoint: headingAt >= 0 ? { x: x[headingAt], y: y[headingAt] } : null,
    failed,
    violations,
  };
}

export interface EmptyReport {
  longestVh: number; // the longest scroll with nothing of the wave on screen, in viewports
  atY: number; // where that stretch starts (scroll position, px)
  totalVh: number;
}

// With a train, an off-screen stretch means the screen is briefly empty of
// wave. Walk the page a step at a time and find the longest scroll with no
// drawn column on screen (the opening, before the head reaches the line,
// is skipped: the band is the wave's natural start).
export function emptyScreen(samples: SpineSamples, anchors: Anchors, viewport: number, headAt: number, train: number | null): EmptyReport {
  const width = anchors.width;
  const end = anchors.box.footer.bottom - viewport;
  const stepY = 24;
  let longest = 0;
  let longestAt = 0;
  let total = 0;
  let runStart = -1;
  let started = false;
  for (let scroll = 0; scroll <= end; scroll += stepY) {
    const head = arcAtY(samples, scroll + headAt * viewport);
    const tail = train === null ? 0 : Math.max(0, head - train);
    let visible = false;
    for (let i = Math.floor(tail / samples.step); i <= Math.min(samples.count - 1, head / samples.step); i++) {
      const xi = samples.x[i];
      const yi = samples.y[i];
      if (xi > 0 && xi < width && yi > scroll && yi < scroll + viewport) {
        visible = true;
        break;
      }
    }
    if (visible) started = true;
    if (!started) continue;
    if (!visible && runStart < 0) runStart = scroll;
    if (visible && runStart >= 0) {
      const run = scroll - runStart;
      total += run;
      if (run > longest) {
        longest = run;
        longestAt = runStart;
      }
      runStart = -1;
    }
  }
  if (runStart >= 0) {
    const run = end - runStart;
    total += run;
    if (run > longest) {
      longest = run;
      longestAt = runStart;
    }
  }
  return { longestVh: longest / viewport, atY: longestAt, totalVh: total / viewport };
}

export interface Generated {
  seed: number; // the one asked for
  usedSeed: number; // the derived seed that passed, or the last one tried
  attempts: number;
  fallback: boolean; // no seed passed in RULES.tries: the authored line stands in
  moves: Move[];
  points: SpinePoint[];
  report: RuleReport | null;
}

// The line for a seed: up to RULES.tries derived seeds, the first that keeps
// every rule wins; if none does, the authored fallback (the first authored
// irregular spine) stands in. Without a measured page the first candidate
// stands until the measure arrives.
export function hintsFor(rules: RuleSettings): GenHints {
  return { entryRight: rules.entryNearBandPx > 0, clearHeadings: rules.headingClearPx > 0, clearLinks: rules.linksClear };
}

export function generateSpine(seed: number, params: GenParams, anchors: Anchors | null, opts: CheckOptions, fallback: Move[] = FALLBACK.moves): Generated {
  let lastSeed = seed;
  const hints = hintsFor(opts.rules);
  for (let attempt = 0; attempt < RULES.tries; attempt++) {
    lastSeed = derivedSeed(seed, attempt);
    const moves = generateLine(lastSeed, params, undefined, hints);
    const points = composePoints(moves);
    if (!anchors) return { seed, usedSeed: lastSeed, attempts: 1, fallback: false, moves, points, report: null };
    const report = checkLine(points, anchors, opts);
    if (!report.failed.length) return { seed, usedSeed: lastSeed, attempts: attempt + 1, fallback: false, moves, points, report };
  }
  const points = composePoints(fallback);
  return { seed, usedSeed: lastSeed, attempts: RULES.tries, fallback: true, moves: fallback, points, report: anchors ? checkLine(points, anchors, opts) : null };
}

export const FALLBACK = AUTHORED[0];

export interface BulkReport {
  seeds: number;
  firstTryRejected: Record<RuleId, number>; // share of first candidates failing each rule
  firstTryPass: number;
  fallbackRate: number;
  meanAttempts: number;
  msPerLine: { generate: number; check: number };
  worst: { seed: number; score: number; report: RuleReport }[];
}

// The bulk check behind the "is per-visit generation safe" numbers: every
// seed through the same path a visitor's load takes, timed, with the accepted
// lines ranked by how close they sit to a rule's edge.
export function bulkCheck(count: number, params: GenParams, anchors: Anchors, opts: CheckOptions, start = 1): BulkReport {
  const firstTryRejected = Object.fromEntries(RULE_IDS.map((id) => [id, 0])) as Record<RuleId, number>;
  const hints = hintsFor(opts.rules);
  let firstPass = 0;
  let fallbacks = 0;
  let attempts = 0;
  let genMs = 0;
  let checkMs = 0;
  let lines = 0;
  const accepted: { seed: number; score: number; report: RuleReport }[] = [];
  for (let n = 0; n < count; n++) {
    const seed = start + n;
    let passed = false;
    for (let attempt = 0; attempt < RULES.tries; attempt++) {
      const t0 = performance.now();
      const points = composePoints(generateLine(derivedSeed(seed, attempt), params, undefined, hints));
      const t1 = performance.now();
      const report = checkLine(points, anchors, opts);
      const t2 = performance.now();
      genMs += t1 - t0;
      checkMs += t2 - t1;
      lines++;
      attempts++;
      if (attempt === 0) for (const id of report.failed) firstTryRejected[id]++;
      if (!report.failed.length) {
        if (attempt === 0) firstPass++;
        // Closeness to the edges: a tight bend, a long flat run, a long empty stretch.
        const R = opts.rules;
        const score =
          Math.max(0, 2.2 - report.bendRatio) +
          report.flatRunPx / RULES.maxFlatRunPx +
          report.empty.longestVh / R.maxEmptyVh +
          (R.headingClearPx > 0 ? Math.max(0, 1 - (report.headingClearPx - R.headingClearPx) / 80) : 0) +
          (R.flatAnySlope > 0 ? report.flatAnyPx / R.flatAnyPx : 0) +
          (R.maxTurnDeg > 0 ? report.turnDeg / R.maxTurnDeg : 0);
        accepted.push({ seed, score, report });
        passed = true;
        break;
      }
    }
    if (!passed) fallbacks++;
  }
  (Object.keys(firstTryRejected) as RuleId[]).forEach((id) => (firstTryRejected[id] /= count));
  accepted.sort((a, b) => b.score - a.score);
  return {
    seeds: count,
    firstTryRejected,
    firstTryPass: firstPass / count,
    fallbackRate: fallbacks / count,
    meanAttempts: attempts / count,
    msPerLine: { generate: genMs / lines, check: checkMs / lines },
    worst: accepted.slice(0, 5),
  };
}
