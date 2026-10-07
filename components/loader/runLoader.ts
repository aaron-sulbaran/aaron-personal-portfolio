import { gsap } from "@/lib/gsap";
import { siteEase } from "@/lib/coil/motion";
import { siteContent } from "@/lib/content";
import { LOADER, coilDebugFlags, displayPercent, homeLoad, reportHomeLoad, slowSceneMs } from "@/lib/loader/progress";
import { landName, nameTarget, type NameTarget } from "@/lib/loader/handoff";
import { loaderEnd, stillPoster, type StillPoster } from "@/lib/loader/still";
import { createStillWait } from "@/lib/loader/stillWait";
import { createInkEase, type InkEase } from "@/lib/loader/inkEase";
import { COIL } from "@/lib/coil/constants";
import { HERO_HEADING_ID } from "@/components/home/HeroText";
import {
  greetingColor,
  greetingInBox,
  landing,
  landingGradient,
  landingOpacity,
  landingTransform,
  parseRgb,
} from "@/lib/loader/continuity";
import { LOADER_LOCKUP, NUM_ARITH, PROFA_METRICS, inkSpan, lockupMetrics, lockupVars, type LockupMetrics } from "@/lib/loader/lockup";
import { debugLog } from "./loaderDebug";

// The loader's imperative run, outside React: one rAF loop easing the fill
// toward the tally, the flash guard, the 600ms number rule, the 150ms hold at
// 100, and the exit (the continuity landing on the canvas lockup, the
// hand-off to the hero still, or a plain fade). A load done inside the guard
// skips all of that: the resting lockup holds until the scene has drawn and
// hands to it in one frame (or to the still, when no scene can run). Loader.tsx
// renders the markup and calls runLoader once its mode is known; the returned
// function tears it all down.

// How long a CSS animation on `el` has run, or null when it cannot be read.
function animationTime(el: Element, name: string): number | null {
  if (typeof el.getAnimations !== "function") return null;
  const found = el.getAnimations().find((a) => (a as CSSAnimation).animationName === name);
  const time = found?.currentTime;
  return typeof time === "number" ? time : null;
}

export type LoaderParts = {
  root: HTMLDivElement;
  pane: HTMLDivElement;
  name: HTMLDivElement;
  base: HTMLSpanElement;
  fill: HTMLDivElement;
  count: HTMLDivElement;
  num: HTMLSpanElement;
  bg: HTMLDivElement;
  greet: HTMLSpanElement;
};

export type LoaderOptions = {
  reduced: boolean;
  // The hero shows the canvas: the h1 is visually hidden, the DOM lockup may go.
  sceneShown: () => boolean;
};

