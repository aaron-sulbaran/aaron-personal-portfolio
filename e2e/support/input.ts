import type { CDPSession } from "@playwright/test";
import type { RecordedWheel } from "@/lib/coil/capture.fixtures";
import type { Point } from "./coil";

// Real-shaped input through the DevTools protocol. page.mouse.wheel sends one
// wheel per call and waits on each, so it cannot express a trackpad's stream
// (dozens of events a second, several inside one frame, an inertia tail).
// These go through Input.dispatchMouseEvent, the same path a real device's
// events take into the renderer, at real coordinates and on the recorded
// clock.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pointerTo(cdp: CDPSession, { x, y }: Point) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
}

// Arrives at a point the way a hand does: from a little way off, then onto it.
export async function approach(cdp: CDPSession, point: Point) {
  await pointerTo(cdp, { x: point.x - 37, y: point.y + 29 });
  await pointerTo(cdp, point);
}

export type StreamOptions = {
  // Where each event lands; a function moves the pointer along the stream.
  at: Point | ((index: number) => Point);
  // Runs before event `index` is sent (a pointer move, a mark).
  before?: (index: number) => Promise<void> | void;
};

// Replays a recorded wheel stream ([ms since the first event, deltaY]) on
// its own timing. Events are fired without waiting on each other's
// acknowledgement, as a device does; the call resolves once all have landed.
export async function trackpad(cdp: CDPSession, stream: readonly RecordedWheel[], options: StreamOptions) {
  const start = performance.now();
  const sent: Promise<unknown>[] = [];
  for (let index = 0; index < stream.length; index++) {
    const [at, deltaY] = stream[index];
    const wait = start + at - performance.now();
    if (wait > 0) await sleep(wait);
    await options.before?.(index);
    const { x, y } = typeof options.at === "function" ? options.at(index) : options.at;
    sent.push(cdp.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY }));
  }
  await Promise.all(sent);
}

// A pointer resting on a trackpad is never perfectly still: every other event
// it drifts by up to `amplitude` px around `center` (a real move each time).
export function pointerJitter(cdp: CDPSession, center: Point, amplitude = 2) {
  let k = 0;
  let where = center;
  return {
    at: () => where,
    before: async (index: number) => {
      if (index % 2 !== 0) return;
      k += 1;
      where = { x: center.x + ((k % 3) - 1) * amplitude, y: center.y + (((k + 1) % 3) - 1) * amplitude };
      await pointerTo(cdp, where);
    },
  };
}

// A steady stream: `hz` events a second of `deltaY` for `ms` (a finger held
// on the trackpad, long enough to test anything timed from a gesture's start).
export function steadyStream(ms: number, deltaY = 3, hz = 60): RecordedWheel[] {
  return Array.from({ length: Math.floor((ms * hz) / 1000) }, (_, i) => [Math.round((i * 1000) / hz), deltaY] as const);
}

// The first events of a stream, up to `pixels` of travel.
export function firstPixels(stream: readonly RecordedWheel[], pixels: number): RecordedWheel[] {
  const out: RecordedWheel[] = [];
  let total = 0;
  for (const event of stream) {
    if (total >= pixels) break;
    out.push(event);
    total += Math.abs(event[1]);
  }
  return out;
}
