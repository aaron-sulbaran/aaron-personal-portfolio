import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  UnsignedByteType,
  type ShaderMaterial,
  type Texture,
  type Vector4,
} from "three";
import { siteContent } from "@/lib/content";
import { entranceNameAlpha, type EntranceClock } from "@/lib/coil/entrance";
import { COIL_FX_EVENT, FIELD, NAME_FILL, NAME_FILLS, parseNameFill, type CoilFxDetail, type NameFill } from "@/lib/coil/field.glsl";
import { clamp01, isNarrow } from "@/lib/coil/geometry";
import { siteEase } from "@/lib/coil/motion";
import { REPEL, createRepelField, encodeRepel, injectStroke, maxOffset, stepRepel } from "@/lib/coil/repel";
import { toBytes } from "@/lib/coil/theme";
import { LOADER } from "@/lib/loader/progress";
import type { NameTarget } from "@/lib/loader/handoff";
import { pushStat } from "./debug";
import type { LoopLink, SceneCtx } from "./state";
import type { CoilEntrance, CoilSceneProps } from "./types";

// The canvas name: "Hi, I'm" and "Aaron" in one mask the composite pass
// fills (solid or a live fill, ?name=<fill>), its layout, its fades (the
// entrance, the loader's handoff, the greeting), the cursor's repel buffer,
// and the loader's continuity exit (nameRect, landName).

// ---- fx-hero: the name lockup and the greeting's fade ----
// "Hi, I'm" and "Aaron" in one mask, both Profa Black in white on clear: the
// greeting small (its cap height NAME_FILL.greetingCap of the name's), on the
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
  const greetPx = ((NAME_FILL.greetingCap * nm.actualBoundingBoxAscent) / cap100) * 100;
  const greetFont = `900 ${greetPx}px ${family}`;
  g.font = greetFont;
  const gm = g.measureText(greeting);
  const gAscent = gm.actualBoundingBoxAscent;
  const gDescent = Math.max(0, gm.actualBoundingBoxDescent);
  const gap = NAME_FILL.greetingGap * gAscent;
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
  g.fillText(name, pad + nm.actualBoundingBoxLeft, pad + greetBlock + nm.actualBoundingBoxAscent);
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
  };
}

// The greeting's alpha. After the loader it fades up over NAME_FILL.
// greetingFadeMs from the middle of the loader's exit (the loader lands on
// "Aaron" only); otherwise it rises with the name as the band opens.
function greetingAlpha(entrance: CoilEntrance | null, nowMs: number, nameAlpha: number) {
  if (!entrance || !entrance.nameFromLoader || !Number.isFinite(entrance.startMs)) return nameAlpha;
  const startMs = entrance.startMs - (LOADER.exitMs - LOADER.entranceOverlapMs) + LOADER.exitMs / 2;
  const x = clamp01((nowMs - startMs) / NAME_FILL.greetingFadeMs);
  return siteEase(x);
}
// ---- end fx-hero ----

// ---- fx-hero state: the fill and the repel buffer ----
// Made before the composite material, which is created holding them.
export function createNameFill(fillParam: string | null) {
  const fill: NameFill = parseNameFill(fillParam);
  const repel = createRepelField();
  const repelBytes = new Uint8Array(REPEL.cols * REPEL.rows * 4);
  encodeRepel(repel, repelBytes);
  const repelTexture = new DataTexture(repelBytes, REPEL.cols, REPEL.rows, RGBAFormat, UnsignedByteType);
  repelTexture.minFilter = LinearFilter;
  repelTexture.magFilter = LinearFilter;
  repelTexture.needsUpdate = true;
  return { fill, repel, repelBytes, repelTexture };
}

type NameFx = ReturnType<typeof createNameFill>;

// A frame's name inputs: the props as the frame began and the entrance clock.
type NameFrame = {
  now: number;
  props: CoilSceneProps;
  clock: EntranceClock | null;
  realElapsedMs: number;
};

