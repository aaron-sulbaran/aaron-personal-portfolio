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
