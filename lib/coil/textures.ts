import { getImageProps } from "next/image";
import type { HomeTile, LogoRef, StrandCard } from "@/lib/content";
import { BAR_D, BOLT_D, LEG_D } from "@/lib/mark/geometry";
import { COIL } from "./constants";
import { toBytes, toCanvasColor, type CoilTheme, type Rgba } from "./theme";
import { cardDims, circlesLayout, containBox, logoBox, MARK_INK_BOX, needsGround, type CardDims, type TextureSize } from "./cardFace";

// Card faces, painted on 2D canvases from the theme tokens, ported from hero
// lab 2 (391-516) at Aaron's picks: photo fronts in true color inside our
// pane; work fronts on --card-work-pane with the logo from public/work/logos;
// photo backs a duotone of the photo in the accent (--card-duo-dark to
// --card-duo-light); work backs the plain pane, no logo (a mirrored mark reads
// as backwards text). Every paint returns fresh canvases, so a repaint uploads
// into a fresh texture and the old one is disposed, never rewritten in place.
//
// Every paint takes the texture size from the scene's render budget (see
// lib/coil/drivers.ts): 384x512 on fine pointers, smaller on coarse ones.

export type { TextureSize };
type Dims = CardDims;
const dimsFor = cardDims;

const DESKTOP = dimsFor(COIL.lab.textureSize);

export const CARD_TEXTURE_SIZE = { width: DESKTOP.w, height: DESKTOP.h } as const;

export type LogoImage = { image: HTMLImageElement | null; aspect: number };

// A card's decoded sources, loaded once per scene and kept for repaints (a theme
// change picks a logo's dark file at paint time). A file that failed to load is
// null and paints the plain pane. "work" is the legacy tile's, until the scene
// moves to the fourteen (Task 9 deletes it with loadCardSource and paintWorkFront).
export type CardSource =
  | { kind: "photo"; key: string; image: HTMLImageElement | null }
  | { kind: "work"; key: string; logo: HTMLImageElement | null }
  | { kind: "logo"; key: string; light: HTMLImageElement | null; dark: HTMLImageElement | null; logo: LogoRef; tile: "plain" | "anvil" }
  | { kind: "mark"; key: string }
  | { kind: "circles"; key: string; logos: LogoImage[] };

export type CardFaces = { front: HTMLCanvasElement; back: HTMLCanvasElement };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const smooth = (x: number) => x * x * (3 - 2 * x);

// ---------------------------------------------------------------- loading

