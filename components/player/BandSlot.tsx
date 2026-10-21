"use client";

import { forwardRef, type ReactNode } from "react";

// Where the player opens in the band. From md up it floats at the band's right
// edge, on the band's content grid, over the wave and clear of the copy; on
// phones it sits in the flow under the copy. It stays mounted through the
// hand-off to the isle (hidden, not removed) so its box can be measured for
// the morph, and it is inert and invisible whenever it is not the one on show.
// The band's credit line, when it is shown in the band, rides under the card as
// a caption: the card covers the band's lower right, where the line sits.
type Props = { shown: boolean; reduce: boolean; caption: string | null; children: ReactNode };

export const BandSlot = forwardRef<HTMLDivElement, Props>(function BandSlot({ shown, reduce, caption, children }, ref) {
  const fade = reduce ? 200 : 160;
  const visibility = {
    opacity: shown ? 1 : 0,
    visibility: shown ? ("visible" as const) : ("hidden" as const),
    transition: shown ? `opacity ${fade}ms ease` : `opacity ${fade}ms ease, visibility 0s linear ${fade}ms`,
  };
  return (
    <div className="pointer-events-none relative z-20 px-[6vw] pt-3 md:absolute md:inset-x-0 md:top-3.5 md:pt-0" data-lab-band-slot>
      <div className="mx-auto flex max-w-[1240px] justify-end">
        <div className="flex w-full flex-col items-end gap-2 md:w-auto">
          <div ref={ref} inert={!shown} className="pointer-events-auto w-full md:w-auto" style={visibility}>
            {children}
          </div>
          {caption && (
            <p data-lab-credit-caption className="font-label text-label-sm leading-[1.5] text-muted" style={visibility}>
              {caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
