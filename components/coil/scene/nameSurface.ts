import { ClampToEdgeWrapping, Color, DataTexture, LinearFilter, Mesh, RGBAFormat, ShaderMaterial, UnsignedByteType, Vector2 } from "three";
import { FULLSCREEN_VERT, NAME_DISTURB, NAME_SURFACE, SURFACE_FRAG, nameDisturb } from "@/lib/coil/field.glsl";
import { applyColor } from "@/lib/coil/theme";
import {
  WAKE,
  blurDirection,
  clearWake,
  createWake,
  encodeWake,
  injectStroke,
  maxWake,
  stepWake,
  wakeRectOf,
  type WakeRect,
} from "@/lib/coil/wake";
import { pushStat } from "./debug";
import type { Gl } from "./renderer";
import type { SceneCtx } from "./state";

// The name's lit surface and the pointer's wake over it (the design review's
// verdict of 2026-09-30 on the Tide and Fabric labs). The surface is one
// fragment pass into a half resolution target sized to the name's lockup; the
// composite reads it through the letters. The wake is a small grid on the CPU
// (lib/coil/wake.ts), stepped once a frame in the name step and uploaded only
// while it moves; the surface and the composite both sample it.
//
// A fine pointer's movement since the last frame (client px, so page scroll
// alone never counts) is one stroke, whether or not a card sits between it and
// the name. Touch, the unwound list, the poster and reduced motion leave the
// name idle; reduced motion also holds the surface's clock.

export type NameRectCss = { x: number; y: number; w: number; h: number };

