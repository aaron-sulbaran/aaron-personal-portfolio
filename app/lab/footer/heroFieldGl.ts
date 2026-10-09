import { FIELD, NAME_DISTURB, NAME_SURFACE, nameComposite, nameDisturb } from "@/lib/coil/field.glsl";
import { createFieldPass, fullscreenTriangle, getContext, link, UV_VERT, type FieldFrame } from "./fieldGl";
import { COMPOSITE_SOURCE, SURFACE_SOURCE, surfaceClock, surfaceExtent, surfaceTargetSize } from "./heroField";
import type { NameTokens } from "./tokens";

// The hero backdrop in raw WebGL 2 (no three in the footer): three passes as
// the hero runs them. The field into a third resolution target; the name's
// lit surface into a half resolution target over the word (only when the
// letters show it); the composite to the canvas at the device resolution.

export type HeroLetters = {
  band: number; // stage px: the letters' band starts here (the paper cover's top); -1 for none
  rect: { x: number; y: number; w: number; h: number }; // stage px: the word, padded, the surface's extent
  intensity: number; // the field's depth inside the letters
  surface: boolean; // the hero name's surface over it
};

export type HeroFrame = FieldFrame & {
  readonly behind: number; // the field's depth behind the footer
  readonly letters: HeroLetters | null;
  readonly name: NameTokens;
  readonly surfaceS: number; // the surface's clock, s
  readonly flip: boolean;
  readonly viewportH: number;
};

export type HeroFieldGl = { draw: (frame: HeroFrame) => void; resize: (cssW: number, cssH: number, dpr: number) => void; dispose: () => void };

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

function createTarget(gl: WebGL2RenderingContext): Target | null {
  const tex = gl.createTexture();
  const fb = gl.createFramebuffer();
  if (!tex || !fb) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { fb, tex, w: 0, h: 0 };
}

function sizeTarget(gl: WebGL2RenderingContext, t: Target, w: number, h: number) {
  if (t.w === w && t.h === h) return;
  t.w = w;
  t.h = h;
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
}

