import type { PageMeasure } from "./anchorStore";
import { composePoints } from "./compose";
import type { PathSettings } from "./settings";
import { generateSpine, type CheckOptions, type Generated } from "./spineRules";
import { spineById, type SpineDef } from "./spines";

// Which spine the path draws: an authored one by id, the editable custom
// moves, or the seeded generator checked against the measured page.

export interface SpineChoice {
  def: SpineDef;
  generated: Generated | null;
  genMs: number; // generation plus rule checks, every attempt
}

// The amplitude the engine draws at this width (phones get their own).
export function effectiveAmplitude(path: PathSettings, amplitude: number, width: number): number {
  return width > 0 && width < 600 && path.phoneAmplitude > 0 ? path.phoneAmplitude : amplitude;
}

export function checkOptions(path: PathSettings, amplitude: number, viewport: number, width = 0): CheckOptions {
  return {
    amplitude: effectiveAmplitude(path, amplitude, width),
    viewport,
    headAt: path.headAt,
    train: path.tail === "train" ? path.trainLength : null,
    rules: path.rules,
  };
}

export function chooseSpine(path: PathSettings, measure: PageMeasure | null, amplitude: number): SpineChoice {
  if (path.spine === "custom") {
    return {
      def: { id: "custom", label: "Custom", note: "Your edits, stretch by stretch.", moves: path.custom, points: composePoints(path.custom) },
      generated: null,
      genMs: 0,
    };
  }
  if (path.spine === "generated") {
    const t0 = performance.now();
    // With the reviewer's rules on, a failed seed falls back to the reviewed Signature line.
    const fallback = spineById(path.rules.headingClearPx > 0 ? "signature-reviewed" : "signature").moves;
    const generated = generateSpine(path.seed, path.gen, measure?.anchors ?? null, checkOptions(path, amplitude, measure?.viewport ?? 900, measure?.anchors.width ?? 0), fallback);
    const genMs = performance.now() - t0;
    return {
      def: {
        id: "generated",
        label: "Generated",
        note: generated.fallback
          ? `Seed ${path.seed}: no candidate kept every rule in ${generated.attempts} tries, so the authored fallback stands in.`
          : `Seed ${path.seed}, accepted on try ${generated.attempts}.`,
        moves: generated.moves,
        points: generated.points,
      },
      generated,
      genMs,
    };
  }
  return { def: spineById(path.spine), generated: null, genMs: 0 };
}
