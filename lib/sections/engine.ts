import { gsap, ScrollTrigger, SplitText } from "@/lib/gsap";
import { bandFor, planBlock, type BlockKind, type Split, type Step } from "./grammar";

// The DOM half of the sections grammar: one timeline and one ScrollTrigger
// per block, built from planBlock's plain data. Every tween is a from-tween on
// opacity or a transform, so the text never leaves the accessibility tree and
// a revert (the matchMedia context's, or SplitText's on a re-split) leaves the
// server's markup exactly as it was.

export interface BlockOptions {
  kind: BlockKind;
  index: number;
  split: Split;
  reduce: boolean;
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

export function buildBlock(el: HTMLElement, { kind, index, split, reduce }: BlockOptions): () => void {
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
  const timeline = (lines: Element[] = []) => {
    const tl = gsap.timeline({
      defaults: { ease: plan.ease, duration: plan.duration },
      scrollTrigger: {
        trigger,
        start: () => bandFor(kind, offset()).start,
        end: () => bandFor(kind, offset()).end,
        scrub: plan.scrub,
        invalidateOnRefresh: true,
      },
    });
    for (const step of plan.steps) {
      const targets = targetsOf(el, step, lines);
      if (targets) tl.from(targets, { ...step.from, stagger: step.stagger ?? 0 }, step.at);
    }
    // A timeline's trigger defers its first refresh a tick, and until then
    // the from-tweens hold the masked state; a block already past its band
    // on a deep load would paint masked for a frame. Measure now, in the task
    // that armed it.
    tl.scrollTrigger?.refresh();
    return tl;
  };
  el.dataset.sectionsState = "armed";
  if (plan.split === "lines") {
    // aria "none": the words stay in the tree as text, in order; no label
    // stands in for them and no line is hidden. Returning the timeline lets
    // SplitText revert and time-sync it on every re-split.
    const lines = SplitText.create(el, {
      type: "lines",
      mask: "lines",
      linesClass: "sections-line",
      aria: "none",
      autoSplit: true,
      onSplit: (self) => timeline(self.lines),
    });
    return () => {
      lines.revert();
      settle();
    };
  }
  const tl = timeline();
  return () => {
    tl.revert();
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
