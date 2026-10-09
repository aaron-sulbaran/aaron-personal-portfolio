import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { exportAll, sharp } from "../../scripts/export-photos.mjs";
import { imageSize, jpegHasMetadata } from "@/lib/testing/imageSize";

const root = mkdtempSync(join(tmpdir(), "export-src-"));
const RED = "#ff0000";
const BLUE = "#0000ff";

// Stored 1600 by 1200, left half red, right half blue, tagged with EXIF orientation 6 and a
// copyright line: it displays 1200 by 1600 with red on top.
async function rotatedSource(path: string) {
  const red = await sharp({ create: { width: 800, height: 1200, channels: 3, background: RED } }).png().toBuffer();
  await sharp({ create: { width: 1600, height: 1200, channels: 3, background: BLUE } })
    .composite([{ input: red, left: 0, top: 0 }])
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Copyright: "private" } })
    .toFile(path);
}

// Stored 1600 by 1200 with a red top-left quadrant, tagged EXIF orientation 5 (transpose, the
// mirrored selfie case): it displays 1200 by 1600 with red top left, so the manifest's flip puts
// red top right. Read as orientation 6 (rotate only), red would land top left after the flip.
async function mirroredSource(path: string) {
  const red = await sharp({ create: { width: 800, height: 600, channels: 3, background: RED } }).png().toBuffer();
  await sharp({ create: { width: 1600, height: 1200, channels: 3, background: BLUE } }).composite([{ input: red, left: 0, top: 0 }]).jpeg().withMetadata({ orientation: 5 }).toFile(path);
}

async function halves(path: string, width: number, height: number) {
  const red = await sharp({ create: { width: width / 2, height, channels: 3, background: RED } }).png().toBuffer();
  await sharp({ create: { width, height, channels: 3, background: BLUE } }).composite([{ input: red, left: 0, top: 0 }]).jpeg().toFile(path);
}

async function pixel(path: string, x: number, y: number): Promise<number[]> {
  const { data } = await sharp(path).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return [...data];
}

function isRed([r, g, b]: number[]) { return r > 200 && g < 60 && b < 60; }
function isBlue([r, g, b]: number[]) { return b > 200 && r < 60 && g < 60; }

const manifest = {
  root: `${root}/`,
  cardPictures: [
    { card: "band", id: "band-picture", source: join(root, "rotated.jpg"), crop: [0, 0, 1200, 1600], flipHorizontal: false },
    { card: "building-in-public", id: "building-in-public-picture", source: join(root, "mirrored.jpg"), crop: null, flipHorizontal: true },
  ],
  modalPhotos: [
    { card: "band", id: "band-1-top", source: join(root, "rotated.jpg"), crop: [0, 0, 1200, 400], transform: null, spare: false },
    { card: "jobs", id: "jobs-spare-x", source: join(root, "rotated.jpg"), crop: null, transform: null, spare: true },
  ],
  popovers: [{ key: "matcha", source: join(root, "wide.jpg"), crop: null }],
  logos: [{ card: "talos", files: ["logos/mark.svg", "animation/"] }],
};

let out: string;
let rows: Awaited<ReturnType<typeof exportAll>>;

