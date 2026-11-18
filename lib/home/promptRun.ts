"use client";

import { gsap } from "@/lib/gsap";
import { COIL } from "@/lib/coil/constants";
import type { Quad } from "@/lib/coil/geometry";
import { fastForward, fastForwardsOnKey, fasterScale, litArea, promptFitPx, promptFrame, promptOrigin, promptStartPx, titleInPlace, titlePlace, type Edges, type PromptPlan, type TitlePlace } from "@/lib/home/clickPrompt";
import { setSpotlightUp } from "@/lib/home/spotlight";

// The big "click a card to open it" moment's per-frame run. It is a paused GSAP
// timeline of its own, on the same seconds-from-the-click clock as the deal's
// master but not a child of it: the deal's master starts it in play() and
// nothing about the master's length, onComplete or `dealt` moment changes.
// Every render reads the stage's and the visible resting line's live rects, so
// a scroll in the middle of the move carries the text with the page.

export type PromptParts = {
  stage: HTMLElement | null;
  overlay: HTMLElement | null;
  text: HTMLElement | null;
  plate: HTMLElement | null;
  scrim: HTMLElement | null;
  dim: HTMLElement | null;
  chrome: HTMLElement[]; // the logo and the Menu pill, which version G's title sits between
  menu: HTMLElement | null;
  titles: HTMLElement[];
  hosts: HTMLElement[];
};

export function promptParts(section: HTMLElement): PromptParts {
  const overlay = document.querySelector<HTMLElement>("[data-prompt-stage]");
  const text = overlay?.querySelector<HTMLElement>("[data-prompt-text]") ?? null;
  return {
    stage: section.querySelector<HTMLElement>("[data-coil-stage]"),
    overlay,
    text,
    plate: text?.querySelector<HTMLElement>("[data-prompt-plate]") ?? null,
    scrim: document.querySelector<HTMLElement>("[data-prompt-scrim]"),
    dim: document.querySelector<HTMLElement>("[data-prompt-dim]"),
    chrome: Array.from(document.querySelectorAll<HTMLElement>("[data-mark-trigger], [data-menu-pill]")),
    menu: document.querySelector<HTMLElement>("[data-menu-pill]"),
    titles: Array.from(section.querySelectorAll<HTMLElement>("[data-page-title]")),
    hosts: Array.from(section.querySelectorAll<HTMLElement>("[data-prompt-host]")),
  };
}

export type PromptRun = {
  play: () => void;
  finish: () => void;
  kill: () => void;
  // Versions D and F: lands the line within a quarter second. True when it acted (the scrim or the dim was up).
  fastForward: () => boolean;
};

const PHONE_BELOW_PX = 768;
const STAGE_MARGIN_PX = 32;
const s = (ms: number) => ms / 1000;

