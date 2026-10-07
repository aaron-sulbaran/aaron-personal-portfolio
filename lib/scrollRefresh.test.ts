import { describe, expect, it } from "vitest";
import { guardRefreshScroll, type RecordedScroll } from "./scrollRefresh";

function harness({ inline = "", y = 1951, rec }: { inline?: string; y?: number; rec?: number } = {}) {
  const listeners: Record<string, (() => void)[]> = {};
  const frames = new Map<number, () => void>();
  let lastFrame = 0;
  const steps: string[] = [];
  const scroll: RecordedScroll = { rec };
  const style = {
    value: inline,
    get scrollBehavior() {
      return this.value;
    },
    set scrollBehavior(next: string) {
      steps.push(`inline ${next}`);
      this.value = next;
    },
  };
  guardRefreshScroll({
    on: (event, callback) => (listeners[event] ??= []).push(callback),
    windowScroll: () => {
      steps.push(`read scroll with inline "${style.value}"`);
      return scroll;
    },
    root: { style },
    scrollY: () => y,
    flushStyle: () => steps.push("flush"),
    nextFrame: (callback) => {
      frames.set(++lastFrame, callback);
      return lastFrame;
    },
    cancelFrame: (id) => frames.delete(id),
  });
  const fire = (event: "refreshInit" | "refresh") => listeners[event]?.forEach((callback) => callback());
  const runFrame = () => {
    const due = [...frames.values()];
    frames.clear();
    due.forEach((callback) => callback());
  };
  return { scroll, style, steps, fire, runFrame };
}

describe("guardRefreshScroll", () => {
  it("reads the scroll function before writing auto, then makes auto take effect at once", () => {
    const h = harness({ rec: 1951 });
    h.fire("refreshInit");
    expect(h.steps).toEqual(['read scroll with inline ""', "inline auto", "flush"]);
  });

  it("puts back a record a lone refresh cleared, from the current position", () => {
    const h = harness({ y: 1942.4, rec: 0 });
    h.fire("refreshInit");
    expect(h.scroll.rec).toBe(1942);
  });

  it("keeps a record GSAP made", () => {
    const h = harness({ y: 1942, rec: 1700 });
    h.fire("refreshInit");
    expect(h.scroll.rec).toBe(1700);
  });

  it("hands the root its own inline value back a frame after the refresh, not during it", () => {
    const h = harness({ inline: "" });
    h.fire("refreshInit");
    h.fire("refresh");
    expect(h.style.scrollBehavior).toBe("auto");
    h.style.scrollBehavior = "smooth";
    h.runFrame();
    expect(h.style.scrollBehavior).toBe("");
  });

  it("restores the value from before the first of back to back refreshes, never its own auto", () => {
    const h = harness({ inline: "" });
    h.fire("refreshInit");
    h.fire("refresh");
    h.fire("refreshInit");
    h.fire("refresh");
    h.runFrame();
    expect(h.style.scrollBehavior).toBe("");
    h.fire("refreshInit");
    h.fire("refresh");
    h.runFrame();
    expect(h.style.scrollBehavior).toBe("");
  });

  it("keeps an inline value the page set itself", () => {
    const h = harness({ inline: "smooth" });
    h.fire("refreshInit");
    h.fire("refresh");
    h.runFrame();
    expect(h.style.scrollBehavior).toBe("smooth");
  });
});
