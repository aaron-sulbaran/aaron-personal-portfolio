import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  NearestFilter,
  ShaderMaterial,
  WebGLRenderTarget,
  type Texture,
  type Vector4,
} from "three";
import { siteContent } from "@/lib/content";
import { COIL } from "@/lib/coil/constants";
import { FIELD, NAME } from "@/lib/coil/field.glsl";
import { nameCompositeInk } from "@/lib/coil/debugFlags";
import { clamp01, isNarrow } from "@/lib/coil/geometry";
import { siteEase } from "@/lib/coil/motion";
import { nameInkGain } from "@/lib/coil/nameInk";
import { paintAsText } from "@/lib/coil/lineAnchor";
import { maskGrid } from "@/lib/coil/pixelGrid";
import { getIntroKnobs } from "@/lib/home/introKnobs";
import { toBytes } from "@/lib/coil/theme";
import type { NameTarget } from "@/lib/coil/nameTarget";
import { createGlyphReduction } from "./glyphReduction";
import type { NameSurface } from "./nameSurface";
import type { Gl } from "./renderer";
import type { LoopLink, SceneCtx } from "./state";

// The canvas name: "Hi, I'm" and "Aaron" in one mask the composite pass
// fills with the lit surface (nameSurface.ts), its layout, its fades (the
// entrance, the loader's handoff, the greeting, the surface growing over the
// loader's solid name), and the loader's continuity exit (nameRect, landName).

// ---- fx-hero: the name lockup and the greeting's fade ----
// "Hi, I'm" and "Aaron" in one mask, both Profa Black in white on clear: the
// greeting small (its cap height NAME.greetingCap of the name's), on the
// name's left edge, its lowest ink a fraction of its own cap height above the
// top of the "A". Everything in CSS px; the canvas is `scale` times that.
// The proportions are COIL.lockup's, which the loader's DOM lockup shares.
type NameLockup = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pad: number;
  nameInkWidth: number;
  inkBearing: number; // how far the name's ink reaches left of its pen start (negative: right of it)
  ascent: number; // the name's
  descent: number;
  greetBlock: number; // the greeting's band above the name's own mask
  split: number; // where the greeting's alpha gives way to the name's
  greetCap: number; // the greeting's cap height (its "H")
  greetPx: number; // the greeting's font size
  greetBaseline: number; // the greeting's baseline, from the mask's top
  glyphs: { x0: number; x1: number }[]; // each letter's advance box, from the mask's left
  greetX: { x0: number; x1: number }; // the greeting's ink, from the mask's left
};

function paintNameLockup(greeting: string, name: string, family: string, sizePx: number, scale: number): NameLockup {
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  g.font = `900 100px ${family}`;
  const cap100 = g.measureText("H").actualBoundingBoxAscent || 70;
  const nameFont = `900 ${sizePx}px ${family}`;
  g.font = nameFont;
  const nm = g.measureText(name);
  const greetPx = ((NAME.greetingCap * nm.actualBoundingBoxAscent) / cap100) * 100;
  const greetFont = `900 ${greetPx}px ${family}`;
  g.font = greetFont;
  const gm = g.measureText(greeting);
  const gAscent = gm.actualBoundingBoxAscent;
  const gDescent = Math.max(0, gm.actualBoundingBoxDescent);
  const gap = NAME.greetingGap * gAscent;
  const greetBlock = gAscent + gDescent + gap;
  const pad = Math.ceil(sizePx * COIL.lockup.pad);
  const nameInkWidth = nm.actualBoundingBoxLeft + nm.actualBoundingBoxRight;
  const greetInkWidth = gm.actualBoundingBoxLeft + gm.actualBoundingBoxRight;
  // The greeting's stem sits a hair inside the A's foot, as the lab's did.
  const greetShift = sizePx * COIL.lockup.greetingShift;
  const width = Math.ceil(Math.max(nameInkWidth, greetShift + greetInkWidth) + pad * 2);
  const height = Math.ceil(greetBlock + nm.actualBoundingBoxAscent + nm.actualBoundingBoxDescent + pad * 2);
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.clearRect(0, 0, width, height);
  g.fillStyle = "white";
  g.textBaseline = "alphabetic";
  g.font = greetFont;
  const greetX0 = pad + greetShift;
  g.fillText(greeting, greetX0 + gm.actualBoundingBoxLeft, pad + gAscent);
  g.font = nameFont;
  const penX = pad + nm.actualBoundingBoxLeft;
  g.fillText(name, penX, pad + greetBlock + nm.actualBoundingBoxAscent);
  const glyphs = [...name].map((_, i) => ({
    x0: penX + g.measureText(name.slice(0, i)).width,
    x1: penX + g.measureText(name.slice(0, i + 1)).width,
  }));
  return {
    canvas,
    width,
    height,
    pad,
    nameInkWidth,
    inkBearing: nm.actualBoundingBoxLeft,
    ascent: nm.actualBoundingBoxAscent,
    descent: nm.actualBoundingBoxDescent,
    greetBlock,
    split: pad + gAscent + gDescent + gap / 2,
    greetCap: (greetPx * cap100) / 100,
    greetPx,
    greetBaseline: pad + gAscent,
    glyphs,
    greetX: { x0: greetX0, x1: greetX0 + greetInkWidth },
  };
}

