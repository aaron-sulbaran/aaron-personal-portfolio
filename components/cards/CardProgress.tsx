"use client";

import { siteContent } from "@/lib/content";
import { useSeen } from "@/lib/home/seen";

// "N of 14 opened" and a thin accent bar, read from the seen store (the same
// set the dots and the Coil's rings read). Under the Work column on a desktop,
// under the two columns on a phone (CardColumns places the one for each).
// Hidden until the first card is opened: its room is kept, so nothing moves when
// it appears, and it is out of the accessibility tree while it is hidden (and,
// hidden, it does not move the logo aside: components/SiteLogo.tsx). The
// bar grows by transform only. A card counts once, at close, as ever.
const TOTAL = siteContent.columns.order.reduce((sum, column) => sum + column.groups.reduce((n, group) => n + group.titles.length, 0), 0);
const KEYS = new Set(siteContent.columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles.map((title) => title.key))));

export function CardProgress({ className = "" }: { className?: string }) {
  const seen = useSeen();
  let opened = 0;
  seen.forEach((key) => {
    if (KEYS.has(key as never)) opened += 1;
  });
  const shown = opened > 0;
  return (
    <div
      data-card-progress=""
      data-logo-clear={shown ? "" : undefined}
      aria-hidden={shown ? undefined : true}
      className={`transition-opacity duration-500 ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"} ${className}`}
    >
      <p aria-live="polite" className="font-label text-label-sm text-accent">
        {siteContent.columns.progress(opened, TOTAL)}
      </p>
      <div role="presentation" className="mt-1.5 h-[3px] w-full max-w-[9.5rem] overflow-hidden rounded-full bg-border">
        <div data-card-progress-bar="" className="h-full origin-left rounded-full bg-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none" style={{ transform: `scaleX(${opened / TOTAL})` }} />
      </div>
    </div>
  );
}
