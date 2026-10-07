import { afterAll, describe, expect, it, vi } from "vitest";
import { stillFallback, stillSources } from "@/lib/coil/heroStill";
import { stillPicture } from "@/lib/coil/stillPicture";

// Next reads the deployment id once, when its module loads (on Vercel with
// skew protection, NEXT_DEPLOYMENT_ID), so it is set before any import.
const env = vi.hoisted(() => {
  const before = process.env.NEXT_DEPLOYMENT_ID;
  process.env.NEXT_DEPLOYMENT_ID = "dpl_test";
  return { before };
});

describe("still picture", () => {
  afterAll(() => {
    if (env.before === undefined) delete process.env.NEXT_DEPLOYMENT_ID;
    else process.env.NEXT_DEPLOYMENT_ID = env.before;
  });

  it("puts the deployment id on every URL, sources and img alike, keeping media and type", () => {
    const { sources, img } = stillPicture("light");
    expect(sources).toEqual(stillSources("light").map((s) => ({ media: s.media, type: s.type, srcSet: `${s.src}?dpl=dpl_test` })));
    expect(img.src).toBe(`${stillFallback("light")}?dpl=dpl_test`);
  });
});
