import type { ReactNode } from "react";
import { stickyStyle } from "@/lib/sections/grammar";

// A column whose content holds below the bar while the section's other column
// scrolls past (CSS sticky, desktop only, globals.css), letting go early by
// the grammar's stop offset.
export function StickyColumn({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={["sections-sticky-col", className].filter(Boolean).join(" ")} style={stickyStyle()}>
      <div data-sections-sticky>{children}</div>
    </div>
  );
}
