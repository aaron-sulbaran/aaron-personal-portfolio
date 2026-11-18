"use client";

import { gsap } from "@/lib/gsap";
import { COIL } from "@/lib/coil/constants";
import type { Quad } from "@/lib/coil/geometry";
import { fastForward, fastForwardsOnKey, fasterScale, litArea, promptFrame, promptStartPx, titleInPlace, type Edges, type PromptPlan } from "@/lib/home/clickPrompt";

// The big "click a card to open it" moment's per-frame run. It is a paused GSAP
// timeline of its own, on the same seconds-from-the-click clock as the deal's
// master but not a child of it: the master starts it in play() and brings its
// columns in at the plan's time (lib/home/dealMaster.ts). The big line plays
// where the line rests, and every render places it against the visible resting
// line's live rect, so a scroll in the middle of the move carries it with the page.

const P = COIL.deal.prompt;

export type PromptParts = {
  stage: HTMLElement | null;
  overlay: HTMLElement | null;
  text: HTMLElement | null;
  dim: HTMLElement | null;
  titles: HTMLElement[];
  hosts: HTMLElement[];
};

export function promptParts(section: HTMLElement): PromptParts {
  const overlay = document.querySelector<HTMLElement>("[data-prompt-stage]");
  return {
    stage: section.querySelector<HTMLElement>("[data-coil-stage]"),
    overlay,
    text: overlay?.querySelector<HTMLElement>("[data-prompt-text]") ?? null,
    dim: document.querySelector<HTMLElement>("[data-prompt-dim]"),
    titles: Array.from(section.querySelectorAll<HTMLElement>("[data-page-title]")),
    hosts: Array.from(section.querySelectorAll<HTMLElement>("[data-prompt-host]")),
  };
}

export type PromptRun = {
  play: () => void;
  // The line rests in its spot now.
  finish: () => void;
  // Back to before the deal: nothing of the run is left on the page.
  kill: () => void;
  // Lands the line within COIL.deal.prompt.fastForwardMs. True when it acted (the line was showing).
  fastForward: () => boolean;
};

const s = (ms: number) => ms / 1000;
const isPhone = () => window.innerWidth < P.phoneBelowPx;
const edgesOf = (element: Element): Edges => {
  const box = element.getBoundingClientRect();
  return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
};

