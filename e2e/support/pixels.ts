import { inflateSync } from "node:zlib";
import type { Page } from "@playwright/test";
import type { ProbePoint } from "./hooks";

// Pixels, with no image library: a PNG decoder for what Chromium's screenshots
// produce (8-bit truecolor, with or without alpha, not interlaced), card
// regions as polygons in viewport px, and the two measures the flight swaps
// are held to: the mean color difference inside the card and how far its edge
// moved.

export type Image = { width: number; height: number; rgba: Uint8Array; png?: Buffer };

export function decodePng(png: Buffer): Image {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const depth = body[8];
      const color = body[9];
      if (depth !== 8 || body[12] !== 0 || (color !== 2 && color !== 6)) {
        throw new Error(`unsupported PNG (depth ${depth}, color ${color}, interlace ${body[12]})`);
      }
      channels = color === 6 ? 4 : 3;
    } else if (type === "IDAT") data.push(body);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = previous[i];
      const corner = i >= channels ? previous[i - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - corner);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      }
      row[i] = (line[i] + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const to = (y * width + x) * 4;
      const from = x * channels;
      out[to] = row[from];
      out[to + 1] = row[from + 1];
      out[to + 2] = row[from + 2];
      out[to + 3] = channels === 4 ? row[from + 3] : 255;
    }
    previous = row;
  }
  return { width, height, rgba: out };
}

export type Box = { x: number; y: number; width: number; height: number };

// A card's region: its bent outline in viewport px (the probe's 64 edge
// points), and the box around it, padded, that a screenshot clips to.
export type CardRegion = { outline: ProbePoint[]; box: Box };

export function cardRegion(outline: ProbePoint[], viewport: { width: number; height: number }, pad = 12): CardRegion {
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  const x = Math.max(0, Math.floor(Math.min(...xs)) - pad);
  const y = Math.max(0, Math.floor(Math.min(...ys)) - pad);
  const right = Math.min(viewport.width, Math.ceil(Math.max(...xs)) + pad);
  const bottom = Math.min(viewport.height, Math.ceil(Math.max(...ys)) + pad);
  return { outline, box: { x, y, width: right - x, height: bottom - y } };
}

export async function shoot(page: Page, box: Box): Promise<Image> {
  const png = await page.screenshot({ clip: box, scale: "css", caret: "initial" });
  return { ...decodePng(png), png };
}

function inside(outline: ProbePoint[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i];
    const b = outline[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function edgeDistance(outline: ProbePoint[], x: number, y: number) {
  let best = Infinity;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[j];
    const b = outline[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(x - a.x - t * dx, y - a.y - t * dy));
  }
  return best;
}

export type SwapDiff = {
  // Mean absolute difference per channel inside the card (3px in from its edge), of 255.
  insideMean: number;
  insideMax: number;
  // How far the card's edge moved, px, from the pixels: at an edge of contrast
  // C against the scene without the card, a shift of d px changes its pixel by
  // about C times d. Only strong edges (C >= 24) within 4px of the outline
  // count. The 99th percentile over the edge: a whole edge sliding moves every
  // edge pixel, while one antialiased pixel resolving differently moves one.
  edgeMovePx: number;
  // The single largest per-pixel estimate and where it was (clipped image px).
  edgeMoveMaxPx: number;
  edgeMoveAt: { x: number; y: number } | null;
  edgePixels: number;
  pixels: number;
};

// a and b: the two sides of a swap; without: the same frame with neither the
// mesh nor the flown card (for the edge contrast). All clipped to region.box.
export function pixelDiff(a: Image, b: Image, without: Image, region: CardRegion): SwapDiff {
  const { box, outline } = region;
  const local = outline.map((p) => ({ x: p.x - box.x, y: p.y - box.y }));
  let sum = 0;
  let max = 0;
  let count = 0;
  const moves: number[] = [];
  let edgeMoveMax = 0;
  let edgeMoveAt: { x: number; y: number } | null = null;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      const i = (y * a.width + x) * 4;
      const d = [0, 1, 2].map((c) => Math.abs(a.rgba[i + c] - b.rgba[i + c]));
      const distance = edgeDistance(local, cx, cy);
      if (inside(local, cx, cy) && distance >= 3) {
        sum += d[0] + d[1] + d[2];
        max = Math.max(max, ...d);
        count += 3;
      }
      if (distance <= 4) {
        const contrast = Math.max(...[0, 1, 2].map((c) => Math.abs(a.rgba[i + c] - without.rgba[i + c])));
        if (contrast < 24) continue;
        const move = Math.max(...d) / contrast;
        moves.push(move);
        if (move > edgeMoveMax) {
          edgeMoveMax = move;
          edgeMoveAt = { x, y };
        }
      }
    }
  }
  moves.sort((p, q) => p - q);
  const p99 = moves.length ? moves[Math.min(moves.length - 1, Math.floor(moves.length * 0.99))] : Number.NaN;
  return {
    insideMean: count ? sum / count : Number.NaN,
    insideMax: max,
    edgeMovePx: p99,
    edgeMoveMaxPx: edgeMoveMax,
    edgeMoveAt,
    edgePixels: moves.length,
    pixels: count / 3,
  };
}

// The largest distance between matching points of two outlines, px.
export function outlineGap(a: ProbePoint[], b: ProbePoint[]) {
  return Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));
}
