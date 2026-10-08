// Profa Black's metrics for the comparison face, measured in a 2D canvas once
// the font has loaded: each letter's start along the word (kerning included)
// and its ink, per px of font size. The face is the site's own
// (--font-display on <html>, lib/fonts.ts).

export type ProfaMetrics = {
  readonly ascent: number; // the b's ink above the baseline, per px of font size
  readonly starts: readonly number[];
  readonly advances: readonly number[];
  readonly mids: readonly number[]; // each letter's ink middle above the baseline
  readonly inkTops: readonly number[];
};

export async function measureProfa(text: string): Promise<ProfaMetrics | null> {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim();
  if (!family) return null;
  const font = `900 100px ${family}`;
  try {
    await document.fonts.load(font, text);
  } catch {
    return null;
  }
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  ctx.font = font;
  const chars = [...text];
  const starts = chars.map((_, i) => ctx.measureText(chars.slice(0, i).join("")).width / 100);
  const advances = chars.map((c) => ctx.measureText(c).width / 100);
  const ink = chars.map((c) => ctx.measureText(c));
  return {
    ascent: ctx.measureText("b").actualBoundingBoxAscent / 100,
    starts,
    advances,
    mids: ink.map((m) => (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 200),
    inkTops: ink.map((m) => m.actualBoundingBoxAscent / 100),
  };
}
