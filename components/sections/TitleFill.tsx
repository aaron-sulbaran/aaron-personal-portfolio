"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { joinFillPool } from "@/components/coil/fill/pool";
import { FILL_HELD_IN_INK } from "@/lib/coil/fillPool";
import { canCreateWebGL2 } from "@/components/coil/webglProbe";
import type { TitleFillRuntime } from "@/components/coil/fill/title";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { HOLDING_MODE } from "@/lib/holding";

// A numbered page's title in page 1's name's fill (Aaron, 2026-10-29: "the
// exact same gradient as the Aaron, cohesive across the entire site"): the
// heading (this wrapper's first child) stays the page's own text, and a canvas
// of the name's engine (components/coil/fill) draws its letters with the field
// inside them, moving, with the cursor's sheen.
//
// The wrapper says where it is (data-title-fill): "rest" (the heading in its
// own ink: before its first frame, and whenever it holds no canvas), "on" (the
// canvas draws it; the heading's glyphs are hidden, the heading still the
// heading, selectable, its name its own), "still" (no fill can run: reduced
// motion, no WebGL 2, a failed context or chunk; the CSS fallback the name
// wears then, the field poster as the text's fill). A canvas is made only when
// the pool (components/coil/fill/pool.ts) gives this title one: near the
// viewport, at most two alive on top of the Coil's; it goes when the title is
// far, and with it the context. Its loop runs only while it is on screen.
//
// gate "deal": page 2's title waits out the deal (html[data-deal] from
// "pending" through "unfurled"): no canvas is made while the deal plays, and
// one already drawing holds still, so it never costs the deal a frame.
// fillKey names the title for QA (data-title-fill-key, ?coildebug hooks) and
// for FILL_HELD_IN_INK, the titles that stay in their ink until Aaron decides.

const DEAL_PLAYING = new Set(["pending", "closed", "dealing", "unfurled"]);
const dealPlaying = () => DEAL_PLAYING.has(document.documentElement.dataset.deal ?? "");

// One probe a page load: a context this browser can actually make.
let webgl2: boolean | null = null;
const webgl2Ready = () => (webgl2 ??= canCreateWebGL2());

// QA (?coildebug): the wrapper element carries its runtime, so a spec reads the title it can see.
type QaWrapper = HTMLElement & { __titleFill?: { runtime: () => TitleFillRuntime | null } };

// backdrop "coil": the title sits on the Coil's field (page 2's) and its letters
// are made of that field, framed to the Coil's own canvas, rather than of one
// over their own box (components/coil/fill/title.ts).
const coilCanvas = () => document.querySelector<HTMLElement>("[data-coil-stage] canvas");

export function TitleFill({ children, fillKey, gate, backdrop }: { children: ReactNode; fillKey: string; gate?: "deal"; backdrop?: "coil" }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const reduced = useReducedMotionLive();

  useEffect(() => {
    const host = hostRef.current;
    const wrapper = host?.parentElement;
    const heading = wrapper?.firstElementChild;
    if (!host || !wrapper || !(heading instanceof HTMLElement) || heading === host) return;
    const say = (state: "rest" | "on" | "still") => wrapper.setAttribute("data-title-fill", state);
    // A title held in its ink (lib/coil/fillPool.ts FILL_HELD_IN_INK) stays there, whatever the page can draw.
    if (FILL_HELD_IN_INK.includes(fillKey) && !/[?&]coildebug=[^&]*\bfill-all\b/.test(window.location.search)) {
      say("rest");
      return;
    }
    if (reduced || HOLDING_MODE || typeof WebGL2RenderingContext === "undefined") {
      say("still");
      return;
    }
    say("rest");
    const gated = gate === "deal";
    let runtime: TitleFillRuntime | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let generation = 0;
    let failed = false;

    const release = () => {
      generation += 1;
      runtime?.dispose();
      runtime = null;
      canvas?.remove();
      canvas = null;
      if (!failed) say("rest");
    };
    const giveUp = () => {
      if (failed) return;
      failed = true;
      release();
      say("still");
      member.update();
    };
    const acquire = () => {
      const mine = ++generation;
      if (!webgl2Ready()) return giveUp();
      const next = document.createElement("canvas");
      next.setAttribute("aria-hidden", "true");
      next.setAttribute("data-fill-canvas", "");
      next.className = "title-fill__canvas";
      host.appendChild(next);
      canvas = next;
      import("@/components/coil/sceneChunk").then(({ startTitleFill }) => {
        if (mine !== generation) return;
        try {
          runtime = startTitleFill(
            next,
            heading,
            {
              onFirstFrame: () => {
                if (mine === generation) say("on");
              },
              onContextLost: giveUp,
              onError: (error) => {
                console.error("A title's fill failed; the page's own title carries on.", error);
                giveUp();
              },
            },
            backdrop === "coil" ? { backdrop: coilCanvas } : {},
          );
          runtime.setPaused(gated && dealPlaying());
        } catch (error) {
          console.error("A title's fill failed to start; the page's own title carries on.", error);
          giveUp();
        }
      }, giveUp);
    };

    // A sections heading rises in line by line (lib/sections/engine.ts); its
    // letters are read once they rest, so the reveal is the page's own, in ink.
    const revealed = () => !heading.hasAttribute("data-sections-block") || heading.dataset.sectionsState === "still" || heading.hasAttribute("data-sections-shown");
    const member = joinFillPool({
      id: `${fillKey}:${id}`,
      el: wrapper,
      // A gated title starts none while the deal plays; one it has holds still instead.
      eligible: () => !failed && revealed() && (!gated || !dealPlaying() || runtime !== null),
      acquire,
      release,
    });
    const dealWatch = gated
      ? new MutationObserver(() => {
          runtime?.setPaused(dealPlaying());
          member.update();
        })
      : null;
    dealWatch?.observe(document.documentElement, { attributes: true, attributeFilter: ["data-deal"] });
    const revealWatch = new MutationObserver(() => member.update());
    revealWatch.observe(heading, { attributes: true, attributeFilter: ["data-sections-shown", "data-sections-state"] });

    if (/coildebug/.test(window.location.search)) (wrapper as QaWrapper).__titleFill = { runtime: () => runtime };

    return () => {
      dealWatch?.disconnect();
      revealWatch.disconnect();
      member.leave();
      release();
      wrapper.removeAttribute("data-title-fill");
      delete (wrapper as QaWrapper).__titleFill;
    };
  }, [reduced, gate, backdrop, fillKey, id]);

  return (
    <div data-title-fill-key={fillKey} className="title-fill">
      {children}
      <span ref={hostRef} aria-hidden="true" className="title-fill__host" />
    </div>
  );
}