// next/image optimizer URLs for a photo at the card's texture width (1x) and
// the next size up (2x), cover-cropped to the card aspect at paint time.
export function photoUrls(src: string, size: TextureSize = COIL.lab.textureSize): { base: string; large: string } {
  const { props } = getImageProps({ src, alt: "", width: size[0], height: size[1], quality: 75 });
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
function coverScale(img: HTMLImageElement, d: Dims) {
  const w = d.w - d.inset * 2;
  const h = d.h - d.inset * 2;
  return Math.max(w / img.naturalWidth, h / img.naturalHeight);
}

// A photo at the 1x width; a landscape photo that would upscale more than a
// fifth when cover-cropped to 3:4 fetches the larger size instead. Resolves
// null on failure (the card paints its plain pane).
export async function loadPhoto(src: string, size: TextureSize = COIL.lab.textureSize): Promise<HTMLImageElement | null> {
  const { base, large } = photoUrls(src, size);
  try {
    const img = await loadImage(base);
    if (coverScale(img, dimsFor(size)) <= 1.2 || large === base) return img;
    return await loadImage(large).catch(() => img);
  } catch {
    return null;
  }
}

export async function loadCardSource(
  tile: HomeTile,
  logoFor: (slug: string) => string | null,
  size: TextureSize = COIL.lab.textureSize,
): Promise<CardSource> {
  if (tile.kind === "photo") return { kind: "photo", key: tile.key, image: await loadPhoto(tile.src, size) };
  const logoSrc = logoFor(tile.slug);
  const logo = logoSrc ? await loadImage(logoSrc).catch(() => null) : null;
  return { kind: "work", key: tile.key, logo };
}

// A raster logo goes through the image optimizer at the texture's width (the
// IEEE square is a 525KB JPEG); an SVG is served as it is.
function loadLogo(src: string, size: TextureSize): Promise<HTMLImageElement | null> {
  const url = src.endsWith(".svg") ? src : photoUrls(src, [size[0], size[0]]).base;
  return loadImage(url).catch(() => null);
}

export async function loadStrandSource(card: StrandCard, size: TextureSize = COIL.lab.textureSize): Promise<CardSource> {
  const { key, face } = card;
  switch (face.kind) {
    case "photo":
      return { kind: "photo", key, image: await loadPhoto(face.src, size) };
    case "logo": {
      const [light, dark] = await Promise.all([loadLogo(face.logo.src, size), face.logo.srcDark ? loadLogo(face.logo.srcDark, size) : Promise.resolve(null)]);
      return { kind: "logo", key, light, dark, logo: face.logo, tile: face.tile };
    }
    case "mark":
      return { kind: "mark", key };
    case "circles":
      return { kind: "circles", key, logos: await Promise.all(face.logos.map(async (logo) => ({ image: await loadLogo(logo.src, size), aspect: logo.width / logo.height }))) };
  }
}

// What a card paints when its files never arrive (the loader's give-up time).
export function emptySource(card: StrandCard): CardSource {
  const { key, face } = card;
  switch (face.kind) {
    case "photo":
      return { kind: "photo", key, image: null };
    case "logo":
      return { kind: "logo", key, light: null, dark: null, logo: face.logo, tile: face.tile };
    case "mark":
      return { kind: "mark", key };
    case "circles":
      return { kind: "circles", key, logos: face.logos.map((logo) => ({ image: null, aspect: logo.width / logo.height })) };
  }
}

// ---------------------------------------------------------------- painting

function context(canvas: HTMLCanvasElement, d: Dims, readBack = false) {
  canvas.width = d.w;
  canvas.height = d.h;
  const g = canvas.getContext("2d", readBack ? { willReadFrequently: true } : undefined);
  if (!g) throw new Error("2d context unavailable");
  return g;
}

function shapeCard(g: CanvasRenderingContext2D, d: Dims, fill: string) {
  g.clearRect(0, 0, d.w, d.h);
  g.save();
  g.beginPath();
  g.roundRect(0, 0, d.w, d.h, d.radius);
  g.clip();
  g.fillStyle = fill;
  g.fillRect(0, 0, d.w, d.h);
}

// The rim: a hairline at the edge and a flat highlight just inside it.
function finishCard(g: CanvasRenderingContext2D, d: Dims, theme: CoilTheme) {
  g.restore();
  g.lineWidth = 2;
  g.strokeStyle = toCanvasColor(theme.card.hair);
  g.beginPath();
  g.roundRect(1, 1, d.w - 2, d.h - 2, d.radius);
  g.stroke();
  g.lineWidth = 1.5;
  g.strokeStyle = toCanvasColor(theme.card.hi);
  g.beginPath();
  g.roundRect(3.5, 3.5, d.w - 7, d.h - 7, Math.max(2, d.radius - 2.5));
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

function insetPhoto(g: CanvasRenderingContext2D, d: Dims, img: HTMLImageElement) {
  g.save();
  g.beginPath();
  g.roundRect(d.inset, d.inset, d.w - d.inset * 2, d.h - d.inset * 2, d.innerRadius);
  g.clip();
  drawCover(g, img, d.inset, d.inset, d.w - d.inset * 2, d.h - d.inset * 2);
  g.restore();
}

function paintPhotoFront(g: CanvasRenderingContext2D, d: Dims, img: HTMLImageElement | null, theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(theme.card.pane));
  if (img) {
    insetPhoto(g, d, img);
    g.lineWidth = 1.5;
    g.strokeStyle = toCanvasColor(theme.card.hair);
    g.beginPath();
    g.roundRect(d.inset + 0.75, d.inset + 0.75, d.w - d.inset * 2 - 1.5, d.h - d.inset * 2 - 1.5, d.innerRadius);
    g.stroke();
  }
  finishCard(g, d, theme);
}

// Our pane with the logo centered. The logo files are drawn as they are;
// real single-color marks (paper in dark) arrive with slice 8.
function paintWorkFront(g: CanvasRenderingContext2D, d: Dims, logo: HTMLImageElement | null, theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(theme.card.workPane));
  if (logo) {
    const size = d.w * 0.4;
    const aspect = logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : 1;
    const w = aspect >= 1 ? size : size * aspect;
    const h = aspect >= 1 ? size / aspect : size;
    g.drawImage(logo, (d.w - w) / 2, (d.h - h) / 2, w, h);
  }
  finishCard(g, d, theme);
}

