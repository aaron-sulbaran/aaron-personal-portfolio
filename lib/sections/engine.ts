import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { bandFor, planBlock, type BlockKind, type Split, type Step } from "./grammar";
import { highWater } from "./highWater";

// The DOM half of the sections grammar: one timeline and one ScrollTrigger
// per block, built from planBlock's plain data. Every tween is a from-tween on
// opacity or a transform, so the text never leaves the accessibility tree and
// a revert (the matchMedia context's, or ours on a re-split) leaves the
// server's markup exactly as it was.
//
// A reveal only rises within a page load (Aaron, 2026-10-08): the trigger
// drives no animation (toggle actions all "none") and reports its progress;
// the block keeps the highest progress it has seen and chases it with
// ScrollTrigger's own scrub, an "expo" tween of the timeline's totalProgress
// lasting the plan's scrub seconds (ScrollTrigger.js, scrubDuration).
// Scrolling back up leaves the block where it got to; once it is whole its
// trigger is released.

export interface BlockOptions {
  kind: BlockKind;
  index: number;
  split: Split;
  reduce: boolean;
  // False when matchMedia rebuilds the block on a preference change: there
  // ScrollTrigger has reverted every trigger and refreshes them all itself
  // before the task ends, and a lone refresh would clear the scroll position
  // it holds to restore, dropping the reader at the top of the page.
  measure: boolean;
}

const SELECTOR: Record<Exclude<Step["target"], "lines">, string> = {
  rule: "[data-sections-rule]",
  label: "[data-sections-label]",
  inner: "[data-sections-inner]",
  hair: "[data-sections-hair]",
  text: "[data-sections-text]",
  rowHair: "[data-sections-hair]",
  rowInner: "[data-sections-rowinner]",
};

// A block inside a sticky column is measured from the column, which never
// moves, plus its offset inside the held wrapper, so a held heading never
// drags its own trigger along.
function anchorOf(el: HTMLElement) {
  const held = el.closest<HTMLElement>("[data-sections-sticky]");
  const column = held?.parentElement;
  if (!held || !column) return { trigger: el, offset: () => 0 };
  return { trigger: column, offset: () => Math.round(el.getBoundingClientRect().top - held.getBoundingClientRect().top) };
}

// Fill (components/fx/Fill) repeats a row's content in an inert .fx-over
// copy; only the live content moves.
function targetsOf(el: HTMLElement, step: Step, lines: Element[]): Element | Element[] | null {
  if (step.target === "lines") return lines.length ? lines : null;
  const scope = step.row === undefined ? el : el.querySelectorAll<HTMLElement>("[data-sections-row]")[step.row];
  if (!scope) return null;
  return [...scope.querySelectorAll(SELECTOR[step.target])].find((found) => !found.closest(".fx-over")) ?? null;
}

export function buildBlock(el: HTMLElement, { kind, index, split, reduce, measure }: BlockOptions): () => void {
  const rows = kind === "links" ? el.querySelectorAll("[data-sections-row]").length : 0;
  const plan = planBlock({ kind, reduce, index, split, rows });
  const settle = () => {
    delete el.dataset.sectionsState;
  };
  if (!plan) {
    el.dataset.sectionsState = "still";
    return settle;
  }
  const { trigger, offset } = anchorOf(el);
  // The block's state for the page load: it outlives every refresh and every
  // SplitText re-split, which builds a new timeline for the same block.
  let reached = 0;
  let measured = false;
  let live: { tl: gsap.core.Timeline; chase: gsap.core.Tween } | null = null;

  const release = (self: ScrollTrigger) => {
    if (live?.tl.scrollTrigger === self) self.kill(false, true);
  };
  const follow = (self: ScrollTrigger, refreshed: boolean) => {
    if (!live || live.tl.scrollTrigger !== self) return;
    const { tl, chase } = live;
    const mark = highWater(reached, self.progress);
    reached = mark.reached;
    if (refreshed && !measured) {
      // The first measurement lands at once, so a block already past its
      // band on a deep load never paints masked.
      measured = true;
      chase.pause();
      tl.totalProgress(reached);
    } else if (mark.moved) {
      chase.resetTo("totalProgress", reached, tl.totalProgress());
    }
    // Deferred: a kill inside a full refresh's onRefresh pass would skip the
    // next block's.
    if (mark.done) queueMicrotask(() => release(self));
  };
  const drop = () => {
    if (!live) return 0;
    const shown = live.tl.totalProgress();
    live.chase.kill();
    live.tl.revert();
    live = null;
    return shown;
  };

  const timeline = (lines: Element[] = []) => {
    const shown = drop();
    const tl = gsap.timeline({
      defaults: { ease: plan.ease, duration: plan.duration },
      scrollTrigger:
        reached < 1
          ? {
              trigger,
              start: () => bandFor(kind, offset()).start,
              end: () => bandFor(kind, offset()).end,
              toggleActions: "none none none none",
              onUpdate: (self) => follow(self, false),
              onRefresh: (self) => follow(self, true),
            }
          : undefined,
    });
    for (const step of plan.steps) {
      const targets = targetsOf(el, step, lines);
      if (targets) tl.from(targets, { ...step.from, stagger: step.stagger ?? 0 }, step.at);
    }
    const chase = gsap.to(tl, { totalProgress: "+=0", ease: "expo", duration: plan.scrub, paused: true, inherit: false });
    live = { tl, chase };
    // A re-split carries on from where the last timeline was shown.
    tl.totalProgress(shown);
    if (shown < reached) chase.resetTo("totalProgress", reached, shown);
    // A timeline's trigger defers its first refresh a tick, and until then
    // the from-tweens hold the masked state; a block already past its band
    // on a deep load would paint masked for a frame. Measure now, in the task
    // that armed it.
    if (measure) tl.scrollTrigger?.refresh();
  };
  el.dataset.sectionsState = "armed";
  if (plan.split === "lines") {
    // aria "none": the words stay in the tree as text, in order; no label
    // stands in for them and no line is hidden. onSplit returns nothing, so
    // SplitText leaves the old timeline alone until timeline() has read
    // where it was shown.
    const lines = SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "sections-line",
      aria: "none",
      autoSplit: true,
      onSplit: (self) => timeline(self.lines),
    });
    return () => {
      drop();
      lines.revert();
      settle();
    };
  }
  timeline();
  return () => {
    drop();
    settle();
  };
}

let watchers = 0;
let observer: ResizeObserver | null = null;
let lastHeight = -1;
let timer = 0;

// One observer for every block: when the page's height changes (a font swap,
// the metrics block arriving), every trigger is re-measured once the change
// settles. Width changes are ScrollTrigger's own.
export function watchLayout(): () => void {
  watchers += 1;
  if (!observer) {
    observer = new ResizeObserver(([entry]) => {
      const height = Math.round(entry.contentRect.height);
      if (height === lastHeight) return;
      const first = lastHeight < 0;
      lastHeight = height;
      if (first) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    observer.observe(document.body);
  }
  return () => {
    watchers -= 1;
    if (watchers > 0 || !observer) return;
    observer.disconnect();
    observer = null;
    lastHeight = -1;
    window.clearTimeout(timer);
  };
}
