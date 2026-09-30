import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  Mesh,
  NearestFilter,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type Texture,
  type Vector4,
} from "three";
import { siteContent } from "@/lib/content";
import { entranceNameAlpha, type EntranceClock } from "@/lib/coil/entrance";
import { FIELD, FULLSCREEN_VERT, GLYPH_FRAG, NAME } from "@/lib/coil/field.glsl";
import { clamp01, isNarrow } from "@/lib/coil/geometry";
import { siteEase } from "@/lib/coil/motion";
import { toBytes } from "@/lib/coil/theme";
import { LOADER } from "@/lib/loader/progress";
import type { NameTarget } from "@/lib/loader/handoff";
import type { NameSurface } from "./nameSurface";
import type { Gl } from "./renderer";
import type { LoopLink, SceneCtx } from "./state";
import type { CoilEntrance, CoilSceneProps } from "./types";

// The canvas name: "Hi, I'm" and "Aaron" in one mask the composite pass
// fills with the lit surface (nameSurface.ts), its layout, its fades (the
// entrance, the loader's handoff, the greeting, the surface growing over the
// loader's solid name), and the loader's continuity exit (nameRect, landName).

// ---- fx-hero: the name lockup and the greeting's fade ----
// "Hi, I'm" and "Aaron" in one mask, both Profa Black in white on clear: the
// greeting small (its cap height NAME.greetingCap of the name's), on the
// name's left edge, its lowest ink a fraction of its own cap height above the
// top of the "A". Everything in CSS px; the canvas is `scale` times that.
type NameLockup = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pad: number;
  nameInkWidth: number;
  ascent: number; // the name's
  descent: number;
  greetBlock: number; // the greeting's band above the name's own mask
  split: number; // where the greeting's alpha gives way to the name's
  greetCap: number; // the greeting's cap height (its "H")
  glyphs: { x0: number; x1: number }[]; // each letter's advance box, from the mask's left
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
  const pad = Math.ceil(sizePx * 0.04);
  const nameInkWidth = nm.actualBoundingBoxLeft + nm.actualBoundingBoxRight;
  const greetInkWidth = gm.actualBoundingBoxLeft + gm.actualBoundingBoxRight;
  // The greeting's stem sits a hair inside the A's foot, as the lab's did.
  const greetShift = sizePx * 0.02;
  const width = Math.ceil(Math.max(nameInkWidth, greetShift + greetInkWidth) + pad * 2);
  const height = Math.ceil(greetBlock + nm.actualBoundingBoxAscent + nm.actualBoundingBoxDescent + pad * 2);
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.clearRect(0, 0, width, height);
  g.fillStyle = "white";
  g.textBaseline = "alphabetic";
  g.font = greetFont;
  g.fillText(greeting, pad + greetShift + gm.actualBoundingBoxLeft, pad + gAscent);
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
    ascent: nm.actualBoundingBoxAscent,
    descent: nm.actualBoundingBoxDescent,
    greetBlock,
    split: pad + gAscent + gDescent + gap / 2,
    greetCap: (greetPx * cap100) / 100,
    glyphs,
  };
}

// The greeting's alpha. After the loader it fades up over NAME.
// greetingFadeMs from the middle of the loader's exit (the loader lands on
// "Aaron" only); otherwise it rises with the name as the band opens.
function greetingAlpha(entrance: CoilEntrance | null, nowMs: number, nameAlpha: number) {
  if (!entrance || !entrance.nameFromLoader || !Number.isFinite(entrance.startMs)) return nameAlpha;
  const startMs = entrance.startMs - (LOADER.exitMs - LOADER.entranceOverlapMs) + LOADER.exitMs / 2;
  const x = clamp01((nowMs - startMs) / NAME.greetingFadeMs);
  return siteEase(x);
}
// ---- end fx-hero ----

// The per-letter reduction's two targets (one texel per letter; each frame
// eases from one into the other), made before the composite that reads them.
export function createGlyphTargets(): [WebGLRenderTarget, WebGLRenderTarget] {
  const make = () => new WebGLRenderTarget(NAME.maxGlyphs, 1, { depthBuffer: false, minFilter: NearestFilter, magFilter: NearestFilter });
  return [make(), make()];
}

