import { COMPOSITE_FRAG, NAME_SURFACE, SURFACE_FRAG } from "@/lib/coil/field.glsl";

// The hero's field and name, ported to the footer as the hero draws them
// (components/coil/scene/field.ts, nameSurface.ts and name.ts on main):
// the field at a third of CSS resolution on the hero's own drift, upsampled
// into a full resolution composite with the hero's dither; the name's lit
// surface into a half resolution target over the word; and the hero's own
// composite code (the field and the surface met in OKLab, its floor, chroma
// and grain) inside the letters. The shader strings are the site's
// (lib/coil/field.glsl.ts), moved to GLSL ES 3.00 by exact replacements, so a
// change on the site fails these adapters instead of drifting from them.

// The hero's lockup rect (the name's surface target, the greeting included)
// per px of the hero's width, measured on the running hero (merged main,
// http://localhost:3001, 2026-10-09: 1022 by 334 at 1440 wide, 758 by 248 at
// 1068, 356 by 116 at 390). The name spans 0.7 of the width, 0.9 on a narrow
// pane (width over height under 0.8, COIL.narrow.aspectBelow). The footer's
// surface keeps the hero's plane units per px, so its folds are the hero's size.
export const HERO_LOCKUP = { heightPerWidth: { wide: 0.2319, narrow: 0.2982 }, narrowBelow: 0.8 } as const;

// The hero's frame for a footer `stageW` wide and `stageH` tall under a
// viewport `viewportH` tall: the hero fills the width and 100svh, so the
// field's aspect and scale are the hero's, and the word's middle (`wordMidY`,
// stage px from the top) sits at the frame's middle, where the hero's name
// sits: the letters see the field the name sees, the footer above them the
// hero's upper half (its burnt orange lobe at the top right).
export function heroFrame(stageW: number, stageH: number, viewportH: number, wordMidY = stageH) {
  const height = Math.max(1, viewportH);
  return {
    aspect: stageW / height,
    frameY: stageH / height,
    frameY0: 0.5 - (stageH - wordMidY) / height,
    narrow: stageW / height < HERO_LOCKUP.narrowBelow,
  };
}

// The surface's plane extent (half width, half height in plane units) over
// a rect of the word: the hero's NAME_SURFACE.viewHeight spans the hero's
// lockup height, so a px here is a px there.
export function surfaceExtent(rectW: number, rectH: number, stageW: number, viewportH: number): [number, number] {
  const narrow = heroFrame(stageW, 1, viewportH).narrow;
  const lockupH = Math.max(1, stageW * (narrow ? HERO_LOCKUP.heightPerWidth.narrow : HERO_LOCKUP.heightPerWidth.wide));
  const unitsPerPx = NAME_SURFACE.viewHeight / lockupH;
  return [(rectW * unitsPerPx) / 2, (rectH * unitsPerPx) / 2];
}

const ES3_HEADER = "#version 300 es\nprecision highp float;\nprecision highp int;\n#define texture2D texture\nout vec4 fragColor;\n";

const VARYING = "varying vec2 vUv;";
const FRAG_COLOR = "gl_FragColor = ";

export function adaptSurfaceFrag(source: string): string {
  if (!source.includes(VARYING) || !source.includes(FRAG_COLOR)) {
    throw new Error("The hero's surface shader changed shape; update the footer lab's adapter.");
  }
  return ES3_HEADER + source.replace(VARYING, "in vec2 vUv;").replace(FRAG_COLOR, "fragColor = ");
}

const MAIN = "void main()";
const LETTERS = "vec3 nameLetters(vec3 field, vec2 g, float greeting)";

// The footer's composite: the field upsampled (linear, as the hero's target
// is), above the word's band at the depth behind the footer, inside it at
// the letters' depth with the hero's name drawn from the surface over it
// (the band shows only through the letters: the paper cover holds the rest),
// then the hero's dither. uBand < 0: no band (the field does not end in the
// letters).
const FOOTER_MAIN = `
uniform vec2 uStage;
uniform float uFlip, uBand, uBehind, uLetterK, uSurfOn;
uniform vec4 uRect;
void main() {
  vec2 fuv = gl_FragCoord.xy * uView.zw;
  vec3 field = texture(uField, fuv).rgb;
  float top = (1.0 - fuv.y) * uStage.y;
  vec2 px = vec2(fuv.x * uStage.x, uFlip > 0.5 ? uStage.y - top : top);
  vec3 col;
  if (uBand >= 0.0 && px.y >= uBand) {
    vec3 deep = clamp(uPaper + (field - uPaper) * uLetterK, 0.0, 1.0);
    col = uSurfOn > 0.5 ? nameLetters(deep, (px - uRect.xy) / uRect.zw, 0.0) : deep;
  } else {
    col = clamp(uPaper + (field - uPaper) * uBehind, 0.0, 1.0);
  }
  col += (h12(gl_FragCoord.xy) - 0.5) / 255.0;
  fragColor = vec4(col, 1.0);
}
`;

// The hero's composite up to its main (its uniforms, its grain hash and the
// name's letters), with the footer's main in place of the hero's.
export function adaptCompositeFrag(source: string): string {
  const at = source.indexOf(MAIN);
  if (at < 0 || !source.includes(LETTERS) || !source.includes("float h12(")) {
    throw new Error("The hero's composite changed shape; update the footer lab's adapter.");
  }
  return ES3_HEADER + source.slice(0, at) + FOOTER_MAIN;
}

export const SURFACE_SOURCE = () => adaptSurfaceFrag(SURFACE_FRAG);
export const COMPOSITE_SOURCE = () => adaptCompositeFrag(COMPOSITE_FRAG);

// The surface target's size over a rect (CSS px), as the hero sizes its own:
// half the device resolution, at most NAME_SURFACE.rtMaxWidth wide.
export function surfaceTargetSize(rectW: number, rectH: number, dpr: number): [number, number] {
  const scale = Math.min(NAME_SURFACE.rtScale * dpr, NAME_SURFACE.rtMaxWidth / Math.max(1, rectW));
  return [Math.max(8, Math.round(rectW * scale)), Math.max(8, Math.round(rectH * scale))];
}

// The surface's clock and key light after `clock` seconds, as the hero's.
export function surfaceClock(clock: number) {
  const a = (clock / NAME_SURFACE.lightPeriod) * Math.PI * 2;
  return {
    t: NAME_SURFACE.start + clock * NAME_SURFACE.speed,
    light: [NAME_SURFACE.lightRest[0] + Math.cos(a) * NAME_SURFACE.lightDrift, NAME_SURFACE.lightRest[1] + Math.sin(a) * NAME_SURFACE.lightDrift] as const,
  };
}
