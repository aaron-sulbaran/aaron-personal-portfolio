import type { FooterSettings } from "./settings";

// The field renders once, at the deeper of its two depths: the letters' (in
// clip) and the footer's. The stage's mask holds the footer's share of it; a
// paper veil over the letters takes them back when they are the shallower
// one. Depth is the shader's intensity, a linear move away from paper, so a
// share of a deeper field over paper is the shallower field (short of the
// shader's clamp, which these depths never reach).
export function fieldDepths(field: FooterSettings["field"]) {
  const clip = field.on && field.ending === "clip";
  const deepest = clip ? Math.max(field.intensity, field.letterIntensity) : field.intensity;
  return {
    canvas: deepest,
    backdropShare: deepest > 0 ? field.intensity / deepest : 1,
    letterVeil: clip && deepest > 0 ? 1 - field.letterIntensity / deepest : 0,
  };
}
