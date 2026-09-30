import type { Page } from "@playwright/test";

// A per-frame recorder in the page. Each animation frame, once every rAF
// callback of that frame has run (a message posted from the frame lands after
// it), it reads what the visitor would see: the page's scroll, the coil's
// offset, who owns the wheel, the nudge's opacity, the hovered slot. Every
// wheel event is logged too, as the window sees it after the scene's handler
// (defaultPrevented is the scene's decision), and every pointer move. Chrome
// coalesces wheel events that arrive inside one frame, so the page may see
// fewer wheels than were sent: align by time, never by index.

export type FrameRow = {
  frame: number;
  t: number; // performance.now() when the frame's callbacks had all run
  scrollY: number;
  offset: number;
  owner: "coil" | "page" | "none";
  nudge: number; // the nudge's opacity, 0 when hidden
  hovered: number;
  heroTop: number;
};

export type WheelRow = { t: number; deltaY: number; prevented: boolean; cancelable: boolean; scrollY: number };

export type PointerRow = { t: number; x: number; y: number };

export type Recording = { rows: FrameRow[]; wheels: WheelRow[]; pointers: PointerRow[] };

type Recorder = { on: boolean; frame: number; rows: FrameRow[]; wheels: WheelRow[]; pointers: PointerRow[] };

async function install(page: Page) {
  await page.evaluate(() => {
    const host = window as unknown as { __e2eFrames?: Recorder };
    if (host.__e2eFrames) return;
    const recorder: Recorder = { on: false, frame: 0, rows: [], wheels: [], pointers: [] };
    host.__e2eFrames = recorder;
    const nudge = () =>
      document.querySelector('section[data-scene] svg circle[r="12"]')?.closest<HTMLElement>("div[aria-hidden]") ?? null;
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      if (!recorder.on) return;
      const coil = (
        window as unknown as {
          __coil?: { offset: () => number; owner?: () => FrameRow["owner"]; capturing: () => boolean; hovered: () => number };
        }
      ).__coil;
      const el = nudge();
      recorder.rows.push({
        frame: recorder.frame,
        t: performance.now(),
        scrollY: window.scrollY,
        offset: coil ? coil.offset() : Number.NaN,
        // Builds before the ownership rule only had capturing().
        owner: !coil ? "none" : coil.owner ? coil.owner() : coil.capturing() ? "coil" : "none",
        // As drawn: the computed value, so a fade still running counts as shown.
        nudge: el ? Number(getComputedStyle(el).opacity) : 0,
        hovered: coil ? coil.hovered() : -1,
        heroTop: document.querySelector("section[data-scene]")?.getBoundingClientRect().top ?? Number.NaN,
      });
    };
    const tick = () => {
      recorder.frame += 1;
      channel.port2.postMessage(0);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.addEventListener(
      "wheel",
      (event) => {
        if (!recorder.on) return;
        recorder.wheels.push({
          t: performance.now(),
          deltaY: event.deltaY,
          prevented: event.defaultPrevented,
          cancelable: event.cancelable,
          scrollY: window.scrollY,
        });
      },
      { passive: true },
    );
    window.addEventListener(
      "pointermove",
      (event) => {
        if (recorder.on) recorder.pointers.push({ t: performance.now(), x: event.clientX, y: event.clientY });
      },
      { passive: true },
    );
  });
}

// Records every frame and wheel while `act` runs, plus `tailMs` after it.
export async function frames(page: Page, act: () => Promise<void>, { tailMs = 0 } = {}): Promise<Recording> {
  await install(page);
  await page.evaluate(() => {
    const recorder = (window as unknown as { __e2eFrames: Recorder }).__e2eFrames;
    recorder.rows = [];
    recorder.wheels = [];
    recorder.pointers = [];
    recorder.on = true;
  });
  await act();
  if (tailMs > 0) await page.waitForTimeout(tailMs);
  return page.evaluate(() => {
    const recorder = (window as unknown as { __e2eFrames: Recorder }).__e2eFrames;
    recorder.on = false;
    return { rows: recorder.rows, wheels: recorder.wheels, pointers: recorder.pointers };
  });
}

// The largest page movement from the first recorded frame.
export function pageTravel(recording: Recording) {
  const start = recording.rows[0]?.scrollY ?? 0;
  return Math.max(0, ...recording.rows.map((row) => Math.abs(row.scrollY - start)));
}

export function offsetTravel(recording: Recording) {
  const { rows } = recording;
  return rows.length ? rows[rows.length - 1].offset - rows[0].offset : 0;
}
