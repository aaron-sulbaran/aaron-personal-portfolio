import { CanvasTexture, LinearMipmapLinearFilter, Vector4, type Texture } from "three";
import { COIL } from "@/lib/coil/constants";
import { NAME, NAME_SURFACE } from "@/lib/coil/field.glsl";
import { FIELD_WINDOW_VERT } from "@/lib/coil/nameCanvas.glsl";
import { clamp01 } from "@/lib/coil/geometry";
import { siteEase } from "@/lib/coil/motion";
import { applyColor, parseColor, type Rgba } from "@/lib/coil/theme";
import { layoutTitle, packGlyphs, type CharRect, type TitleLayout } from "@/lib/coil/titleLayout";
import { createGlyphReduction } from "../scene/glyphReduction";
import { startFill, type FillHooks, type FillParts, type FillRuntime, type FillStats } from "./engine";

// A page title's lettering for the fill (./engine.ts): the same field, motion
// and sheen as page 1's name, inside the letters of a real heading. The DOM is
// the truth: every glyph's place is read off the rendered text (one Range rect
// per character, lib/coil/titleLayout.ts), so wrapping, phone widths, the
// font-size clamps and resizes just work, and the heading stays the heading
// (its element, its accessible name, its selection); this canvas is aria-hidden.
//
// The handoff is the name's: the first frame draws the title's own ink, solid,
// exactly where the DOM text is (the page then hides the DOM's glyphs in the
// same frame), and the surface grows over it in NAME.surfaceInMs, on screen:
// its clock only runs with the loop, which only runs while the title shows.
// The surface's folds are the name's size (a px here is a px there).

type TitleMask = { canvas: HTMLCanvasElement; rect: { x: number; y: number; w: number; h: number }; layout: TitleLayout };

// The heading's characters and their boxes, in reading order.
function readChars(heading: HTMLElement): CharRect[] {
  const out: CharRect[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    let i = 0;
    for (const ch of text) {
      range.setStart(node, i);
      range.setEnd(node, i + ch.length);
      const r = range.getBoundingClientRect();
      out.push({ ch, left: r.left, right: r.right, top: r.top, bottom: r.bottom });
      i += ch.length;
    }
  }
  return out;
}

function fontOf(style: CSSStyleDeclaration) {
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function transform(text: string, how: string) {
  if (how === "uppercase") return text.toUpperCase();
  if (how === "lowercase") return text.toLowerCase();
  return text;
}

// The letters in white on clear, at `scale` device px per CSS px, from the
// DOM's own lines. A line is drawn whole (the face's own shaping, as the page
// shapes it); where the canvas's pen would drift from the page's glyphs by
// more than a hair, each glyph is drawn at the page's own place instead.
function paintMask(heading: HTMLElement, origin: DOMRect, scale: number): TitleMask | null {
  const layout = layoutTitle(readChars(heading), origin);
  if (!layout.lines.length) return null;
  const style = getComputedStyle(heading);
  const size = parseFloat(style.fontSize) || 16;
  const pad = Math.ceil(size * COIL.lockup.pad);
  const rect = { x: layout.box.x - pad, y: layout.box.y - pad, w: layout.box.w + 2 * pad, h: layout.box.h + 2 * pad };
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rect.w * scale);
  canvas.height = Math.ceil(rect.h * scale);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = "white";
  g.textBaseline = "alphabetic";
  g.font = fontOf(style);
  g.fontKerning = "normal";
  const spacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
  for (const line of layout.lines) {
    const text = transform(line.text, style.textTransform);
    g.letterSpacing = spacing;
    const ascent = g.measureText(text).fontBoundingBoxAscent;
    const baseline = line.top - rect.y + ascent;
    const chars = [...text];
    let drift = 0;
    let prefix = "";
    chars.forEach((ch, i) => {
      drift = Math.max(drift, Math.abs(line.x + g.measureText(prefix).width - line.starts[i]));
      prefix += ch;
    });
    if (drift <= 0.75) {
      g.fillText(text, line.x - rect.x, baseline);
      continue;
    }
    g.letterSpacing = "0px";
    chars.forEach((ch, i) => g.fillText(ch, line.starts[i] - rect.x, baseline));
  }
  return { canvas, rect, layout };
}

