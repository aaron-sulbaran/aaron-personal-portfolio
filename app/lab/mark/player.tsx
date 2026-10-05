"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "gsap";
import { Chip } from "./ui";

export type Timeline = gsap.core.Timeline;
export type Marker = { label: string; at: number };

// Builds a timeline inside a gsap.context, rebuilt whenever `build` changes
// (callers memoize it on their settings), so a settings change reverts every
// inline style and starts from a clean mark. `version`
// bumps on each build so the transport can re-attach to the new timeline.
export function usePlayer(
  scopeRef: RefObject<Element | null>,
  build: (scope: Element) => Timeline,
  { autoplay = true, loop = false, delay = 0 }: { autoplay?: boolean; loop?: boolean; delay?: number } = {},
) {
  const tlRef = useRef<Timeline | null>(null);
  const [version, setVersion] = useState(0);

  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;
    let timer = 0;
    const ctx = gsap.context(() => {
      const tl = build(scope);
      if (loop) tl.repeat(-1).repeatDelay(1.1);
      tlRef.current = tl;
      if (autoplay) timer = window.setTimeout(() => tl.play(0), delay);
    }, scope);
    setVersion((v) => v + 1);
    return () => {
      window.clearTimeout(timer);
      ctx.revert();
      tlRef.current = null;
    };
  }, [scopeRef, build, autoplay, loop, delay]);

  return { tlRef, version };
}

// Replay, loop and a scrub that drags the timeline by hand. The scrub reads
// the playhead straight from the timeline (no React state per frame).
export function Transport({
  tlRef,
  version,
  speed,
  loop,
  onLoop,
  markers = [],
  frames,
}: {
  tlRef: RefObject<Timeline | null>;
  version: number;
  speed: number;
  loop?: boolean;
  onLoop?: (next: boolean) => void;
  markers?: readonly Marker[];
  frames?: { fps: number; lead: number; count: number };
}) {
  const rangeRef = useRef<HTMLInputElement | null>(null);
  const readoutRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    const sync = () => {
      const t = tl.time();
      if (rangeRef.current) rangeRef.current.value = String(tl.duration() ? t / tl.duration() : 0);
      if (readoutRef.current) {
        const frame = frames ? Math.floor((t - frames.lead) * frames.fps + 1e-6) : null;
        const label = frame === null ? "" : frame < 0 ? "before frame 1, " : frame >= frames!.count ? "settling, " : `frame ${frame + 1} of ${frames!.count}, `;
        readoutRef.current.textContent = `${label}${Math.round((t / speed) * 1000)} / ${Math.round((tl.duration() / speed) * 1000)}ms`;
      }
    };
    tl.eventCallback("onUpdate", sync);
    sync();
    return () => {
      tl.eventCallback("onUpdate", null);
    };
  }, [tlRef, version, speed, frames]);

  const step = (by: number) => {
    const tl = tlRef.current;
    if (!tl || !frames) return;
    const current = Math.floor((tl.time() - frames.lead) * frames.fps + 1e-6);
    const next = Math.max(-1, Math.min(frames.count, current + by));
    seek(next < 0 ? 0 : frames.lead + (next + 0.5) / frames.fps);
  };

  const seek = (seconds: number) => {
    const tl = tlRef.current;
    if (!tl) return;
    tl.pause();
    tl.time(Math.min(seconds, tl.duration()));
  };

  return (
    <div className="flex flex-col gap-2 text-[12px] [font-family:system-ui]">
      <div className="flex flex-wrap items-center gap-2">
        <Chip onClick={() => tlRef.current?.restart()}>Replay</Chip>
        <Chip onClick={() => (tlRef.current?.paused() ? tlRef.current?.play() : tlRef.current?.pause())}>Play or pause</Chip>
        {frames && (
          <>
            <Chip onClick={() => step(-1)}>Previous frame</Chip>
            <Chip onClick={() => step(1)}>Next frame</Chip>
          </>
        )}
        {onLoop && (
          <label className="ml-1 flex items-center gap-1.5">
            <input type="checkbox" checked={!!loop} onChange={(e) => onLoop(e.target.checked)} />
            <span>Loop</span>
          </label>
        )}
        <span ref={readoutRef} className="ml-auto tabular-nums text-muted" />
      </div>
      <input
        ref={rangeRef}
        type="range"
        aria-label="Scrub the timeline"
        min={0}
        max={1}
        step={0.001}
        defaultValue={0}
        onChange={(e) => {
          const tl = tlRef.current;
          if (tl) seek(Number(e.target.value) * tl.duration());
        }}
      />
      {markers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="mr-1 self-center text-muted">Pin at</span>
          {markers.map((m) => (
            <Chip key={m.label} onClick={() => seek(m.at)}>
              {m.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