// onFastForward runs whenever the line lands early, whatever triggered it (the scrim's own listeners,
// the lock's swallow hook, or a resize under G's dim), so Hold's wait always ends with it and columns
// that were waiting for the line come in. cardQuads reads the
// cards' corners as drawn now, or `aheadMs` on at the Coil's idle drift (version G keeps its title clear of them).
export function createPromptRun(parts: PromptParts, plan: PromptPlan, onFastForward?: () => void, cardQuads?: (aheadMs?: number) => readonly Quad[]): PromptRun {
  const { stage, overlay, text, plate, scrim, dim, chrome, menu, titles, hosts } = parts;
  const spotlight = plan.version === "spotlight" && scrim !== null;
  const titled = plan.version === "title";
  const lit = (plan.version === "lit" || titled) && dim !== null;
  let titleAt: TitlePlace | null = null;
  // G on a phone (and "In the column" from 768 px wide) plays its big moment where the line rests: its
  // size, the text's box per px and the cards to keep clear of, kept so each frame can place it against the live line.
  let inPlace: { wantPx: number; perPx: { width: number; height: number }; column: boolean; quads: Quad[] } | null = null;
  const progress = { inP: 0, shrinkP: 0, handoffP: 0 };
  const timeline = gsap.timeline({ paused: true });
  let over = false;
  let sized = false;
  let colors: { from: string; to: string } | null = null;
  let scrimUp = false;
  let dimUp = false;
  let dimShape = "";
  let removeInput: (() => void) | null = null;
  let pressedUnderScrim = false;
  let removeGrace: (() => void) | null = null;

  const visibleLine = () =>
    hosts.map((host) => host.querySelector<HTMLElement>("[data-prompt-line]")).find((line) => line && line.getClientRects().length > 0) ?? null;

  // The scrim goes with the run, however it ends: hidden, its inline styles cleared, the scene let go.
  const dropScrim = () => {
    removeInput?.();
    removeInput = null;
    if (scrim) gsap.set(scrim, { clearProps: "opacity,visibility,pointerEvents" });
    if (dim) gsap.set(dim, { clearProps: "opacity,visibility,backgroundImage" });
    scrimUp = false;
    dimUp = false;
    dimShape = "";
    if (spotlight) setSpotlightUp(false);
  };

  // A tap held past the landing and released over a title must not open it: for a short grace the
  // window swallows the click of a press that began while the scrim was up.
  const endGrace = () => {
    removeGrace?.();
    removeGrace = null;
  };
  const startGrace = () => {
    endGrace();
    if (!pressedUnderScrim) return;
    const stopClick = (event: Event) => {
      if (!pressedUnderScrim) return endGrace();
      pressedUnderScrim = false;
      event.preventDefault();
      event.stopPropagation();
      endGrace();
    };
    // A fresh press (or a cancelled one) during the grace is not the held tap: let its click through.
    const freshPress = () => {
      pressedUnderScrim = false;
    };
    window.addEventListener("click", stopClick, { capture: true });
    window.addEventListener("pointerdown", freshPress, { capture: true });
    window.addEventListener("pointercancel", freshPress, { capture: true });
    const timer = window.setTimeout(endGrace, COIL.deal.prompt.spotlight.clickGraceMs);
    removeGrace = () => {
      window.removeEventListener("click", stopClick, { capture: true });
      window.removeEventListener("pointerdown", freshPress, { capture: true });
      window.removeEventListener("pointercancel", freshPress, { capture: true });
      window.clearTimeout(timer);
      pressedUnderScrim = false;
    };
  };

  const clearStyles = () => {
    dropScrim();
    hosts.forEach((host) => host.style.removeProperty("opacity"));
    if (overlay) gsap.set(overlay, { clearProps: "opacity,visibility,transform,willChange" });
    overlay?.removeAttribute("data-place");
    if (text) gsap.set(text, { clearProps: "fontSize,color" });
    if (plate) gsap.set(plate, { clearProps: "opacity" });
  };

  // Everything G's pill must miss while it can be read: the cards as drawn now (still settling from the
  // deal) and where the Coil's idle drift carries them until the pill is half way through its shrink.
  const titleQuads = (): Quad[] => {
    if (!cardQuads) return [];
    const readableMs = plan.shrinkStartMs - plan.startMs + (plan.shrinkEndMs - plan.shrinkStartMs) / 2;
    return [...cardQuads(), ...[0, 1 / 3, 2 / 3, 1].flatMap((share) => cardQuads(share * readableMs))];
  };

  const edgesOf = (element: Element): Edges => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
  };

  // G where the line rests: the big text's size and corner against the live line. On a phone, between the
  // page title above and the columns below (the line's block ends a margin short of them); in the desktop's
  // Work column, between the Work list above and the screen's foot (or the Music pill) below, clear of every card.
  const placeInLine = (line: HTMLElement) => {
    if (!inPlace) return null;
    const lineBox = edgesOf(line);
    const shared = { line: lineBox, rightEdge: document.documentElement.clientWidth - COIL.deal.prompt.gutterPx, perPx: inPlace.perPx, wantPx: inPlace.wantPx, linePx: parseFloat(getComputedStyle(line).fontSize) };
    if (inPlace.column) {
      const above = line.closest<HTMLElement>("[data-prompt-host]")?.previousElementSibling ?? null;
      const pill = document.querySelector<HTMLElement>("[data-pill]");
      const pillBox = pill && pill.getClientRects().length > 0 ? edgesOf(pill) : null;
      const pillBelow = pillBox && pillBox.right > lineBox.left && pillBox.top > lineBox.bottom ? pillBox.top - COIL.deal.prompt.title.chromeGapPx : Infinity;
      return titleInPlace({
        ...shared,
        aboveBottom: above ? above.getBoundingClientRect().bottom : lineBox.top,
        belowTop: Math.min(window.innerHeight - COIL.deal.prompt.gutterPx, pillBelow),
        quads: inPlace.quads,
      });
    }
    const title = titles.find((element) => element.getClientRects().length > 0);
    const block = line.closest<HTMLElement>("[data-prompt-host]")?.parentElement ?? null;
    const blockBox = block?.getBoundingClientRect();
    return titleInPlace({
      ...shared,
      aboveBottom: title ? title.getBoundingClientRect().bottom : lineBox.top,
      belowTop: block && blockBox ? blockBox.bottom + parseFloat(getComputedStyle(block).marginBottom || "0") : lineBox.bottom,
    });
  };

  // The first render: the text's size from the plan (the desktop's from 768 px wide; E and F from the
  // visible page title), cut to fit the stage, and the two token colors the shrink tweens between.
  const size = (stageBox: DOMRect) => {
    if (!text) return;
    const vw = window.innerWidth >= PHONE_BELOW_PX ? plan.sizeVw.desktop : plan.sizeVw.phone;
    const title = titles.find((element) => element.getClientRects().length > 0);
    const titlePx = title ? parseFloat(getComputedStyle(title).fontSize) : null;
    let px = promptStartPx({ vwPx: (window.innerWidth * vw) / 100, titlePx, titleRatio: plan.titleRatio });
    text.style.fontSize = `${px}px`;
    const perPx = { width: text.getBoundingClientRect().width / px, height: text.getBoundingClientRect().height / px };
    const phone = window.innerWidth < PHONE_BELOW_PX;
    if (titled && (phone || plan.titlePlace === "column")) {
      // G on a phone: a card-free top row too shallow for a title, so the line grows where it rests. From
      // 768 px wide "In the column" plays it there too, beside the Coil, measured against the cards.
      titleAt = null;
      // A phone's line rests under the Coil's band, past the canvas's foot, where no card is ever drawn.
      inPlace = phone
        ? { wantPx: Math.min(px, (titlePx ?? px) * COIL.deal.prompt.title.inPlaceTitles), perPx, column: false, quads: [] }
        : { wantPx: px, perPx, column: true, quads: titleQuads() };
      if (overlay) overlay.dataset.place = "line";
      const line = visibleLine();
      const at = line ? placeInLine(line) : null;
      if (at) text.style.fontSize = `${at.px}px`;
    } else if (titled) {
      // G: the pill hangs in the chrome's row at the biggest size that keeps clear of every rested card
      // ("words only" is measured as the pill too, then drops the plate).
      inPlace = null;
      if (overlay) overlay.dataset.place = plan.titlePlace === "bare" ? "bare" : "row";
      const line = visibleLine();
      titleAt = titlePlace({
        viewportWidth: document.documentElement.clientWidth,
        rowTop: menu ? menu.getBoundingClientRect().top : COIL.deal.prompt.title.rowTopPx,
        chrome: chrome.filter((element) => element.getClientRects().length > 0).map(edgesOf),
        quads: titleQuads(),
        perPx,
        wantPx: px,
        floorPx: (line ? parseFloat(getComputedStyle(line).fontSize) : px) * COIL.deal.prompt.title.floorOfLine,
      });
      text.style.fontSize = `${titleAt.px}px`;
    } else {
      const room = stageBox.width - STAGE_MARGIN_PX;
      const fitted = promptFitPx({ px, textWidth: text.offsetWidth, room, version: plan.version });
      if (fitted !== px) {
        px = fitted;
        text.style.fontSize = `${px}px`;
      }
    }
    const root = getComputedStyle(document.documentElement);
    colors = { from: root.getPropertyValue(spotlight ? "--spotlight-ink" : "--color-foreground").trim(), to: root.getPropertyValue("--color-accent").trim() };
    sized = true;
  };

  const render = () => {
    if (over || !stage || !overlay || !text) return;
    const stageBox = stage.getBoundingClientRect();
    const line = visibleLine();
    if (!line) return;
    if (!sized) size(stageBox);
    // promptFrame divides by the text's width: an unmeasured text skips the frame.
    if (text.offsetWidth === 0) return;
    const lineBox = line.getBoundingClientRect();
    const textBox = { width: text.offsetWidth, height: text.offsetHeight };
    // G's title belongs to the chrome's row, so it holds its place on the screen; on a phone it rides the
    // line it grows from; the rest ride the stage.
    const origin = (inPlace ? placeInLine(line) : titleAt) ?? promptOrigin(plan.version, stageBox, textBox, window.innerWidth < PHONE_BELOW_PX, plan.mode);
    const frame = promptFrame(progress, { ...origin, ...textBox }, lineBox);
    overlay.style.transform = `translate(${frame.x}px, ${frame.y}px) scale(${frame.scale})`;
    // G with no clear place (the narrowest phones) shows no pill: the lit cards and the resting line carry it.
    overlay.style.opacity = String(titleAt && !titleAt.clear ? 0 : frame.opacity);
    if (plate) plate.style.opacity = String(frame.plateOpacity);
    if (spotlight && scrim) scrim.style.opacity = String(frame.scrimOpacity);
    if (lit && dim) drawDim(stageBox, frame.scrimOpacity);
    if (colors) text.style.color = gsap.utils.interpolate(colors.from, colors.to, progress.shrinkP);
    hosts.forEach((host) => (host.style.opacity = String(frame.lineOpacity)));
  };

  const show = () => {
    if (over || !overlay) return;
    // G is measured against the landed cards, not the ribbon the first tick saw.
    if (titled) sized = false;
    overlay.style.visibility = "visible";
    overlay.style.willChange = "transform, opacity";
    if (spotlight) raiseScrim();
    if (lit) raiseDim();
    render();
  };

  // F's dim: an oval of light over the stage's part on screen, redrawn only when that part moves.
  const drawDim = (stageBox: DOMRect, opacity: number) => {
    if (!dim) return;
    const phone = window.innerWidth < PHONE_BELOW_PX;
    const area = litArea(stageBox, window.innerHeight, phone);
    // The Coil scrolled off the screen: nothing to light, so nothing to dim. And a phone's oval only ever
    // dimmed the page under the Coil's band: while the title and the lists wait for the line nothing is
    // there, and the dim would be an empty slab under the words (grey on the light theme).
    if (!area || (phone && plan.columnsAtMs !== null)) {
      dim.style.opacity = "0";
      return;
    }
    const clear = area.clear * 100;
    const shape = `radial-gradient(ellipse ${area.rx}px ${area.ry}px at ${area.cx}px ${area.cy}px, transparent ${clear}%, color-mix(in srgb, var(--lit-dim) 40%, transparent) ${(clear + 100) / 2}%, var(--lit-dim) 100%)`;
    if (shape !== dimShape) {
      dim.style.backgroundImage = shape;
      dimShape = shape;
    }
    dim.style.opacity = String(opacity * plan.dimStrength);
  };

  const fastForwardNow = () => {
    if (over || !(scrimUp || dimUp)) return false;
    const rule = fastForward(plan, timeline.time() * 1000, COIL.deal.prompt.spotlight.fastForwardMs);
    if (!rule) return false;
    // Only ever forward and faster: a stream of inputs must not pull the landing back.
    if (s(rule.seekMs) > timeline.time()) timeline.time(s(rule.seekMs));
    timeline.timeScale(fasterScale(timeline.timeScale(), rule.timeScale));
    onFastForward?.();
    return true;
  };

  // The scrim takes the pointer from its first visible frame: nothing under it opens, and an
  // input on it lands the line. A wheel is never prevented here (the cutscene's lock does that
  // when it holds the page); the lock hands what it swallows to the director instead.
  const raiseScrim = () => {
    if (!scrim || scrimUp) return;
    scrimUp = true;
    scrim.style.opacity = "0";
    scrim.style.visibility = "visible";
    scrim.style.pointerEvents = "auto";
    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const onPointerDown = (event: Event) => {
      pressedUnderScrim = true;
      stop(event);
      fastForwardNow();
    };
    const onInput = () => void fastForwardNow();
    const onKey = (event: KeyboardEvent) => {
      // Never prevented: a scroll key still scrolls when no lock holds it, Tab still moves focus.
      if (fastForwardsOnKey(event.key)) fastForwardNow();
    };
    // A press that never became a click on the scrim (dragged off it, cancelled) must not arm the grace.
    const onPointerCancel = () => {
      pressedUnderScrim = false;
    };
    const onLaterPointerDown = (event: Event) => {
      if (event.target !== scrim) pressedUnderScrim = false;
    };
    scrim.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointercancel", onPointerCancel, { capture: true });
    window.addEventListener("pointerdown", onLaterPointerDown, { capture: true });
    const onScrimClick = (event: Event) => {
      pressedUnderScrim = false;
      stop(event);
    };
    scrim.addEventListener("click", onScrimClick);
    window.addEventListener("wheel", onInput, { capture: true, passive: true });
    window.addEventListener("touchstart", onInput, { capture: true, passive: true });
    window.addEventListener("keydown", onKey, { capture: true });
    removeInput = () => {
      scrim.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointercancel", onPointerCancel, { capture: true });
      window.removeEventListener("pointerdown", onLaterPointerDown, { capture: true });
      scrim.removeEventListener("click", onScrimClick);
      window.removeEventListener("wheel", onInput, { capture: true });
      window.removeEventListener("touchstart", onInput, { capture: true });
      window.removeEventListener("keydown", onKey, { capture: true });
    };
    setSpotlightUp(true);
  };

  // F takes nothing: the dim never holds the pointer and no input is prevented, so a card pressed under
  // it opens. Any input still lands the line (the lock hands over what it swallows, as for D).
  const raiseDim = () => {
    if (!dim || dimUp) return;
    dimUp = true;
    dim.style.opacity = "0";
    dim.style.visibility = "visible";
    const onInput = () => void fastForwardNow();
    const onKey = (event: KeyboardEvent) => {
      if (fastForwardsOnKey(event.key)) fastForwardNow();
    };
    // G's pill was measured for this screen: a resize or a turned phone lands the line where it rests.
    const onResize = () => {
      if (!titled || over) return;
      land();
      onFastForward?.();
    };
    window.addEventListener("pointerdown", onInput, { capture: true, passive: true });
    window.addEventListener("wheel", onInput, { capture: true, passive: true });
    window.addEventListener("touchstart", onInput, { capture: true, passive: true });
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("resize", onResize);
    removeInput = () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onInput, { capture: true });
      window.removeEventListener("wheel", onInput, { capture: true });
      window.removeEventListener("touchstart", onInput, { capture: true });
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  };

  const land = () => {
    over = true;
    timeline.kill();
    // Landed first: clearing the inline opacity while the host still reads "playing" would drop the line
    // to that rule's 0 for a style pass, and its own 500 ms fade would then bring it back (a blink).
    hosts.forEach((host) => (host.dataset.prompt = "landed"));
    clearStyles();
    startGrace();
  };

  hosts.forEach((host) => (host.dataset.prompt = "playing"));
  if (overlay) overlay.dataset.version = plan.version;
  timeline.call(show, [], s(plan.startMs));
  timeline.to(progress, { inP: 1, duration: s(plan.shownMs - plan.startMs), ease: "power2.out" }, s(plan.startMs));
  timeline.to(progress, { shrinkP: 1, duration: s(plan.shrinkEndMs - plan.shrinkStartMs), ease: "power3.inOut" }, s(plan.shrinkStartMs));
  timeline.to(progress, { handoffP: 1, duration: s(plan.endMs - plan.handoffStartMs), ease: "none" }, s(plan.handoffStartMs));
  timeline.call(land, [], s(plan.endMs));
  // Every tick while live, so the text carries with the page through the static hold too.
  timeline.eventCallback("onUpdate", render);

  return {
    play: () => {
      if (!over) timeline.play(0);
    },
    finish() {
      if (!over) land();
    },
    fastForward: fastForwardNow,
    // Also resets a landed run (the lab's replay): back to before the deal.
    kill() {
      over = true;
      timeline.kill();
      clearStyles();
      endGrace();
      hosts.forEach((host) => host.removeAttribute("data-prompt"));
    },
  };
}
