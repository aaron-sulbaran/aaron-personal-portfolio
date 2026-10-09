import { z } from "zod";

// The "web font" face: any Google Fonts family, by name, lab only. Its CSS
// comes from the Google Fonts CSS API at runtime and is injected as a
// <style>, so nothing is bundled and a new candidate needs no code: type its
// name in the panel, add it to FONT_CANDIDATES, or open the lab with
// ?font=Family+Name (repeatable).
//
// Which axes a family has, and their ranges, come from Fontsource's
// metadata API (it mirrors Google Fonts and answers with CORS; the Google
// CSS API refuses an axis a family lacks with a 400 that carries no CORS
// header, so probing it fills the console). The family is then fetched once
// as ranges, so the pointer's swell moves the weight and width axes through
// font-variation-settings, or as its list of static weights (then it grows
// or leans instead).

export type AxisTag = "wght" | "wdth" | "ROND";
export type AxisValues = Partial<Record<AxisTag, number>>;

export type FontCandidate = {
  family: string;
  weight: number;
  width: number;
  round: number;
  swell: number;
  widthSwell: number;
  why: string;
};

// From the font recon (2026-10-09), all OFL on Google Fonts: heavy and
// engineered rather than soft, each with a weight axis reaching 900.
export const FONT_CANDIDATES: readonly FontCandidate[] = [
  {
    family: "Hubot Sans",
    weight: 850,
    width: 108,
    round: 0,
    swell: 50,
    widthSwell: 17,
    why: "GitHub's display grotesk: squared shoulders, flat terminals. A width axis to 125, so the swell widens a letter as well as thickening it.",
  },
  {
    family: "Archivo",
    weight: 850,
    width: 110,
    round: 0,
    swell: 50,
    widthSwell: 15,
    why: "Archivo Black's own family as a variable font: broad, flat sided, its Black at width 110. Weight and width axes, so the swell does both.",
  },
  {
    family: "Geist",
    weight: 800,
    width: 100,
    round: 0,
    swell: 100,
    widthSwell: 0,
    why: "Vercel's grotesk: tight apertures, cut terminals, the most engineered of the set. Weight axis only.",
  },
  {
    family: "Google Sans Flex",
    weight: 850,
    width: 100,
    round: 0,
    swell: 60,
    widthSwell: 15,
    why: "Carries a roundness axis (ROND, 0 to 100): literally the too-soft dial, at 0 for crisp ends. Weight and width axes too.",
  },
];

// A candidate as the lab's settings carry it.
export function candidateFont(c: FontCandidate) {
  return { family: c.family, weight: c.weight, width: c.width, round: c.round, swell: c.swell, widthSwell: c.widthSwell };
}

export type WebFontInfo = {
  family: string; // as the CSS names it, quoted for font-family
  axes: Partial<Record<AxisTag, readonly [number, number]>>;
  weights: readonly number[]; // the static weights, when there is no weight axis
};

// The API wants lowercase tags first, then uppercase, each alphabetical.
const TAG_ORDER: readonly AxisTag[] = ["wdth", "wght", "ROND"];
const SAMPLE = "build.stuff";

