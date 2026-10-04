import { DPR_CAP } from "@/lib/waveform/layout";

// What the band view (waveView.ts) and the horizon view (horizonView.ts)
// share: the colors read once per theme, the batched dot fills, the canvas
// sizing and the pointer. The track each lays per frame is lib/waveform/track.ts.

export type Theme = "light" | "dark";
export type Alphas = { muted: number; accent: number };

export const themeNow = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function createDotPainter(ctx: CanvasRenderingContext2D) {
  const colors = { muted: "rgb(136,136,136)", accent: "rgb(127,168,201)" };
  return {
    colors,
    // The tokens are read once per theme, never at frame time.
    readColors() {
      const style = getComputedStyle(document.documentElement);
      const toRgb = (hex: string, fallback: string) => {
        if (!hex.startsWith("#")) return fallback;
        const n = parseInt(hex.slice(1), 16);
        return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
      };
      colors.muted = toRgb(style.getPropertyValue("--color-muted").trim(), colors.muted);
      colors.accent = toRgb(style.getPropertyValue("--color-accent").trim(), colors.accent);
    },
    fill(dots: number[], color: string, alpha: number) {
      if (!dots.length) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let k = 0; k < dots.length; k += 3) {
        // moveTo the circle's right edge first so the batched path never joins
        // consecutive dots with a stray chord.
        ctx.moveTo(dots[k] + dots[k + 2], dots[k + 1]);
        ctx.arc(dots[k], dots[k + 1], dots[k + 2], 0, Math.PI * 2);
      }
      ctx.fill();
    },
  };
}

export function sizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number, height: number) {
  // DPR_CAP: a band of dots gains nothing past 1.5x density.
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// The latest pointer position for a fine pointer; `onChange` wakes the loop.
export function trackPointer(fine: boolean, onChange: () => void) {
  const pointer = { x: -1e4, y: -1e4, on: false };
  const onMove = (event: PointerEvent) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.on = true;
    onChange();
  };
  const onLeave = () => {
    pointer.on = false;
    // Wake a stopped loop so a carve under a cursor that left the window eases out.
    onChange();
  };
  if (fine) {
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
  }
  return {
    pointer,
    dispose() {
      if (!fine) return;
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    },
  };
}
