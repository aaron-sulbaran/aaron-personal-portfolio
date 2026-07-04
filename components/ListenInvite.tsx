"use client";

import { useEffect, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { revealIndex } from "@/lib/motion";
import { Reveal } from "./Reveal";
import {
  getSoundtrackState,
  initSoundtrackFromStorage,
  startSoundtrack,
  stopSoundtrack,
  useSoundtrack,
} from "@/lib/soundtrack";

const MOBILE_MAX = 767;

// The soundtrack invitation beat: an in-flow, non-blocking section between the
// hero carousel and #work where the waveform introduces itself. It is page
// content, never a modal; it must never capture or pause scrolling. "Play it"
// opts in (startSoundtrack), "maybe later" opts out (stopSoundtrack), and the
// actions crossfade to a short confirmation while the section stays in flow.
// A visitor with a stored prior choice (soundtrack state anything but "before"
// at mount) never sees the ask: the whole section renders null. Desktop-only in
// v1, matching the rest of the soundtrack surface (PlaybackPill's gating).
export function ListenInvite() {
  const music = useSoundtrack();
  const c = siteContent.listen;

  // null until the client resolves the media query, so SSR and the first
  // client render agree (both null -> nothing) and there is no flash.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  // The soundtrack state as it stood when this component mounted. A choice
  // that already existed then (restored from localStorage) means a returning
  // visitor: render null for the whole visit. A choice made after mount is
  // this session's answer: keep the section and show the confirmation.
  const stateAtMount = useRef<"unknown" | "before" | "answered">("unknown");

  useEffect(() => {
    // Idempotent; PlaybackPill also calls this, but depending on a sibling's
    // effect order would be fragile, so resolve the stored choice here too.
    initSoundtrackFromStorage();
    if (stateAtMount.current === "unknown") {
      stateAtMount.current = getSoundtrackState() === "before" ? "before" : "answered";
    }
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (isMobile === null || isMobile || stateAtMount.current !== "before") return null;

  const answered = music !== "before";
  const note = music === "off" ? c.declinedNote : c.acceptedNote;

  return (
    <section
      id="listen"
      aria-label={c.ariaLabel}
      className="relative flex min-h-[60vh] w-full items-center justify-center px-6 py-24 md:px-10"
    >
      <Reveal className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 text-center">
        <p
          className="reveal-item flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted"
          style={revealIndex(0)}
        >
          <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
          <span>{c.kicker}</span>
          <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
        </p>
        <p
          className="reveal-mask font-serif text-[clamp(2.5rem,5vw,4.25rem)] italic leading-[1.05] tracking-tight text-foreground"
          style={revealIndex(1)}
        >
          <span className="block">{c.line}</span>
        </p>
        <p
          className="reveal-item max-w-md text-base leading-[1.55] text-muted md:text-lg"
          style={revealIndex(2)}
        >
          {c.body}
        </p>

        {/* Actions and confirmation share one grid cell so the crossfade never
            shifts layout; the hidden layer is inert (pointer-events + disabled
            + aria-hidden) so nothing invisible stays clickable or focusable. */}
        <div className="reveal-item mt-2 grid w-full" style={revealIndex(3)}>
          <div
            className="col-start-1 row-start-1 flex items-baseline justify-center gap-8 transition-opacity duration-300"
            style={{ opacity: answered ? 0 : 1, pointerEvents: answered ? "none" : "auto" }}
            aria-hidden={answered}
          >
            <button
              type="button"
              onClick={() => startSoundtrack()}
              disabled={answered}
              data-cursor-hover
              className="group font-serif text-2xl italic text-accent transition-colors duration-200 hover:text-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default md:text-3xl"
            >
              <span className="underline decoration-accent/40 decoration-1 underline-offset-[3.5px] [text-decoration-skip-ink:auto] transition-[text-decoration-color] duration-200 group-hover:decoration-accent">
                {c.accept}
              </span>
            </button>
            <button
              type="button"
              onClick={() => stopSoundtrack()}
              disabled={answered}
              className="text-sm text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default md:text-base"
            >
              {c.decline}
            </button>
          </div>
          <p
            className="col-start-1 row-start-1 self-center text-sm leading-[1.55] text-muted transition-opacity duration-300 md:text-base"
            style={{
              opacity: answered ? 1 : 0,
              transitionDelay: answered ? "200ms" : "0ms",
            }}
            aria-hidden={!answered}
          >
            {note}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
