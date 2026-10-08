// The AS mark from public/brand/, inlined in currentColor so it reads ink in
// light and paper in dark through the text token. It is always the full mark,
// the bolt with the A beneath it (Aaron, 2026-09-29, overriding the earlier
// bolt-alone rule under 24px). "square" keeps the brand files' padded square
// box (the nav); "tight" crops to the ink so the mark fills a small slot, as
// in the Menu pill's hover odometer.
import { BAR_D, BOLT_D, LEG_D, VIEW_BOX } from "@/lib/mark/geometry";

const VIEW_BOXES = {
  square: VIEW_BOX,
  tight: "51.69 22.62 144.92 210.76",
} as const;

export function AsMark({ className, fit = "square" }: { className?: string; fit?: keyof typeof VIEW_BOXES }) {
  return (
    <svg viewBox={VIEW_BOXES[fit]} aria-hidden="true" focusable="false" className={className}>
      <path d={BOLT_D} fill="currentColor" />
      <path d={LEG_D} fill="currentColor" />
      <path d={BAR_D} fill="currentColor" />
    </svg>
  );
}