export function normalizeFamily(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function fontQueryParams(search: string): string[] {
  return new URLSearchParams(search).getAll("font").map(normalizeFamily).filter(Boolean);
}

// `axes` like "wdth,wght@75..125,200..900", or "wght@900", or none.
export function cssUrl(family: string, axes?: string): string {
  const name = encodeURIComponent(normalizeFamily(family)).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${name}${axes ? `:${axes}` : ""}&display=block`;
}

export function axesQuery(axes: WebFontInfo["axes"]): string {
  const tags = TAG_ORDER.filter((t) => axes[t]);
  return tags.length ? `${tags.join(",")}@${tags.map((t) => `${axes[t]![0]}..${axes[t]![1]}`).join(",")}` : "";
}

export function parseFamilyName(css: string): string | null {
  return css.match(/font-family:\s*'([^']+)'/)?.[1] ?? null;
}

export function variationSettings(values: AxisValues): string {
  const parts = TAG_ORDER.filter((t) => values[t] !== undefined).map((t) => `"${t}" ${+values[t]!.toFixed(2)}`);
  return parts.length ? parts.join(", ") : "normal";
}

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

// Where the family rests and where the swell takes it at the pointer, from
// the lab's settings: every value clamped into the axis it moves; a static
// family rests at its nearest weight and cannot swell.
export function fontPose(info: WebFontInfo, f: { weight: number; width: number; round: number; swell: number; widthSwell: number }) {
  const rest: AxisValues = {};
  const heavy: AxisValues = {};
  const { wght, wdth, ROND } = info.axes;
  if (wght) {
    rest.wght = clamp(f.weight, wght);
    heavy.wght = clamp(f.weight + f.swell, wght);
  }
  if (wdth) {
    rest.wdth = clamp(f.width, wdth);
    heavy.wdth = clamp(f.width + f.widthSwell, wdth);
  }
  if (ROND) rest.ROND = heavy.ROND = clamp(f.round, ROND);
  const staticWeight = info.weights.length ? info.weights.reduce((best, w) => (Math.abs(w - f.weight) < Math.abs(best - f.weight) ? w : best)) : 400;
  const cssWeight = rest.wght ?? staticWeight;
  const canSwell = TAG_ORDER.some((t) => rest[t] !== heavy[t]);
  return { rest, heavy, cssWeight, heavyCssWeight: heavy.wght ?? cssWeight, canSwell };
}

// The axes between rest and the swell's end, at a swell share t (0 to 1).
export function poseAt(rest: AxisValues, heavy: AxisValues, t: number): AxisValues {
  const out: AxisValues = {};
  for (const tag of TAG_ORDER) {
    const a = rest[tag];
    if (a === undefined) continue;
    out[tag] = a + ((heavy[tag] ?? a) - a) * t;
  }
  return out;
}

const loads = new Map<string, Promise<WebFontInfo | null>>();

export function loadWebFont(family: string): Promise<WebFontInfo | null> {
  const key = normalizeFamily(family).toLowerCase();
  let pending = loads.get(key);
  if (!pending) {
    pending = load(normalizeFamily(family)).catch(() => null);
    loads.set(key, pending);
  }
  return pending;
}

const FONTSOURCE = "https://api.fontsource.org/v1";
const FamilyMeta = z.object({ family: z.string(), type: z.string(), variable: z.boolean(), weights: z.array(z.number()) });
const AxisMeta = z.object({ min: z.coerce.number(), max: z.coerce.number() });
const VariableMeta = z.object({ axes: z.record(z.string(), AxisMeta) });

export function fontsourceId(family: string): string {
  return normalizeFamily(family).toLowerCase().replace(/\s+/g, "-");
}

// The axes this lab moves, from Fontsource's variable metadata: each one a
// family really ranges over.
export function axesFrom(meta: z.infer<typeof VariableMeta> | null): WebFontInfo["axes"] {
  const axes: WebFontInfo["axes"] = {};
  for (const tag of TAG_ORDER) {
    const axis = meta?.axes[tag];
    if (axis && axis.max > axis.min) axes[tag] = [axis.min, axis.max];
  }
  return axes;
}

async function json<T>(url: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function stylesheet(url: string) {
  try {
    const res = await fetch(url);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function load(family: string): Promise<WebFontInfo | null> {
  const id = fontsourceId(family);
  const meta = await json(`${FONTSOURCE}/fonts/${id}`, FamilyMeta);
  if (!meta || meta.type !== "google" || !meta.weights.length) return null;
  const axes = meta.variable ? axesFrom(await json(`${FONTSOURCE}/variable/${id}`, VariableMeta)) : {};
  let info: WebFontInfo = { family: meta.family, axes, weights: axes.wght ? [] : meta.weights };
  let css = TAG_ORDER.some((t) => axes[t]) ? await stylesheet(cssUrl(meta.family, axesQuery(axes))) : null;
  if (!css) {
    info = { family: meta.family, axes: {}, weights: meta.weights };
    css = await stylesheet(cssUrl(meta.family, `wght@${meta.weights.join(";")}`));
  }
  if (!css) return null;
  const name = parseFamilyName(css) ?? meta.family;
  const styleId = `footer-lab-font-${id}`;
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = css;
    document.head.appendChild(style);
  }
  const quoted = `"${name}"`;
  const drawn = info.axes.wght ? [info.axes.wght[0], info.axes.wght[1]] : info.weights;
  await Promise.all(drawn.map((w) => document.fonts.load(`${w} 100px ${quoted}`, SAMPLE).catch(() => [])));
  if (!document.fonts.check(`${drawn[0]} 100px ${quoted}`, SAMPLE)) return null;
  return { ...info, family: quoted };
}
