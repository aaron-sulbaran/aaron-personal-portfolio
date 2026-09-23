import type { FlowTone } from "@/lib/recruiting/funnel";

// One place for how each flow tone paints, shared by the Sankey, the narrow
// bars and the legend so they can never disagree. Encoding (dataviz skill):
// lanes are categorical identity (validated trio); outcomes are a diverging
// pair on a neutral midpoint: warm = moved forward, cool = rejected, gray =
// no reply or withdrew, hollow gray = still open (not resolved yet).

export interface ToneStyle {
  color: string;
  flowOpacity: number;
  nodeOpacity: number;
  hollow?: boolean;
}

export const TONES: Record<FlowTone, ToneStyle> = {
  "lane-1": { color: "var(--viz-lane-1)", flowOpacity: 0.5, nodeOpacity: 1 },
  "lane-2": { color: "var(--viz-lane-2)", flowOpacity: 0.5, nodeOpacity: 1 },
  "lane-3": { color: "var(--viz-lane-3)", flowOpacity: 0.5, nodeOpacity: 1 },
  node: { color: "var(--viz-node)", flowOpacity: 0.35, nodeOpacity: 0.7 },
  forward: { color: "var(--viz-warm)", flowOpacity: 0.45, nodeOpacity: 0.9 },
  offer: { color: "var(--viz-warm)", flowOpacity: 0.7, nodeOpacity: 1 },
  rejected: { color: "var(--viz-cool)", flowOpacity: 0.45, nodeOpacity: 0.9 },
  noreply: { color: "var(--viz-node)", flowOpacity: 0.28, nodeOpacity: 0.6 },
  withdrew: { color: "var(--viz-node)", flowOpacity: 0.2, nodeOpacity: 0.4 },
  open: { color: "var(--viz-node)", flowOpacity: 0.16, nodeOpacity: 1, hollow: true },
  ignored: { color: "var(--viz-node)", flowOpacity: 0.16, nodeOpacity: 0.35 },
};

// Outcome legend order, reading order of the exits.
export const OUTCOME_TONES = ["forward", "open", "rejected", "noreply", "withdrew"] as const;
