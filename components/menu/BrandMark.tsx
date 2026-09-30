// The AS mark from public/brand/, inlined in currentColor so it reads ink in
// light and paper in dark through the text token. It is always the full mark,
// the bolt with the A beneath it (Aaron, 2026-09-29, overriding the earlier
// bolt-alone rule under 24px). "square" keeps the brand files' padded square
// box (the nav); "tight" crops to the ink so the mark fills a small slot, as
// in the Menu pill's hover odometer.
const VIEW_BOX = {
  square: "2.49 6.34 243.32 243.32",
  tight: "51.69 22.62 144.92 210.76",
} as const;

export function AsMark({ className, fit = "square" }: { className?: string; fit?: keyof typeof VIEW_BOX }) {
  return (
    <svg viewBox={VIEW_BOX[fit]} aria-hidden="true" focusable="false" className={className}>
      <path d="M90.29 83.58L162.35 23.12L134.45 92.18L196.11 105.28L131.2 229.2L160.4 129.67L78.69 112.3Z" fill="currentColor" />
      <path d="M151.62 133.45L52.19 232.88L65.2 232.88L132.65 165.43L122.98 198.37L123.53 229.2Z" fill="currentColor" />
      <path d="M102.4 189.17L135.27 189.17L132.57 198.37L93.2 198.37Z" fill="currentColor" />
    </svg>
  );
}
