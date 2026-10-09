// A typeset face's metrics for the wordmark (Profa Black, or a web font),
// per px of font size, once the font has loaded: each letter's start along
// the word (kerning included) and advance at rest and at the swell's end,
// and its ink. Advances are measured in the DOM, which honors
// font-variation-settings (width, roundness) and ligatures off; the ink in a
// 2D canvas at the weight, which is all that moves it vertically. Pure
// layout over them lives in wordLayout.ts.

export type TypeMetrics = {
  readonly ascent: number; // the b's ink above the baseline, the wordmark's unit
  readonly starts: readonly number[];
  readonly advances: readonly number[];
  readonly heavyAdvances: readonly number[]; // at the swell's end (the same when it cannot swell)
  readonly mids: readonly number[]; // each letter's ink middle above the baseline
  readonly inkTops: readonly number[]; // the larger of both poses
  readonly inkBottoms: readonly number[]; // ink below the baseline, the larger of both poses
};

export type Pose = { readonly weight: number; readonly variation: string };

const PX = 100;

function rowMetrics(text: string, family: string, pose: Pose) {
  const host = document.createElement("div");
  Object.assign(host.style, {
    position: "absolute",
    left: "-99999px",
    top: "0",
    visibility: "hidden",
    whiteSpace: "pre",
    fontFamily: family,
    fontSize: `${PX}px`,
    fontWeight: String(pose.weight),
    fontVariationSettings: pose.variation,
    fontVariantLigatures: "none",
    fontKerning: "normal",
    fontSynthesis: "none",
    lineHeight: "1",
  });
  const word = document.createElement("span");
  word.textContent = text;
  host.appendChild(word);
  const singles = [...text].map((c) => {
    const span = document.createElement("span");
    span.textContent = c;
    host.appendChild(document.createElement("br"));
    host.appendChild(span);
    return span;
  });
  document.body.appendChild(host);
  const node = word.firstChild as Text;
  const range = document.createRange();
  const left = (i: number) => {
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    return range.getBoundingClientRect().left;
  };
  const origin = left(0);
  const starts = [...text].map((_, i) => (left(i) - origin) / PX);
  const advances = singles.map((s) => s.getBoundingClientRect().width / PX);
  host.remove();
  return { starts, advances };
}

export async function measureFace(text: string, family: string, rest: Pose, heavy: Pose): Promise<TypeMetrics | null> {
  const fontAt = (weight: number) => `${weight} ${PX}px ${family}`;
  try {
    await Promise.all([document.fonts.load(fontAt(rest.weight), text), document.fonts.load(fontAt(heavy.weight), text)]);
  } catch {
    return null;
  }
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  const chars = [...text];
  const inkAt = (weight: number) => {
    ctx.font = fontAt(weight);
    return { ascent: ctx.measureText("b").actualBoundingBoxAscent / PX, ink: chars.map((c) => ctx.measureText(c)) };
  };
  const light = inkAt(rest.weight);
  const dark = heavy.weight === rest.weight ? light : inkAt(heavy.weight);
  if (!(light.ascent > 0)) return null;
  const row = rowMetrics(text, family, rest);
  const heavyRow = heavy.weight === rest.weight && heavy.variation === rest.variation ? row : rowMetrics(text, family, heavy);
  return {
    ascent: light.ascent,
    starts: row.starts,
    advances: row.advances,
    heavyAdvances: heavyRow.advances,
    mids: light.ink.map((m) => (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / (2 * PX)),
    inkTops: light.ink.map((m, i) => Math.max(m.actualBoundingBoxAscent, dark.ink[i].actualBoundingBoxAscent) / PX),
    inkBottoms: light.ink.map((m, i) => Math.max(m.actualBoundingBoxDescent, dark.ink[i].actualBoundingBoxDescent) / PX),
  };
}