// The name's surface scale: NAME_SURFACE.viewHeight across its lockup (the
// h1's box and the mask's rim), read off page 1; without a name on the page,
// a lockup as tall as the name's is to its line.
function nameUnitsPerPx(fontPx: number) {
  const name = document.querySelector<HTMLElement>("[data-coil-name]");
  const rect = name?.getBoundingClientRect();
  const size = name ? parseFloat(getComputedStyle(name).fontSize) : 0;
  const lockup = rect && rect.height > 0 && size > 0 ? rect.height + 2 * size * COIL.lockup.pad : 5 * fontPx;
  return NAME_SURFACE.viewHeight / Math.max(1, lockup);
}

// The field a title's letters are made of: its own box's (the name's way), or,
// for a title on the Coil's field, the window of that field it sits on
// (Aaron, 2026-10-30: "base it on the blue around the cards"), so the ink's
// floor stands off the very field behind it. `backdrop` gives that field's
// canvas, or null where the title is off it.
export type TitleFillOptions = { backdrop?: () => HTMLElement | null };

function createTitleLettering({ ctx, gl, field, surface, glyphTargets }: FillParts, heading: HTMLElement, canvas: HTMLCanvasElement, options: TitleFillOptions) {
  const { st } = ctx;
  const { view } = st;
  const cu = field.compMaterial.uniforms;
  const fu = field.fieldMaterial.uniforms;
  const windowed = Boolean(options.backdrop);
  if (windowed) {
    fu.uWindow = { value: new Vector4(0, 0, 1, 1) };
    field.fieldMaterial.vertexShader = FIELD_WINDOW_VERT;
    field.fieldMaterial.needsUpdate = true;
  }
  // Where this canvas is in the backdrop's frame, each frame (the title and
  // the Coil's stage scroll apart); a move redraws the field.
  function frameField() {
    if (!windowed) return;
    const own = canvas.getBoundingClientRect();
    const frame = options.backdrop?.()?.getBoundingClientRect();
    const on = frame && frame.width > 0 && frame.height > 0 && own.bottom > frame.top && own.top < frame.bottom && own.right > frame.left && own.left < frame.right;
    const w = fu.uWindow.value as Vector4;
    const was = [w.x, w.y, w.z, w.w, fu.uAspect.value as number].join();
    if (on) {
      w.set((own.left - frame.left) / frame.width, (frame.bottom - own.bottom) / frame.height, own.width / frame.width, own.height / frame.height);
      fu.uAspect.value = frame.width / frame.height;
    } else {
      w.set(0, 0, 1, 1);
      fu.uAspect.value = view.width / view.height;
    }
    if ([w.x, w.y, w.z, w.w, fu.uAspect.value as number].join() !== was) st.lastFieldTime = Number.NaN;
  }
  // The solid is the title's own ink, whole; the rest is the name's.
  cu.uSolidK = { value: 1 };
  cu.uGlyphRows.value = 1;
  const reduction = createGlyphReduction(gl, field.compMaterial, glyphTargets, surface);
  let texture: Texture | null = null;
  let mask: TitleMask | null = null;
  let surfaceInS = 0; // seconds of the surface growing in, on screen

  // The DOM's ink, solid: what the first frame draws, under the DOM's own glyphs.
  function applyTheme() {
    const ink: Rgba = parseColor(getComputedStyle(heading).color) ?? st.theme.ink;
    applyColor(cu.uGradTop.value, ink);
    applyColor(cu.uGradBottom.value, ink);
  }

  function layout() {
    const scale = Math.min(2, window.devicePixelRatio || 1);
    mask = paintMask(heading, canvas.getBoundingClientRect(), scale);
    texture?.dispose();
    texture = null;
    if (!mask) {
      cu.uNameA.value = 0;
      return;
    }
    const next = new CanvasTexture(mask.canvas);
    next.generateMipmaps = true;
    next.minFilter = LinearMipmapLinearFilter;
    next.anisotropy = 4;
    texture = next;
    const { rect, layout: laid } = mask;
    cu.uName.value = next;
    cu.uNameRect.value.set(rect.x, rect.y, rect.w, rect.h);
    cu.uNameSpan.value.set(0, 1);
    cu.uGreetSplit.value = 0;
    cu.uLod.value = Math.max(0, Math.log2(mask.canvas.height / (rect.h * view.dpr)));
    cu.uNameA.value = 1;
    cu.uGreetA.value = 0;
    cu.uGrain.value = 0;
    // Each glyph's box in the rect's uv, for the per-letter minimum; the greeting's slot stays empty.
    const boxes = cu.uGlyphBox.value as Vector4[];
    const glyphs = packGlyphs(laid.glyphs, NAME.maxGlyphs - 1);
    boxes.forEach((box) => box.set(0, 0, 0, 0));
    glyphs.forEach((glyph, i) => boxes[i].set((glyph.x0 - rect.x) / rect.w, (glyph.y0 - rect.y) / rect.h, (glyph.x1 - rect.x) / rect.w, (glyph.y1 - rect.y) / rect.h));
    cu.uGlyphN.value = glyphs.length;
    surface.layout(rect, view.dpr, nameUnitsPerPx(parseFloat(getComputedStyle(heading).fontSize) || 16));
    frameField();
  }

  return {
    ready: async () => {
      await document.fonts.ready;
      const font = fontOf(getComputedStyle(heading));
      await Promise.race([document.fonts.load(font).then(() => undefined), new Promise<void>((resolve) => window.setTimeout(resolve, 6000))]);
    },
    layout,
    applyTheme,
    fade() {
      frameField();
      cu.uSurfIn.value = siteEase(clamp01((surfaceInS * 1000) / NAME.surfaceInMs));
    },
    step(dt: number) {
      surfaceInS += dt;
      surface.step(dt, ctx.live.current.input === "fine");
    },
    renderSurface(dt: number) {
      if (!mask) return;
      surface.render(true);
      reduction.render(dt);
    },
    scenes: () => [reduction.scene],
    observe: () => [heading],
    dispose() {
      texture?.dispose();
      reduction.dispose();
      surface.dispose();
    },
    // QA: the mask and where it is (viewport px), the glyphs it holds.
    mask: () => {
      if (!mask) return null;
      const at = canvas.getBoundingClientRect();
      return { canvas: mask.canvas, rect: { ...mask.rect, x: mask.rect.x + at.left, y: mask.rect.y + at.top }, layout: mask.layout, origin: { left: at.left, top: at.top } };
    },
    surfaceIn: () => cu.uSurfIn.value as number,
    glyphMeans: reduction.means,
  };
}

export type TitleFillRuntime = FillRuntime & {
  stats: () => FillStats & { surfaceIn: number };
  mask: ReturnType<typeof createTitleLettering>["mask"];
  glyphMeans: () => number[];
};

export function startTitleFill(canvas: HTMLCanvasElement, heading: HTMLElement, hooks: FillHooks, options: TitleFillOptions = {}): TitleFillRuntime {
  const fill = startFill(canvas, (parts) => createTitleLettering(parts, heading, canvas, options), hooks, { compileAsync: true });
  // A font that swaps in late moves every glyph: lay out again.
  const onFonts = () => fill.relayout();
  document.fonts.addEventListener("loadingdone", onFonts);
  return {
    relayout: fill.relayout,
    setPaused: fill.setPaused,
    dispose() {
      document.fonts.removeEventListener("loadingdone", onFonts);
      fill.dispose();
    },
    stats: () => ({ ...fill.stats(), surfaceIn: fill.lettering.surfaceIn() }),
    mask: fill.lettering.mask,
    glyphMeans: fill.lettering.glyphMeans,
  };
}