beforeAll(async () => {
  await rotatedSource(join(root, "rotated.jpg"));
  await mirroredSource(join(root, "mirrored.jpg"));
  await halves(join(root, "wide.jpg"), 2400, 1200);
  mkdirSync(join(root, "logos"));
  writeFileSync(join(root, "logos", "mark.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"></svg>');
  out = mkdtempSync(join(tmpdir(), "export-out-"));
  mkdirSync(join(out, "photos", "cards"), { recursive: true });
  writeFileSync(join(out, "photos", "cards", "renamed-last-run.jpg"), "stale");
  rows = await exportAll(manifest, out);
}, 30_000);

describe("exportAll", () => {
  it("writes each output where the manifest's ids say, and reports its pixels and bytes", () => {
    expect(rows.map((row) => [row.kind, row.out, row.width, row.height])).toEqual([
      ["card", "photos/cards/band-picture.jpg", 1200, 1600],
      ["card", "photos/cards/building-in-public-picture.jpg", 1200, 1600],
      ["modal", "photos/cards/band-1-top.jpg", 1200, 400],
      ["pop", "photos/pops/matcha.jpg", 800, 400],
      ["logo", "work/logos/talos/mark.svg", null, null],
    ]);
    for (const row of rows) expect(row.bytes).toBe(readFileSync(join(out, row.out)).length);
  });
  it("crops in the photo's displayed orientation", async () => {
    expect(isRed(await pixel(join(out, "photos/cards/band-1-top.jpg"), 600, 200))).toBe(true);
    expect(isRed(await pixel(join(out, "photos/cards/band-picture.jpg"), 600, 100))).toBe(true);
    expect(isBlue(await pixel(join(out, "photos/cards/band-picture.jpg"), 600, 1500))).toBe(true);
  });
  it("mirrors a picture the manifest flips, after EXIF orientation 5's own mirror", async () => {
    const file = join(out, "photos/cards/building-in-public-picture.jpg");
    expect(isRed(await pixel(file, 900, 400))).toBe(true);
    expect(isBlue(await pixel(file, 300, 400))).toBe(true);
    expect(isBlue(await pixel(file, 300, 1200))).toBe(true);
  });
  it("strips every metadata block and stays under budget", () => {
    for (const row of rows.filter((row) => row.kind !== "logo")) {
      const file = join(out, row.out);
      expect(jpegHasMetadata(file), row.out).toBe(false);
      expect(imageSize(file)).toEqual([row.width, row.height]);
      expect(row.bytes).toBeLessThanOrEqual(300_000);
    }
  });
  it("copies logos byte for byte and skips folders and spares", () => {
    expect(readFileSync(join(out, "work/logos/talos/mark.svg"))).toEqual(readFileSync(join(root, "logos", "mark.svg")));
    expect(existsSync(join(out, "photos/cards/jobs-spare-x.jpg"))).toBe(false);
  });
  it("removes files a previous run wrote that the manifest no longer names", () => {
    expect(existsSync(join(out, "photos/cards/renamed-last-run.jpg"))).toBe(false);
  });
  it("refuses to remove anything the export did not write", async () => {
    const guarded = mkdtempSync(join(tmpdir(), "export-guard-"));
    mkdirSync(join(guarded, "work", "logos", "talos", "animation"), { recursive: true });
    await expect(exportAll(manifest, guarded)).rejects.toThrow(/not the export's/);
    expect(existsSync(join(guarded, "work", "logos", "talos", "animation"))).toBe(true);
    expect(existsSync(join(guarded, "photos"))).toBe(false);
  }, 30_000);
  // sRGB 200,60,60 stored as Display P3 is about 184,71,65; an export that ignored the profile would keep those.
  it("converts a Display P3 source to untagged sRGB", async () => {
    await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 60, b: 60 } } }).withIccProfile("p3").jpeg({ quality: 100 }).toFile(join(root, "p3.jpg"));
    const p3Out = mkdtempSync(join(tmpdir(), "export-p3-"));
    await exportAll({ ...manifest, cardPictures: [], modalPhotos: [], logos: [], popovers: [{ key: "p3", source: join(root, "p3.jpg"), crop: null }] }, p3Out);
    const file = join(p3Out, "photos/pops/p3.jpg");
    const [r, g, b] = await pixel(file, 200, 150);
    expect(Math.max(Math.abs(r - 200), Math.abs(g - 60), Math.abs(b - 60))).toBeLessThanOrEqual(4);
    expect(jpegHasMetadata(file)).toBe(false);
  });
  it("writes nothing when any entry fails", async () => {
    const empty = mkdtempSync(join(tmpdir(), "export-fail-"));
    const broken = { ...manifest, popovers: [{ key: "matcha", source: join(root, "wide.jpg"), crop: [0, 0, 5000, 100] }] };
    await expect(exportAll(broken, empty)).rejects.toThrow(/outside/);
    expect(existsSync(join(empty, "photos"))).toBe(false);
  });
  it("reads the manifest path given on the command line, with or without --out", () => {
    const script = join(process.cwd(), "scripts", "export-photos.mjs");
    const missing = join(root, "no-such-manifest.json");
    for (const args of [[missing], [missing, "--out", mkdtempSync(join(tmpdir(), "export-cli-"))], ["--out", mkdtempSync(join(tmpdir(), "export-cli-")), missing]]) {
      const run = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
      expect(run.status, args.join(" ")).toBe(1);
      expect(run.stderr, args.join(" ")).toContain(missing);
    }
    expect(spawnSync(process.execPath, [script, "a.json", "b.json"], { encoding: "utf8" }).stderr).toContain("Usage");
  });
});
