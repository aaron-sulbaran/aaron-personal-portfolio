import type { CDPSession, Page } from "@playwright/test";
import type { Point } from "./coil";

// The deal's cutscene, read from outside: a per-frame recorder (the page's
// scroll, the deal's state and clock, the cards' projected rectangles against
// page 1's blocks and button) and the input a reader's hand makes (a trackpad's
// fling, a finger's drag and flick) through the DevTools protocol, the path a
// real device's events take into the renderer.

export type Rect = { left: number; top: number; right: number; bottom: number };

export type Frame = {
  t: number; // performance.now(), ms, once every callback of the frame has run
  y: number; // window.scrollY
  workTop: number; // the cards section's top in the viewport (page 2's top: 0 where the deal lands)
  deal: string; // <html data-deal>
  clock: number | null; // the deal's own clock, ms from the click (null: not playing)
  cards: Rect[]; // the cards' projected quads' bounding boxes, viewport px
  blocks: Rect[]; // page 1's story blocks ([data-block]) and the button's line
  cta: Rect | null; // "Deal me in"
  ctaOpacity: number;
  blockOpacity: number; // the least opacity of a story block
  lock: string | null; // <html data-deal-lock> when the page carries it
  overflow: string; // the root's computed overflow-y
  clientWidth: number; // the root's client width (a scrollbar coming or going changes it)
};

type Recorder = { on: boolean; frames: Frame[] };
type CoilWindow = Window & {
  __e2eCutscene?: Recorder;
  __coil?: { visibleQuads: () => { x: number; y: number }[][]; entrance: () => { elapsedMs: number | null } };
};

// Starts recording one sample per animation frame. A message posted from the
// frame's rAF lands after every rAF callback of that frame (the master
// timeline's scroll, the scene's draw), so each row is what the visitor sees.
export async function startRecording(page: Page) {
  await page.evaluate(() => {
    const w = window as CoilWindow;
    const recorder: Recorder = { on: true, frames: [] };
    w.__e2eCutscene = recorder;
    const box = (r: DOMRect | DOMRectReadOnly): Rect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    const opacityOf = (el: Element | null) => {
      let o = 1;
      for (let node = el; node; node = node.parentElement) o *= Number(getComputedStyle(node).opacity);
      return o;
    };
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      if (!recorder.on) return;
      const coil = w.__coil;
      const quads = coil ? coil.visibleQuads() : [];
      const cta = document.querySelector("[data-intro-cta]");
      const blocks = Array.from(document.querySelectorAll("[data-block]"));
      recorder.frames.push({
        t: performance.now(),
        y: window.scrollY,
        workTop: document.getElementById("work")!.getBoundingClientRect().top,
        deal: document.documentElement.dataset.deal ?? "",
        clock: coil ? coil.entrance().elapsedMs : null,
        cards: quads.map((quad) => {
          const xs = quad.map((p) => p.x);
          const ys = quad.map((p) => p.y);
          return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
        }),
        blocks: blocks.map((el) => box(el.getBoundingClientRect())),
        cta: cta ? box(cta.getBoundingClientRect()) : null,
        ctaOpacity: cta ? opacityOf(cta) : 0,
        blockOpacity: blocks.reduce((least, el) => Math.min(least, opacityOf(el)), 1),
        lock: document.documentElement.getAttribute("data-deal-lock"),
        overflow: getComputedStyle(document.documentElement).overflowY,
        clientWidth: document.documentElement.clientWidth,
      });
    };
    const tick = () => {
      if (!recorder.on) return;
      channel.port2.postMessage(0);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function stopRecording(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const recorder = (window as CoilWindow).__e2eCutscene!;
    recorder.on = false;
    return recorder.frames;
  });
}

// How deep two rectangles overlap on the screen, the lesser axis (0: they do not).
export function overlap(a: Rect, b: Rect, viewport: { width: number; height: number }): number {
  const across = Math.min(a.right, b.right, viewport.width) - Math.max(a.left, b.left, 0);
  const down = Math.min(a.bottom, b.bottom, viewport.height) - Math.max(a.top, b.top, 0);
  return across > 0.5 && down > 0.5 ? Math.min(across, down) : 0;
}

// Every frame where a projected card is on top of a story block or the button.
// `seenOnly` leaves out what is faded away (under SEEN there is nothing to cover).
const SEEN = 0.05;
export function coverage(frames: Frame[], viewport: { width: number; height: number }, seenOnly = false): string[] {
  const out: string[] = [];
  for (const f of frames) {
    const things: { what: string; rect: Rect; opacity: number }[] = f.blocks.map((rect, i) => ({ what: `block ${i}`, rect, opacity: f.blockOpacity }));
    if (f.cta) things.push({ what: "Deal me in", rect: f.cta, opacity: f.ctaOpacity });
    for (const thing of things) {
      if (seenOnly && thing.opacity < SEEN) continue;
      for (const card of f.cards) {
        const depth = overlap(card, thing.rect, viewport);
        if (depth > 0) {
          out.push(`t ${Math.round(f.t)} y ${Math.round(f.y)} deal ${f.deal}: a card over ${thing.what}, ${depth.toFixed(1)} px`);
          break;
        }
      }
    }
  }
  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A trackpad's fling: `events` wheels of 80 to 150 px over `ms`, then a
// decaying tail (the OS's inertia) for `tailMs`. [ms since the first, deltaY].
export function flingStream({ events = 40, ms = 400, tailMs = 1500, sign = 1 }: { events?: number; ms?: number; tailMs?: number; sign?: 1 | -1 } = {}): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < events; i++) out.push([Math.round((i * ms) / events), sign * (80 + ((i * 37) % 71))]);
  // The tail starts where the burst left off (about 115 px an event) and dies away by an exponential
  // with a 0.35 s time constant: an event a frame until it is under a pixel.
  const frame = 1000 / 60;
  for (let at = ms; at < ms + tailMs; at += frame) {
    const delta = 115 * Math.exp(-(at - ms) / 350);
    if (delta < 1) break;
    out.push([Math.round(at), sign * Math.round(delta)]);
  }
  return out;
}

// Sends a stream of wheels on its own clock, without waiting on each one (a
// device does not). Resolves once every event has landed.
export async function wheelStream(cdp: CDPSession, stream: readonly (readonly [number, number])[], at: Point) {
  const start = performance.now();
  const sent: Promise<unknown>[] = [];
  for (const [when, deltaY] of stream) {
    const wait = start + when - performance.now();
    if (wait > 0) await sleep(wait);
    sent.push(cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: at.x, y: at.y, deltaX: 0, deltaY }));
  }
  await Promise.all(sent);
}

// A finger flick on a phone: from `from`, `distance` px (negative: the finger goes up the screen, the
// page down) at `speed` px/s, then lifted, so the browser's own momentum follows as it does for a
// real flick. (DevTools' synthesized gesture: touch events at speed, and the fling after them.)
export async function flick(cdp: CDPSession, from: Point, distance: number, speed: number) {
  await cdp.send("Input.synthesizeScrollGesture", { x: from.x, y: from.y, yDistance: distance, speed, gestureSourceType: "touch", preventFling: false });
}

// Where the page's sticky range runs, in scroll position, and where the deal lands.
export async function dealFacts(page: Page) {
  return page.evaluate(() => {
    const rail = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
    const stage = document.querySelector("[data-coil-sticky]")!.getBoundingClientRect();
    const work = document.getElementById("work")!.getBoundingClientRect();
    return { stickY: rail.top + window.scrollY, range: rail.height - stage.height, landing: work.top + window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight };
  });
}
