import { Color, Mesh, ShaderMaterial, Vector2, Vector4, type Texture } from "three";
import { DRIFT_PRESETS, fieldClocks, parseDriftPreset, type DriftPreset } from "@/lib/coil/drift";
import { COMPOSITE_FRAG, COMPOSITE_VERT, FIELD, FIELD_FRAG, FULLSCREEN_VERT } from "@/lib/coil/field.glsl";
import { REPEL } from "@/lib/coil/repel";
import { applyColor } from "@/lib/coil/theme";
import type { Gl } from "./renderer";
import type { SceneCtx } from "./state";

// The two fullscreen passes. The field (the shader weather behind the coil)
// renders into its own low-resolution target, and only when one of its two
// clocks moved; the composite draws that target to the canvas with the name
// masked over it (the name's uniforms are written by name.ts). ?drift picks
// the preset; ?coildebug=poster draws the field's first frame, the posters'.

export type CompositeInit = { mode: number; repel: Texture };

export function createField(ctx: SceneCtx, gl: Gl, init: CompositeInit) {
  const { st, flags } = ctx;
  const { posterMode, heldAt } = flags;
  const { renderer, orthoCamera, fieldScene, compScene, fieldTarget, uView, quad } = gl;
  let driftPreset: DriftPreset = parseDriftPreset(flags.driftParam);

  const fieldMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: FIELD_FRAG,
    uniforms: {
      uT: { value: 0 }, // fx-hero: set by render from fieldClocks
      // ---- fx-hero: the weather clock and warp (drift presets) ----
      uTw: { value: 0 },
      uWarp: { value: DRIFT_PRESETS[driftPreset].warp },
      // ---- end fx-hero ----
      uAspect: { value: 1.6 },
      uAmt: { value: FIELD.amount },
      uSec: { value: st.theme.field.secondStrength },
      uSecAt: { value: new Vector2(...FIELD.secondAt) },
      uSecScale: { value: new Vector2(...FIELD.secondScale) },
      uTop: { value: new Color() },
      uBottom: { value: new Color() },
      uGlow: { value: new Color() },
      uSecond: { value: new Color() },
    },
  });
  const fieldMesh = new Mesh(quad, fieldMaterial);
  fieldMesh.frustumCulled = false;
  fieldScene.add(fieldMesh);

  const compMaterial = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader: COMPOSITE_VERT,
    fragmentShader: COMPOSITE_FRAG,
    uniforms: {
      uField: { value: fieldTarget.texture },
      uName: { value: null },
      uView,
      uNameRect: { value: new Vector4(0, 0, 1, 1) },
      uFull: { value: new Vector2(1, 1) },
      uPaper: { value: new Color() },
      uGradTop: { value: new Color() },
      uGradBottom: { value: new Color() },
      uNameK: { value: 0 },
      uNameA: { value: 0 },
      uLod: { value: 0 },
      uGrain: { value: FIELD.grain },
      uDpr: { value: 1 },
      uSeam: { value: FIELD.seamFade },
      // ---- fx-hero: the greeting, the fill and the repel ----
      uNameSpan: { value: new Vector2(0, 1) },
      uGreetSplit: { value: 0 },
      uGreetA: { value: 0 },
      uWarm: { value: new Color() },
      uFlowDir: { value: new Vector2(Math.cos(0.58), -Math.sin(0.58)) },
      uMode: { value: init.mode },
      uFillMix: { value: 1 },
      uNameT: { value: 0 },
      uRepel: { value: init.repel },
      uRepelOn: { value: 0 },
      uRepelMax: { value: REPEL.maxPush },
      // ---- end fx-hero ----
    },
  });
  const compMesh = new Mesh(quad, compMaterial);
  compMesh.frustumCulled = false;
  compScene.add(compMesh);

  let fieldElapsed = 0;
  let lastWeatherTime = Number.NaN; // fx-hero

  // The theme's field colors and the composite's paper and name gradient.
  function applyTheme() {
    const fu = fieldMaterial.uniforms;
    applyColor(fu.uTop.value, st.theme.field.top);
    applyColor(fu.uBottom.value, st.theme.field.bottom);
    applyColor(fu.uGlow.value, st.theme.field.glow);
    applyColor(fu.uSecond.value, st.theme.field.second);
    fu.uSec.value = st.theme.field.secondStrength;
    const cu = compMaterial.uniforms;
    applyColor(cu.uPaper.value, st.theme.paper);
    applyColor(cu.uGradTop.value, st.theme.name.top);
    applyColor(cu.uGradBottom.value, st.theme.name.bottom);
    cu.uNameK.value = st.theme.name.ink * FIELD.nameInkGain;
    applyColor(cu.uWarm.value, st.theme.field.second); // fx-hero: grain-warm's second tone
  }

  function resizePasses(buffer: Vector2) {
    fieldMaterial.uniforms.uAspect.value = st.view.width / st.view.height;
    compMaterial.uniforms.uFull.value.set(st.view.width, st.view.height);
    compMaterial.uniforms.uDpr.value = buffer.y / st.view.height;
  }

  // The ?drift pick, live (the switcher's event).
  function setDrift(raw: string) {
    driftPreset = parseDriftPreset(raw);
    fieldMaterial.uniforms.uWarp.value = DRIFT_PRESETS[driftPreset].warp;
    st.lastFieldTime = Number.NaN;
  }

  // Render step: the field's clocks, the canvas cleared, the field pass only when a clock moved.
  function field({ dt }: { dt: number }) {
    if (!posterMode) fieldElapsed += dt;
    // The poster is the live field's first frame, so the scene picks up where it left off.
    // ---- fx-hero: two clocks, the orange and the weather (drift presets) ----
    const clocks = fieldClocks(posterMode ? 0 : (heldAt ?? fieldElapsed), false, driftPreset);
    fieldMaterial.uniforms.uT.value = clocks.orange;
    fieldMaterial.uniforms.uTw.value = clocks.weather;
    renderer.setRenderTarget(null);
    renderer.clear();
    if (clocks.orange !== st.lastFieldTime || clocks.weather !== lastWeatherTime) {
      renderer.setRenderTarget(fieldTarget);
      renderer.render(fieldScene, orthoCamera);
      renderer.setRenderTarget(null);
      st.lastFieldTime = clocks.orange;
      lastWeatherTime = clocks.weather;
    }
    // ---- end fx-hero ----
  }

  // Render step: the field and the name, to the canvas.
  function composite() {
    renderer.render(compScene, orthoCamera);
  }

  function dispose() {
    fieldMaterial.dispose();
    compMaterial.dispose();
  }

  return {
    fieldMaterial,
    compMaterial,
    applyTheme,
    resizePasses,
    setDrift,
    field,
    composite,
    driftPreset: () => driftPreset,
    dispose,
  };
}

export type Field = ReturnType<typeof createField>;