export function createNameSurface(ctx: SceneCtx, gl: Gl) {
  const { st, flags, debug } = ctx;
  const { pointer } = st;
  const { posterMode, heldAt } = flags;
  const { renderer, orthoCamera, surfaceScene, surfaceTarget, quad } = gl;

  const wake = createWake();
  const wakeBytes = new Uint8Array(WAKE.cols * WAKE.rows * 4);
  encodeWake(wake, wakeBytes);
  const wakeTexture = new DataTexture(wakeBytes, WAKE.cols, WAKE.rows, RGBAFormat, UnsignedByteType);
  wakeTexture.minFilter = LinearFilter;
  wakeTexture.magFilter = LinearFilter;
  wakeTexture.wrapS = ClampToEdgeWrapping;
  wakeTexture.wrapT = ClampToEdgeWrapping;
  wakeTexture.needsUpdate = true;
  // Shared by the surface and the composite (both sample the wake).
  const wakeUniforms = {
    uWake: { value: wakeTexture },
    uWakeSize: { value: new Vector2(WAKE.cols, WAKE.rows) },
    uWakeOn: { value: 0 },
  };

  const rot = (NAME_SURFACE.rotZ * Math.PI) / 180;
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: SURFACE_FRAG,
    uniforms: {
      ...wakeUniforms,
      uT: { value: NAME_SURFACE.start },
      uStrength: { value: NAME_SURFACE.strength },
      uCrestBias: { value: NAME_SURFACE.crestBias },
      uRelief: { value: NAME_SURFACE.relief },
      uSheen: { value: NAME_SURFACE.sheen },
      uGloss: { value: NAME_SURFACE.gloss },
      uBright: { value: NAME_SURFACE.bright },
      uDrag: { value: NAME_DISTURB.drag },
      uMaxDrag: { value: NAME_DISTURB.maxDrag },
      uSwell: { value: NAME_DISTURB.swell },
      uPress: { value: 0 },
      uChurn: { value: NAME_DISTURB.churn },
      uShift: { value: NAME_DISTURB.shift },
      uLift: { value: 0 },
      uExt: { value: new Vector2(1, 1) },
      uRot: { value: new Vector2(Math.cos(rot), Math.sin(rot)) },
      uLight: { value: new Vector2(...NAME_SURFACE.lightRest) },
      uC1: { value: new Color() },
      uC2: { value: new Color() },
      uC3: { value: new Color() },
      uShadow: { value: new Color() },
      uSheenC: { value: new Color() },
    },
  });
  const mesh = new Mesh(quad, material);
  mesh.frustumCulled = false;
  surfaceScene.add(mesh);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wakeRect: WakeRect = { x: 0, y: 0, w: 0, h: 0 };
  const last = { clientX: Number.NaN, clientY: Number.NaN };
  let clock = 0; // seconds of the surface's own motion
  let drawnAt = Number.NaN; // the clock the target holds
  let dirty = true;

  // The lockup's rect (CSS px, the greeting included) at rest: the target's
  // size, the plane's extent over it, the wake's grid.
  function layout(rect: NameRectCss, dpr: number) {
    const scale = Math.min(NAME_SURFACE.rtScale * dpr, NAME_SURFACE.rtMaxWidth / Math.max(1, rect.w));
    surfaceTarget.setSize(Math.max(8, Math.round(rect.w * scale)), Math.max(8, Math.round(rect.h * scale)));
    const aspect = rect.w / Math.max(1, rect.h);
    material.uniforms.uExt.value.set((NAME_SURFACE.viewHeight * aspect) / 2, NAME_SURFACE.viewHeight / 2);
    wakeRectOf(rect, wakeRect);
    dirty = true;
  }

  function applyTheme() {
    const u = material.uniforms;
    const s = st.theme.name.surface;
    applyColor(u.uC1.value, s.c1);
    applyColor(u.uC2.value, s.c2);
    applyColor(u.uC3.value, s.c3);
    applyColor(u.uShadow.value, s.shadow);
    applyColor(u.uSheenC.value, s.sheen);
    const disturb = nameDisturb(st.theme.dark);
    u.uPress.value = disturb.press;
    u.uLift.value = disturb.lift;
    dirty = true;
  }

  function upload() {
    blurDirection(wake);
    encodeWake(wake, wakeBytes);
    wakeTexture.needsUpdate = true;
    dirty = true;
  }

  // Once a frame, in the name step: the surface's clock and light, the
  // pointer's stroke, the wake's step. `live`: a fine pointer over the coiled
  // hero may stir the name.
  function step(dt: number, live: boolean) {
    const started = debug ? performance.now() : 0;
    const reduced = reducedMotion.matches;
    clock = heldAt ?? (reduced || posterMode ? clock : clock + dt);
    const u = material.uniforms;
    u.uT.value = NAME_SURFACE.start + clock * NAME_SURFACE.speed;
    const a = (clock / NAME_SURFACE.lightPeriod) * Math.PI * 2;
    u.uLight.value.set(
      NAME_SURFACE.lightRest[0] + Math.cos(a) * NAME_SURFACE.lightDrift,
      NAME_SURFACE.lightRest[1] + Math.sin(a) * NAME_SURFACE.lightDrift,
    );
    const stirring = live && !reduced && !posterMode;
    if (stirring && pointer.known && Number.isFinite(last.clientX) && dt > 0) {
      // Every frame, a still pointer included: the stroke's speed is smoothed.
      const dx = pointer.clientX - last.clientX;
      const dy = pointer.clientY - last.clientY;
      injectStroke(wake, wakeRect, pointer.x - dx, pointer.y - dy, pointer.x, pointer.y, dt);
    }
    if (!pointer.known || !stirring) wake.speed = 0;
    last.clientX = pointer.known ? pointer.clientX : Number.NaN;
    last.clientY = pointer.known ? pointer.clientY : Number.NaN;
    if (!stirring && wake.active) {
      clearWake(wake);
      upload();
    } else if (stepWake(wake, dt)) {
      upload();
    }
    wakeUniforms.uWakeOn.value = wake.active ? 1 : 0;
    if (clock !== drawnAt) dirty = true;
    if (debug) {
      if (!debug.namePass) debug.namePass = [];
      pushStat(debug.namePass, performance.now() - started);
    }
  }

  // Render step (surface), before the composite: only while the name shows,
  // and only when the clock, the wake, the layout or the theme moved.
  function render(showing: boolean) {
    if (!showing || posterMode || !dirty) return;
    renderer.setRenderTarget(surfaceTarget);
    renderer.render(surfaceScene, orthoCamera);
    renderer.setRenderTarget(null);
    drawnAt = clock;
    dirty = false;
  }

  // ---- QA: nameBench() (the Fable lab's timing) ----
  // GPU: n back-to-back surface passes inside one timer query, so a single
  // pass's pipeline stall does not count; without the timer extension, n
  // passes bracketed by two synchronous reads, less an empty bracket.
  function benchGpu(n = 40): Promise<{ perPassMs: number; n: number; surf: number[]; method: string }> {
    const context = renderer.getContext() as WebGL2RenderingContext;
    const timer = context.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number } | null;
    const surf = [surfaceTarget.width, surfaceTarget.height];
    const passes = () => {
      renderer.setRenderTarget(surfaceTarget);
      for (let i = 0; i < n; i++) renderer.render(surfaceScene, orthoCamera);
      renderer.setRenderTarget(null);
    };
    if (timer) {
      return new Promise((resolve) => {
        const query = context.createQuery();
        context.beginQuery(timer.TIME_ELAPSED_EXT, query);
        passes();
        context.endQuery(timer.TIME_ELAPSED_EXT);
        const poll = () => {
          if (!query || !context.getQueryParameter(query, context.QUERY_RESULT_AVAILABLE)) return requestAnimationFrame(poll);
          const ns = context.getQueryParameter(query, context.QUERY_RESULT) as number;
          context.deleteQuery(query);
          dirty = true;
          resolve({ perPassMs: ns / 1e6 / n, n, surf, method: "timer query" });
        };
        requestAnimationFrame(poll);
      });
    }
    const pixel = new Uint8Array(4);
    const sync = () => renderer.readRenderTargetPixels(surfaceTarget, 0, 0, 1, 1, pixel);
    sync();
    const empty0 = performance.now();
    sync();
    const empty = performance.now() - empty0;
    const t0 = performance.now();
    passes();
    sync();
    const ms = performance.now() - t0 - empty;
    dirty = true;
    return Promise.resolve({ perPassMs: ms / n, n, surf, method: "finish bracket" });
  }

  // CPU: the wake's per frame work with a live wake (a fast stroke every
  // frame, the step, the direction's low-pass and the encode) on a scratch grid.
  function benchCpu(n = 2000) {
    const scratch = createWake();
    const bytes = new Uint8Array(wakeBytes.length);
    const rect = { ...wakeRect };
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const x = rect.x + rect.w * (0.2 + 0.6 * ((i % 60) / 60));
      const y = rect.y + rect.h * 0.55;
      injectStroke(scratch, rect, x - 36, y, x, y, 1 / 60);
      stepWake(scratch, 1 / 60);
      blurDirection(scratch);
      encodeWake(scratch, bytes);
    }
    return (performance.now() - t0) / n;
  }
  // The surface's mean color as the target holds it now (the --name-surface-mean token is this, at rest).
  function measureMean() {
    const w = surfaceTarget.width;
    const h = surfaceTarget.height;
    const px = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(surfaceTarget, 0, 0, w, h, px);
    const sum = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += px[i + c];
    return sum.map((v) => Math.round(v / (w * h)));
  }
  // ---- end QA ----

  function dispose() {
    material.dispose();
    wakeTexture.dispose();
  }

  return {
    wakeUniforms,
    texture: surfaceTarget.texture,
    layout,
    applyTheme,
    step,
    render,
    benchGpu,
    benchCpu,
    measureMean,
    wake: () => wake,
    wakeRect: () => wakeRect,
    state: () => ({ clock, wakeActive: wake.active, wakeMax: maxWake(wake), surf: [surfaceTarget.width, surfaceTarget.height] }),
    dispose,
  };
}

export type NameSurface = ReturnType<typeof createNameSurface>;