export function createHeroFieldGl(canvas: HTMLCanvasElement): HeroFieldGl | null {
  const context = getContext(canvas);
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  const buffer = fullscreenTriangle(gl);
  const fieldPass = createFieldPass(gl);
  const surfacePass = link(gl, UV_VERT, SURFACE_SOURCE());
  const compositePass = link(gl, UV_VERT, COMPOSITE_SOURCE());
  const fieldT = createTarget(gl);
  const surfaceT = createTarget(gl);
  if (!fieldPass || !surfacePass || !compositePass || !fieldT || !surfaceT) return null;
  const field = fieldPass;
  const surface = surfacePass;
  const composite = compositePass;
  const fieldTarget = fieldT;
  const surfaceTarget = surfaceT;
  const css = { w: 1, h: 1, dpr: 1 };
  const rot = (NAME_SURFACE.rotZ * Math.PI) / 180;

  function drawSurface(frame: HeroFrame, letters: HeroLetters) {
    const [w, h] = surfaceTargetSize(letters.rect.w, letters.rect.h, css.dpr);
    sizeTarget(gl, surfaceTarget, w, h);
    // The surface's target must not sit on a unit while it is drawn into
    // (its wake sampler reads unit 0, the composite left it on unit 1).
    for (const unit of [gl.TEXTURE1, gl.TEXTURE0]) {
      gl.activeTexture(unit);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, surfaceTarget.fb);
    const p = surface;
    p.use();
    const n = frame.name;
    const clock = surfaceClock(frame.surfaceS);
    const [ex, ey] = surfaceExtent(letters.rect.w, letters.rect.h, css.w, frame.viewportH);
    const disturb = nameDisturb(frame.tokens.dark);
    gl.uniform1i(p.u("uWake"), 0);
    gl.uniform1f(p.u("uWakeOn"), 0);
    gl.uniform2f(p.u("uWakeSize"), 1, 1);
    gl.uniform1f(p.u("uT"), clock.t);
    gl.uniform1f(p.u("uStrength"), NAME_SURFACE.strength);
    gl.uniform1f(p.u("uCrestBias"), NAME_SURFACE.crestBias);
    gl.uniform1f(p.u("uRelief"), NAME_SURFACE.relief);
    gl.uniform1f(p.u("uSheen"), NAME_SURFACE.sheen);
    gl.uniform1f(p.u("uGloss"), NAME_SURFACE.gloss);
    gl.uniform1f(p.u("uBright"), NAME_SURFACE.bright);
    gl.uniform1f(p.u("uDrag"), NAME_DISTURB.drag);
    gl.uniform1f(p.u("uMaxDrag"), NAME_DISTURB.maxDrag);
    gl.uniform1f(p.u("uSwell"), NAME_DISTURB.swell);
    gl.uniform1f(p.u("uPress"), disturb.press);
    gl.uniform1f(p.u("uChurn"), NAME_DISTURB.churn);
    gl.uniform1f(p.u("uShift"), NAME_DISTURB.shift);
    gl.uniform1f(p.u("uLift"), disturb.lift);
    gl.uniform2f(p.u("uExt"), ex, ey);
    gl.uniform2f(p.u("uRot"), Math.cos(rot), Math.sin(rot));
    gl.uniform2f(p.u("uLight"), clock.light[0], clock.light[1]);
    gl.uniform3f(p.u("uC1"), ...n.c1);
    gl.uniform3f(p.u("uC2"), ...n.c2);
    gl.uniform3f(p.u("uC3"), ...n.c3);
    gl.uniform3f(p.u("uShadow"), ...n.shadow);
    gl.uniform3f(p.u("uSheenC"), ...n.sheen);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function drawComposite(frame: HeroFrame) {
    const p = composite;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    p.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fieldTarget.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, surfaceTarget.tex);
    gl.activeTexture(gl.TEXTURE0);
    for (const name of ["uField", "uName", "uGlyph", "uWake"]) gl.uniform1i(p.u(name), 0);
    gl.uniform1i(p.u("uSurf"), 1);
    gl.uniform4f(p.u("uView"), 0, 0, 1 / canvas.width, 1 / canvas.height);
    gl.uniform2f(p.u("uStage"), css.w, css.h);
    gl.uniform1f(p.u("uFlip"), frame.flip ? 1 : 0);
    gl.uniform3f(p.u("uPaper"), ...frame.tokens.paper);
    gl.uniform1f(p.u("uBehind"), frame.behind);
    const letters = frame.letters;
    gl.uniform1f(p.u("uBand"), letters ? letters.band : -1);
    gl.uniform1f(p.u("uLetterK"), letters ? letters.intensity : 1);
    gl.uniform1f(p.u("uSurfOn"), letters?.surface ? 1 : 0);
    if (letters) gl.uniform4f(p.u("uRect"), letters.rect.x, letters.rect.y, Math.max(1, letters.rect.w), Math.max(1, letters.rect.h));
    // The name as the hero composites it: its ink, the surface's mean and
    // the theme's floor, detail, chroma and grain; no wake, no greeting, no
    // per-letter minimum (that one weighs the hero's five letters).
    const n = frame.name;
    const c = nameComposite(frame.tokens.dark);
    gl.uniform1f(p.u("uNameK"), n.ink * FIELD.nameInkGain);
    gl.uniform1f(p.u("uSurfIn"), 1);
    gl.uniform3f(p.u("uSurfMean"), ...n.mean);
    gl.uniform1f(p.u("uDetail"), c.detail);
    gl.uniform1f(p.u("uChroma"), c.chroma);
    gl.uniform1f(p.u("uFloor"), c.floor);
    gl.uniform1f(p.u("uFloorSign"), c.floorSign);
    gl.uniform1f(p.u("uReveal"), c.reveal);
    gl.uniform1f(p.u("uGrainAmt"), c.grain);
    gl.uniform1f(p.u("uGlyphN"), 0);
    gl.uniform1f(p.u("uGlyphRel"), c.glyphRel);
    gl.uniform1f(p.u("uGlyphAbs"), c.glyphAbs);
    gl.uniform1f(p.u("uGreetFloor"), c.greetFloor);
    gl.uniform1f(p.u("uGreetCap"), 0);
    gl.uniform1f(p.u("uWakeOn"), 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    draw(frame) {
      const fw = Math.max(8, Math.round(css.w / FIELD.divisor));
      const fh = Math.max(8, Math.round(css.h / FIELD.divisor));
      sizeTarget(gl, fieldTarget, fw, fh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fieldTarget.fb);
      field.draw({ ...frame, intensity: 1 }, fw, fh);
      if (frame.letters?.surface && frame.letters.band >= 0) drawSurface(frame, frame.letters);
      drawComposite(frame);
    },
    resize(cssW, cssH, dpr) {
      css.w = Math.max(1, cssW);
      css.h = Math.max(1, cssH);
      css.dpr = dpr;
      canvas.width = Math.max(1, Math.round(css.w * dpr));
      canvas.height = Math.max(1, Math.round(css.h * dpr));
    },
    dispose() {
      gl.deleteBuffer(buffer);
      field.dispose();
      surface.dispose();
      composite.dispose();
      for (const t of [fieldTarget, surfaceTarget]) {
        gl.deleteFramebuffer(t.fb);
        gl.deleteTexture(t.tex);
      }
    },
  };
}
