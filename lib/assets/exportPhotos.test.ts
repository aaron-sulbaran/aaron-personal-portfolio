import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportAll, sharp } from "../../scripts/export-photos.mjs";
import { imageSize, jpegHasMetadata } from "@/lib/testing/imageSize";

const tempDirs: string[] = [];
function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

const root = tempDir("export-src-");
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

// A 100 by 150 vector: white on the left with a hairline black stripe 0.4 wide at x 25, blue on the
// right. Drawn at 100 by 150 the stripe is a 40% grey pixel column; rendered at the pop's 533 by 800
// it is a 2 px black line. Stretching the small raster could never produce that line.
const SPLIT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100" height="150" fill="#ffffff"/><rect x="50" width="50" height="150" fill="#0000ff"/><rect x="24.8" width="0.4" height="150" fill="#000000"/></svg>';

// The darkest grey in a window of one row.
async function darkest(input: string | Buffer, y: number, from: number, to: number): Promise<number> {
  const { data, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true });
  let min = 255;
  for (let x = from; x <= to; x++) min = Math.min(min, data[y * info.width + x]);
  return min;
}

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
  popovers: [
    { key: "matcha", source: join(root, "wide.jpg"), crop: null },
    { key: "split", source: join(root, "split.svg"), format: "svg", crop: null },
  ],
  logos: [{ card: "talos", files: ["logos/mark.svg", "animation/"] }],
};

let out: string;
let rows: Awaited<ReturnType<typeof exportAll>>;

beforeAll(async () => {
  await rotatedSource(join(root, "rotated.jpg"));
  await mirroredSource(join(root, "mirrored.jpg"));
  await halves(join(root, "wide.jpg"), 2400, 1200);
  writeFileSync(join(root, "split.svg"), SPLIT_SVG);
  mkdirSync(join(root, "logos"));
  writeFileSync(join(root, "logos", "mark.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"></svg>');
  out = tempDir("export-out-");
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
      ["pop", "photos/pops/split.jpg", 533, 800],
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
  it("crops first and mirrors second, so an off-centre crop keeps its red edge on the right", async () => {
    // A 1600 by 1200 source with red in x < 400; both outputs keep the crop's 900 by 1200 (no upscaling).
    // Cropping x 0 to 900 first leaves red at the crop's x 0 to 400, and the mirror then moves it to
    // x 500 to 900: a probe at x 800 is red and x 100 is blue. Mirroring first would send the red to
    // source x 1200 to 1600, outside the crop, and the whole output would come out blue.
    await sharp({ create: { width: 1600, height: 1200, channels: 3, background: BLUE } })
      .composite([{ input: await sharp({ create: { width: 400, height: 1200, channels: 3, background: RED } }).png().toBuffer(), left: 0, top: 0 }])
      .jpeg({ quality: 100 })
      .toFile(join(root, "off-centre.jpg"));
    const flipOut = tempDir("export-flip-");
    await exportAll(
      {
        ...manifest,
        cardPictures: [{ card: "band", id: "off-centre-picture", source: join(root, "off-centre.jpg"), crop: [0, 0, 900, 1200], flipHorizontal: true }],
        modalPhotos: [{ card: "band", id: "off-centre-modal", source: join(root, "off-centre.jpg"), crop: [0, 0, 900, 1200], transform: "flipHorizontal", spare: false }],
        popovers: [],
        logos: [],
      },
      flipOut,
    );
    const card = join(flipOut, "photos/cards/off-centre-picture.jpg");
    expect(imageSize(card)).toEqual([900, 1200]);
    expect(isRed(await pixel(card, 800, 600))).toBe(true);
    expect(isBlue(await pixel(card, 100, 600))).toBe(true);
    expect(isBlue(await pixel(card, 400, 600))).toBe(true);
    const modal = join(flipOut, "photos/cards/off-centre-modal.jpg");
    expect(imageSize(modal)).toEqual([900, 1200]);
    expect(isRed(await pixel(modal, 800, 600))).toBe(true);
    expect(isBlue(await pixel(modal, 100, 600))).toBe(true);
  });
  it("renders a vector popover at the pop size instead of stretching a small raster", async () => {
    const file = join(out, "photos/pops/split.jpg");
    expect(imageSize(file)).toEqual([533, 800]);
    expect((await pixel(file, 60, 400)).every((channel) => channel > 230)).toBe(true);
    expect(isBlue(await pixel(file, 430, 400))).toBe(true);
    expect(await darkest(file, 400, 124, 142)).toBeLessThan(70);
    // The same picture at its own 100 by 150, stretched to 533 by 800, only reaches the stripe's 40% grey.
    const small = await sharp(Buffer.from(SPLIT_SVG)).png().toBuffer();
    expect(await darkest(await sharp(small).resize(533, 800).png().toBuffer(), 400, 124, 142)).toBeGreaterThan(120);
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
    const guarded = tempDir("export-guard-");
    mkdirSync(join(guarded, "work", "logos", "talos", "animation"), { recursive: true });
    await expect(exportAll(manifest, guarded)).rejects.toThrow(/not the export's/);
    expect(existsSync(join(guarded, "work", "logos", "talos", "animation"))).toBe(true);
    expect(existsSync(join(guarded, "photos"))).toBe(false);
  }, 30_000);
  // sRGB 200,60,60 stored as Display P3 is about 184,71,65; an export that ignored the profile would keep those.
  it("converts a Display P3 source to untagged sRGB", async () => {
    await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 60, b: 60 } } }).withIccProfile("p3").jpeg({ quality: 100 }).toFile(join(root, "p3.jpg"));
    const p3Out = tempDir("export-p3-");
    await exportAll({ ...manifest, cardPictures: [], modalPhotos: [], logos: [], popovers: [{ key: "p3", source: join(root, "p3.jpg"), crop: null }] }, p3Out);
    const file = join(p3Out, "photos/pops/p3.jpg");
    const [r, g, b] = await pixel(file, 200, 150);
    expect(Math.max(Math.abs(r - 200), Math.abs(g - 60), Math.abs(b - 60))).toBeLessThanOrEqual(4);
    expect(jpegHasMetadata(file)).toBe(false);
  });
  it("writes nothing when any entry fails", async () => {
    const empty = tempDir("export-fail-");
    const broken = { ...manifest, popovers: [{ key: "matcha", source: join(root, "wide.jpg"), crop: [0, 0, 5000, 100] }] };
    await expect(exportAll(broken, empty)).rejects.toThrow(/outside/);
    expect(existsSync(join(empty, "photos"))).toBe(false);
  });
  it("reads the manifest path given on the command line, with or without --out", () => {
    const script = join(process.cwd(), "scripts", "export-photos.mjs");
    const missing = join(root, "no-such-manifest.json");
    for (const args of [[missing], [missing, "--out", tempDir("export-cli-")], ["--out", tempDir("export-cli-"), missing]]) {
      const run = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
      expect(run.status, args.join(" ")).toBe(1);
      expect(run.stderr, args.join(" ")).toContain(missing);
    }
    expect(spawnSync(process.execPath, [script, "a.json", "b.json"], { encoding: "utf8" }).stderr).toContain("Usage");
  });
});
