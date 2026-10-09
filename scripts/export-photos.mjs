#!/usr/bin/env node
// Exports the content pass's card pictures, modal photos, popovers and logos
// from Aaron's originals (outside the repo) as the photo export manifest says.
// The manifest is the source of truth: rerun this script, never hand-edit its
// output. It holds local paths, so it stays untracked and is read from the
// command line at run time; no path from it is ever written into the repo.
//
// Photos: auto-oriented from EXIF (crop boxes are in oriented pixels), cropped,
// mirrored where the manifest says, resized without upscaling (card pictures
// 3:4 at 1200 by 1600; modal photos at most 1600 px and popovers at most 800 px
// on the long edge, in their own shape), flattened onto white if they carry
// alpha, then encoded as progressive sRGB JPEG with every metadata block
// dropped, at quality 85, stepping down until the file is under 300,000 bytes.
// A popover the manifest marks "svg" is a vector: it is rendered at the output size (opened at the
// density that lands at or above it, so nothing is stretched), uncropped, then encoded the same way.
// Logos are official files, copied byte for byte.
//
// Nothing is written until every output is encoded and checked. The script owns
// public/photos/cards/, public/photos/pops/ and each public/work/logos/<card>/
// it fills; it removes image files there that the manifest no longer names and
// refuses to run if anything else is in those folders.
//
// Usage: node scripts/export-photos.mjs [manifest] [--out <dir>]
//   manifest defaults to docs/content/photo-export-manifest.json, out to public, both under the repo root
//   wherever the script is run from; an explicit manifest or --out resolves against the current directory.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { BYTE_BUDGET, QUALITIES, cropRegion, exportJobs, outputSize, vectorDensity } from "./photo-export-plan.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
// The sharp Next ships (as scripts/render-posters.mjs uses it); exported for the tests.
export const sharp = createRequire(require.resolve("next/package.json"))("sharp");

async function encodePhoto(job) {
  const source = await sharp(job.source).metadata();
  const region = cropRegion(job.crop, source.autoOrient);
  const size = outputSize(job.kind, region, job.vector);
  for (const quality of QUALITIES) {
    // A vector is opened at the density that renders it at the output size; the manifest never crops
    // one, so there is no box to scale into the rendered pixels.
    let pipeline = job.vector ? sharp(job.source, { density: vectorDensity(region, size) }) : sharp(job.source, { autoOrient: true }).extract(region);
    if (job.flip) pipeline = pipeline.flop();
    pipeline = pipeline.resize(size.width, size.height, { fit: "cover", position: "centre" });
    if (source.hasAlpha) pipeline = pipeline.flatten({ background: "#ffffff" });
    const data = await pipeline.toColourspace("srgb").jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();
    if (data.length > BYTE_BUDGET) continue;
    const written = await sharp(data).metadata();
    if (written.width !== size.width || written.height !== size.height) throw new Error(`${job.out}: wrote ${written.width} by ${written.height}, planned ${size.width} by ${size.height}`);
    if (written.exif || written.icc || written.xmp || written.iptc) throw new Error(`${job.out}: metadata survived the export`);
    return { data, width: size.width, height: size.height, quality };
  }
  throw new Error(`${job.out}: over ${BYTE_BUDGET} bytes even at quality ${QUALITIES.at(-1)}`);
}

async function encodeLogo(job) {
  const data = readFileSync(job.source);
  if (job.source.endsWith(".svg")) return { data, width: null, height: null, quality: null };
  const meta = await sharp(data).metadata();
  return { data, width: meta.width, height: meta.height, quality: null };
}

export async function exportAll(manifest, outDir) {
  const jobs = exportJobs(manifest);
  const results = [];
  for (const job of jobs) results.push({ job, ...(job.kind === "logo" ? await encodeLogo(job) : await encodePhoto(job)) });

  // Only image files a previous run could have written are removed; anything else stops the run
  // before a byte is written (C3 may put the Talos animation beside the logos).
  const owned = new Set(jobs.map((job) => dirname(job.out)));
  const stale = [];
  for (const dir of owned) {
    const full = join(outDir, dir);
    const keep = new Set(jobs.filter((job) => dirname(job.out) === dir).map((job) => job.out.slice(dir.length + 1)));
    for (const entry of existsSync(full) ? readdirSync(full, { withFileTypes: true }) : []) {
      if (keep.has(entry.name) || entry.name.startsWith(".")) continue;
      if (!entry.isFile() || !/\.(?:jpg|svg|png|avif)$/.test(entry.name)) throw new Error(`${join(dir, entry.name)} is not the export's; move it out of ${dir} before rerunning`);
      stale.push(join(full, entry.name));
    }
  }
  for (const dir of owned) mkdirSync(join(outDir, dir), { recursive: true });
  for (const file of stale) rmSync(file);
  for (const result of results) writeFileSync(join(outDir, result.job.out), result.data);
  return results.map(({ job, data, width, height, quality }) => ({ kind: job.kind, out: job.out, width, height, bytes: data.length, quality }));
}

function printTable(rows) {
  if (rows.length === 0) {
    console.log("0 files, 0 bytes");
    return;
  }
  const lines = rows.map((row) => [row.kind, `/${row.out}`, row.width ? `${row.width}x${row.height}` : "svg", String(row.bytes), row.quality ? `q${row.quality}` : "copy"]);
  const widths = lines[0].map((_, column) => Math.max(...lines.map((line) => line[column].length)));
  for (const line of lines) console.log(line.map((cell, column) => (column === 3 ? cell.padStart(widths[column]) : cell.padEnd(widths[column]))).join("  "));
  console.log(`${rows.length} files, ${rows.reduce((sum, row) => sum + row.bytes, 0)} bytes`);
}

async function main() {
  const args = process.argv.slice(2);
  const outFlag = args.indexOf("--out");
  const outDir = outFlag >= 0 ? resolve(args[outFlag + 1] ?? "") : resolve(REPO_ROOT, "public");
  const positional = outFlag >= 0 ? args.filter((_, index) => index !== outFlag && index !== outFlag + 1) : args;
  if ((outFlag >= 0 && !args[outFlag + 1]) || positional.length > 1) {
    console.error("Usage: node scripts/export-photos.mjs [manifest] [--out <dir>]");
    process.exit(1);
  }
  const manifestPath = positional[0] !== undefined ? resolve(positional[0]) : resolve(REPO_ROOT, "docs/content/photo-export-manifest.json");
  const rows = await exportAll(JSON.parse(readFileSync(manifestPath, "utf8")), outDir);
  printTable(rows);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
