import { gsap } from "@/lib/gsap";
import { celBeats, celMarkup, celPlan, celSchedule } from "@/lib/mark/cel";
import { CARD, CEL_PICK } from "@/lib/mark/constants";

// The cel strike as one timeline (the lab's strike.ts, buildCel): a linear
// tween of a frame counter whose onUpdate redraws the layer only when the
// whole frame changes, so the clock steps like film. The page dips to the
// loader's dark tokens for the strike and the one flash frame covers the
// whole surface; AsMark fades in over the hot copy as the dip lifts.
function buildCelStrike(root: Element, night: Element | null, flash: Element | null) {
  const tl = gsap.timeline({ paused: true });
  const layer = root.querySelector<SVGGElement>('[data-part="cel"]');
  const rest = root.querySelector<HTMLElement>('[data-part="rest"]');
  if (!layer || !rest) return tl;
  const plan = celPlan(CEL_PICK);
  const sch = celSchedule(CEL_PICK);
  const ids = { glow: layer.dataset.glow ?? "", wide: layer.dataset.wide ?? "", pool: layer.dataset.pool ?? "", bloom: layer.dataset.bloom ?? "" };
  const count = plan.frames.length;
  const framesEnd = sch.lead + count / sch.fps;
  let shown = -2;
  const draw = (index: number) => {
    if (index === shown) return;
    shown = index;
    layer.innerHTML = index < 0 ? "" : celMarkup(plan, index, ids, CEL_PICK);
  };
  gsap.set(rest, { autoAlpha: 0 });
  draw(-1);
  const clock = { f: -sch.lead * sch.fps };
  tl.to(clock, { f: count, duration: framesEnd, ease: "none", onUpdate: () => draw(Math.min(count - 1, Math.floor(clock.f + 1e-6))) }, 0);
  if (flash) {
    const at = sch.lead + plan.impactFrame / sch.fps;
    tl.set(flash, { opacity: plan.fullFlash }, at).set(flash, { opacity: 0 }, at + 1 / sch.fps);
  }
  if (night) {
    tl.to(night, { opacity: 1, duration: sch.lead, ease: "power1.out" }, 0);
    tl.to(night, { opacity: 0, duration: sch.lift, ease: "power2.inOut" }, framesEnd);
  }
  tl.to(rest, { autoAlpha: 1, duration: sch.lift, ease: "power2.inOut" }, framesEnd);
  tl.set(layer, { autoAlpha: 0 }, framesEnd + sch.lift);
  return tl;
}

// Strike first: the bolt lands on the dipped page, then the surface forms
// around the settled mark and the words rise. The mark never moves.
export function buildCardOpen(scope: Element) {
  const tl = gsap.timeline({ paused: true });
  const root = scope.querySelector("[data-mark-strike]");
  if (!root) return tl;
  const strike = buildCelStrike(root, scope.querySelector("[data-cel-night]"), scope.querySelector("[data-cel-flash]"));
  tl.add(strike.paused(false), CARD.strikeLeadS);
  const formAt = CARD.strikeLeadS + celBeats(CEL_PICK).settle - CARD.formEarlyS;
  tl.fromTo('[data-card="surface"]', { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: CARD.formS, ease: "site" }, formAt);
  tl.fromTo('[data-card="text"]', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: CARD.formS, ease: "site", stagger: CARD.textStaggerS }, formAt + CARD.textDelayS);
  return tl;
}