// The lockup where the page lays it out (the name's own canvas, hero rework
// slice 4d): each line painted at the page's own pen and baseline at the page's
// own size, on the canvas's device grid (lib/coil/pixelGrid.ts): the mask's
// pixels are the buffer's, its corner on one, and both baselines on whole
// rows, so the glyphs are the page's own glyphs, pixel for pixel, and nothing
// resamples them. `scale` is the buffer's px per CSS px. Everything returned is
// CSS px, the rect's corner from the canvas's drawn corner.
function paintPlacedLockup(heading: HTMLElement, greeting: string, name: string, family: string, at: NamePlacement, scale: number): NameLockup & { x: number; y: number; greetTop: number } {
  const nameFont = `900 ${at.name.size}px ${family}`;
  const greetFont = `900 ${at.greeting.size}px ${family}`;
  const n = at.name;
  const gr = at.greeting;
  const pad = Math.ceil(n.size * COIL.lockup.pad);
  // One canvas, set in the heading's type: measured, sized to the mask, painted.
  const { canvas, value } = paintAsText(heading, 1, 1, (probe, mask) => {
    probe.fontKerning = "normal";
    probe.font = greetFont;
    const gm = probe.measureText(greeting);
    const greetCap = probe.measureText("H").actualBoundingBoxAscent;
    probe.font = nameFont;
    const nm = probe.measureText(name);
    const inkLeft = Math.min(n.pen - nm.actualBoundingBoxLeft, gr.pen - gm.actualBoundingBoxLeft);
    const inkRight = Math.max(n.pen + nm.actualBoundingBoxRight, gr.pen + gm.actualBoundingBoxRight);
    const inkTop = gr.baseline - gm.actualBoundingBoxAscent;
    const inkBottom = n.baseline + nm.actualBoundingBoxDescent;
    const { px, rect } = maskGrid({ x: inkLeft - pad, y: inkTop - pad, w: inkRight - inkLeft + 2 * pad, h: inkBottom - inkTop + 2 * pad }, scale);
    // Sizing the canvas clears its state: everything is set again after.
    mask.width = px.w;
    mask.height = px.h;
    const g = probe;
    g.setTransform(scale, 0, 0, scale, -px.x, -px.y);
    g.fillStyle = "white";
    g.textBaseline = "alphabetic";
    g.fontKerning = "normal";
    g.font = greetFont;
    g.fillText(greeting, gr.pen, gr.baseline);
    g.font = nameFont;
    g.fillText(name, n.pen, n.baseline);
    const glyphs = [...name].map((_, i) => ({
      x0: n.pen + g.measureText(name.slice(0, i)).width - rect.x,
      x1: n.pen + g.measureText(name.slice(0, i + 1)).width - rect.x,
    }));
    return { gm, nm, greetCap, rect, inkTop, glyphs };
  });
  const { gm, nm, greetCap, rect, inkTop, glyphs } = value;
  const capTop = n.baseline - nm.actualBoundingBoxAscent;
  const greetLow = gr.baseline + Math.max(0, gm.actualBoundingBoxDescent);
  return {
    canvas,
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    pad,
    nameInkWidth: nm.actualBoundingBoxLeft + nm.actualBoundingBoxRight,
    inkBearing: nm.actualBoundingBoxLeft,
    ascent: nm.actualBoundingBoxAscent,
    descent: nm.actualBoundingBoxDescent,
    // The name's own band starts a pad above its cap top; the greeting is everything above it.
    greetBlock: capTop - pad - rect.y,
    split: (greetLow + capTop) / 2 - rect.y,
    greetCap,
    greetPx: gr.size,
    greetBaseline: gr.baseline - rect.y,
    greetTop: inkTop - rect.y,
    glyphs,
    greetX: { x0: gr.pen - gm.actualBoundingBoxLeft - rect.x, x1: gr.pen + gm.actualBoundingBoxRight - rect.x },
  };
}

