"use client";

import { useId } from "react";
import { AsMark } from "@/components/menu/BrandMark";
import { CEL_PICK } from "@/lib/mark/constants";
import { VIEW_BOX } from "@/lib/mark/geometry";

// The card's mark: an empty cel layer the strike timeline redraws frame by
// frame, the blurs it references, and the real AsMark on top, which is the
// settled frame. The core and glow are the loader's always-dark tokens.
// Reduced motion renders AsMark alone.
const REGION = { filterUnits: "userSpaceOnUse" as const, x: -160, y: -160, width: 580, height: 580 };

export function MarkStrike({ sizePx, reduced }: { sizePx: number; reduced: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <div data-mark-strike="" data-mode={reduced ? "static" : "cel"} className="relative shrink-0" style={{ width: sizePx, height: sizePx }}>
      {!reduced && (
        <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <filter id={`${id}-glow`} {...REGION}>
              <feGaussianBlur stdDeviation={CEL_PICK.celGlowRadius} />
            </filter>
            <filter id={`${id}-wide`} {...REGION}>
              <feGaussianBlur stdDeviation={CEL_PICK.celGlowRadius * 2.8} />
            </filter>
            <filter id={`${id}-pool`} {...REGION}>
              <feGaussianBlur stdDeviation="9 2.2" />
            </filter>
            <filter id={`${id}-bloom`} {...REGION}>
              <feGaussianBlur stdDeviation="26" />
            </filter>
          </defs>
          <g
            data-part="cel"
            data-glow={`${id}-glow`}
            data-wide={`${id}-wide`}
            data-pool={`${id}-pool`}
            data-bloom={`${id}-bloom`}
            className="[--cel-core:var(--loader-name)] [--cel-glow:var(--loader-fill)]"
          />
        </svg>
      )}
      <div data-part="rest" className="absolute inset-0 text-foreground">
        <AsMark className="block h-full w-full" />
      </div>
    </div>
  );
}
