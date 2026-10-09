import { describe, expect, it } from "vitest";
import { FLIP_OVERRIDES, cropRegion, exportJobs, outputSize } from "../../scripts/photo-export-plan.mjs";

// A manifest in the real one's shape, with made-up paths.
const manifest = {
  root: "/assets/",
  cardPictures: [{ card: "band", id: "band-picture", source: "/assets/band.jpg", crop: [700, 0, 2120, 1893], flipHorizontal: false, caption: "c", alt: "a" }],
  modalPhotos: [
    { card: "jobs", id: "jobs-1-mod-selfie", source: "/assets/mod.jpg", crop: null, transform: null, spare: false, timeline: 1 },
    { card: "jobs", id: "jobs-spare-aritzia-domain", source: "/assets/spare.jpg", crop: null, transform: null, spare: true, timeline: 4 },
  ],
  popovers: [{ key: "matcha", source: "/assets/matcha.jpg", crop: [1000, 2100, 3600, 5567] }],
  logos: [
    { card: "talos", files: ["pack/mark/mark.svg", "pack/animation/"] },
    { card: "this-site", files: ["app/icon.svg (in the repo)"] },
  ],
};

describe("exportJobs", () => {
  it("names each output from its id, skips the spare, the animation folder and in-repo files", () => {
    expect(exportJobs(manifest).map((job) => [job.kind, job.out, job.source])).toEqual([
      ["card", "photos/cards/band-picture.jpg", "/assets/band.jpg"],
      ["modal", "photos/cards/jobs-1-mod-selfie.jpg", "/assets/mod.jpg"],
      ["pop", "photos/pops/matcha.jpg", "/assets/matcha.jpg"],
      ["logo", "work/logos/talos/mark.svg", "/assets/pack/mark/mark.svg"],
    ]);
  });
  it("carries the crop and the flip, for a card picture, a modal transform and the two overrides", () => {
    const flipped = { ...manifest, cardPictures: [{ ...manifest.cardPictures[0], flipHorizontal: true }] };
    expect(exportJobs(flipped)[0]).toMatchObject({ crop: [700, 0, 2120, 1893], flip: true });
    const modal = { ...manifest.modalPhotos[0], transform: "flipHorizontal" };
    expect(exportJobs({ ...manifest, modalPhotos: [modal] })[1]).toMatchObject({ kind: "modal", flip: true });
    expect([...FLIP_OVERRIDES]).toEqual(["capital-one-3-2026", "hackathons-2-vercel"]);
    const override = { ...manifest.modalPhotos[0], id: "hackathons-2-vercel" };
    expect(exportJobs({ ...manifest, modalPhotos: [override] })[1]).toMatchObject({ id: "hackathons-2-vercel", flip: true });
    expect(exportJobs(manifest)[1]).toMatchObject({ id: "jobs-1-mod-selfie", flip: false });
  });
  it("refuses a manifest it cannot trust", () => {
    expect(() => exportJobs({ ...manifest, popovers: [{ key: "Matcha Kyoto", source: "/a.jpg", crop: null }] })).toThrow();
    expect(() => exportJobs({ ...manifest, popovers: [{ key: "matcha", source: "/a.jpg", crop: [10, 10, 5, 20] }] })).toThrow();
    expect(() => exportJobs({ ...manifest, modalPhotos: [{ ...manifest.modalPhotos[0], transform: "rotate" }] })).toThrow();
    expect(() => exportJobs({ ...manifest, popovers: [...manifest.popovers, ...manifest.popovers] })).toThrow(/two manifest entries/);
  });
});

describe("cropRegion", () => {
  it("turns x0,y0,x1,y1 into an extract box, or the whole frame", () => {
    expect(cropRegion([700, 0, 2120, 1893], { width: 2520, height: 1893 })).toEqual({ left: 700, top: 0, width: 1420, height: 1893 });
    expect(cropRegion(null, { width: 3024, height: 4032 })).toEqual({ left: 0, top: 0, width: 3024, height: 4032 });
  });
  it("refuses a box outside the oriented source", () => {
    expect(() => cropRegion([0, 100, 1126, 1701], { width: 1126, height: 1630 })).toThrow(/outside/);
  });
});

describe("outputSize", () => {
  it("makes a card picture 3:4 at 1200 by 1600, never upscaled, never under 768 wide", () => {
    expect(outputSize("card", { width: 1420, height: 1893 })).toEqual({ width: 1200, height: 1600 });
    expect(outputSize("card", { width: 900, height: 1200 })).toEqual({ width: 900, height: 1200 });
    expect(() => outputSize("card", { width: 600, height: 800 })).toThrow(/at least 768/);
    expect(() => outputSize("card", { width: 1600, height: 1200 })).toThrow(/3:4/);
  });
  it("keeps a modal photo's shape within 1600 px and a pop's within 800 px", () => {
    expect(outputSize("modal", { width: 5712, height: 4284 })).toEqual({ width: 1600, height: 1200 });
    expect(outputSize("modal", { width: 2170, height: 3480 })).toEqual({ width: 998, height: 1600 });
    expect(outputSize("modal", { width: 532, height: 517 })).toEqual({ width: 532, height: 517 });
    expect(outputSize("pop", { width: 1536, height: 1376 })).toEqual({ width: 800, height: 717 });
  });
});
