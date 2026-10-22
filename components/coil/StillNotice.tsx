"use client";

import { useSyncExternalStore } from "react";
import { Fill } from "@/components/fx/Fill";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import type { StillCause } from "@/lib/coil/heroStill";
import { stillNoticeStore } from "@/lib/home/stillNotice";
import { INTRO_HEADING_ID } from "@/lib/home/introId";

// The still page's one quiet line at the foot of the Coil's frame: why the
// page is still, and "Got it", which dismisses it for good and hands focus to
// the intro's h1 (tabIndex -1), so the keyboard resumes from the top of the
// page. CoilStage renders it only in data-scene="still" once the section is
// ready, portalled into the stage's frame. A status, never a dialog: no focus
// trap, no autofocus, nothing blocked. Not in HeroOverlay, whose root stays
// invisible without a scene.
const subscribe = (listener: () => void) => stillNoticeStore().subscribe(listener);
const dismissed = () => stillNoticeStore().dismissed();
const dismissedOnServer = () => true;

export function StillNotice({ cause }: { cause: StillCause }) {
  const hidden = useSyncExternalStore(subscribe, dismissed, dismissedOnServer);
  if (hidden) return null;
  const copy = siteContent.hero.still;
  return (
    <div
      role="status"
      data-still-notice
      className="pointer-events-auto absolute bottom-[max(32px,7svh)] left-1/2 flex w-full max-w-[36rem] -translate-x-1/2 flex-col items-center gap-1 text-balance px-6 text-center font-label text-label-sm text-foreground"
    >
      <p>{copy[cause]}</p>
      <Fill
        {...FILL_PICK.nav}
        shape="rect"
        onClick={() => {
          stillNoticeStore().dismiss();
          document.getElementById(INTRO_HEADING_ID)?.focus({ preventScroll: true });
        }}
        data-cursor-hover
        className="-mx-2 inline-flex items-center px-2 py-1 font-label text-label-sm text-accent"
        overClassName="flex items-center px-2 py-1"
      >
        {copy.dismiss}
      </Fill>
    </div>
  );
}