// A logo on its pane (the anvil for Talos): the opaque IEEE square as the face, at
// the photo inset's width; any other logo centred at its fit, on a light plate
// where the dark theme needs one (cardFace.ts needsGround).
function paintLogoFront(g: CanvasRenderingContext2D, d: Dims, source: Extract<CardSource, { kind: "logo" }>, theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(source.tile === "anvil" ? theme.card.anvil : theme.card.workPane));
  const image = theme.dark && source.dark ? source.dark : source.light;
  const aspect = source.logo.width / source.logo.height;
  if (image && source.logo.opaque) {
    const box = containBox(aspect, d.w - d.inset * 2);
    const x = (d.w - box.w) / 2;
    const y = (d.h - box.h) / 2;
    g.save();
    g.beginPath();
    g.roundRect(x, y, box.w, box.h, d.innerRadius);
    g.clip();
    g.drawImage(image, x, y, box.w, box.h);
    g.restore();
  } else if (image) {
    const box = logoBox(aspect, d.w, COIL.face);
    const x = (d.w - box.w) / 2;
    const y = (d.h - box.h) / 2;
    if (needsGround(source.logo, source.tile, theme.dark)) {
      const pad = d.w * COIL.face.plateInset;
      g.fillStyle = toCanvasColor(theme.card.logoGround);
      g.beginPath();
      g.roundRect(x - pad, y - pad, box.w + pad * 2, box.h + pad * 2, d.innerRadius);
      g.fill();
    }
    g.drawImage(image, x, y, box.w, box.h);
  }
  finishCard(g, d, theme);
}

// This site: the AS mark in the accent, centred.
function paintMarkFront(g: CanvasRenderingContext2D, d: Dims, theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(theme.card.workPane));
  const width = d.w * COIL.face.markWidth;
  const scale = width / MARK_INK_BOX.width;
  g.save();
  g.translate((d.w - width) / 2 - MARK_INK_BOX.x * scale, (d.h - MARK_INK_BOX.height * scale) / 2 - MARK_INK_BOX.y * scale);
  g.scale(scale, scale);
  g.fillStyle = toCanvasColor(theme.card.mark);
  for (const path of [BOLT_D, LEG_D, BAR_D]) g.fill(new Path2D(path));
  g.restore();
  finishCard(g, d, theme);
}

// The jobs card: light discs growing up the diagonal, each with its employer's
// logo (the light file in both themes: the disc is its ground).
function paintCirclesFront(g: CanvasRenderingContext2D, d: Dims, logos: readonly LogoImage[], theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(theme.card.workPane));
  circlesLayout(logos.length, d.w / d.h, COIL.face.circles).forEach((circle, i) => {
    const cx = circle.x * d.w;
    const cy = circle.y * d.w;
    const r = circle.r * d.w;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = toCanvasColor(theme.card.logoGround);
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = toCanvasColor(theme.card.hair);
    g.stroke();
    const { image, aspect } = logos[i];
    if (!image) return;
    const box = containBox(aspect, 2 * r * COIL.face.circles.logo);
    g.drawImage(image, cx - box.w / 2, cy - box.h / 2, box.w, box.h);
  });
  finishCard(g, d, theme);
}

// The photo's luminance mapped between the two duotone endpoints, pane and
// all (lab 485-496), then the rim on top.
function paintPhotoBack(g: CanvasRenderingContext2D, d: Dims, img: HTMLImageElement, theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(theme.card.duoLight));
  insetPhoto(g, d, img);
  const a = toBytes(theme.card.duoDark);
  const b = toBytes(theme.card.duoLight);
  const data = g.getImageData(0, 0, d.w, d.h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const luminance = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    const l = smooth(clamp01((luminance - 0.06) / 0.88));
    px[i] = a[0] + (b[0] - a[0]) * l;
    px[i + 1] = a[1] + (b[1] - a[1]) * l;
    px[i + 2] = a[2] + (b[2] - a[2]) * l;
  }
  g.putImageData(data, 0, 0);
  finishCard(g, d, theme);
}

function paintPlainBack(g: CanvasRenderingContext2D, d: Dims, fill: string, theme: CoilTheme) {
  shapeCard(g, d, fill);
  finishCard(g, d, theme);
}

// A file that failed or timed out (image null) paints the plain pane.
export function paintCard(source: CardSource, theme: CoilTheme, size: TextureSize = COIL.lab.textureSize): CardFaces {
  const d = size === COIL.lab.textureSize ? DESKTOP : dimsFor(size);
  const front = document.createElement("canvas");
  const back = document.createElement("canvas");
  const f = context(front, d);
  const plainBack = (fill: Rgba) => paintPlainBack(context(back, d), d, toCanvasColor(fill), theme);
  switch (source.kind) {
    case "photo":
      paintPhotoFront(f, d, source.image, theme);
      if (source.image) paintPhotoBack(context(back, d, true), d, source.image, theme);
      else plainBack(theme.card.pane);
      break;
    case "work":
      paintWorkFront(f, d, source.logo, theme);
      plainBack(theme.card.workBack);
      break;
    case "logo":
      paintLogoFront(f, d, source, theme);
      plainBack(source.tile === "anvil" ? theme.card.anvil : theme.card.workBack);
      break;
    case "mark":
      paintMarkFront(f, d, theme);
      plainBack(theme.card.workBack);
      break;
    case "circles":
      paintCirclesFront(f, d, source.logos, theme);
      plainBack(theme.card.workBack);
      break;
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
