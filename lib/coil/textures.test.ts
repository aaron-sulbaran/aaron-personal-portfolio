import { describe, expect, it } from "vitest";
import { strandCardByKey, strandCards } from "@/lib/content";
import { emptySource } from "@/lib/coil/textures";

// What a card paints before its files arrive, or once the loader gives up on them.
describe("a card's empty source", () => {
  it("is each card's own face kind, with no image", () => {
    expect(Object.fromEntries(strandCards.map((card) => [card.key, emptySource(card).kind]))).toEqual({
      mentorship: "photo", "min-max": "logo", band: "photo", talos: "logo", travel: "photo", "capital-one": "logo", hackathons: "photo",
      anthropic: "logo", misuki: "photo", ieee: "logo", jobs: "circles", "this-site": "mark", fsdatalink: "logo", "building-in-public": "photo",
    });
  });
  it("keeps a logo's tile and file facts, and every job's disc with its logo's shape", () => {
    const talos = emptySource(strandCardByKey.get("talos")!);
    expect(talos.kind === "logo" && [talos.tile, talos.light, talos.dark]).toEqual(["anvil", null, null]);
    const ieee = emptySource(strandCardByKey.get("ieee")!);
    expect(ieee.kind === "logo" && ieee.logo.opaque).toBe(true);
    const jobs = emptySource(strandCardByKey.get("jobs")!);
    expect(jobs.kind === "circles" && jobs.logos.map((logo) => [logo.image, +logo.aspect.toFixed(3)])).toEqual([
      [null, 5.85], [null, 1.037], [null, 3.573], [null, 0.814], [null, 4.965],
    ]);
  });
});
