"use client";

import { useState } from "react";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";
import { DOCK } from "@/lib/waveform/dock";

// Whether the reader has scrolled past the band: its bottom edge is above the
// dock line (DOCK.passedPx from the viewport's top). Read from the scroll
// position by one ScrollTrigger, not from visibility, so a jump that crosses
// the band in one step (an instant anchor under reduced motion, a deep load)
// still flips it both ways. Creation and every refresh read it directly, so a
// load that starts past the band is passed with no scroll.
//
// Passed is read as "scroll at or past start", never isActive: the end stays
// the default, and every crossing of start fires one of the four callbacks (a
// jump over the whole range fires onEnter then onLeave, and back, onEnterBack
// then onLeaveBack). An end of "max" would be wrong: the trigger is created
// under the entrance's scroll lock, when the max scroll is 0, so it resolves
// to start + 1 until the next refresh.
export function useBandPassed(): boolean {
  const [passed, setPassed] = useState(false);

  useGSAP(() => {
    const read = (self: ScrollTrigger) => setPassed(self.scroll() >= self.start);
    const st = ScrollTrigger.create({
      trigger: "#listen",
      start: `bottom ${DOCK.passedPx}px`,
      onEnter: read,
      onLeave: read,
      onEnterBack: read,
      onLeaveBack: read,
      onRefresh: read,
    });
    read(st);
    return () => st.kill();
  });

  return passed;
}
