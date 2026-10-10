import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { imageSize, jpegHasMetadata } from "@/lib/testing/imageSize";

const PUBLIC = join(process.cwd(), "public");
const MANIFEST = "docs/content/photo-export-manifest.json";

// What scripts/export-photos.mjs wrote from the approved manifest (2026-10-08), in pixels.
const PHOTOS: Record<string, [number, number]> = {
  "anthropic-1-hackathon": [1600, 1200], "anthropic-2-session": [1200, 1600], "anthropic-3-teaching": [1600, 1205],
  "band-1-section": [1600, 1067], "band-2-practice": [1200, 1600], "band-3-competition": [1200, 1600], "band-picture": [1200, 1600],
  "building-1-analytics": [532, 517], "building-2-toronto": [1200, 1600], "building-in-public-picture": [1200, 1600],
  "capital-one-1-2024": [1200, 1600], "capital-one-2-2025": [1200, 1600], "capital-one-3-2026": [1200, 1600],
  "hackathons-1-hookem": [1600, 1135], "hackathons-2-vercel": [1200, 1600], "hackathons-picture": [1200, 1600],
  "ieee-1-social": [1600, 1061], "ieee-2-award": [1600, 858], "ieee-3-rising-stars": [1200, 1600],
  "jobs-1-mod-selfie": [1200, 1600], "jobs-2-mod-sign": [1200, 1600], "jobs-3-apple": [1200, 1600], "jobs-4-aritzia-poster": [998, 1600],
  "mentorship-1-booth": [1125, 978], "mentorship-2-scholar": [1600, 1200], "mentorship-3-shpe": [1600, 1200], "mentorship-picture": [1200, 1600],
  "misuki-1-gregory-gym": [1126, 1501], "misuki-2-shop": [1200, 1600], "misuki-3-hiroshima": [1600, 1200], "misuki-picture": [1200, 1600],
  "travel-1-fuji": [1200, 1600], "travel-2-dubai": [1200, 1600], "travel-3-cartagena": [1200, 1600], "travel-picture": [1200, 1600],
};
const POPS: Record<string, [number, number]> = {
  "contrabass-clarinet": [600, 800], "downhill-skating": [600, 800], "leadership-award": [600, 800], matcha: [600, 800], "rock-climbing": [600, 800],
  rango: [599, 800], sandboarding: [600, 800], "sister-kyoto": [800, 717], skydiving: [800, 600], "venezuela-flag": [600, 800],
};
const LOGOS: Record<string, string[]> = {
  anthropic: ["anthropic-mark-white.svg", "anthropic-mark.svg", "anthropic-wordmark-white.svg", "anthropic-wordmark.svg"],
  "capital-one": ["capital-one-logo.svg"],
  fsdatalink: ["fsdatalink-logo-light.png", "fsdatalink-logo.avif", "fsdatalink-mark.png"],
  ieee: ["ieee-ut-logo.jpg"],
  jobs: ["apple-logo-black.svg", "apple-logo-white.svg", "aritzia-logo-light.svg", "aritzia-logo-white.svg", "aritzia-logo.svg", "mod-pizza-logo.svg", "popeyes-logo.svg", "ut-austin-logo-white.svg", "ut-austin-logo.svg"],
  "min-max": ["mark-on-dark.svg", "mark.svg", "wordmark-on-dark.svg", "wordmark.svg"],
  talos: ["lockup-dark.svg", "mark.svg", "wordmark-dark.svg"],
};

function listed(dir: string): string[] {
  return readdirSync(join(PUBLIC, dir)).filter((name) => !name.startsWith(".")).sort();
}

describe("the exported photos", () => {
  it("are exactly the manifest's card pictures, modal photos and popovers, at the measured pixels", () => {
    expect(listed("photos/cards")).toEqual(Object.keys(PHOTOS).sort().map((name) => `${name}.jpg`));
    expect(listed("photos/pops")).toEqual(Object.keys(POPS).sort().map((name) => `${name}.jpg`));
    for (const [name, size] of Object.entries(PHOTOS)) expect(imageSize(join(PUBLIC, "photos/cards", `${name}.jpg`)), name).toEqual(size);
    for (const [name, size] of Object.entries(POPS)) expect(imageSize(join(PUBLIC, "photos/pops", `${name}.jpg`)), name).toEqual(size);
  });
  it("stay under 300,000 bytes with no Exif or ICC segment", () => {
    for (const file of [...listed("photos/cards").map((name) => `photos/cards/${name}`), ...listed("photos/pops").map((name) => `photos/pops/${name}`)]) {
      expect(statSync(join(PUBLIC, file)).size, file).toBeLessThanOrEqual(300_000);
      expect(jpegHasMetadata(join(PUBLIC, file)), file).toBe(false);
    }
  });
  it("make every card picture 3:4 within a pixel", () => {
    for (const [name, [width, height]] of Object.entries(PHOTOS)) if (name.endsWith("-picture")) expect(Math.abs(width - (height * 3) / 4), name).toBeLessThanOrEqual(1);
  });
});

describe("the exported logos", () => {
  it("are the official files logos.md names, one folder per card", () => {
    for (const [card, files] of Object.entries(LOGOS)) expect(listed(`work/logos/${card}`), card).toEqual(files);
  });
});

describe("the public tree after the placeholder sweep", () => {
  it("keeps only the card and pop folders and the holding deck's graduation photo in public/photos", () => {
    expect(listed("photos")).toEqual(["cards", "pops", "uncs-grad.jpeg"]);
  });
  it("keeps one folder per card in public/work/logos plus the eleven press-kit files", () => {
    const pressKit = [
      "anthropic-symbol.svg", "anthropic-symbol-dark.svg", "anthropic-wordmark.svg", "anthropic-wordmark-dark.svg",
      "claude-mark.svg", "claude-wordmark.svg", "claude-wordmark-dark.svg",
      "minmax-lockup.svg", "minmax-lockup-dark.svg", "minmax-mark.svg", "minmax-mark-dark.svg",
    ];
    expect(listed("work/logos")).toEqual([...Object.keys(LOGOS), ...pressKit].sort());
  });
  it("carries no metadata in the graduation photo", () => {
    expect(jpegHasMetadata(join(PUBLIC, "photos/uncs-grad.jpeg"))).toBe(false);
  });
});

describe("the export manifest", () => {
  it("stays out of git: ignored and untracked", () => {
    expect(execFileSync("git", ["ls-files", "--", MANIFEST], { encoding: "utf8" })).toBe("");
    expect(execFileSync("git", ["check-ignore", MANIFEST], { encoding: "utf8" }).trim()).toBe(MANIFEST);
  });
  it("leaves no local asset path in tracked code", () => {
    const folder = ["aaron", "site", "assets"].join("-");
    let hits = "";
    try {
      hits = execFileSync("git", ["grep", "-l", folder, "--", "lib", "scripts", "app", "components", "e2e", "public"], { encoding: "utf8" });
    } catch {
      // git grep exits 1 when nothing matches.
    }
    expect(hits).toBe("");
  });
});
