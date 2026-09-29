import { getImageProps } from "next/image";
import type { HomeTile } from "@/lib/content";
import { COIL } from "./constants";
import { toBytes, toCanvasColor, type CoilTheme } from "./theme";

// Card faces, painted on 2D canvases from the theme tokens, ported from hero
// lab 2 (391-516) at Aaron's picks: photo fronts in true color inside our
// pane; work fronts on --card-work-pane with the logo from public/work/logos;
// photo backs a duotone of the photo in the accent (--card-duo-dark to
// --card-duo-light); work backs the plain pane, no logo (a mirrored mark reads
// as backwards text). Every paint returns fresh canvases, so a repaint uploads
// into a fresh texture and the old one is disposed, never rewritten in place.

const [TEX_W, TEX_H] = COIL.lab.textureSize;
const RADIUS = Math.round(0.05 * TEX_W);
const INSET = Math.round(0.034 * TEX_W);

export const CARD_TEXTURE_SIZE = { width: TEX_W, height: TEX_H } as const;

// A card's decoded sources, loaded once per scene and kept for repaints.
// A photo that failed to load is null and paints the plain pane.
export type CardSource =
  | { kind: "photo"; key: string; image: HTMLImageElement | null }
  | { kind: "work"; key: string; logo: HTMLImageElement | null };

export type CardFaces = { front: HTMLCanvasElement; back: HTMLCanvasElement };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const smooth = (x: number) => x * x * (3 - 2 * x);

// ---------------------------------------------------------------- loading

// next/image optimizer URLs for a photo at the card's texture width (1x) and
// the next size up (2x), cover-cropped to the card aspect at paint time.
export function photoUrls(src: string): { base: string; large: string } {
  const { props } = getImageProps({ src, alt: "", width: TEX_W, height: TEX_H, quality: 75 });
  const entries = (props.srcSet ?? "").split(", ").map((entry) => entry.split(" ")[0]).filter(Boolean);
  const base = entries[0] ?? props.src;
  return { base, large: entries[entries.length - 1] ?? base };
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      img.decode().then(
        () => resolve(img),
        () => resolve(img),
      );
    };
    img.onerror = () => reject(new Error(`card image failed: ${url}`));
    img.src = url;
  });
}

// The pixels the inset photo actually needs, against what the image carries.
function coverScale(img: HTMLImageElement) {
  const w = TEX_W - INSET * 2;
  const h = TEX_H - INSET * 2;
  return Math.max(w / img.naturalWidth, h / img.naturalHeight);
}

// A photo at the 1x width; a landscape photo that would upscale more than a
// fifth when cover-cropped to 3:4 fetches the larger size instead. Resolves
// null on failure (the card paints its plain pane).
export async function loadPhoto(src: string): Promise<HTMLImageElement | null> {
  const { base, large } = photoUrls(src);
  try {
    const img = await loadImage(base);
    if (coverScale(img) <= 1.2 || large === base) return img;
    return await loadImage(large).catch(() => img);
  } catch {
    return null;
  }
}

export async function loadCardSource(tile: HomeTile, logoFor: (slug: string) => string | null): Promise<CardSource> {
  if (tile.kind === "photo") return { kind: "photo", key: tile.key, image: await loadPhoto(tile.src) };
  const logoSrc = logoFor(tile.slug);
  const logo = logoSrc ? await loadImage(logoSrc).catch(() => null) : null;
  return { kind: "work", key: tile.key, logo };
}

// ---------------------------------------------------------------- painting

function context(canvas: HTMLCanvasElement, readBack = false) {
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const g = canvas.getContext("2d", readBack ? { willReadFrequently: true } : undefined);
  if (!g) throw new Error("2d context unavailable");
  return g;
}

function shapeCard(g: CanvasRenderingContext2D, fill: string) {
  g.clearRect(0, 0, TEX_W, TEX_H);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, TEX_W, TEX_H, RADIUS);
  g.clip();
  g.fillStyle = fill;
  g.fillRect(0, 0, TEX_W, TEX_H);
}

// The rim: a hairline at the edge and a flat highlight just inside it.
function finishCard(g: CanvasRenderingContext2D, theme: CoilTheme) {
  g.restore();
  g.lineWidth = 2;
  g.strokeStyle = toCanvasColor(theme.card.hair);
  g.beginPath();
  g.roundRect(1, 1, TEX_W - 2, TEX_H - 2, RADIUS);
  g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = toCanvasColor(theme.card.hi);
  g.beginPath();
  g.roundRect(3.5, 3.5, TEX_W - 7, TEX_H - 7, Math.max(2, RADIUS - 2.5));
  g.stroke();
}

