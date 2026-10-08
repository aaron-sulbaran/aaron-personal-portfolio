import { describe, expect, it } from "vitest";
import { LOADER } from "@/lib/loader/progress";
import { loaderEnd, markStillGaveUp, provideStillPoster, stillGaveUp, stillPoster, type LoaderEndInput } from "@/lib/loader/still";

const at = (over: Partial<LoaderEndInput>): LoaderEndInput => ({
  reduced: false, paneShown: false, target: "none", still: false, waitedMs: 0, ...over,
});

describe("the loader's end", () => {
  it("keeps reduced motion's branch: a skip inside the guard, else the fade", () => {
    expect(loaderEnd(at({ reduced: true, still: true }))).toBe("skip");
    expect(loaderEnd(at({ reduced: true, paneShown: true, target: "landable" }))).toBe("fade");
  });
  it("hands to a scene: the resting hold inside the guard, the continuity past it", () => {
    expect(loaderEnd(at({ target: "landable" }))).toBe("rest");
    expect(loaderEnd(at({ target: "away" }))).toBe("rest");
    expect(loaderEnd(at({ paneShown: true, target: "landable" }))).toBe("continuity");
    expect(loaderEnd(at({ paneShown: true, target: "away" }))).toBe("fade");
  });
  it("hands to the still when no scene can run, pane or not", () => {
    expect(loaderEnd(at({ still: true }))).toBe("dissolve");
    expect(loaderEnd(at({ paneShown: true, still: true }))).toBe("dissolve");
  });
  it("past the guard with nobody to take the lockup, fades at once", () => {
    expect(loaderEnd(at({ paneShown: true, waitedMs: 0 }))).toBe("fade");
    // The scene path's 6s give-up with no scene drawn: no extra hold on the pane.
    expect(loaderEnd(at({ paneShown: true, target: "none", still: false, waitedMs: 0 }))).toBe("fade");
  });
  it("waits on the fast path only, a hand-off's give-up at most, for the still to be known", () => {
    expect(loaderEnd(at({ waitedMs: LOADER.handoffGiveUpMs - 1 }))).toBe("wait");
    expect(loaderEnd(at({ waitedMs: LOADER.handoffGiveUpMs }))).toBe("skip");
  });
  it("has one still provider, released only by its own owner", () => {
    const a = { decoded: () => Promise.resolve(), target: () => null };
    const b = { decoded: () => Promise.resolve(), target: () => null };
    const releaseA = provideStillPoster(a);
    const releaseB = provideStillPoster(b);
    releaseA();
    expect(stillPoster()).toBe(b);
    releaseB();
    expect(stillPoster()).toBeNull();
  });
  it("hears the loader give up on the still, until a new still is provided", () => {
    const poster = { decoded: () => Promise.resolve(), target: () => null };
    const release = provideStillPoster(poster);
    expect(stillGaveUp()).toBe(false);
    markStillGaveUp();
    expect(stillGaveUp()).toBe(true);
    release();
    expect(stillGaveUp(), "the give-up outlives its provider (the hero still decodes later)").toBe(true);
    const again = provideStillPoster(poster);
    expect(stillGaveUp(), "a new provider starts a new load").toBe(false);
    again();
  });
});
