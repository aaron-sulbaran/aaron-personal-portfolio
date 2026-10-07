import { Color, Mesh, ShaderMaterial, Vector2, Vector4, type IUniform, type Texture } from "three";
import { heldFieldS, nameCompositeInk } from "@/lib/coil/debugFlags";
import { DRIFT_PRESETS, fieldClocks, parseDriftPreset, type DriftPreset } from "@/lib/coil/drift";
import { COMPOSITE_FRAG, COMPOSITE_VERT, FIELD, FIELD_FRAG, FULLSCREEN_VERT, NAME, nameComposite } from "@/lib/coil/field.glsl";
import { applyColor } from "@/lib/coil/theme";
import type { Gl } from "./renderer";
import type { SceneCtx } from "./state";

// The two fullscreen passes. The field (the shader weather behind the coil)
// renders into its own low-resolution target, and only when one of its two
// clocks moved; the composite draws that target to the canvas with the name
// masked over it (the name's uniforms are written by name.ts; its surface is
// nameSurface.ts's target). ?drift picks the preset; ?coildebug=poster draws
// the field's first frame, the posters'.

// The name surface's target and the wake's uniforms, shared with its pass.
// And the per-letter reduction's target (name.ts renders it).
export type CompositeInit = { surface: Texture; wake: Record<string, IUniform>; glyph: Texture };

export function createField(ctx: SceneCtx, gl: Gl, init: CompositeInit) {
  const { st, flags } = ctx;
  const { view } = st;
  const { pinned } = flags;
  const { renderer, orthoCamera, fieldScene, compScene, fieldTarget, uView, quad } = gl;
  const driftPreset: DriftPreset = parseDriftPreset(flags.driftParam);

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
      // ---- the greeting, the name's surface and its wake ----
      uNameSpan: { value: new Vector2(0, 1) },
      uGreetSplit: { value: 0 },
      uGreetA: { value: 0 },
      uSurf: { value: init.surface },
      ...init.wake,
      uSurfIn: { value: 1 },
      uSurfMean: { value: new Color() },
      uDetail: { value: 1 },
      uChroma: { value: 1 },
      uFloor: { value: 0 },
      uFloorSign: { value: 1 },
      uReveal: { value: 0 },
      uGrainAmt: { value: 0 },
      uGlyph: { value: init.glyph },
      uGlyphBox: { value: Array.from({ length: NAME.maxGlyphs }, () => new Vector4(0, 0, 0, 0)) },
      uGlyphN: { value: 0 },
      uGlyphRel: { value: 0 },
      uGlyphAbs: { value: 0 },
      uGreetFloor: { value: 1 },
      uGreetCap: { value: 0 },
      // ---- end the name ----
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
    // The still's strong ink; QA (?coildebug=ink=100): the whole surface through the letters.
    cu.uNameK.value = nameCompositeInk(flags, st.theme.name.ink);
    applyColor(cu.uSurfMean.value, st.theme.name.surface.mean);
    const name = nameComposite(st.theme.dark);
    cu.uFloor.value = name.floor;
    cu.uFloorSign.value = name.floorSign;
    cu.uDetail.value = name.detail;
    cu.uReveal.value = name.reveal;
    cu.uChroma.value = name.chroma;
    cu.uGrainAmt.value = name.grain;
    cu.uGlyphRel.value = name.glyphRel;
    cu.uGlyphAbs.value = name.glyphAbs;
    cu.uGreetFloor.value = name.greetFloor;
    cu.uGreetCap.value = name.greetCap;
  }

  function resizePasses(buffer: Vector2) {
    fieldMaterial.uniforms.uAspect.value = view.width / view.height;
    compMaterial.uniforms.uFull.value.set(view.width, view.height);
    compMaterial.uniforms.uDpr.value = buffer.y / view.height;
  }

  // Render step: the field's clocks, the canvas cleared, the field pass only when a clock moved.
  function field({ dt }: { dt: number }) {
    if (!pinned) fieldElapsed += dt;
    // The posters and the stills are the live field's first frame, so the scene picks up where they leave off.
    // ---- fx-hero: two clocks, the orange and the weather (drift presets) ----
    const clocks = fieldClocks(heldFieldS(flags, fieldElapsed), false, driftPreset);
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
    field,
    composite,
    driftPreset: () => driftPreset,
    dispose,
  };
}

export type Field = ReturnType<typeof createField>;
