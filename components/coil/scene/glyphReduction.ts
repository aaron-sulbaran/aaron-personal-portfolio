import { Mesh, Scene, ShaderMaterial, type WebGLRenderTarget } from "three";
import { FULLSCREEN_VERT, GLYPH_FRAG, NAME } from "@/lib/coil/field.glsl";
import type { NameSurface } from "./nameSurface";
import type { Gl } from "./renderer";

// The per-letter reduction (GLYPH_FRAG): one fragment per letter, each its
// mean contrast against the field, which the composite reads to lift a letter
// that falls short of the strongest. The name's layer (name.ts) and every page
// title's fill (components/coil/fill/title.ts) run this one, after the surface
// and before the composite; it reads what the composite reads (shared uniforms).
// The values ease over NAME.glyphEaseS and hold while the pointer's wake is
// live, so the lift never cancels what a gesture does to a letter.
export function createGlyphReduction(gl: Gl, comp: ShaderMaterial, glyphTargets: [WebGLRenderTarget, WebGLRenderTarget], surface: NameSurface) {
  const { renderer, orthoCamera } = gl;
  const cu = comp.uniforms;
  const material = new ShaderMaterial({
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
      uGreetFloor: cu.uGreetFloor,
      uGlyphPrev: { value: glyphTargets[1].texture },
      uGlyphBlend: { value: 1 },
    },
  });
  let fresh = true; // no reduction yet: the first one lands at once
  const scene = new Scene();
  const mesh = new Mesh(gl.quad, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  function render(dt: number) {
    const [from, into] = cu.uGlyph.value === glyphTargets[0].texture ? glyphTargets : [glyphTargets[1], glyphTargets[0]];
    material.uniforms.uGlyphPrev.value = from.texture;
    material.uniforms.uGlyphBlend.value = fresh ? 1 : surface.wake().active ? 0 : 1 - Math.exp(-Math.max(0, dt) / NAME.glyphEaseS);
    renderer.setRenderTarget(into);
    renderer.render(scene, orthoCamera);
    renderer.setRenderTarget(null);
    cu.uGlyph.value = into.texture;
    fresh = false;
  }

  // QA: each letter's mean contrast as the reduction last measured it.
  function means() {
    const px = new Uint8Array(NAME.maxGlyphs * 4);
    const current = cu.uGlyph.value === glyphTargets[0].texture ? glyphTargets[0] : glyphTargets[1];
    renderer.readRenderTargetPixels(current, 0, 0, NAME.maxGlyphs, 1, px);
    return Array.from({ length: cu.uGlyphN.value as number }, (_, i) => (px[i * 4] / 255 - 0.5) * 0.5);
  }

  function dispose() {
    material.dispose();
    glyphTargets.forEach((target) => target.dispose());
  }

  return { scene, render, means, dispose };
}

export type GlyphReduction = ReturnType<typeof createGlyphReduction>;
