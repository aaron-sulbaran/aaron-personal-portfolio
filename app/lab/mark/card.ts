"use client";

import { gsap } from "gsap";
import { IMPACT_X_FRACTION } from "./geometry";
import { beats, EASES, type Settings } from "./settings";
import { buildStrike } from "./strike";

// The card's open, composed around the strike. The backdrop and the panel use
// the modal's real numbers (lib/modal.ts: blur 0 to 24px over 280ms easeOut;
// WorkModal: opacity, y 16, scale 0.97 over 280ms easeOut), with Framer's
// easeOut as a CustomEase so the copy moves on the same curve.

const MODAL_IN = 0.28;
const STRIKE_LEAD = 0.04;


export function buildCardOpen(stage: Element, s: Settings, reduced: boolean) {
  const one = (part: string) => stage.querySelector<HTMLElement>(`[data-card="${part}"]`);
  const backdrop = one("backdrop");
  const tint = one("tint");
  const panel = one("panel");
  const surface = one("surface");
  const ground = one("ground");
  const markRoot = one("mark");
  const texts = Array.from(stage.querySelectorAll<HTMLElement>('[data-card="text"]'));
  const tl = gsap.timeline({ paused: true });

  // Measured before any tween transforms the panel.
  let groundOrigin = 0;
  if (ground && markRoot) {
    const markBox = markRoot.getBoundingClientRect();
    groundOrigin = markBox.left + markBox.width * IMPACT_X_FRACTION - ground.getBoundingClientRect().left;
  }

  tl.fromTo(
    backdrop,
    { backdropFilter: "blur(0px)" },
    { backdropFilter: "blur(24px)", duration: MODAL_IN, ease: "framerOut" },
    0,
  );
  tl.fromTo(tint, { opacity: 0 }, { opacity: 1, duration: MODAL_IN, ease: "framerOut" }, 0);

  if (reduced || !markRoot) {
    if (markRoot) buildStrike(markRoot, s, { reduced: "static" });
    tl.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: "none" }, 0);
    return tl;
  }

  const b = beats(s);
  const speed = s.speed;
  const placeGround = (strikeAt: number) => {
    if (!ground) return;
    gsap.set(ground, { transformOrigin: `${groundOrigin}px 50%` });
    tl.fromTo(
      ground,
      { scaleX: 0 },
      { scaleX: 1, duration: (Math.max(s.splashMs, 360) * 1.1) / 1000 / speed, ease: EASES[s.splashEase].gsap },
      strikeAt + b.impact / speed,
    );
  };

  if (s.order === "card-first") {
    tl.fromTo(panel, { opacity: 0, y: 16, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: MODAL_IN, ease: "framerOut" }, 0);
    const strikeAt = MODAL_IN + 0.08;
    const strike = buildStrike(markRoot, s, { flash: one("flash-card") }).timeScale(speed);
    tl.add(strike.paused(false), strikeAt);
    placeGround(strikeAt);
    return tl;
  }

  // Strike first: the bolt lands on the bare page, then the surface forms
  // around the settled mark and the words rise after it. The mark never moves.
  const strike = buildStrike(markRoot, s, { flash: one("flash-page") }).timeScale(speed);
  tl.add(strike.paused(false), STRIKE_LEAD);
  placeGround(STRIKE_LEAD);
  const formAt = STRIKE_LEAD + b.settle / speed - 0.12;
  gsap.set(panel, { opacity: 1 });
  tl.fromTo(surface, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.42, ease: "site" }, formAt);
  tl.fromTo(texts, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.42, ease: "site", stagger: 0.05 }, formAt + 0.1);
  return tl;
}

export function cardMarkers(s: Settings) {
  const b = beats(s);
  const strikeAt = s.order === "card-first" ? MODAL_IN + 0.08 : STRIKE_LEAD;
  const at = (t: number) => strikeAt + t / s.speed;
  return [
    { label: "mid strike", at: at(b.impact * 0.55) },
    { label: "impact", at: at(b.impact + 0.03) },
    { label: "A half", at: at(b.aStart + (b.settle - b.aStart) * 0.5) },
    { label: "settled", at: at(b.settle) + 0.6 },
  ];
}