// The greeting shows with the name: the loader lands both, or both rise as
// the band opens.
// ---- end fx-hero ----

// The per-letter reduction's two targets (one texel per letter; each frame
// eases from one into the other), made before the composite that reads them.
export function createGlyphTargets(): [WebGLRenderTarget, WebGLRenderTarget] {
  const make = () => new WebGLRenderTarget(NAME.maxGlyphs, 1, { depthBuffer: false, minFilter: NearestFilter, magFilter: NearestFilter });
  return [make(), make()];
}

// A frame's name inputs: the time, and whether the loader is to land the name
// (a loader that was running when the name was made lands it regardless).
export type NameFrame = {
  now: number;
  nameFromLoader: boolean;
};

// Where the page lays its own lockup out, in the name's canvas (CSS px from the
// canvas's drawn corner): each line's pen, its baseline (on a whole device px,
// where the page paints it) and its font size; that corner in the viewport;
// and the heading whose type the letters are set in. A name with none is
// centered, as the hero's name always was.
export type LinePlacement = { pen: number; baseline: number; size: number };
export type NamePlacement = { name: LinePlacement; greeting: LinePlacement; corner: { left: number; top: number }; heading: HTMLElement };

// The page's loader (components/home/loader) is on the screen: armed by the head
// script, and not yet done.
function loaderRuns() {
  const state = document.documentElement.dataset.introLoader;
  return state === "on" || state === "shrink";
}