// onEarlyEnd runs whenever the line lands early, whatever triggered it (an input while it shows, the
// lock's swallow hook, a resize), so the lock's wait ends with it and the columns that were waiting for
// the line come in. cardQuads reads the cards' corners as drawn now, or `aheadMs` on at the Coil's idle
// drift: the big line keeps clear of them.
export function createPromptRun(parts: PromptParts, plan: PromptPlan, onEarlyEnd?: () => void, cardQuads?: (aheadMs?: number) => readonly Quad[]): PromptRun {
  const { stage, overlay, text, dim, titles, hosts } = parts;
  // The big line's wanted size, the text's box per px of font size and the cards to keep clear of, so each
  // frame can place it against the live line. column: beside the Coil, under the Work list (from 768 px
  // wide); otherwise under the page title, below the Coil's band.
  let place: { wantPx: number; perPx: { width: number; height: number }; column: boolean; quads: Quad[] } | null = null;
  const progress = { inP: 0, shrinkP: 0, handoffP: 0 };
  const timeline = gsap.timeline({ paused: true });
  let over = false;
  let sized = false;
  let colors: { from: string; to: string } | null = null;
  let showing = false;
  let dimShape = "";
  let removeInput: (() => void) | null = null;

  const visibleLine = () =>
    hosts.map((host) => host.querySelector<HTMLElement>("[data-prompt-line]")).find((line) => line && line.getClientRects().length > 0) ?? null;

  const clearStyles = () => {
    removeInput?.();
    removeInput = null;
    showing = false;
    dimShape = "";
    if (dim) gsap.set(dim, { clearProps: "opacity,visibility,backgroundImage" });
    hosts.forEach((host) => host.style.removeProperty("opacity"));
    if (overlay) gsap.set(overlay, { clearProps: "opacity,visibility,transform,willChange" });
    if (text) gsap.set(text, { clearProps: "fontSize,color" });
  };

  // Everything the big line must miss while it can be read: the cards as drawn now (still settling from
  // the deal) and where the Coil's idle drift carries them until the line is half way through its shrink.
  const cardsToMiss = (): Quad[] => {
    if (!cardQuads) return [];
    const readableMs = (plan.shrinkStartMs + plan.shrinkEndMs) / 2 - plan.startMs;
    return [...cardQuads(), ...[0, 1 / 3, 2 / 3, 1].flatMap((share) => cardQuads(share * readableMs))];
  };

  // The big line's size and corner against the live line. On a phone, between the page title above and
  // the columns below (the line's block ends a margin short of them); in the Work column, between the
  // Work list above and the screen's foot (or the Music pill) below, clear of every card.
  const placeInLine = (line: HTMLElement) => {
    if (!place) return null;
    const lineBox = edgesOf(line);
    const host = line.closest<HTMLElement>("[data-prompt-host]");
    const shared = { line: lineBox, rightEdge: document.documentElement.clientWidth - P.gutterPx, perPx: place.perPx, wantPx: place.wantPx, linePx: parseFloat(getComputedStyle(line).fontSize) };
    if (place.column) {
      const above = host?.previousElementSibling ?? null;
      const pill = document.querySelector<HTMLElement>("[data-pill]");
      const pillBox = pill && pill.getClientRects().length > 0 ? edgesOf(pill) : null;
      const pillBelow = pillBox && pillBox.right > lineBox.left && pillBox.top > lineBox.bottom ? pillBox.top - P.chromeGapPx : Infinity;
      return titleInPlace({
        ...shared,
        aboveBottom: above ? above.getBoundingClientRect().bottom : lineBox.top,
        belowTop: Math.min(window.innerHeight - P.gutterPx, pillBelow),
        quads: place.quads,
      });
    }
    const title = titles.find((element) => element.getClientRects().length > 0);
    const block = host?.parentElement ?? null;
    return titleInPlace({
      ...shared,
      aboveBottom: title ? title.getBoundingClientRect().bottom : lineBox.top,
      belowTop: block ? block.getBoundingClientRect().bottom + parseFloat(getComputedStyle(block).marginBottom || "0") : lineBox.bottom,
    });
  };

  // The big line's size (in page titles, cut to its place) and the two token colors the shrink tweens between.
  const size = () => {
    if (!text) return;
    const phone = isPhone();
    const title = titles.find((element) => element.getClientRects().length > 0);
    const wantPx = promptStartPx({
      vwPx: (window.innerWidth * (phone ? P.sizeVw.phone : P.sizeVw.desktop)) / 100,
      titlePx: title ? parseFloat(getComputedStyle(title).fontSize) : null,
      titleRatio: phone ? Math.min(plan.titleRatio, P.phoneTitles) : plan.titleRatio,
    });
    text.style.fontSize = `${wantPx}px`;
    const box = text.getBoundingClientRect();
    // A phone's line rests under the Coil's band, past the canvas's foot, where no card is ever drawn.
    place = { wantPx, perPx: { width: box.width / wantPx, height: box.height / wantPx }, column: !phone, quads: phone ? [] : cardsToMiss() };
    const line = visibleLine();
    const at = line ? placeInLine(line) : null;
    if (at) text.style.fontSize = `${at.px}px`;
    const root = getComputedStyle(document.documentElement);
    colors = { from: root.getPropertyValue("--color-foreground").trim(), to: root.getPropertyValue("--color-accent").trim() };
    sized = true;
  };

  // The dim: an oval of light over the stage's part on screen, redrawn only when that part moves. A phone
  // draws none: its oval only ever dimmed the page under the Coil's band, and that page is waiting for
  // the line, so the dim would be an empty slab under the words.
  const drawDim = (opacity: number) => {
    if (!dim) return;
    const area = stage && !isPhone() ? litArea(stage.getBoundingClientRect(), window.innerHeight) : null;
    if (!area) {
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

  const render = () => {
    if (over || !overlay || !text) return;
    const line = visibleLine();
    if (!line) return;
    if (!sized) size();
    // promptFrame divides by the text's width: an unmeasured text skips the frame.
    if (text.offsetWidth === 0) return;
    const origin = placeInLine(line);
    if (!origin) return;
    const frame = promptFrame(progress, { left: origin.left, top: origin.top, width: text.offsetWidth, height: text.offsetHeight }, line.getBoundingClientRect());
    overlay.style.transform = `translate(${frame.x}px, ${frame.y}px) scale(${frame.scale})`;
    overlay.style.opacity = String(frame.opacity);
    drawDim(frame.dimOpacity);
    if (colors) text.style.color = gsap.utils.interpolate(colors.from, colors.to, progress.shrinkP);
    hosts.forEach((host) => (host.style.opacity = String(frame.lineOpacity)));
  };

  const land = () => {
    over = true;
    timeline.kill();
    // Landed first: clearing the inline opacity while the host still reads "playing" would drop the line
    // to that rule's 0 for a style pass, and its own 500 ms fade would then bring it back (a blink).
    hosts.forEach((host) => (host.dataset.prompt = "landed"));
    clearStyles();
  };

  const fastForwardNow = () => {
    if (over || !showing) return false;
    const rule = fastForward(plan, timeline.time() * 1000, P.fastForwardMs);
    if (!rule) return false;
    // Only ever forward and faster: a stream of inputs must not pull the landing back.
    if (s(rule.seekMs) > timeline.time()) timeline.time(s(rule.seekMs));
    timeline.timeScale(fasterScale(timeline.timeScale(), rule.timeScale));
    onEarlyEnd?.();
    return true;
  };

  // From the moment the line shows, any input lands it: a pointer, a wheel, a touch or any key but a bare
  // modifier. Nothing is prevented and the dim never takes the pointer, so a card pressed under it opens.
  // (The cutscene's lock hands over what it swallows through fastForward.) The line was measured for
  // this screen: a resize or a turned phone lands it where it rests.
  const listen = () => {
    const onInput = () => void fastForwardNow();
    const onKey = (event: KeyboardEvent) => {
      if (fastForwardsOnKey(event.key)) fastForwardNow();
    };
    const onResize = () => {
      if (over) return;
      land();
      onEarlyEnd?.();
    };
    window.addEventListener("pointerdown", onInput, { capture: true, passive: true });
    window.addEventListener("wheel", onInput, { capture: true, passive: true });
    window.addEventListener("touchstart", onInput, { capture: true, passive: true });
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("resize", onResize);
    removeInput = () => {
      window.removeEventListener("pointerdown", onInput, { capture: true });
      window.removeEventListener("wheel", onInput, { capture: true });
      window.removeEventListener("touchstart", onInput, { capture: true });
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("resize", onResize);
    };
  };

  const show = () => {
    if (over || !overlay || showing) return;
    showing = true;
    // Measured against the landed cards, not the ribbon the first tick saw.
    sized = false;
    overlay.style.visibility = "visible";
    overlay.style.willChange = "transform, opacity";
    if (dim) {
      dim.style.opacity = "0";
      dim.style.visibility = "visible";
    }
    listen();
    render();
  };

  hosts.forEach((host) => (host.dataset.prompt = "playing"));
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
    // Also resets a landed run (the lab's replay).
    kill() {
      over = true;
      timeline.kill();
      clearStyles();
      hosts.forEach((host) => host.removeAttribute("data-prompt"));
    },
  };
}
