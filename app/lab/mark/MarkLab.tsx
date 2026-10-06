"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";
import { syncThemeColorMeta, type Theme } from "@/lib/theme";
import { CardOverlay, CardStage } from "./CardStage";
import { celSchedule } from "./cel";
import { Panel, type View } from "./Panel";
import { Transport, usePlayer, type Timeline } from "./player";
import { INITIAL, beats, type Settings } from "./settings";
import { SmallSizes } from "./SmallSizes";
import { buildStrike } from "./strike";
import { CelStage, StrikeMark } from "./StrikeMark";
import { TriggerCorner } from "./Trigger";
import { Caption, Section } from "./ui";

// The bench for the mark's Easter egg: the strike on a large specimen, the
// card it opens, the trigger in the real corner, and the small sizes. Nothing
// here plays sound or reads a site store.

declare global {
  interface Window {
    __markLab?: { specimen: () => Timeline | null; set: (patch: Partial<Settings>) => void };
  }
}

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeColorMeta(theme);
}

export function MarkLab() {
  const [s, setS] = useState<Settings>(INITIAL);
  const [view, setView] = useState<View>({ reduce: false, loop: false, collapsed: false });
  const [overlay, setOverlay] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const osReduced = !!useReducedMotion();
  const reduced = view.reduce || osReduced;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const build = useCallback(
    (scope: Element) =>
      buildStrike(scope, s, {
        flash: flashRef.current,
        night: scope.querySelector('[data-cel-night="specimen"]'),
        celFlash: scope.querySelector('[data-cel-flash="specimen"]'),
        reduced: reduced ? "fade" : false,
      }).timeScale(s.speed),
    [s, reduced],
  );
  const { tlRef, version } = usePlayer(stageRef, build, { loop: view.loop, delay: 200 });

  useEffect(() => {
    window.__markLab = { specimen: () => tlRef.current, set: (patch) => setS((x) => ({ ...x, ...patch })) };
    return () => {
      delete window.__markLab;
    };
  }, [tlRef]);

  const b = beats(s);
  const frames = useMemo(() => {
    if (s.strike !== "cel" || reduced) return undefined;
    const c = celSchedule(s);
    return { fps: c.fps, lead: c.lead, count: c.count };
  }, [s, reduced]);
  const markers = reduced
    ? []
    : [
        { label: "start", at: 0 },
        { label: "mid strike", at: b.impact * 0.55 },
        { label: "impact", at: b.impact + 0.02 },
        { label: "splash", at: b.impact + (s.splashMs / 1000) * 0.4 },
        { label: "A half", at: b.aStart + (b.settle - b.aStart) * 0.5 },
        { label: "before settle", at: b.settle - 0.001 },
        { label: "settled", at: b.end },
      ];

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className={`px-6 pb-24 pt-28 md:px-10 ${view.collapsed ? "" : "lg:pr-[380px]"}`}>
        <Panel s={s} view={view} theme={theme} osReduced={osReduced} edit={setS} setView={setView} setTheme={setTheme} />
        <div className="mx-auto flex max-w-[1000px] flex-col">
          <header className="mb-12 flex flex-col gap-2">
            <h1 className="font-display text-section leading-none">The mark, struck</h1>
            <p className="max-w-[60ch] text-[13px] leading-snug text-muted [font-family:system-ui]">
              A bench for the Easter egg: the bolt strikes along its own zigzag, lands on its point, and the A is made where it hits. Every frame ends on the real
              AsMark, flat ink in light and flat paper in dark.
            </p>
          </header>

          <Section index="1" title="The strike" note="Pin each beat with the buttons under the stage; the scrub drags the timeline by hand.">
            <div className="flex flex-col gap-4">
              <div ref={stageRef} id="specimen-stage" className="relative isolate flex h-[520px] items-center justify-center overflow-hidden rounded-2xl bg-[var(--menu-panel)] [box-shadow:inset_0_0_0_1px_var(--color-border)]">
                <div ref={flashRef} aria-hidden="true" className={`pointer-events-none absolute inset-0 opacity-0 ${s.effect === "accent" ? "bg-accent" : "bg-foreground"} ${s.flashInLight ? "" : "hidden dark:block"}`} />
                <CelStage s={s} where="specimen" />
                <StrikeMark s={s} sizePx={s.sizePx} />
              </div>
              <Transport
                tlRef={tlRef}
                version={version}
                speed={s.speed}
                loop={view.loop}
                onLoop={(loop) => setView((v) => ({ ...v, loop }))}
                markers={markers}
                frames={frames}
              />
            </div>
          </Section>

          <Section
            index="2"
            title="The card"
            note="A static copy of the site's modal shell at the size I would ship. Strike first: the bolt lands on the blurred page and the card forms around the mark. Card first: the panel arrives and the bolt strikes into it. The words are placeholders for Aaron to write."
          >
            <CardStage s={s} reduced={reduced} />
          </Section>

          <Section index="3" title="How it is found" note="The top-left corner at its real size. Pick the trigger in the panel, then try it here; it opens the card over the whole page.">
            <TriggerCorner s={s} reduced={reduced} cardOpen={overlay} onOpen={() => setOverlay(true)} />
          </Section>

          <Section index="4" title="Small sizes" note="The settled mark and the strike at 96 and 48px, at speed and slowed, so you can see whether the animation survives a smaller card.">
            <SmallSizes s={s} reduced={reduced} />
            {reduced && <Caption>Reduced motion: no strike at any size, only the static mark.</Caption>}
          </Section>
        </div>
      </div>
      {overlay && <CardOverlay s={s} reduced={reduced} onClose={() => setOverlay(false)} />}
    </div>
  );
}
