import { arcAtY, sampleSpine, type SpineSamples } from "./spineGeometry";
import { AUTHORED, composePoints, derivedSeed, generateLine, type GenParams, type Move } from "./compose";
import { SECTION_KEYS, resolveSpine, type Anchors, type SpinePoint } from "./spines";

// The rules a good line keeps, as a pure function of the points and a
// measured page (section boxes at one width): the line is sampled here, never
// in the DOM. The generator only hands out lines that pass; authored ones show
// their numbers in the panel so a breach is visible, not silent.

export const RULES = {
  minBendRatio: 1.4, // the bend's radius over the wave's reach (0.55 of the amplitude), where on screen
  maxBacktrackPx: 6, // y never climbs back more than this, so the line cannot cross itself
  maxFlatRunPx: 240, // the longest near-flat stretch allowed inside a section's words
  flatSlope: 0.12, // |dy/ds| under this is "flat": a run that would sit on a heading's baseline
  maxEmptyVh: 1.5, // the longest scroll with no wave on screen, with the train
  tries: 8, // seeds tried before falling back to an authored line
};

export type RuleId = "bend" | "crossing" | "flat" | "empty";

export interface RuleReport {
  bendRatio: number;
  backtrackPx: number;
  flatRunPx: number;
  offscreenVh: number; // the longest stretch of page wholly off screen, information
  empty: EmptyReport;
  failed: RuleId[];
  violations: string[];
}

export interface CheckOptions {
  amplitude: number;
  viewport: number;
  headAt: number;
  train: number | null; // px, or null when everything behind the head stays drawn
}

export function checkLine(points: SpinePoint[], anchors: Anchors, opts: CheckOptions): RuleReport {
  return checkSamples(sampleSpine(resolveSpine({ points }, anchors), 4), anchors, opts);
}

export function checkSamples(samples: SpineSamples, anchors: Anchors, opts: CheckOptions): RuleReport {
  const width = anchors.width;
  const reach = Math.max(1, opts.amplitude * 0.55);
  const { count, x, y, radius, yMax, step } = samples;
  const margin = 40;
  let bend = Infinity;
  let backtrack = 0;
  let flatRun = 0;
  let offscreen = 0;
  let flatStart = -1;
  let offStart = -1;
  for (let i = 0; i < count; i++) {
    const on = x[i] > -margin && x[i] < width + margin;
    if (on) bend = Math.min(bend, radius[i] / reach);
    backtrack = Math.max(backtrack, yMax[i] - y[i]);

    let inWords = false;
    for (const key of SECTION_KEYS) {
      const w = anchors.words[key];
      if (y[i] >= w.top && y[i] <= w.bottom) {
        inWords = true;
        break;
      }
    }
    const dy = i > 0 ? Math.abs(y[i] - y[i - 1]) / step : 1;
    const flat = on && inWords && x[i] > 0 && x[i] < width && dy < RULES.flatSlope;
    if (flat && flatStart < 0) flatStart = i;
    if (!flat && flatStart >= 0) {
      flatRun = Math.max(flatRun, (i - flatStart) * step);
      flatStart = -1;
    }
    if (!on && offStart < 0) offStart = i;
    if (on && offStart >= 0) {
      offscreen = Math.max(offscreen, (y[i] - y[offStart]) / opts.viewport);
      offStart = -1;
    }
  }
  if (flatStart >= 0) flatRun = Math.max(flatRun, (count - flatStart) * step);
  if (offStart >= 0) offscreen = Math.max(offscreen, (y[count - 1] - y[offStart]) / opts.viewport);
  const empty = emptyScreen(samples, anchors, opts.viewport, opts.headAt, opts.train);

  const failed: RuleId[] = [];
  const violations: string[] = [];
  if (bend < RULES.minBendRatio) {
    failed.push("bend");
    violations.push(`a bend tighter than ${RULES.minBendRatio} times the wave's reach`);
  }
  if (backtrack > RULES.maxBacktrackPx) {
    failed.push("crossing");
    violations.push("the line climbs back on itself (it could cross)");
  }
  if (flatRun > RULES.maxFlatRunPx) {
    failed.push("flat");
    violations.push(`a flat run of ${Math.round(flatRun)}px inside a text block`);
  }
  if (empty.longestVh > RULES.maxEmptyVh) {
    failed.push("empty");
    violations.push(`${empty.longestVh.toFixed(1)} viewports of scroll with no wave on screen`);
  }
  return { bendRatio: bend, backtrackPx: backtrack, flatRunPx: flatRun, offscreenVh: offscreen, empty, failed, violations };
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
export function generateSpine(seed: number, params: GenParams, anchors: Anchors | null, opts: CheckOptions): Generated {
  let lastSeed = seed;
  for (let attempt = 0; attempt < RULES.tries; attempt++) {
    lastSeed = derivedSeed(seed, attempt);
    const moves = generateLine(lastSeed, params);
    const points = composePoints(moves);
    if (!anchors) return { seed, usedSeed: lastSeed, attempts: 1, fallback: false, moves, points, report: null };
    const report = checkLine(points, anchors, opts);
    if (!report.failed.length) return { seed, usedSeed: lastSeed, attempts: attempt + 1, fallback: false, moves, points, report };
  }
  const moves = FALLBACK.moves;
  const points = composePoints(moves);
  return { seed, usedSeed: lastSeed, attempts: RULES.tries, fallback: true, moves, points, report: anchors ? checkLine(points, anchors, opts) : null };
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
  const firstTryRejected: Record<RuleId, number> = { bend: 0, crossing: 0, flat: 0, empty: 0 };
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
      const points = composePoints(generateLine(derivedSeed(seed, attempt), params));
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
        const score =
          Math.max(0, 2.2 - report.bendRatio) + report.flatRunPx / RULES.maxFlatRunPx + report.empty.longestVh / RULES.maxEmptyVh;
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
