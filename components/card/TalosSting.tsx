"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { siteContent } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";
import { COIN, LETTER_PATHS, LETTERS_ORIGIN, LOCKUP_VIEWBOX, TEE_PATH } from "@/lib/talos/lockup";
import { seek, STING, type StingFrame } from "@/lib/talos/sting";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";

// The Talos sting between the first two paragraphs of the Talos modal: the brand
// kit's radar opening (lib/talos/sting.ts) drawn as inline SVG, once, after the
// modal's masks have opened and once its stage is in view (a phone may have it
// below the fold, and then it starts as it scrolls up); its last frame is the static lockup (lib/talos/lockup.test.ts) and the
// component swaps to that file when it ends. Reduced motion shows the file at
// once, live in both directions. It never plays on hover or click, a hidden tab
// holds the clock, and nothing else touches this SVG. Flat fills only, from the
// kit's tokens (app/globals.css), on a plain ground: no shadow, glow or glass.

const { width, height } = LOCKUP_VIEWBOX;
const bronze: CSSProperties = { fill: "var(--talos-bronze)" };
const anvil: CSSProperties = { fill: "var(--talos-anvil)" };
const ink: CSSProperties = { fill: "var(--talos-ink)" };
const heat: CSSProperties = { fill: "var(--talos-heat)" };
const gridline: CSSProperties = { fill: "none", stroke: "var(--talos-anvil)", strokeOpacity: 0.32, strokeWidth: 5 };
const SECTOR_OPACITY = [0.5, 0.26, 0.12] as const;
const translate = (x: number, y: number) => `translate(${x} ${y})`;

type Phase = "waiting" | "playing" | "done";

export function TalosSting({ startDelayMs }: { startDelayMs: number }) {
  const { lockup } = siteContent.cards.talos.team;
  const reduced = useReducedMotionLive();
  const [timeMs, setTimeMs] = useState(0);
  const [phase, setPhase] = useState<Phase>("waiting");
  const [inView, setInView] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = performance.now();
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (reduced || !stage || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setInView(true);
        observer.disconnect();
      },
      { threshold: 0.6 },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [reduced, inView]);

  useEffect(() => {
    if (reduced || !inView) return;
    let raf = 0;
    let last = 0;
    let clock = -Math.max(0, startDelayMs - (performance.now() - openedAt.current));
    const frame = (now: number) => {
      clock += Math.min(now - last, 50);
      last = now;
      if (clock >= STING.durationMs) {
        setTimeMs(STING.durationMs);
        setPhase("done");
        return;
      }
      if (clock >= 0) {
        setTimeMs(clock);
        setPhase("playing");
      }
      raf = requestAnimationFrame(frame);
    };
    const resume = () => {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) resume();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancelAnimationFrame(raf);
    };
  }, [reduced, inView, startDelayMs]);

  const still = reduced || phase === "done";
  return (
    <div ref={stageRef} data-mask={partId.sting} data-mask-kind="photo" className="rounded-2xl border border-border bg-background px-[7%] py-[5%]">
      <div role="img" aria-label={lockup.alt} data-sting={reduced ? "reduced" : phase} data-sting-stage="">
        {still ? (
          <>
            <Image src={lockup.light} alt="" width={lockup.width} height={lockup.height} priority className="block h-auto w-full dark:hidden" />
            <Image src={lockup.dark} alt="" width={lockup.width} height={lockup.height} priority className="hidden h-auto w-full dark:block" />
          </>
        ) : (
          <StingSvg frame={seek(timeMs)} />
        )}
      </div>
    </div>
  );
}

function StingSvg({ frame }: { frame: StingFrame }) {
  const id = useId().replace(/:/g, "");
  const flan = `${id}-flan`;
  const word = `${id}-word`;
  const { center, radius } = COIN;
  const { scope } = frame;
  const coinTransform = frame.coinScale === 1 ? undefined : `translate(${center} ${center}) scale(${frame.coinScale}) translate(${-center} ${-center})`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" className="block h-auto w-full">
      <defs>
        <clipPath id={flan}>
          <circle cx={center} cy={center} r={radius} />
        </clipPath>
        <mask id={word} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <rect x={STING.wipeStart} y={0} width={frame.wipeWidth} height={height} fill="white" />
        </mask>
      </defs>
      <g mask={frame.wordDone ? undefined : `url(#${word})`}>
        {LETTER_PATHS.map((d, k) => (
          <g key={k} transform={frame.letterShift[k] === 0 ? undefined : translate(frame.letterShift[k], 0)}>
            <path transform={translate(LETTERS_ORIGIN.x, LETTERS_ORIGIN.y)} d={d} style={ink} />
          </g>
        ))}
      </g>
      <g transform={translate(LETTERS_ORIGIN.x, LETTERS_ORIGIN.y)}>
        <g transform={`translate(${COIN.x - LETTERS_ORIGIN.x} ${COIN.y - LETTERS_ORIGIN.y}) scale(${COIN.scale})`}>
          <g transform={coinTransform}>
            <circle cx={center} cy={center} r={radius} style={bronze} />
            {scope && (
              <g clipPath={`url(#${flan})`}>
                <circle cx={center} cy={center} r={148} style={gridline} />
                <path d="M256 32V480M32 256H480" style={gridline} />
                {[2, 1, 0].map((k) => (
                  <path key={k} d={scope.sectors[k]} fillOpacity={SECTOR_OPACITY[k]} style={heat} />
                ))}
                {scope.contacts.map((c, k) => c && <circle key={k} cx={c.x} cy={c.y} r={17} fillOpacity={c.opacity} style={heat} />)}
              </g>
            )}
            {frame.struck && <path d={TEE_PATH} clipPath={`url(#${flan})`} style={anvil} />}
          </g>
          {frame.dieY !== null && <path d={TEE_PATH} transform={translate(0, frame.dieY)} style={ink} />}
        </g>
      </g>
    </svg>
  );
}