export function createName(
  ctx: SceneCtx,
  gl: Gl,
  comp: ShaderMaterial,
  surface: NameSurface,
  glyphTargets: [WebGLRenderTarget, WebGLRenderTarget],
  loop: LoopLink,
) {
  const { st, host, live, flags } = ctx;
  const { view } = st;
  const { posterMode } = flags;
  // The per-letter reduction reads what the composite reads (shared uniforms).
  const cu = comp.uniforms;
  const reduction = createGlyphReduction(gl, comp, glyphTargets, surface);
  let greetBlock = 0; // the greeting's band above the name's mask, CSS px at rest
  let surfaceInFrom: number | null = null; // when the loader's solid name landed
  let nameTexture: Texture | null = null;
  let lockup: (NameLockup & { scale: number }) | null = null;
  // ---- slice 4 state: the name handoff ----
  let nameBox: {
    left: number;
    baseline: number;
    inkWidth: number;
    size: number;
    maskTop: number;
    maskHeight: number;
    greeting: { left: number; baseline: number; fontPx: number };
  } | null = null;
  let nameLanded = false;
  // The canvas's drawn corner in the viewport, for a placed name (the Coil's
  // scene reads its host's box).
  let corner: { left: number; top: number } | null = null;
  // An entrance that waits for the loader has reached the frame: the name and
  // the greeting are held at 0 and the surface has not begun, so a landing
  // draws exactly the solid gradient the loader holds.
  let awaitingLoader = false;
  // The page's loader was running when the scene began: the name waits for it
  // (the loader lands its lockup on it, landName) or for it to be done.
  const underLoader = loaderRuns();

  function layoutName(placed: NamePlacement | null = null) {
    if (placed) return layoutPlaced(placed);
    if (!st.geo) return;
    const { width: W, height: H } = view;
    const narrow = isNarrow(view);
    const probe = document.createElement("canvas").getContext("2d");
    if (!probe) return;
    probe.font = `900 100px ${st.nameFamily}`;
    const w100 = probe.measureText(siteContent.hero.name).width || 1;
    const size = ((W * (narrow ? COIL.lockup.widthNarrow : COIL.lockup.widthWide)) / w100) * 100;
    // ---- fx-hero: "Hi, I'm" drawn with the name, one mask ----
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const mask = paintNameLockup(siteContent.hero.greeting, siteContent.hero.name, st.nameFamily, size, scale);
    lockup = { ...mask, scale };
    nameTexture?.dispose();
    const texture = new CanvasTexture(mask.canvas);
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 4;
    nameTexture = texture;
    const inkWidth = mask.nameInkWidth;
    const capTop = H / 2 - mask.ascent / 2;
    const left = (W - inkWidth) / 2;
    const span = mask.ascent + mask.descent + 2 * mask.pad;
    cu.uName.value = texture;
    cu.uNameRect.value.set(left - mask.pad, capTop - mask.pad - mask.greetBlock, mask.width, mask.height);
    cu.uNameSpan.value.set(mask.greetBlock / mask.height, span / mask.height);
    cu.uGreetSplit.value = mask.split / mask.height;
    greetBlock = mask.greetBlock;
    cu.uLod.value = Math.max(0, Math.log2(mask.canvas.height / (mask.height * view.dpr)));
    cu.uNameA.value = posterMode ? 0 : 1;
    // The surface under the whole lockup, at rest, and each letter's box in
    // the rect's uv for the per-letter minimum.
    surface.layout({ x: left - mask.pad, y: capTop - mask.pad - mask.greetBlock, w: mask.width, h: mask.height }, view.dpr);
    const boxes = cu.uGlyphBox.value as Vector4[];
    const glyphs = mask.glyphs.slice(0, NAME.maxGlyphs - 1);
    const nameTop = (mask.greetBlock + mask.pad) / mask.height;
    const nameBottom = (mask.greetBlock + mask.pad + mask.ascent + mask.descent) / mask.height;
    glyphs.forEach((glyph, i) => boxes[i].set(glyph.x0 / mask.width, nameTop, glyph.x1 / mask.width, nameBottom));
    cu.uGlyphN.value = glyphs.length;
    // The greeting in the last slot (its mean, for the greeting's cap).
    boxes[NAME.maxGlyphs - 1].set(mask.greetX.x0 / mask.width, mask.pad / mask.height, mask.greetX.x1 / mask.width, mask.split / mask.height);
    // Slice 4: the lockup's geometry for the loader's handoff (canvas px):
    // the name's ink and gradient band, and the greeting's ink.
    const maskTop = capTop - mask.pad - mask.greetBlock;
    nameBox = {
      left,
      baseline: capTop + mask.ascent,
      inkWidth,
      size,
      maskTop: capTop - mask.pad,
      maskHeight: span,
      greeting: { left: left - mask.pad + mask.greetX.x0, baseline: maskTop + mask.greetBaseline, fontPx: mask.greetPx },
    };
    // The overlay keeps only the unwound list's "Coil" control, sized off the
    // greeting's old size.
    const greetingPx = narrow ? 16 : Math.min(21, Math.max(16, W * 0.0125));
    live.current.overlay.current?.layout(posterMode ? null : { controlPx: Math.round(greetingPx * 0.86) });
    // ---- end fx-hero ----
  }

  // The page's lockup, laid where the page lays it (the name's own canvas).
  function layoutPlaced(placed: NamePlacement) {
    const mask = paintPlacedLockup(placed.heading, siteContent.hero.greeting, siteContent.hero.name, st.nameFamily, placed, view.dpr);
    lockup = { ...mask, scale: view.dpr };
    corner = placed.corner;
    nameTexture?.dispose();
    const texture = new CanvasTexture(mask.canvas);
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.anisotropy = 4;
    nameTexture = texture;
    const span = mask.ascent + mask.descent + 2 * mask.pad;
    cu.uName.value = texture;
    cu.uNameRect.value.set(mask.x, mask.y, mask.width, mask.height);
    cu.uNameSpan.value.set(mask.greetBlock / mask.height, span / mask.height);
    cu.uGreetSplit.value = mask.split / mask.height;
    greetBlock = mask.greetBlock;
    // A texel a buffer pixel: the mask is read at its own resolution.
    cu.uLod.value = Math.max(0, Math.log2(mask.canvas.height / (mask.height * view.dpr)));
    cu.uNameA.value = posterMode ? 0 : 1;
    surface.layout({ x: mask.x, y: mask.y, w: mask.width, h: mask.height }, view.dpr);
    const boxes = cu.uGlyphBox.value as Vector4[];
    const glyphs = mask.glyphs.slice(0, NAME.maxGlyphs - 1);
    const n = placed.name;
    const nameTop = (n.baseline - mask.ascent - mask.y) / mask.height;
    const nameBottom = (n.baseline + mask.descent - mask.y) / mask.height;
    glyphs.forEach((glyph, i) => boxes[i].set(glyph.x0 / mask.width, nameTop, glyph.x1 / mask.width, nameBottom));
    cu.uGlyphN.value = glyphs.length;
    // The greeting in the last slot (its mean, for the greeting's cap).
    boxes[NAME.maxGlyphs - 1].set(mask.greetX.x0 / mask.width, mask.greetTop / mask.height, mask.greetX.x1 / mask.width, mask.split / mask.height);
    nameBox = {
      left: n.pen - mask.inkBearing,
      baseline: n.baseline,
      inkWidth: mask.nameInkWidth,
      size: n.size,
      maskTop: n.baseline - mask.ascent - mask.pad,
      maskHeight: span,
      greeting: { left: mask.x + mask.greetX.x0, baseline: placed.greeting.baseline, fontPx: placed.greeting.size },
    };
  }

  // The name's middle in the canvas (CSS px): where the field's opening grows
  // from. Null before the first layout.
  function origin() {
    return nameBox ? { x: nameBox.left + nameBox.inkWidth / 2, y: nameBox.maskTop + nameBox.maskHeight / 2 } : null;
  }

  // The name's and the greeting's fade, and the surface growing over the
  // loader's solid name once it lands. A name the loader is to land waits
  // (held at 0, the surface not begun) until it does, so a landing draws exactly
  // the solid gradient the loader holds; a loader that is done without landing
  // the name (the scene was not ready when it ended) gives it up, and the name
  // shows from then on.
  function entranceFade(f: NameFrame) {
    const { now } = f;
    const fromLoader = underLoader || f.nameFromLoader;
    const handedOff = fromLoader ? nameLanded || !loaderRuns() : null;
    const nameAlpha = posterMode || handedOff === false ? 0 : 1;
    cu.uNameA.value = nameAlpha;
    cu.uGrain.value = FIELD.grain * nameAlpha;
    cu.uGreetA.value = nameAlpha;
    awaitingLoader = fromLoader && !handedOff;
    if (fromLoader && surfaceInFrom === null && handedOff) surfaceInFrom = now;
    cu.uSurfIn.value = !fromLoader ? 1 : surfaceInFrom === null ? 0 : siteEase(clamp01((now - surfaceInFrom) / NAME.surfaceInMs));
  }

  // The rebuild fade scales the name and the greeting.
  function fade(k: number) {
    cu.uNameA.value *= k;
    cu.uGreetA.value *= k; // fx-hero
  }

  // ?coildebug=noname.
  function hide() {
    cu.uNameA.value = 0;
    cu.uGreetA.value = 0;
  }

  // Update step (name): the surface's clock and the pointer's wake. A fine
  // pointer stirs the name only while the coil is coiled.
  function step(f: { dt: number; listProgress: number }) {
    surface.step(f.dt, live.current.input === "fine" && f.listProgress === 0);
  }

  // Render step (surface): the surface, then each letter's mean contrast,
  // only while the name or the greeting shows (after the field, before the
  // composite reads both). The per-letter values ease over glyphEaseS and hold
  // while the wake is live.
  function renderSurface({ dt }: { dt: number }) {
    const showing = cu.uNameA.value > 0 || cu.uGreetA.value > 0;
    surface.render(showing);
    if (!showing || posterMode) return;
    reduction.render(dt);
  }

  // ---- slice 4: the loader's continuity exit ----
  function nameRect(): NameTarget | null {
    if (!st.ready || !nameBox) return null;
    const rect = corner ?? host.getBoundingClientRect();
    return {
      left: rect.left + nameBox.left,
      baseline: rect.top + nameBox.baseline,
      width: nameBox.inkWidth,
      fontPx: nameBox.size,
      greeting: {
        left: rect.left + nameBox.greeting.left,
        baseline: rect.top + nameBox.greeting.baseline,
        fontPx: nameBox.greeting.fontPx,
      },
      gradient: {
        top: rect.top + nameBox.maskTop,
        height: nameBox.maskHeight,
        from: toBytes(st.theme.name.top),
        to: toBytes(st.theme.name.bottom),
      },
      inkAlpha: Math.min(1, Math.max(0, nameCompositeInk(flags, st.theme.name.ink, nameInkGain(getIntroKnobs().nameInk)))),
    };
  }

  // True when the canvas drew the lockup this frame; false (and nothing
  // changed) while the scene cannot take it: not drawn yet, or the entrance
  // that waits for the loader has not reached a frame.
  function landName() {
    if (!st.ready || st.contextLost || st.disposed || posterMode || !awaitingLoader) return false;
    nameLanded = true;
    awaitingLoader = false;
    cu.uNameA.value = 1;
    cu.uGreetA.value = 1;
    cu.uGrain.value = FIELD.grain;
    loop.render(0);
    return true;
  }
  // ---- end slice 4 ----

  // QA: each letter's mean contrast as the reduction last measured it.
  const glyphMeans = reduction.means;

  function dispose() {
    nameTexture?.dispose();
    reduction.dispose();
    surface.dispose();
  }

  return {
    layoutName,
    entranceFade,
    fade,
    hide,
    step,
    renderSurface,
    nameRect,
    landName,
    greetBlock: () => greetBlock,
    origin,
    landed: () => nameLanded,
    // QA: the mask, its rect and its letters (the per-letter readout).
    lockup: () => lockup,
    glyphMeans,
    // The reduction's pass, for a fill that compiles its programs before its first frame.
    reductionScene: reduction.scene,
    dispose,
  };
}

export type Name = ReturnType<typeof createName>;