// The loader's run: the tally loop, the guard, the hold and the exit.
// Returns the cleanup.
export function runLoader(
  parts: LoaderParts,
  { reduced, sceneShown }: LoaderOptions,
  reveal: (startMs: number, nameFromLoader: boolean) => void,
  mountedAt: number,
): () => void {
  const { root, count, num, bg } = parts;
  const tally = homeLoad();
  // ?coildebug=handoff: the hand-off waits on window.__coilLoader.finish()
  // (cards held back), to compare the frames either side of it.
  const debugFlags = coilDebugFlags(window.location.search);
  const holdHandoff = debugFlags.has("handoff");
  // ?coildebug=slowscene: the scene cannot take the lockup before this time.
  const sceneTakesAt = slowSceneMs(debugFlags) ?? 0;
  let metrics: LockupMetrics = PROFA_METRICS;
  let disposed = false;
  let raf = 0;
  let shown = 0; // the displayed progress, easing toward the tally
  let last = performance.now();
  let finishing = false;
  let timeline: gsap.core.Timeline | null = null;
  let holdTimer = 0;
  let paneShown = false;
  let endBegan = 0;
  let stillTimer = 0;
  let stopStillWait = () => {};
  let ink: InkEase | null = null;
  const note = debugLog(root);
  note("run", { reduced, items: tally ? tally.progress() : null });

  // The face's real metrics, once loaded, on both lockups (the h1 hands over at the same pose), then the tally hears it.
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
  Promise.all([document.fonts.load(`900 100px ${family}`), document.fonts.ready])
    .then(() => {
      if (disposed) return;
      const measured = measureLockup(family);
      if (measured) {
        metrics = measured;
        const heading = document.getElementById(HERO_HEADING_ID);
        lockupVars(measured).forEach(([key, value]) => [root, heading].forEach((el) => el?.style.setProperty(key, value)));
      }
      reportHomeLoad("fonts");
    })
    .catch(() => reportHomeLoad("fonts"));

  const paint = (done: boolean) => {
    parts.pane.style.setProperty("--p", shown.toFixed(4));
    const percent = displayPercent(shown, done && shown >= 1);
    num.textContent = String(percent);
    parts.pane.setAttribute("aria-valuenow", String(percent));
    // Full: the whole name in the accent (no paper hairline above the clip).
    if (shown >= 1) root.setAttribute("data-full", "");
  };

  const guardPassed = () => {
    const time = animationTime(bg, "coil-loader-in");
    return (time ?? performance.now() - mountedAt) >= LOADER.guardMs;
  };

  const gone = () => {
    root.setAttribute("data-state", "gone");
  };

  // Lands the canvas lockup and drops the DOM one in the same task, on the
  // first frame both are ready (the scene drawn and showing, the entrance
  // reached); gives up after handoffGiveUpMs, leaving the canvas's fallback.
  function handOff() {
    const began = performance.now();
    const attempt = () => {
      raf = 0;
      if (disposed) return;
      if (sceneShown() && performance.now() >= sceneTakesAt && landName()) {
        gone();
        note("handoff");
        return;
      }
      if (performance.now() - began > LOADER.handoffGiveUpMs) {
        gone();
        note("handoff-gave-up");
        return;
      }
      raf = requestAnimationFrame(attempt);
    };
    attempt();
  }

  // Done inside the guard with a scene drawn: the pane never shows; the
  // resting lockup (already the landed pose) holds while the entrance reaches
  // the scene, then the canvas takes it. The band starts at the hand-off.
  function rest() {
    root.setAttribute("data-state", "rest");
    note("rest");
    reveal(performance.now() + (holdHandoff ? 600000 : LOADER.restHoldMs), true);
    if (holdHandoff) exposeFinish(handOff);
    else holdTimer = window.setTimeout(handOff, LOADER.restHoldMs);
  }

  const tick = (now: number) => {
    raf = 0;
    if (disposed) return;
    const dt = Math.min(0.1, Math.max(0, now - last) / 1000);
    last = now;
    tally?.check(now);
    const target = tally ? tally.progress() : 1;
    const done = tally ? tally.done() : true;
    // A short, honest ease toward the tally, never slower than 1.5 per second.
    shown += Math.max((target - shown) * (1 - Math.exp(-dt * 12)), Math.min(target - shown, 1.5 * dt));
    if (target - shown < 0.002) shown = target;
    paint(done);
    note("frame", { tally: target, shown, done });
    if (done && !finishing) {
      finishing = true;
      paneShown = guardPassed();
      if (!paneShown) {
        // Everything was ready inside the guard: no pane. The resting lockup
        // holds (the pane can no longer arm) while end() picks who takes it.
        if (!reduced) root.setAttribute("data-state", "rest");
        end();
        return;
      }
      const numberTime = animationTime(count, "coil-loader-count");
      if (numberTime !== null && numberTime < LOADER.numberAfterMs) count.setAttribute("data-hidden", "");
      note("done", { numberTime, numberHidden: count.hasAttribute("data-hidden"), gaveUp: tally?.gaveUp() ?? false });
    }
    if (finishing && shown >= 1) {
      note("100");
      holdTimer = window.setTimeout(exit, LOADER.holdMs);
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  function exit() {
    if (disposed) return;
    root.setAttribute("data-state", "live");
    end();
  }

  // Who takes the lockup (lib/loader/still.ts): the scene (the resting hold or
  // the continuity), the hero still, or nobody (a fade, a skip). A canvas
  // lockup off screen is no landing: it would fly out of view.
  function end() {
    raf = 0;
    if (disposed) return;
    const now = performance.now();
    endBegan ||= now;
    const found = reduced ? null : nameTarget();
    const target = !found ? "none" : found.baseline > 0 && found.baseline - found.fontPx < window.innerHeight ? "landable" : "away";
    const poster = stillPoster();
    const choice = loaderEnd({ reduced, paneShown, target, still: poster !== null, waitedMs: now - endBegan });
    if (choice === "wait") {
      raf = requestAnimationFrame(end);
      return;
    }
    note("end", { choice });
    if (choice === "rest") rest();
    else if (choice === "skip") skip();
    else if (choice === "dissolve") dissolve(poster!);
    else if (choice === "continuity") continuity(found!);
    else fade();
  }

  function skip() {
    root.setAttribute("data-rest", "off");
    gone();
    note("skipped");
    reveal(performance.now(), false);
  }

  // A plain fade. The pane covered the resting lockup, so it leaves with
  // the pane; without a pane the resting lockup fades with the root and the
  // h1 shows at gone.
  function fade() {
    if (paneShown) root.setAttribute("data-rest", "off");
    note("fade");
    reveal(performance.now() + LOADER.reducedFadeMs, false);
    timeline = gsap.timeline({ onComplete: gone });
    timeline.to(root, { opacity: 0, duration: LOADER.reducedFadeMs / 1000, ease: "none" });
  }

  // No scene can run. Once the still has decoded, the pane (if it showed)
  // fades off the resting lockup; then the still fades in UNDER the resting
  // lockup over stillFadeMs (loaderMarkup.ts lifts its hold on
  // data-dissolve) while the lockup's ink eases to the h1's (lib/loader/inkEase.ts),
  // and the lockup leaves in one frame onto the h1 when that fade ends.
  // A still that fails to decode, or not within handoffGiveUpMs: the plain
  // fade, and the h1 carries the hero.
  function dissolve(poster: StillPoster) {
    note("still");
    let decided = false;
    const giveUp = () => {
      if (decided || disposed) return;
      decided = true;
      window.clearTimeout(stillTimer);
      note("still-failed");
      fade();
    };
    const handTo = () => {
      if (disposed) return;
      ink?.settle();
      stopStillWait();
      gone();
      note("still-handoff");
    };
    // The lockup leaves when the still's own fade ends (?coildebug=handoff:
    // on finish()); the ink and the backup timer run from the fade's
    // transitionrun, not from here (lib/loader/stillWait.ts).
    const afterStillFade = () => {
      const still = document.querySelector<HTMLElement>("[data-hero-still]");
      const layer = root.querySelector<HTMLElement>(LOADER_LOCKUP.layer);
      ink = createInkEase(layer, () => getComputedStyle(layer!).opacity, COIL.lockup.stillInk, LOADER.stillFadeMs);
      const wait = createStillWait({
        fadeMs: LOADER.stillFadeMs, slackMs: LOADER.stillFadeSlackMs,
        startGuardMs: LOADER.stillFadeMs + LOADER.stillFadeSlackMs + LOADER.handoffGiveUpMs,
        timers: { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) },
        leave: holdHandoff ? () => {} : handTo,
        onStart: ink.start,
      });
      const phases: Record<string, () => void> = { transitionrun: wait.started, transitionend: wait.ended, transitioncancel: wait.cancelled };
      const onPhase = (event: Event) => {
        if (event.target === still && (event as TransitionEvent).propertyName === "opacity") phases[event.type]();
      };
      Object.keys(phases).forEach((type) => still?.addEventListener(type, onPhase));
      stopStillWait = () => {
        Object.keys(phases).forEach((type) => still?.removeEventListener(type, onPhase));
        wait.dispose();
      };
    };
    const under = () => {
      if (disposed) return;
      root.setAttribute("data-state", "rest");
      root.setAttribute("data-dissolve", "");
      note("dissolve");
      reveal(performance.now() + LOADER.stillFadeMs, false);
      afterStillFade();
      if (holdHandoff) exposeFinish(handTo);
    };
    const begin = () => {
      if (!paneShown) return under();
      timeline = gsap.timeline({ onComplete: under });
      timeline.to([parts.bg, parts.pane], { opacity: 0, duration: LOADER.stillFadeMs / 1000, ease: "none" });
    };
    const decodedNow = () => {
      if (decided || disposed) return;
      decided = true;
      window.clearTimeout(stillTimer);
      if (!holdHandoff) return begin();
      note("still-held");
      exposeFinish(begin);
    };
    stillTimer = window.setTimeout(giveUp, LOADER.handoffGiveUpMs);
    poster.decoded().then(decodedNow, giveUp);
  }

  function continuity(target: NameTarget) {
    root.setAttribute("data-rest", "off"); // The pane covered the resting lockup; the exit lands the pane's own.
    const { name, base, fill, greet } = parts;
    const accent = parseRgb(getComputedStyle(fill.firstElementChild ?? fill).color) ?? target.gradient.from;
    const nameStyle = getComputedStyle(name);
    const matrix = new DOMMatrixReadOnly(nameStyle.transform === "none" ? undefined : nameStyle.transform);
    const fontPx = parseFloat(nameStyle.fontSize);
    const box = {
      left: name.offsetLeft,
      top: name.offsetTop,
      width: name.offsetWidth,
      height: name.offsetHeight,
      rotationDeg: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
    };
    const land = landing(box, target);
    const glyphTop = (metrics.capR - metrics.base) * fontPx;
    const durationS = LOADER.exitMs / 1000;

    // The fill is complete; the base glyph carries the color from here.
    fill.style.visibility = "hidden";
    base.style.color = "transparent";
    base.style.setProperty("-webkit-background-clip", "text");
    base.style.backgroundClip = "text";
    count.setAttribute("data-exit", "");
    // The greeting placed from the scene's own numbers, so it lands exactly.
    const greeting = inkSpan(NUM_ARITH, greetingInBox(box, target), metrics.gInkL, metrics.base);
    greet.style.transition = "none";
    greet.style.left = `${greeting.left}px`;
    greet.style.top = `${greeting.top}px`;
    greet.style.fontSize = `${greeting.fontPx}px`;

    const state = { e: 0, c: 0, bg: 1, count: 1 };
    const apply = () => {
      name.style.transform = landingTransform(land, state.e);
      name.style.opacity = String(landingOpacity(target, state.c));
      base.style.backgroundImage = landingGradient(accent, target, box, glyphTop, state.c);
      greet.style.color = greetingColor(accent, target, state.c);
      bg.style.opacity = String(state.bg);
      count.style.opacity = String(state.count);
    };
    apply();
    note("exit", { land });
    reveal(performance.now() + (holdHandoff ? 600000 : LOADER.exitMs - LOADER.entranceOverlapMs), true);
    timeline = gsap.timeline({
      onUpdate: apply,
      // One frame: the canvas draws its lockup now, the DOM lockup leaves now.
      onComplete: handOff,
    });
    timeline.to(state, { e: 1, duration: durationS, ease: siteEase }, 0);
    timeline.to(state, { c: 1, duration: durationS * 0.85, ease: "power1.inOut" }, 0);
    timeline.to(state, { bg: 0, duration: durationS * 0.75, ease: "power1.out" }, 0);
    timeline.to(state, { count: 0, duration: durationS * 0.35, ease: "power1.out" }, 0);
    if (holdHandoff) {
      const running = timeline;
      running.addPause(durationS - 1e-4);
      // Finishing jumps to the end, so the hand-off lands in the calling task.
      exposeFinish(() => running.progress(1));
    }
  }

  return () => {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    window.clearTimeout(holdTimer);
    window.clearTimeout(stillTimer);
    stopStillWait();
    ink?.cancel();
    timeline?.kill();
  };
}

// ?coildebug=handoff: the held hand-off resumes on window.__coilLoader.finish().
function exposeFinish(finish: () => void) {
  const host = window as unknown as { __coilLoader?: { finish?: () => void } };
  if (host.__coilLoader) host.__coilLoader.finish = finish;
}

// The display face's metrics for the lockup at this browser's rendering, as
// the canvas measures them; null when the face does not look loaded.
function measureLockup(family: string): LockupMetrics | null {
  const g = document.createElement("canvas").getContext("2d");
  if (!g) return null;
  g.font = `900 1000px ${family}`;
  const { greeting, name } = siteContent.hero;
  return lockupMetrics(g.measureText(name), g.measureText(greeting), g.measureText("H"), 1000);
}
