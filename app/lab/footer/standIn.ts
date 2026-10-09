import { FIELD } from "@/lib/coil/field.glsl";
import type { FieldTokens } from "./tokens";

// The poster stand-in, for a browser without WebGL 2 (Aaron's Chrome has
// graphics acceleration off): the hero's poster (public/coil/field-*.avif,
// 1440 by 900, the live field's first frame on the hero's drift) recolored
// with the field's intensity law and drifted by CSS. The poster carries the
// hero's seam fade in its last 14 percent; the footer draws its own endings.

export const POSTER_CROP = 1 - FIELD.seamFade;
export const STANDIN_WIDTH = 480;

export type Box = { x: number; y: number; w: number; h: number };

// Where the poster lands on a canvas `w` by `h`, and which share of its
// height is drawn. Footer: its top 86 percent stretched over the canvas, as
// rounds 1 to 3 drew it. Hero: the whole poster covering the hero's frame
// (the canvas's width and the viewport's height, `frameH`, at the canvas's
// scale), centered across, its middle on the word's middle (`midY`), as the
// live hero backdrop frames the field; its seam fade falls far below the
// footer's bottom.
export function posterBox(mode: "hero" | "footer", w: number, h: number, posterW: number, posterH: number, frameH: number, midY: number): Box & { crop: number } {
  if (mode === "footer") return { x: 0, y: 0, w, h, crop: POSTER_CROP };
  const scale = Math.max(w / posterW, frameH / posterH);
  const dw = posterW * scale;
  const dh = posterH * scale;
  return { x: (w - dw) / 2, y: midY - dh / 2, w: dw, h: dh, crop: 1 };
}

export function drawStandIn(ctx: CanvasRenderingContext2D, image: HTMLImageElement, box: Box & { crop: number }, tokens: FieldTokens, intensity: number) {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight * box.crop, box.x, box.y, box.w, box.h);
  if (intensity === 1) return;
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;
  const paper = tokens.paper.map((c) => c * 255);
  for (let i = 0; i < px.length; i += 4) {
    for (let c = 0; c < 3; c++) px[i + c] = Math.max(0, Math.min(255, paper[c] + (px[i + c] - paper[c]) * intensity));
  }
  ctx.putImageData(data, 0, 0);
}
