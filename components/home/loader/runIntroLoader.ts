import { COIL } from "@/lib/coil/constants";
import { gsap } from "@/lib/gsap";
import { getIntroKnobs } from "@/lib/home/introKnobs";
import { INTRO_HEADING_ID } from "@/lib/home/introId";
import {
  beginIntroLoad,
  displayPercent,
  easeFill,
  endIntroLoad,
  fillComplete,
  fillTarget,
  reportIntroLoad,
  showNumber,
} from "@/lib/home/introLoad";
import { landingColors } from "@/lib/home/loaderLanding";
import { landName, nameTarget } from "@/lib/home/nameHandoff";
import { flipTransform, type Rect } from "@/lib/home/nameFlip";

// The loader's imperative run, outside React: one rAF loop easing the fill
// toward the real tally (never ahead of it, never faster than its shortest
// run), the 600ms number rule, the hold at 100, then the shrink: the lockup is
// carried onto the heading by a uniform scale and a shift (GSAP, transform
// only) while the dark ground dissolves, and one frame hands the lockup over:
// to the canvas name the scene draws on that same place, wearing the colours the
// canvas name starts in (lib/home/loaderLanding.ts), or, where no scene can take
// it, to the heading, which was server-rendered there all along. IntroLoader.tsx renders
// the markup and calls this once the page has armed the loader; the returned
// function tears it all down.

export type LoaderParts = {
  root: HTMLElement;
  ground: HTMLElement;
  lockup: HTMLElement;
  count: HTMLElement;
  num: HTMLElement;
};

type Phase = "fill" | "hold" | "shrink" | "done";

// How long the loader waits for the scene to take the landed name before it leaves anyway.
const HANDOFF_GIVE_UP_MS = 1500;

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

// QA only (?coildebug): where the lockup's last frame landed, to compare with the heading.
function noteLanded(rect: Rect) {
  if (!/coildebug/.test(window.location.search)) return;
  const host = window as unknown as { __introLoader?: { landed: Rect | null; runs: number } };
  host.__introLoader = { landed: rect, runs: (host.__introLoader?.runs ?? 0) + 1 };
}

