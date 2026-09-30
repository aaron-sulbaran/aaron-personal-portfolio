import { describe, expect, it } from "vitest";
import { runRender, runUpdate, type RenderSteps, type UpdateSteps } from "./frame";

// The scene's frame order, as a contract: one frame runs every update step
// and then every render step, each once, in this order. The scene's modules
// hand their step functions to these two sequencers, so a module that moves
// a step (or a new step placed in the wrong slot) fails here.

const UPDATE = [
  "scroll",
  "conveyor",
  "helix",
  "entrance",
  "rebuild",
  "unwind",
  "name",
  "seen",
  "slots",
  "silhouette",
  "picking",
  "nudge",
  "repaint",
] as const;
const RENDER = ["field", "surface", "composite", "cards"] as const;

function recorder<K extends string>(names: readonly K[], calls: string[], frames: unknown[]) {
  return Object.fromEntries(
    names.map((name) => [
      name,
      (frame: unknown) => {
        calls.push(name);
        frames.push(frame);
      },
    ]),
  ) as Record<K, (frame: unknown) => void>;
}

describe("frame order", () => {
  it("runs the update steps, then the render steps, once each and in order", () => {
    const calls: string[] = [];
    const frames: unknown[] = [];
    const frame = { dt: 1 / 60, now: 1000 };
    runUpdate(recorder(UPDATE, calls, frames) as UpdateSteps<typeof frame>, frame);
    runRender(recorder(RENDER, calls, frames) as RenderSteps<typeof frame>, frame);
    expect(calls).toEqual([...UPDATE, ...RENDER]);
  });

  it("hands every step the same frame record", () => {
    const calls: string[] = [];
    const frames: unknown[] = [];
    const frame = { dt: 0, now: 0 };
    runUpdate(recorder(UPDATE, calls, frames) as UpdateSteps<typeof frame>, frame);
    runRender(recorder(RENDER, calls, frames) as RenderSteps<typeof frame>, frame);
    expect(frames).toHaveLength(UPDATE.length + RENDER.length);
    expect(frames.every((seen) => seen === frame)).toBe(true);
  });

  it("stops the frame where a step throws, so the loop's catch sees the error", () => {
    const calls: string[] = [];
    const steps = recorder(UPDATE, calls, []) as UpdateSteps<null>;
    steps.unwind = () => {
      calls.push("unwind");
      throw new Error("unwind failed");
    };
    expect(() => runUpdate(steps, null)).toThrow("unwind failed");
    expect(calls).toEqual(["scroll", "conveyor", "helix", "entrance", "rebuild", "unwind"]);
  });
});
