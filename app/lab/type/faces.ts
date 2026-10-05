// The candidate label faces: what each one is, the weights it really has,
// whether it carries a width axis, and why it is on the list. fonts.ts loads
// them; this file stays free of next/font so the client can import it.

export type FaceGroup = "control" | "family" | "google" | "disk";

export type Face = {
  id: string;
  name: string;
  group: FaceGroup;
  family: string;
  weights: readonly number[];
  // A width axis as font-stretch percentages, when the face has one.
  stretch?: { min: number; max: number };
  // Inter keeps the body's alternates; every other face gets its defaults,
  // since cv11, ss01 and ss03 mean different things (or nothing) elsewhere.
  features: string;
  why: string;
};

const INTER_FEATURES = '"cv11", "ss01", "ss03"';

export const FACES: readonly Face[] = [
  {
    id: "inter",
    name: "Inter (today)",
    group: "control",
    family: "var(--font-sans)",
    weights: [400, 500, 600],
    features: INTER_FEATURES,
    why: "The control: what every label on the site is set in now.",
  },
  {
    id: "profa",
    name: "Profa",
    group: "family",
    family: "var(--lab-profa)",
    weights: [400, 700, 900],
    features: "normal",
    why: "The display family's own text cuts: the labels rhyme with the headlines instead of arguing with them.",
  },
  {
    id: "dm-mono",
    name: "DM Mono",
    group: "google",
    family: "var(--lab-dm-mono)",
    weights: [300, 400, 500],
    features: "normal",
    why: "A soft, round mono: reads as a builder's annotation without the terminal costume, and its geometry is close to Profa's.",
  },
  {
    id: "martian-mono",
    name: "Martian Mono",
    group: "google",
    family: "var(--lab-martian-mono)",
    weights: [300, 400, 500, 600],
    stretch: { min: 75, max: 112.5 },
    features: "normal",
    why: "A wide, engineered mono whose stance echoes Profa's width; the width axis lets it tuck in at small sizes.",
  },
  {
    id: "mona-sans",
    name: "Mona Sans",
    group: "google",
    family: "var(--lab-mona-sans)",
    weights: [400, 500, 600, 700],
    stretch: { min: 75, max: 125 },
    features: "normal",
    why: "A grotesk with a real width axis: pushed a little wide it carries Profa's proportions at label sizes.",
  },
  {
    id: "bricolage",
    name: "Bricolage Grotesque",
    group: "google",
    family: "var(--lab-bricolage)",
    weights: [300, 400, 500, 600, 700],
    stretch: { min: 75, max: 100 },
    features: "normal",
    why: "The most character on the list: optical sizing and ink traps that come alive at 12 to 14px.",
  },
  {
    id: "schibsted",
    name: "Schibsted Grotesk",
    group: "google",
    family: "var(--lab-schibsted)",
    weights: [400, 500, 600, 700],
    features: "normal",
    why: "A sturdy editorial grotesk: warmer and more opinionated than Inter, still quiet enough for meta lines.",
  },
  {
    id: "familjen",
    name: "Familjen Grotesk",
    group: "google",
    family: "var(--lab-familjen)",
    weights: [400, 500, 600, 700],
    features: "normal",
    why: "A grotesk with a hand in it: quirky joins and a compact rhythm that sits well under a heavy display face.",
  },
  {
    id: "scaver",
    name: "Scaver (Calvéra)",
    group: "disk",
    family: "var(--lab-scaver)",
    weights: [400, 700],
    features: "normal",
    why: "On disk: an upright display serif, the subtitle-face direction. Its italics are left out by the house rules.",
  },
  {
    id: "groste",
    name: "GROSTE",
    group: "disk",
    family: "var(--lab-groste)",
    weights: [400],
    features: "normal",
    why: "On disk: a wide, heavy grotesk. Doxent (capitals only) and Phonk (demo stamps on the comma and hyphen) are left out.",
  },
];

export const GROUP_LABELS: Record<FaceGroup, string> = {
  control: "Control",
  family: "The display family",
  google: "Google Fonts",
  disk: "Also on disk",
};

export function faceById(id: string): Face {
  return FACES.find((face) => face.id === id) ?? FACES[0];
}

// The fallback after the label face is Inter, so a glyph a face lacks (Profa
// has no left arrow for the back link) still draws in the site's own sans.
export function familyStack(face: Face): string {
  return face.id === "inter" ? `${face.family}, system-ui, sans-serif` : `${face.family}, var(--font-sans), system-ui, sans-serif`;
}

export function nearestWeight(face: Face, wanted: number): number {
  return face.weights.reduce((best, w) => (Math.abs(w - wanted) < Math.abs(best - wanted) ? w : best), face.weights[0]);
}
