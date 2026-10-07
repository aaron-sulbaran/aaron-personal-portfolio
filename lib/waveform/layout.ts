import type { DotLayout } from "./dots";

// The one phone breakpoint for the soundtrack surface (the band, its canvas
// and the pill), matching Tailwind's md boundary at 768px.
export const PHONE_MAX_PX = 767;
export const PHONE_QUERY = `(max-width: ${PHONE_MAX_PX}px)`;

// The phone query as a store for useSyncExternalStore (client only; pass
// `() => true` as the server snapshot so nothing phone-gated renders on the server).
export const subscribePhone = (onChange: () => void) => {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
export const isPhone = () => window.matchMedia(PHONE_QUERY).matches;

// A band of dots gains nothing past 1.5x density; capping it keeps the canvas
// under a third of the pixels a 3x phone would otherwise allocate.
export const DPR_CAP = 1.5;

const SPACING_DESKTOP = 13;
const SPACING_PHONE = 16;
// Max amplitude as a share of the band's height: the idle drift fills about
// a fifth of the band, as in Aaron's sketch; the loudest peaks may clip.
const AMPLITUDE = 0.42;

// Column grid for a canvas of `width` by `height` css px: columns run the full
// width, centered, on the band's horizontal midline.
export function bandLayout(width: number, height: number): DotLayout {
  const spacing = width <= PHONE_MAX_PX ? SPACING_PHONE : SPACING_DESKTOP;
  const columns = Math.max(0, Math.floor(width / spacing));
  return {
    columns,
    spacing,
    startX: (width - columns * spacing) / 2 + spacing / 2,
    baseline: height / 2,
    maxAmp: height * AMPLITUDE,
  };
}
