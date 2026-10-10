import { COIL } from "@/lib/coil/constants";
import { FIELD, NAME_DISTURB, NAME_SURFACE, nameComposite, nameDisturb } from "@/lib/coil/field.glsl";
import { MAX_RIPPLES, type RippleRing } from "@/lib/footer/egg";
import type { Box } from "@/lib/footer/heroFrame";
import {
  FIELD_VERT,
  UV_VERT,
  compositeSource,
  fieldSource,
  surfaceClock,
  surfaceExtent,
  surfaceSource,
  surfaceTargetSize,
  type CompositeUniform,
  type FieldUniform,
  type SurfaceUniform,
} from "@/lib/footer/shaders";
import type { FieldTokens, NameTokens } from "@/lib/footer/tokens";
import { fullscreenTriangle, getContext, link } from "./program";

// The footer's field in raw WebGL 2, three passes as the hero runs them
// (components/coil/scene/field.ts and nameSurface.ts, ported in the footer
// lab's heroFieldGl.ts): the field into a third resolution target on the
// hero's drift and in the hero's frame, the egg's rings pushing through it;
// the hero name's lit surface into a half resolution target over the word;
// the composite to the canvas at the device resolution, the field behind the
// footer at one depth and inside the letters' band at the letters' depth
// with the name's surface over it, and the hero's dither. One context.

export type FieldFrame = {
  readonly orange: number; // the field's clocks (lib/coil/drift.ts fieldClocks)
  readonly weather: number;
  readonly warp: number;
  readonly tokens: FieldTokens;
  readonly name: NameTokens;
  readonly aspect: number; // the hero's frame (lib/footer/heroFrame.ts heroFrame)
  readonly frameY: number;
  readonly frameY0: number;
  readonly rings: readonly RippleRing[];
  readonly ringWidthPx: number;
  readonly behind: number; // the field's depth behind the footer
  readonly letters: { readonly band: number; readonly rect: Box; readonly intensity: number; readonly surface: boolean };
  readonly surfaceS: number; // the name surface's clock, s
  readonly viewportH: number;
};

export type FooterFieldGl = {
  draw: (frame: FieldFrame) => void;
  resize: (cssW: number, cssH: number, dpr: number) => void;
  dispose: () => void;
};

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

export function createFooterFieldGl(canvas: HTMLCanvasElement): FooterFieldGl | null {
  const context = getContext(canvas);
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  const buffer = fullscreenTriangle(gl);
  const fieldP = link<FieldUniform>(gl, FIELD_VERT, fieldSource());
  const surfaceP = link<SurfaceUniform>(gl, UV_VERT, surfaceSource());
  const compositeP = link<CompositeUniform>(gl, UV_VERT, compositeSource());
  const fieldT = createTarget(gl);
  const surfaceT = createTarget(gl);
  if (!fieldP || !surfaceP || !compositeP || !fieldT || !surfaceT) return null;
  const field = fieldP;
  const surface = surfaceP;
  const composite = compositeP;
  const fieldTarget = fieldT;
  const surfaceTarget = surfaceT;
  const css = { w: 1, h: 1, dpr: 1 };
  const rot = (NAME_SURFACE.rotZ * Math.PI) / 180;
  const rings = new Float32Array(4 * MAX_RIPPLES);
  const shines = new Float32Array(MAX_RIPPLES);

  function drawField(frame: FieldFrame, w: number, h: number) {
    const p = field;
    const t = frame.tokens;
    p.use();
    gl.uniform1f(p.u("uAmt"), FIELD.amount);
    gl.uniform2f(p.u("uSecAt"), ...FIELD.secondAt);
    gl.uniform2f(p.u("uSecScale"), ...FIELD.secondScale);
    gl.uniform1f(p.u("uT"), frame.orange);
    gl.uniform1f(p.u("uTw"), frame.weather);
    gl.uniform1f(p.u("uWarp"), frame.warp);
    gl.uniform1f(p.u("uAspect"), frame.aspect);
    gl.uniform1f(p.u("uSec"), t.dark ? FIELD.second.dark : FIELD.second.light);
    gl.uniform3f(p.u("uTop"), ...t.top);
    gl.uniform3f(p.u("uBottom"), ...t.bottom);
    gl.uniform3f(p.u("uGlow"), ...t.glow);
    gl.uniform3f(p.u("uSecond"), ...t.second);
    gl.uniform3f(p.u("uPaper"), ...t.paper);
    // The field renders at the hero's own depth; the composite sets each region's.
    gl.uniform1f(p.u("uIntensity"), 1);
    gl.uniform4f(p.u("uFrame"), 1, frame.frameY, 0, frame.frameY0);
    gl.uniform2f(p.u("uStagePx"), css.w, css.h);
    rings.fill(0);
    shines.fill(0);
    frame.rings.slice(0, MAX_RIPPLES).forEach((r, i) => {
      rings.set([r.x, r.y, r.radius, r.push], 4 * i);
      shines[i] = r.shine;
    });
    gl.uniform4fv(p.u("uRip[0]"), rings);
    gl.uniform1fv(p.u("uRipShine[0]"), shines);
    gl.uniform1f(p.u("uRipW"), Math.max(1, frame.ringWidthPx));
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function drawSurface(frame: FieldFrame) {
    const { rect } = frame.letters;
    const [w, h] = surfaceTargetSize(rect.w, rect.h, css.dpr);
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
    const [ex, ey] = surfaceExtent(rect.w, rect.h, css.w, frame.viewportH);
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

  function drawComposite(frame: FieldFrame) {
    const p = composite;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    p.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fieldTarget.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, surfaceTarget.tex);
    gl.activeTexture(gl.TEXTURE0);
    for (const name of ["uField", "uName", "uGlyph", "uWake"] as const) gl.uniform1i(p.u(name), 0);
    gl.uniform1i(p.u("uSurf"), 1);
    gl.uniform4f(p.u("uView"), 0, 0, 1 / canvas.width, 1 / canvas.height);
    gl.uniform2f(p.u("uStage"), css.w, css.h);
    gl.uniform3f(p.u("uPaper"), ...frame.tokens.paper);
    gl.uniform1f(p.u("uBehind"), frame.behind);
    const l = frame.letters;
    gl.uniform1f(p.u("uBand"), l.band);
    gl.uniform1f(p.u("uLetterK"), l.intensity);
    gl.uniform1f(p.u("uSurfOn"), l.surface ? 1 : 0);
    gl.uniform4f(p.u("uRect"), l.rect.x, l.rect.y, Math.max(1, l.rect.w), Math.max(1, l.rect.h));
    // The name as the hero composites it: its ink at the hero's gain, the
    // surface's mean and the theme's floor, detail, chroma and grain; no
    // wake, no greeting, no per-letter minimum (that weighs the hero's letters).
    const n = frame.name;
    const c = nameComposite(frame.tokens.dark);
    gl.uniform1f(p.u("uNameK"), Math.min(1, Math.max(0, n.ink * COIL.lockup.inkGain)));
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
      drawField(frame, fw, fh);
      if (frame.letters.surface) drawSurface(frame);
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
      // No loseContext: a dev remount (React's strict effects) asks the same
      // canvas for its context again, and a lost one would fail every call.
    },
  };
}