export function createName(ctx: SceneCtx, comp: ShaderMaterial, fx: NameFx, loop: LoopLink) {
  const { st, host, live, debug, flags } = ctx;
  const { posterMode, heldAt } = flags;
  const { repel, repelBytes, repelTexture } = fx;
  let nameFill = fx.fill;
  let repelUploaded = true; // the texture holds the buffer's rest state
  const repelLast = { clientX: Number.NaN, clientY: Number.NaN };
  let nameClock = 0; // seconds of the fill's idle motion
  let greetBlock = 0; // the greeting's band above the name's mask, CSS px at rest
  let fillInFrom: number | null = null; // when the loader's solid name landed
  const repelRect = { x: 0, y: 0, w: 0, h: 0 };
  const strokeFrom = { x: 0, y: 0 };
  const strokeTo = { x: 0, y: 0 };
  let nameTexture: Texture | null = null;
  // ---- slice 4 state: the name handoff ----
  let nameBox: { left: number; baseline: number; inkWidth: number; size: number; maskTop: number; maskHeight: number } | null =
    null;
  let nameLanded = false;

  function layoutName() {
    if (!st.geo) return;
    const { width: W, height: H } = st.view;
    const narrow = isNarrow(st.view);
    const probe = document.createElement("canvas").getContext("2d");
    if (!probe) return;
    probe.font = `900 100px ${st.nameFamily}`;
    const w100 = probe.measureText(siteContent.hero.name).width || 1;
    const size = ((W * (narrow ? 0.9 : 0.7)) / w100) * 100;
    // ---- fx-hero: "Hi, I'm" drawn with the name, one mask ----
    const mask = paintNameLockup(
      siteContent.hero.greeting,
      siteContent.hero.name,
      st.nameFamily,
      size,
      Math.min(2, window.devicePixelRatio || 1),
    );
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
    const cu = comp.uniforms;
    cu.uName.value = texture;
    cu.uNameRect.value.set(left - mask.pad, capTop - mask.pad - mask.greetBlock, mask.width, mask.height);
    cu.uNameSpan.value.set(mask.greetBlock / mask.height, span / mask.height);
    cu.uGreetSplit.value = mask.split / mask.height;
    greetBlock = mask.greetBlock;
    cu.uLod.value = Math.max(0, Math.log2(mask.canvas.height / (mask.height * st.view.dpr)));
    cu.uNameA.value = posterMode ? 0 : 1;
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
  // fill growing in after the loader's solid name lands.
  function entranceFade(f: NameFrame) {
    const { now, props, realElapsedMs } = f;
    const clock = f.clock as EntranceClock;
    const entrance = props.entrance;
    // A loader that never lands the name still gives it up a second after the entrance.
    const handedOff = entrance?.nameFromLoader
      ? nameLanded || realElapsedMs > clock.durationS * 1000 + 1000
      : null;
    const nameAlpha = posterMode ? 0 : entranceNameAlpha(clock, handedOff);
    comp.uniforms.uNameA.value = nameAlpha;
    comp.uniforms.uGrain.value = FIELD.grain * nameAlpha;
    // ---- fx-hero: the greeting's own fade; the fill grows in after the loader's solid name lands ----
    comp.uniforms.uGreetA.value = posterMode ? 0 : greetingAlpha(entrance ?? null, now, nameAlpha);
    if (entrance?.nameFromLoader && fillInFrom === null && handedOff) fillInFrom = now;
    comp.uniforms.uFillMix.value = !entrance?.nameFromLoader
      ? 1
      : fillInFrom === null
        ? 0
        : siteEase(clamp01((now - fillInFrom) / NAME_FILL.fillInMs));
    // ---- end fx-hero ----
  }

  // The rebuild fade scales the name and the greeting.
  function fade(k: number) {
    comp.uniforms.uNameA.value *= k;
    comp.uniforms.uGreetA.value *= k; // fx-hero
  }

  // ?coildebug=noname.
  function hide() {
    comp.uniforms.uNameA.value = 0;
    comp.uniforms.uGreetA.value = 0;
  }

  // fx-hero: the sand drifts along the helix's axis.
  function flowAlong(dx: number, dy: number) {
    comp.uniforms.uFlowDir.value.set(dx, dy);
  }

  // ---- fx-hero: the fill's idle clock and the cursor repel, once per frame ----
  // A fine pointer's movement since the last frame (in client px, so page
  // scroll alone never counts) is one stroke across the name's rect, whether
  // or not a card sits between it and the name. The buffer relaxes every
  // frame and uploads only while it moves. Nothing while unwound or solid.
  function stepNameFill(dt: number, listProgress: number) {
    const started = debug ? performance.now() : 0;
    const cu = comp.uniforms;
    nameClock = heldAt ?? nameClock + dt;
    cu.uNameT.value = nameClock;
    const props = live.current;
    const pointer = st.pointer;
    const repelLive = props.input === "fine" && listProgress === 0 && nameFill !== "solid" && !posterMode;
    if (repelLive && pointer.known && Number.isFinite(repelLast.clientX) && dt > 0) {
      const dx = pointer.clientX - repelLast.clientX;
      const dy = pointer.clientY - repelLast.clientY;
      if (dx !== 0 || dy !== 0) {
        const rect = cu.uNameRect.value as Vector4;
        repelRect.x = rect.x;
        repelRect.y = rect.y;
        repelRect.w = rect.z;
        repelRect.h = rect.w;
        strokeFrom.x = pointer.x - dx;
        strokeFrom.y = pointer.y - dy;
        strokeTo.x = pointer.x;
        strokeTo.y = pointer.y;
        injectStroke(repel, repelRect, strokeFrom, strokeTo, dt);
      }
    }
    repelLast.clientX = pointer.known ? pointer.clientX : Number.NaN;
    repelLast.clientY = pointer.known ? pointer.clientY : Number.NaN;
    if (!repelLive && repel.active) {
      repel.d.fill(0);
      repel.v.fill(0);
      repel.active = false;
    } else {
      stepRepel(repel, dt);
    }
    if (repel.active || !repelUploaded) {
      encodeRepel(repel, repelBytes);
      repelTexture.needsUpdate = true;
      repelUploaded = !repel.active;
    }
    cu.uRepelOn.value = repel.active ? 1 : 0;
    if (debug) {
      if (!debug.namePass) debug.namePass = [];
      pushStat(debug.namePass, performance.now() - started);
    }
  }

  // Update step (name): the fill's idle clock and the repel.
  function step(f: { dt: number; listProgress: number }) {
    stepNameFill(f.dt, f.listProgress); // fx-hero: the fill's idle clock and the repel
  }

  // The switcher (?coildebug=name) and ?name / ?drift picks, live.
  function listenFx(setDrift: (raw: string) => void) {
    const onFx = (event: Event) => {
      const detail = (event as CustomEvent<CoilFxDetail>).detail ?? {};
      if (detail.name !== undefined) {
        nameFill = parseNameFill(detail.name);
        comp.uniforms.uMode.value = NAME_FILLS.indexOf(nameFill);
      }
      if (detail.drift !== undefined) {
        setDrift(detail.drift);
      }
      if (st.raf) return;
      loop.renderStill();
    };
    window.addEventListener(COIL_FX_EVENT, onFx); // fx-hero
    return () => window.removeEventListener(COIL_FX_EVENT, onFx); // fx-hero
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
    comp.uniforms.uNameA.value = 1;
    comp.uniforms.uGrain.value = FIELD.grain;
    loop.render(0);
  }
  // ---- end slice 4 ----

  function dispose() {
    nameTexture?.dispose();
    repelTexture.dispose(); // fx-hero
  }

  return {
    layoutName,
    entranceFade,
    fade,
    hide,
    flowAlong,
    step,
    listenFx,
    nameRect,
    landName,
    greetBlock: () => greetBlock,
    landed: () => nameLanded,
    fx: () => ({ nameFill, repelActive: repel.active, repelMax: maxOffset(repel), nameClock }),
    dispose,
  };
}

export type Name = ReturnType<typeof createName>;