function drawCover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  // A touch above center: faces sit high in most of these photos.
  const sy = clamp((img.naturalHeight - sh) * 0.42, 0, img.naturalHeight - sh);
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

const INNER_RADIUS = Math.max(3, RADIUS - INSET * 0.6);

function insetPhoto(g: CanvasRenderingContext2D, img: HTMLImageElement) {
  g.save();
  g.beginPath();
  g.roundRect(INSET, INSET, TEX_W - INSET * 2, TEX_H - INSET * 2, INNER_RADIUS);
  g.clip();
  drawCover(g, img, INSET, INSET, TEX_W - INSET * 2, TEX_H - INSET * 2);
  g.restore();
}

function paintPhotoFront(g: CanvasRenderingContext2D, img: HTMLImageElement | null, theme: CoilTheme) {
  shapeCard(g, toCanvasColor(theme.card.pane));
  if (img) {
    insetPhoto(g, img);
    g.lineWidth = 1.5;
    g.strokeStyle = toCanvasColor(theme.card.hair);
    g.beginPath();
    g.roundRect(INSET + 0.75, INSET + 0.75, TEX_W - INSET * 2 - 1.5, TEX_H - INSET * 2 - 1.5, INNER_RADIUS);
    g.stroke();
  }
  finishCard(g, theme);
}

// Our pane with the logo centered. The logo files are drawn as they are;
// real single-color marks (paper in dark) arrive with slice 8.
function paintWorkFront(g: CanvasRenderingContext2D, logo: HTMLImageElement | null, theme: CoilTheme) {
  shapeCard(g, toCanvasColor(theme.card.workPane));
  if (logo) {
    const size = TEX_W * 0.4;
    const aspect = logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 1;
    const w = aspect >= 1 ? size : size * aspect;
    const h = aspect >= 1 ? size / aspect : size;
    g.drawImage(logo, (TEX_W - w) / 2, (TEX_H - h) / 2, w, h);
  }
  finishCard(g, theme);
}

// The photo's luminance mapped between the two duotone endpoints, pane and
// all (lab 485-496), then the rim on top.
function paintPhotoBack(g: CanvasRenderingContext2D, img: HTMLImageElement, theme: CoilTheme) {
  shapeCard(g, toCanvasColor(theme.card.duoLight));
  insetPhoto(g, img);
  const a = toBytes(theme.card.duoDark);
  const b = toBytes(theme.card.duoLight);
  const data = g.getImageData(0, 0, TEX_W, TEX_H);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const luminance = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const l = smooth(clamp01((luminance - 0.06) / 0.88));
    d[i] = a[0] + (b[0] - a[0]) * l;
    d[i + 1] = a[1] + (b[1] - a[1]) * l;
    d[i + 2] = a[2] + (b[2] - a[2]) * l;
  }
  g.putImageData(data, 0, 0);
  finishCard(g, theme);
}

function paintPlainBack(g: CanvasRenderingContext2D, fill: string, theme: CoilTheme) {
  shapeCard(g, fill);
  finishCard(g, theme);
}

export function paintCard(source: CardSource, theme: CoilTheme): CardFaces {
  const front = document.createElement("canvas");
  const back = document.createElement("canvas");
  const f = context(front);
  if (source.kind === "photo") {
    paintPhotoFront(f, source.image, theme);
    if (source.image) paintPhotoBack(context(back, true), source.image, theme);
    else paintPlainBack(context(back), toCanvasColor(theme.card.pane), theme);
  } else {
    paintWorkFront(f, source.logo, theme);
    paintPlainBack(context(back), toCanvasColor(theme.card.workBack), theme);
  }
  return { front, back };
}

// The name mask: the name in white on a transparent canvas at `scale` device
// px per CSS px, padded so the glyphs never touch the edge (lab 809-826).
export type NameMask = {
  canvas: HTMLCanvasElement;
  width: number; // CSS px, padding included
  height: number;
  pad: number;
  left: number; // actualBoundingBoxLeft
  ascent: number;
  descent: number;
};

export function paintNameMask(text: string, fontFamily: string, sizePx: number, scale: number): NameMask {
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2d context unavailable");
  const font = `900 ${sizePx}px ${fontFamily}`;
  g.font = font;
  const m = g.measureText(text);
  const pad = Math.ceil(sizePx * 0.04);
  const width = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight + pad * 2);
  const height = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + pad * 2);
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.clearRect(0, 0, width, height);
  g.font = font;
  g.fillStyle = "white";
  g.textBaseline = "alphabetic";
  g.fillText(text, pad + m.actualBoundingBoxLeft, pad + m.actualBoundingBoxAscent);
  return {
    canvas,
    width,
    height,
    pad,
    left: m.actualBoundingBoxLeft,
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent,
  };
}
