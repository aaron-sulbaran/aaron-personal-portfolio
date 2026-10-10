import type { Page } from "@playwright/test";
import { nextFrames, scrollToY } from "./coil";

// Reading the footer (components/footer): its wordmark's letters through
// their SVG transforms, its phase (data-word: waiting, moving, rest), its
// field's kind (data-footer-field: gl or poster), the field's chunk among the
// page's scripts, and the WebGL 2 contexts made for its canvas.

export const FOOTER = "footer[data-footer]";
// Only the footer field's chunk carries its ripple uniform; three's renderer marks the Coil's.
const FIELD_CHUNK = /uRipShine/;
const THREE = /WebGLRenderer/;

export async function toFooter(page: Page) {
  await scrollToY(page, await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight));
}

export async function waitForWord(page: Page, phase: "rest" | "moving" | "waiting" = "rest", timeout = 10_000) {
  await page.waitForFunction((p) => document.querySelector("footer[data-footer]")?.getAttribute("data-word") === p, phase, { timeout });
}

export async function waitForField(page: Page, kind: "gl" | "poster", timeout = 15_000) {
  await page.waitForFunction((k) => document.querySelector("[data-footer-field]")?.getAttribute("data-footer-field") === k, kind, { timeout });
}

export type Pose = { x: number; y: number; squash: number; angle: number };

// A letter's transform as numbers: the first translate (the pivot's place,
// its y the baseline less any lift), the press's squash, the egg's turn.
export function parsePose(transform: string): Pose {
  const head = /^translate\(([-\d.]+) ([-\d.]+)\)/.exec(transform);
  const squash = /scale\(1 ([-\d.]+)\)/.exec(transform);
  const turn = /rotate\(([-\d.]+) 0 /.exec(transform);
  return { x: head ? Number(head[1]) : NaN, y: head ? Number(head[2]) : NaN, squash: squash ? Number(squash[1]) : NaN, angle: turn ? Number(turn[1]) : 0 };
}

export type WordRead = { baseline: number; size: number; transforms: string[]; chars: string[] };

export async function readWord(page: Page): Promise<WordRead> {
  return page.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>("svg[data-wordmark]")!;
    const letters = [...svg.querySelectorAll<SVGGElement>("[data-letter]")];
    return {
      baseline: Number(svg.dataset.baseline),
      size: Number(svg.dataset.size),
      transforms: letters.map((g) => g.getAttribute("transform") ?? ""),
      chars: letters.map((g) => g.dataset.letter ?? ""),
    };
  });
}

// Every letter's transform at every frame for `ms`, starting now (call it,
// then act, then await it).
export function recordWord(page: Page, ms: number): Promise<string[][]> {
  return page.evaluate(
    (span) =>
      new Promise<string[][]>((resolve) => {
        const frames: string[][] = [];
        const start = performance.now();
        const tick = () => {
          frames.push([...document.querySelectorAll("svg[data-wordmark] [data-letter]")].map((g) => g.getAttribute("transform") ?? ""));
          if (performance.now() - start < span) requestAnimationFrame(tick);
          else resolve(frames);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
}

// The page's scripts that are the footer field's chunk, and whether any of them carries three.
export function watchFieldChunks(page: Page) {
  const bodies: Promise<{ url: string; field: boolean; three: boolean }>[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (!/\.js(\?|$)/.test(url) || response.status() >= 400) return;
    bodies.push(
      response
        .text()
        .then((text) => ({ url, field: FIELD_CHUNK.test(text), three: THREE.test(text) }))
        .catch(() => ({ url, field: false, three: false })),
    );
  });
  return {
    async fieldChunks() {
      return (await Promise.all(bodies)).filter((s) => s.field);
    },
  };
}

// An init script: counts the WebGL 2 contexts made for canvases inside the footer.
export function countFooterContexts() {
  const original = HTMLCanvasElement.prototype.getContext;
  (window as unknown as { __footerContexts: number }).__footerContexts = 0;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
    const context = (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
    if (kind === "webgl2" && context && this.closest("footer")) (window as unknown as { __footerContexts: number }).__footerContexts += 1;
    return context;
  } as typeof original;
}

export const footerContexts = (page: Page) => page.evaluate(() => (window as unknown as { __footerContexts?: number }).__footerContexts ?? 0);

// The footer's own box, and its small lines' and band's, relative to it.
export async function footerBoxes(page: Page) {
  return page.evaluate(() => {
    const footer = document.querySelector("footer[data-footer]")!.getBoundingClientRect();
    const rel = (selector: string) => {
      const r = document.querySelector(selector)!.getBoundingClientRect();
      return { top: r.top - footer.top, height: r.height };
    };
    return { width: footer.width, height: footer.height, lines: rel("[data-footer-lines]"), band: rel("[data-footer-band]") };
  });
}

export async function settleFrames(page: Page) {
  await nextFrames(page, 3);
}
