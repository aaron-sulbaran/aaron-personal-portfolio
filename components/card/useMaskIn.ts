"use client";

import { useLayoutEffect, type RefObject } from "react";
import { gsap, SplitText } from "@/lib/gsap";
import { GALLERY } from "@/lib/gallery/constants";
import { photoWipeIn, textIn } from "@/lib/gallery/reveal";
import { maskTable, type MaskStep } from "@/lib/gallery/timing";

// The card modal's mask-in (modal-gallery.md, "Masking in"; the gallery lab's
// round six): one GSAP timeline from lib/gallery/timing's table, built when
// the body mounts and run on a timer from startMs (the landing after a flight,
// at once otherwise; lib/gallery/steps maskStartMs), on screen or not. A
// text part with data-mask-split is split into the lines its text rests on
// (no mask wrappers: a left to right clip opens in place, and the lines stay
// put when the split is reverted) and each line's clip opens; any other text
// part opens its own clip. A photo part's clip edge crosses it from the left
// while its media settles. Every tween is a fromTo on an element React gives
// no inline style, and the end of the run (or a close, a replay or reduced
// motion turning on) reverts the splits and clears only what GSAP wrote, so
// nothing outlives the run. The root carries data-mask-armed while it is live.

type Options = { reduced: boolean; runKey: string; startMs: number; stepsFor: (lines: (id: string) => number) => MaskStep[] };

const WRITTEN = "clipPath,transform";

const BREAK = "data-mask-break";
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

// Reverting a split restores the part's innerHTML, which drops keyboard focus
// held by an inline tip or link inside it. This notes where focus sat (the
// inline key when it has one, else its place among the part's focusable
// elements) and returns the way back to it once the revert is done.
function holdFocus(parts: Iterable<HTMLElement>): () => void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return () => {};
  const part = [...parts].find((el) => el.contains(active));
  if (!part) return () => {};
  const { inline, inlineKey } = active.dataset;
  const position = [...part.querySelectorAll<HTMLElement>(FOCUSABLE)].indexOf(active);
  return () => {
    if (!part.isConnected) return;
    const same = inlineKey ? [...part.querySelectorAll<HTMLElement>("[data-inline-key]")].find((el) => el.dataset.inline === inline && el.dataset.inlineKey === inlineKey) : undefined;
    (same ?? part.querySelectorAll<HTMLElement>(FOCUSABLE)[position])?.focus({ preventScroll: true });
  };
}

// Holds a text part's split to the lines its text rests on. SplitText wraps
// word boxes, and they wrap a little differently from the plain text: a
// hyphenated word stays whole, a pop inside the text can break where its
// button never does, a line that fits by a fraction of a pixel no longer fits.
// Then the run's lines jumped to the resting ones as it ended (Aaron,
// 2026-11-09: "small-business" on the family business). So before the split
// this finds where each resting line starts (a glyph that drops below the line
// before it), marks each start after the first with a break, which SplitText
// ends a line at, and turns the part's own wrapping off. The way back, once
// the split is reverted, takes the breaks out. A part with no layout (a phone
// page out of view) has no lines to hold and splits as it would anyway.
function holdRestingLines(part: HTMLElement): (() => void) | null {
  const starts: { text: Text; at: number }[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT);
  let top: number | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    for (let at = 0; at < text.data.length; at++) {
      if (!/\S/.test(text.data[at])) continue;
      range.setStart(text, at);
      range.setEnd(text, at + 1);
      const glyph = range.getClientRects()[0];
      if (!glyph) continue;
      if (top === null) top = glyph.top;
      else if (glyph.top > top + glyph.height / 2) {
        starts.push({ text, at });
        top = glyph.top;
      }
    }
  }
  if (top === null) return null;
  for (const { text, at } of starts.reverse()) {
    // A line that opens with a pop or a link breaks before it: a break inside
    // its button would only break the button.
    let start: ChildNode = /\S/.test(text.data.slice(0, at)) ? text.splitText(at) : text;
    while (start.parentElement && start.parentElement !== part && !start.previousSibling) start = start.parentElement;
    const lineEnd = document.createElement("br");
    lineEnd.setAttribute(BREAK, "");
    start.before(lineEnd);
  }
  part.style.whiteSpace = "nowrap";
  return () => {
    part.querySelectorAll(`br[${BREAK}]`).forEach((lineEnd) => lineEnd.remove());
    part.normalize();
    part.style.whiteSpace = "";
  };
}

export function useMaskIn(rootRef: RefObject<HTMLElement | null>, { reduced, runKey, startMs, stepsFor }: Options) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    const parts = new Map([...root.querySelectorAll<HTMLElement>("[data-mask]")].map((el) => [el.dataset.mask ?? "", el] as const));
    const splits = new Map<string, SplitText>();
    const held: (() => void)[] = [];
    for (const [id, el] of parts) {
      if (el.dataset.maskKind !== "text" || !el.hasAttribute("data-mask-split")) continue;
      const release = holdRestingLines(el);
      if (release) held.push(release);
      splits.set(id, SplitText.create(el, { type: "lines", linesClass: "card-line", aria: "none" }));
    }
    const { mask, ease, direction } = GALLERY;
    const table = maskTable(stepsFor((id) => splits.get(id)?.lines.length ?? 1), { startMs, lengthMs: mask.lengthMs, staggerMs: mask.staggerMs, lineStaggerMs: mask.lineStaggerMs });
    const duration = mask.lengthMs / 1000;
    const touched: Element[] = [];
    root.dataset.maskArmed = "";
    const finish = () => {
      const restoreFocus = holdFocus([...splits.keys()].flatMap((id) => parts.get(id) ?? []));
      for (const split of splits.values()) split.revert();
      splits.clear();
      for (const release of held.splice(0)) release();
      restoreFocus();
      gsap.set(touched, { clearProps: WRITTEN });
      delete root.dataset.maskArmed;
    };
    const tl = gsap.timeline({ onComplete: finish });
    for (const entry of table.entries) {
      const el = parts.get(entry.id);
      if (!el) continue;
      const at = entry.startMs / 1000;
      if (el.dataset.maskKind === "text") {
        const lines = splits.get(entry.id)?.lines;
        const targets = lines?.length ? lines : [el];
        touched.push(...targets);
        const reveal = textIn(direction);
        tl.fromTo(targets, reveal.from, { ...reveal.to, duration, ease: ease.gsap, stagger: mask.lineStaggerMs / 1000 }, at);
        continue;
      }
      const wipe = photoWipeIn(direction);
      touched.push(el);
      tl.fromTo(el, { clipPath: wipe.from }, { clipPath: wipe.to, duration, ease: ease.gsap }, at);
      const media = el.querySelector<HTMLElement>("[data-mask-media]");
      if (media) {
        touched.push(media);
        tl.fromTo(media, { scale: mask.settle }, { scale: 1, duration, ease: ease.gsap }, at);
      }
    }
    return () => {
      tl.kill();
      finish();
    };
    // stepsFor and startMs are read once per run; runKey names every input that replays the masks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, runKey]);
}
