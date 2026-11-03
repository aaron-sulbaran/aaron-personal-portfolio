import { describe, expect, it } from "vitest";
import { downAt200, downFirstQuick, jitter, notches, upQuick, type RecordedWheel } from "@/lib/coil/capture.fixtures";
import { COIL } from "@/lib/coil/constants";
import { isReadersScroll, type WheelSample } from "@/lib/home/wheelTail";

const { reversePx, minPxPerMs } = COIL.deal.cutscene.tail;

// The verdict after each event of a stream, as the lock reads it: the stream so far, at the event's time.
function verdicts(stream: readonly RecordedWheel[]) {
  const samples: WheelSample[] = [];
  return stream.map(([t, px]) => {
    samples.push({ t, px });
    return { t, reader: isReadersScroll(samples, t) };
  });
}

describe("a momentum tail, from the recorded Chrome streams", () => {
  const tails = { downFirstQuick, upQuick, downAt200, jitter };

  it("is never the reader's once the fingers' ramp is over, at any event, double events and all", () => {
    for (const [name, stream] of Object.entries(tails)) {
      const late = verdicts(stream).filter(({ t }) => t > 450);
      expect(late.length, name).toBeGreaterThan(40);
      expect(late.filter(({ reader }) => reader).map(({ t }) => t), name).toEqual([]);
    }
  });

  it("is the reader's while the fingers are still on the pad: the ramp rises", () => {
    for (const [name, stream] of Object.entries(tails)) {
      const ramp = verdicts(stream).filter(({ t }) => t <= 300);
      expect(ramp.some(({ reader }) => reader), name).toBe(true);
    }
  });

  it("stays a tail through a stalled frame that flushes a run of events at once", () => {
    // jitter's tail with the events between 900 and 1030 ms held and delivered as one at 1030.
    const held = jitter.filter(([t]) => t > 900 && t <= 1030);
    const flushed: RecordedWheel[] = [
      ...jitter.filter(([t]) => t <= 900),
      [1030, held.reduce((sum, [, px]) => sum + px, 0)],
      ...jitter.filter(([t]) => t > 1030),
    ];
    expect(held.length).toBeGreaterThan(4);
    expect(verdicts(flushed).filter(({ t, reader }) => t > 450 && reader)).toEqual([]);
  });
});

describe("the reader's own scroll", () => {
  it("is a mouse wheel kept turning: nearly every notch of the recorded run reads as the reader's", () => {
    // Notches 33 to 67 ms apart: the pace wavers with them, so a notch now and then reads as the wheel slowing.
    const readers = verdicts(notches).filter(({ reader }) => reader);
    expect(readers.length).toBeGreaterThanOrEqual(notches.length - 4);
  });

  it("is a single notch, at once", () => {
    expect(isReadersScroll([{ t: 1000, px: 100 }], 1000)).toBe(true);
  });

  it("is a gentle trackpad scroll, a few pixels a frame, going on", () => {
    for (const px of [2, 3, 6]) {
      const samples: WheelSample[] = [];
      let last = false;
      for (let t = 0; t <= 600; t += 16) {
        samples.push({ t, px });
        last = isReadersScroll(samples, t);
      }
      expect(last, `${px} px a frame`).toBe(true);
    }
  });

  it("is a swipe that turns round on a tail: the latest event against the one before", () => {
    const tail = downFirstQuick.map(([t, px]): WheelSample => ({ t, px }));
    const turned = [...tail, { t: 1100, px: -reversePx }];
    expect(isReadersScroll(tail, 1000)).toBe(false);
    expect(isReadersScroll(turned, 1100)).toBe(true);
  });

  it("is a fresh swipe rising out of the tail's last pixels", () => {
    const tail = downFirstQuick.map(([t, px]): WheelSample => ({ t, px }));
    const swipe: WheelSample[] = [
      { t: 1000, px: 15 },
      { t: 1017, px: 30 },
      { t: 1039, px: 105 },
    ];
    expect(isReadersScroll([...tail, ...swipe.slice(0, 1)], 1000)).toBe(false);
    expect(isReadersScroll([...tail, ...swipe], 1039)).toBe(true);
  });
});

describe("what is too slight to tell", () => {
  it("is not the reader's: a lone pixel, or a trickle under the floor", () => {
    expect(isReadersScroll([{ t: 1000, px: 1 }], 1000)).toBe(false);
    const samples: WheelSample[] = [];
    for (let t = 0; t <= 600; t += 17) samples.push({ t, px: (minPxPerMs * 17) / 2 });
    expect(isReadersScroll(samples, 600)).toBe(false);
  });

  it("is not the reader's: nothing at all, or a stream that has gone quiet", () => {
    expect(isReadersScroll([], 1000)).toBe(false);
    expect(isReadersScroll([{ t: 1000, px: 100 }], 1000 + COIL.deal.cutscene.tail.recentMs)).toBe(false);
  });

  it("is not a turn round when the latest event is a pixel or two against the grain", () => {
    const tail = downFirstQuick.map(([t, px]): WheelSample => ({ t, px }));
    expect(isReadersScroll([...tail, { t: 1100, px: -(reversePx - 1) }], 1100)).toBe(false);
  });
});
