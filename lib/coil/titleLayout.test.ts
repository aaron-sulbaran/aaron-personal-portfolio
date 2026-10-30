import { describe, expect, it } from "vitest";
import { layoutTitle, packGlyphs, type CharRect } from "./titleLayout";

// A monospace stand-in for the page's text: each character `advance` px wide,
// lines `lineHeight` apart, wrapped at `width` the way the browser wraps (at a
// space; the space that ends a line hangs there). Viewport px.
function typeset(text: string, { width, advance = 10, lineHeight = 30, box = 24, left = 100, top = 200 }: { width: number; advance?: number; lineHeight?: number; box?: number; left?: number; top?: number }): CharRect[] {
  const out: CharRect[] = [];
  let x = 0;
  let line = 0;
  const words = text.split(" ");
  words.forEach((word, w) => {
    if (x > 0 && x + word.length * advance > width) {
      line += 1;
      x = 0;
    }
    for (const ch of word) {
      out.push({ ch, left: left + x, right: left + x + advance, top: top + line * lineHeight, bottom: top + line * lineHeight + box });
      x += advance;
    }
    if (w < words.length - 1) {
      out.push({ ch: " ", left: left + x, right: left + x + advance, top: top + line * lineHeight, bottom: top + line * lineHeight + box });
      x += advance;
    }
  });
  return out;
}

describe("a title's letters, read off the page's own layout", () => {
  it("keeps one line as one line, in px from the canvas, with every glyph's box", () => {
    const layout = layoutTitle(typeset("proof of work", { width: 1000 }), { left: 90, top: 190 });
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0]).toMatchObject({ text: "proof of work", x: 10, top: 10, bottom: 34 });
    expect(layout.glyphs).toHaveLength(11);
    expect(layout.glyphs[0]).toEqual({ x0: 10, x1: 20, y0: 10, y1: 34 });
    expect(layout.box).toEqual({ x: 10, y: 10, w: 130, h: 24 });
  });

  it("follows the browser's wrap: a line a row, the hanging space dropped, each glyph on its own row", () => {
    const layout = layoutTitle(typeset("here's what i've been up to.", { width: 110 }), { left: 100, top: 200 });
    expect(layout.lines.map((line) => line.text)).toEqual(["here's what", "i've been", "up to."]);
    expect(layout.lines.map((line) => line.top)).toEqual([0, 30, 60]);
    for (const line of layout.lines) expect(line.x).toBe(0);
    // The glyphs carry their own line's rows: the shader's per-letter test needs both axes.
    const rows = [...new Set(layout.glyphs.map((g) => g.y0))];
    expect(rows).toEqual([0, 30, 60]);
    expect(layout.glyphs).toHaveLength(23);
    expect(layout.box).toEqual({ x: 0, y: 0, w: 110, h: 84 });
  });

  it("lays out again from new rects after a resize: the same words, new lines, new places", () => {
    const wide = layoutTitle(typeset("here's what i've been up to.", { width: 400 }), { left: 100, top: 200 });
    const narrow = layoutTitle(typeset("here's what i've been up to.", { width: 110 }), { left: 100, top: 200 });
    expect(wide.lines).toHaveLength(1);
    expect(narrow.lines).toHaveLength(3);
    expect(wide.glyphs).toHaveLength(narrow.glyphs.length);
    expect(wide.box.w).toBeGreaterThan(narrow.box.w);
    expect(narrow.box.h).toBeGreaterThan(wide.box.h);
    // A larger font (a clamp crossing a breakpoint) moves every glyph with it.
    const bigger = layoutTitle(typeset("wanna chat?", { width: 1000, advance: 20, box: 48 }), { left: 100, top: 200 });
    expect(bigger.glyphs[1].x0).toBe(20);
    expect(bigger.lines[0].bottom).toBe(48);
  });

  it("skips collapsed whitespace (an empty box) and starts no line on a space", () => {
    const chars: CharRect[] = [
      { ch: "\n", left: 0, right: 0, top: 0, bottom: 0 },
      { ch: "a", left: 10, right: 20, top: 0, bottom: 20 },
      { ch: " ", left: 20, right: 25, top: 0, bottom: 20 },
      { ch: " ", left: 0, right: 5, top: 30, bottom: 50 },
      { ch: "b", left: 0, right: 10, top: 30, bottom: 50 },
    ];
    const layout = layoutTitle(chars, { left: 0, top: 0 });
    expect(layout.lines.map((line) => line.text)).toEqual(["a", "b"]);
    expect(layout.lines[1].x).toBe(0);
  });

  it("an empty heading is nothing at all", () => {
    expect(layoutTitle([], { left: 0, top: 0 })).toEqual({ lines: [], glyphs: [], box: { x: 0, y: 0, w: 0, h: 0 } });
  });
});

describe("the per-letter slots", () => {
  it("leaves a title that fits as it is", () => {
    const glyphs = layoutTitle(typeset("wanna chat?", { width: 1000 }), { left: 0, top: 0 }).glyphs;
    expect(packGlyphs(glyphs, 47)).toEqual(glyphs);
  });

  it("shares slots between neighbours on a line, never across lines, covering every glyph", () => {
    const glyphs = layoutTitle(typeset("here's what i've been up to.", { width: 110 }), { left: 0, top: 0 }).glyphs;
    const packed = packGlyphs(glyphs, 10);
    expect(packed).toHaveLength(10);
    for (const glyph of glyphs) expect(packed.some((slot) => slot.y0 === glyph.y0 && slot.x0 <= glyph.x0 && slot.x1 >= glyph.x1)).toBe(true);
  });
});