export function runIntroLoader(parts: LoaderParts): () => void {
  const { root, ground, lockup, count, num } = parts;
  const html = document.documentElement;
  const knobs = getIntroKnobs();
  const { holdMs, numberAfterMs, giveUpMs } = COIL.intro.loader;
  const startMs = performance.now();
  const tally = beginIntroLoad(startMs, giveUpMs);
  let phase: Phase = "fill";
  let raf = 0;
  let holdTimer = 0;
  let shown = 0;
  let last = startMs;
  let timeline: gsap.core.Timeline | null = null;
  let disposed = false;

  // A clean start (a replay begins on top of a finished one).
  gsap.set([lockup, ground, count], { clearProps: "all" });
  root.removeAttribute("data-full");
  root.removeAttribute("data-shrink");
  root.style.setProperty("--p", "0");
  num.textContent = "0";
  count.setAttribute("data-hidden", "");
  html.setAttribute("data-intro-loader", "on");

  // The face, then the tally hears it.
  const family = getComputedStyle(html).getPropertyValue("--font-display").trim() || "sans-serif";
  Promise.all([document.fonts.load(`900 100px ${family}`), document.fonts.ready])
    .then(() => reportIntroLoad("fonts"))
    .catch(() => reportIntroLoad("fonts"));

  // Nothing scrolls under the loader: the heading's place is measured once, at the top.
  const prevent = (event: Event) => event.preventDefault();
  window.addEventListener("wheel", prevent, { passive: false });
  window.addEventListener("touchmove", prevent, { passive: false });

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotion = () => {
    if (motion.matches) finish();
  };
  motion.addEventListener("change", onMotion);

  function finish() {
    if (phase === "done") return;
    phase = "done";
    noteLanded(rectOf(lockup));
    teardown();
    // The heading shows and the loader goes in one style change.
    html.setAttribute("data-intro-loader", "done");
  }

  function teardown() {
    cancelAnimationFrame(raf);
    window.clearTimeout(holdTimer);
    timeline?.kill();
    timeline = null;
    window.removeEventListener("wheel", prevent);
    window.removeEventListener("touchmove", prevent);
    motion.removeEventListener("change", onMotion);
    endIntroLoad(tally);
  }

  function paint(done: boolean, elapsed: number) {
    root.style.setProperty("--p", shown.toFixed(4));
    const percent = displayPercent(shown, done && shown >= 1);
    num.textContent = String(percent);
    root.setAttribute("aria-valuenow", String(percent));
    if (showNumber(elapsed, done, numberAfterMs)) count.removeAttribute("data-hidden");
    else count.setAttribute("data-hidden", "");
    if (shown >= 1) root.setAttribute("data-full", "");
  }

  function shrink() {
    if (disposed || phase === "done") return;
    phase = "shrink";
    html.setAttribute("data-intro-loader", "shrink");
    root.setAttribute("data-shrink", "");
    count.setAttribute("data-hidden", "");
    if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: "instant" });
    const heading = document.getElementById(INTRO_HEADING_ID);
    if (!heading) return finish();
    const flip = flipTransform(rectOf(lockup), rectOf(heading));
    const ink = heading.querySelector("[data-lockup-name]") ?? heading;
    const seconds = knobs.shrinkMs / 1000;
    timeline = gsap.timeline({ onComplete: handOff });
    timeline.set(lockup, { transformOrigin: "0 0" });
    timeline.to(lockup, { x: flip.x, y: flip.y, scale: flip.scale, duration: seconds, ease: knobs.shrinkEase }, 0);
    // The ground clears first, so the name is never mid-ink over a mid-grey ground; the ink follows it to the landing's.
    timeline.to(ground, { opacity: 0, duration: seconds * 0.5, ease: "power1.inOut" }, seconds * 0.08);
    // The scene can take the name (it has drawn): the ink goes to the canvas name's own, the greeting solid above it.
    const target = nameTarget();
    const nameEl = lockup.querySelector(".name-lockup__name");
    const greetEl = lockup.querySelector(".name-lockup__greet");
    if (target && nameEl && greetEl) {
      const colors = landingColors(target);
      timeline.to(lockup, { color: colors.name, duration: seconds * 0.65, ease: "power1.inOut" }, seconds * 0.35);
      timeline.to(nameEl, { opacity: colors.nameOpacity, duration: seconds * 0.65, ease: "power1.inOut" }, seconds * 0.35);
      timeline.to(greetEl, { color: colors.greeting, duration: seconds * 0.65, ease: "power1.inOut" }, seconds * 0.35);
    } else {
      timeline.to(lockup, { color: getComputedStyle(ink).color, duration: seconds * 0.65, ease: "power1.inOut" }, seconds * 0.35);
    }
  }

  // The lockup has landed on the name's place: the canvas takes it and the
  // loader goes in one task. Where the scene cannot take it yet it is given a
  // moment; after that the page's heading shows it (the scene's name appears
  // by itself once the loader is done).
  function handOff() {
    if (disposed || phase === "done") return;
    const began = performance.now();
    const attempt = () => {
      raf = 0;
      if (disposed || phase === "done") return;
      if (landName() || performance.now() - began > HANDOFF_GIVE_UP_MS) return finish();
      raf = requestAnimationFrame(attempt);
    };
    attempt();
  }

  function tick(now: number) {
    raf = 0;
    if (disposed || phase !== "fill") return;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const elapsed = now - startMs;
    tally.check(now);
    const done = tally.done();
    shown = easeFill(shown, fillTarget(tally.progress(), done, elapsed, knobs.loaderMs), dt);
    paint(done, elapsed);
    if (fillComplete(done, elapsed, knobs.loaderMs) && shown >= 1) {
      phase = "hold";
      holdTimer = window.setTimeout(shrink, holdMs);
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  raf = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    const wasRunning = phase !== "done";
    phase = "done";
    teardown();
    // Torn down mid-run (a route change, a dev remount): never leave the heading hidden.
    if (wasRunning) html.setAttribute("data-intro-loader", "done");
  };
}