// A frame's name inputs: the props as the frame began and the entrance clock.
type NameFrame = {
  now: number;
  props: CoilSceneProps;
  clock: EntranceClock | null;
  realElapsedMs: number;
};

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
  const { renderer, orthoCamera } = gl;
  // The per-letter reduction reads what the composite reads (shared uniforms).
  const cu = comp.uniforms;
  const glyphMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: GLYPH_FRAG,
    uniforms: {
      uField: cu.uField,
      uName: cu.uName,
      uSurf: cu.uSurf,
      uNameRect: cu.uNameRect,
      uFull: cu.uFull,
      uSurfMean: cu.uSurfMean,
      uNameK: cu.uNameK,
      uDetail: cu.uDetail,
      uFloor: cu.uFloor,
      uFloorSign: cu.uFloorSign,
      uGlyphN: cu.uGlyphN,
      uGlyphBox: cu.uGlyphBox,
      uGlyphPrev: { value: glyphTargets[1].texture },
      uGlyphBlend: { value: 1 },
    },
  });
  let glyphFresh = true; // no reduction yet: the first one lands at once
  const glyphScene = new Scene();
  const glyphMesh = new Mesh(gl.quad, glyphMaterial);
  glyphMesh.frustumCulled = false;
  glyphScene.add(glyphMesh);
  let greetBlock = 0; // the greeting's band above the name's mask, CSS px at rest
  let surfaceInFrom: number | null = null; // when the loader's solid name landed
  let nameTexture: Texture | null = null;
  let lockup: (NameLockup & { scale: number }) | null = null;
  // ---- slice 4 state: the name handoff ----
  let nameBox: { left: number; baseline: number; inkWidth: number; size: number; maskTop: number; maskHeight: number } | null =
    null;
  let nameLanded = false;

  function layoutName() {
    if (!st.geo) return;
    const { width: W, height: H } = view;
    const narrow = isNarrow(view);
    const probe = document.createElement("canvas").getContext("2d");
    if (!probe) return;
    probe.font = `900 100px ${st.nameFamily}`;
    const w100 = probe.measureText(siteContent.hero.name).width || 1;
    const size = ((W * (narrow ? 0.9 : 0.7)) / w100) * 100;
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
    const glyphs = mask.glyphs.slice(0, NAME.maxGlyphs);
    const nameTop = (mask.greetBlock + mask.pad) / mask.height;
    const nameBottom = (mask.greetBlock + mask.pad + mask.ascent + mask.descent) / mask.height;
    glyphs.forEach((glyph, i) => boxes[i].set(glyph.x0 / mask.width, nameTop, glyph.x1 / mask.width, nameBottom));
    cu.uGlyphN.value = glyphs.length;
    // Slice 4: the name's geometry for the loader's handoff (canvas px): the
    // name alone, never the greeting.
    nameBox = {
      left,
      baseline: capTop + mask.ascent,
      inkWidth,
      size,
      maskTop: capTop - mask.pad,
      maskHeight: span,
    };
    // The overlay keeps only the unwound list's "Coil" control, sized off the
    // greeting's old size.
    const greetingPx = narrow ? 16 : Math.min(21, Math.max(16, W * 0.0125));
    live.current.overlay.current?.layout(posterMode ? null : { controlPx: Math.round(greetingPx * 0.86) });
    // ---- end fx-hero ----
  }

  // Part of the entrance step: the name's and the greeting's fades, and the
  // surface growing over the loader's solid name once it lands.
  function entranceFade(f: NameFrame) {
    const { now, props, realElapsedMs } = f;
    const clock = f.clock as EntranceClock;
    const entrance = props.entrance;
    // A loader that never lands the name still gives it up a second after the entrance.
    const handedOff = entrance?.nameFromLoader
      ? nameLanded || realElapsedMs > clock.durationS * 1000 + 1000
      : null;
    const nameAlpha = posterMode ? 0 : entranceNameAlpha(clock, handedOff);
    cu.uNameA.value = nameAlpha;
    cu.uGrain.value = FIELD.grain * nameAlpha;
    cu.uGreetA.value = posterMode ? 0 : greetingAlpha(entrance ?? null, now, nameAlpha);
    if (entrance?.nameFromLoader && surfaceInFrom === null && handedOff) surfaceInFrom = now;
    cu.uSurfIn.value = !entrance?.nameFromLoader
      ? 1
      : surfaceInFrom === null
        ? 0
        : siteEase(clamp01((now - surfaceInFrom) / NAME.surfaceInMs));
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
    const [from, into] = cu.uGlyph.value === glyphTargets[0].texture ? glyphTargets : [glyphTargets[1], glyphTargets[0]];
    glyphMaterial.uniforms.uGlyphPrev.value = from.texture;
    glyphMaterial.uniforms.uGlyphBlend.value = glyphFresh
      ? 1
      : surface.wake().active
        ? 0
        : 1 - Math.exp(-Math.max(0, dt) / NAME.glyphEaseS);
    renderer.setRenderTarget(into);
    renderer.render(glyphScene, orthoCamera);
    renderer.setRenderTarget(null);
    cu.uGlyph.value = into.texture;
    glyphFresh = false;
  }

  // ---- slice 4: the loader's continuity exit ----
  function nameRect(): NameTarget | null {
    if (!st.ready || !nameBox) return null;
    const rect = host.getBoundingClientRect();
    return {
      left: rect.left + nameBox.left,
      baseline: rect.top + nameBox.baseline,
      width: nameBox.inkWidth,
      fontPx: nameBox.size,
      gradient: {
        top: rect.top + nameBox.maskTop,
        height: nameBox.maskHeight,
        from: toBytes(st.theme.name.top),
        to: toBytes(st.theme.name.bottom),
      },
      inkAlpha: Math.min(1, Math.max(0, st.theme.name.ink * FIELD.nameInkGain)),
    };
  }

  function landName() {
    nameLanded = true;
    if (!st.ready || st.contextLost || st.disposed || posterMode) return;
    cu.uNameA.value = 1;
    cu.uGrain.value = FIELD.grain;
    loop.render(0);
  }
  // ---- end slice 4 ----

  // QA: each letter's mean contrast as the reduction last measured it.
  function glyphMeans() {
    const px = new Uint8Array(NAME.maxGlyphs * 4);
    const current = cu.uGlyph.value === glyphTargets[0].texture ? glyphTargets[0] : glyphTargets[1];
    renderer.readRenderTargetPixels(current, 0, 0, NAME.maxGlyphs, 1, px);
    return Array.from({ length: cu.uGlyphN.value as number }, (_, i) => (px[i * 4] / 255 - 0.5) * 0.5);
  }

  function dispose() {
    nameTexture?.dispose();
    glyphMaterial.dispose();
    glyphTargets.forEach((target) => target.dispose());
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
    landed: () => nameLanded,
    // QA: the mask, its rect and its letters (the per-letter readout).
    lockup: () => lockup,
    glyphMeans,
    dispose,
  };
}

export type Name = ReturnType<typeof createName>;
