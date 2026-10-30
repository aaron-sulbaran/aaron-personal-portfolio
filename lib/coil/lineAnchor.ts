// Where the page lays a line of text out and where it paints it, viewport px.
// The layout: a 0 by 0 inline-block put just before the text sits on the
// line's baseline at the pen (an empty inline-block's baseline is its bottom
// edge); it is read and removed in the same task, so nothing paints and the
// line never moves (it has no width and no height above the baseline). The
// paint: Chrome sets a run of text down from its text box's top rounded to a
// whole px, its baseline a whole px below that (the face's ascent, rounded),
// and its pen where the layout has it (glyphs sit on subpixels across). So
// the painted baseline is the layout's moved by the box top's rounding
// (measured on page 1's name across ten widths, 2026-10-30: ten of ten). On a
// Mac the px is a CSS px whatever the screen's density (Chrome lays out in
// CSS px there); elsewhere it lays out, and rounds, in device px. The canvas
// fills draw their letters on the painted baseline (components/coil/fill).

export type LineAnchor = { x: number; y: number; top: number };

export function lineAnchor(text: Text): LineAnchor | null {
  const parent = text.parentNode;
  if (!parent) return null;
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText = "display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline";
  parent.insertBefore(probe, text);
  const r = probe.getBoundingClientRect();
  probe.remove();
  const range = document.createRange();
  const start = (text.textContent ?? "").search(/\S/);
  range.setStart(text, Math.max(0, start));
  range.setEnd(text, Math.max(0, start) + 1);
  const box = range.getBoundingClientRect();
  return { x: r.left, y: r.top, top: box.top };
}

// The px text is laid out and rounded in: a CSS px on a Mac, a device px elsewhere.
export function textPx(dpr: number): number {
  const mac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform || navigator.userAgent);
  return mac ? 1 : dpr > 0 ? dpr : 1;
}

// The baseline the page paints a line on (viewport px), from its layout: the
// layout's baseline moved as its text box's top is rounded, in the page's own
// coordinates (`scrollY`), at `perPx` px per CSS px.
export function paintedBaseline(at: LineAnchor, scrollY: number, perPx: number): number {
  const top = at.top + scrollY;
  return at.y + (Math.round(top * perPx) / perPx - top);
}

// The first text node with something to draw under `el`.
export function firstText(el: Node): Text | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node.textContent ?? "").trim()) return node as Text;
  return null;
}

// A 2D canvas whose text is set as `el`'s own text is: drawn while the canvas
// sits inside `el`, so its font resolves against `el`'s style and takes the
// page's typographic settings the `font` string cannot carry (the body's
// stylistic sets, its antialiased smoothing: a canvas outside the document
// draws "i'm" with the face's default apostrophe and a smoothed, bolder stem).
// The canvas is out of the flow and unseen, and gone again before the task ends.
export function paintAsText<T>(el: HTMLElement, width: number, height: number, draw: (g: CanvasRenderingContext2D) => T): { canvas: HTMLCanvasElement; value: T } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:absolute;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none";
  el.appendChild(canvas);
  try {
    const g = canvas.getContext("2d");
    if (!g) throw new Error("2d context unavailable");
    return { canvas, value: draw(g) };
  } finally {
    canvas.remove();
  }
}
