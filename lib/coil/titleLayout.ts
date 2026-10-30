// A page title's letters as the page laid them out, for the title fill
// (components/coil/fill/title.ts): the DOM is the truth, so every glyph's place
// comes from the rendered text (one Range rect per character, viewport px) and
// nothing here wraps, sizes or measures text of its own. Lines are read off the
// rects: a character whose box sits below the current line's middle starts the
// next one, so a wrap, a phone width, a font-size clamp and a resize all just
// work. Pure, so the tests drive it with rects.

// One character of the heading's text and its box (viewport px). Collapsed
// whitespace has an empty box and is skipped.
export type CharRect = { readonly ch: string; readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };

export type TitleGlyph = { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number };

export type TitleLine = {
  readonly text: string; // the line as drawn, from its first glyph to its last
  readonly x: number; // the first glyph's pen start
  readonly top: number; // the line's text box (the font's content area)
  readonly bottom: number;
  readonly starts: readonly number[]; // each character's pen start, in step with text
};

export type TitleLayout = {
  readonly lines: readonly TitleLine[];
  readonly glyphs: readonly TitleGlyph[]; // every visible glyph's box, in reading order
  // The lines' union: where the mask goes (px from the origin).
  readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
};

const isSpace = (ch: string) => /^\s$/.test(ch);

// The rects in reading order, in px from `origin` (the fill's canvas).
export function layoutTitle(chars: readonly CharRect[], origin: { left: number; top: number }): TitleLayout {
  type Open = { chars: CharRect[]; top: number; bottom: number };
  const open: Open[] = [];
  for (const c of chars) {
    if (!(c.right - c.left > 0) || !(c.bottom - c.top > 0)) continue;
    const line = open.at(-1);
    const middle = line ? (line.top + line.bottom) / 2 : 0;
    if (!line || c.top >= middle) {
      // A space that hangs at a wrap belongs to no line's ink: it never starts one.
      if (isSpace(c.ch)) continue;
      open.push({ chars: [c], top: c.top, bottom: c.bottom });
    } else {
      line.chars.push(c);
      line.top = Math.min(line.top, c.top);
      line.bottom = Math.max(line.bottom, c.bottom);
    }
  }
  const lines: TitleLine[] = [];
  const glyphs: TitleGlyph[] = [];
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const line of open) {
    // Trailing spaces draw nothing.
    while (line.chars.length && isSpace(line.chars.at(-1)!.ch)) line.chars.pop();
    if (!line.chars.length) continue;
    const top = line.top - origin.top;
    const bottom = line.bottom - origin.top;
    for (const c of line.chars) {
      if (isSpace(c.ch)) continue;
      glyphs.push({ x0: c.left - origin.left, x1: c.right - origin.left, y0: top, y1: bottom });
    }
    const left = line.chars[0].left - origin.left;
    const right = Math.max(...line.chars.map((c) => c.right)) - origin.left;
    lines.push({ text: line.chars.map((c) => c.ch).join(""), x: left, top, bottom, starts: line.chars.map((c) => c.left - origin.left) });
    x0 = Math.min(x0, left);
    x1 = Math.max(x1, right);
    y0 = Math.min(y0, top);
    y1 = Math.max(y1, bottom);
  }
  const box = lines.length ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: 0, h: 0 };
  return { lines, glyphs, box };
}

// The per-letter reduction has a fixed number of slots (the shader's
// NAME.maxGlyphs less the greeting's): a title with more glyphs than that
// shares slots between neighbours on a line, the narrowest pair first, so
// every glyph is still held to the floor with the letters beside it.
export function packGlyphs(glyphs: readonly TitleGlyph[], slots: number): TitleGlyph[] {
  const out = glyphs.slice();
  while (out.length > Math.max(1, slots)) {
    let best = -1;
    for (let i = 0; i + 1 < out.length; i++) {
      if (out[i].y0 !== out[i + 1].y0) continue;
      if (best < 0 || out[i + 1].x1 - out[i].x0 < out[best + 1].x1 - out[best].x0) best = i;
    }
    // One glyph a line and still too many lines: the rest go unheld.
    if (best < 0) return out.slice(0, slots);
    const [a, b] = [out[best], out[best + 1]];
    out.splice(best, 2, { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: a.y0, y1: a.y1 });
  }
  return out;
}
