"use client";

import { forwardRef, type ReactNode } from "react";

// Where the player opens in the band. From md up it floats at the band's right
// edge, on the band's content grid, over the wave and clear of the copy; on
// phones it sits in the flow under the copy. It stays mounted through the
// hand-off to the isle (hidden, not removed) so its box can be measured for
// the morph, and it is inert and invisible whenever it is not the one on show.
type Props = { shown: boolean; reduce: boolean; children: ReactNode };

export const BandSlot = forwardRef<HTMLDivElement, Props>(function BandSlot({ shown, reduce, children }, ref) {
  const fade = reduce ? 200 : 160;
  return (
    <div className="pointer-events-none relative z-20 px-[6vw] pt-3 md:absolute md:inset-x-0 md:top-3.5 md:pt-0" data-lab-band-slot>
      <div className="mx-auto flex max-w-[1240px] justify-end">
        <div
          ref={ref}
          inert={!shown}
          className="pointer-events-auto w-full md:w-auto"
          style={{
            opacity: shown ? 1 : 0,
            visibility: shown ? "visible" : "hidden",
            transition: shown ? `opacity ${fade}ms ease` : `opacity ${fade}ms ease, visibility 0s linear ${fade}ms`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
});
