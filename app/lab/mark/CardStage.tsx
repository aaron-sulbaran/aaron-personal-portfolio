"use client";

import { forwardRef, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { X } from "lucide-react";
import { useCloseHint } from "@/components/PhotoModal";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { siteContent } from "@/lib/content";
import { GROUND_FRACTION } from "./geometry";
import { buildCardOpen, cardMarkers } from "./card";
import { Transport, usePlayer, type Timeline } from "./player";
import type { Settings } from "./settings";
import { CelStage, StrikeMark } from "./StrikeMark";

// A static copy of the site's modal shell (components/WorkModal.tsx) sized
// for a small card. The panel is split into a surface (border, fill, shadow,
// blur) and the content above it, so the strike-first order can form the
// surface around a mark that never moves. Classes match WorkModal's, including
// bg-background/85 and bg-background/70, which emit nothing under Tailwind 3
// with var() colors; the copy shows what the site really renders.

declare global {
  interface Window {
    __markCard?: () => Timeline | null;
  }
}

const PANEL_SHADOW = "shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)]";

// The flash's tone follows the splash color; in light it is hidden unless the
// panel asks for it, since on paper a flash can only darken.
const flashTone = (s: Settings) => `${s.effect === "accent" ? "bg-accent" : "bg-foreground"} ${s.flashInLight ? "" : "hidden dark:block"}`;

const PLACEHOLDER = {
  eyebrow: "Placeholder label",
  title: "Placeholder title",
  lines: ["The story of the mark goes here, in my words.", "A second line goes here, in my words.", "A third, shorter line, if it earns its place."],
};

function Words({ wide }: { wide: boolean }) {
  const closeHint = useCloseHint();
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <span data-card="text" className="text-sm text-muted">
        {PLACEHOLDER.eyebrow}
      </span>
      <h2 data-card="text" className={`font-display leading-tight text-foreground ${wide ? "text-3xl" : "text-3xl md:text-4xl"}`}>
        {PLACEHOLDER.title}
      </h2>
      {PLACEHOLDER.lines.map((line) => (
        <p key={line} data-card="text" className="text-base leading-relaxed text-foreground">
          {line}
        </p>
      ))}
      <span data-card="text" className="pt-1 text-sm text-muted">
        {closeHint}
      </span>
    </div>
  );
}

type ShellProps = { s: Settings; onClose?: () => void };

export const CardShell = forwardRef<HTMLDivElement, ShellProps>(function CardShell({ s, onClose }, ref) {
  const mark = (
    <div data-card="mark" className="w-fit shrink-0">
      <StrikeMark s={s} sizePx={s.cardMarkPx} />
    </div>
  );
  const width = s.layout === "side" ? "max-w-xl" : "max-w-md";
  const groundStyle: CSSProperties = { top: s.cardMarkPx * GROUND_FRACTION };

  return (
    <div ref={ref} data-card="panel" className={`relative my-auto w-full ${width}`} onMouseDown={(e) => e.stopPropagation()}>
      <div data-card="surface" className={`absolute inset-0 overflow-hidden rounded-2xl border border-border bg-background/85 backdrop-blur-xl ${PANEL_SHADOW}`}>
        <div data-card="flash-card" className={`pointer-events-none absolute inset-0 opacity-0 ${flashTone(s)}`} />
        <CelStage s={s} where="card" />
      </div>
      <div className="relative flex flex-col gap-6 p-6 md:p-10">
        <button
          type="button"
          data-card="text"
          onClick={onClose}
          aria-label={siteContent.modals.closeAriaLabel}
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition-colors duration-200 hover:text-accent"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        {s.layout === "side" && (
          <div className="flex items-center gap-7 pr-6">
            {mark}
            <Words wide />
          </div>
        )}
        {s.layout === "above" && (
          <>
            {mark}
            <Words wide={false} />
          </>
        )}
        {s.layout === "ground" && (
          <>
            <div className="relative">
              {mark}
              <div data-card="ground" aria-hidden="true" className="absolute -left-6 -right-6 h-px bg-border md:-left-10 md:-right-10" style={groundStyle} />
            </div>
            <Words wide={false} />
          </>
        )}
      </div>
    </div>
  );
});

function useCardPlayer(stageRef: React.RefObject<HTMLDivElement | null>, s: Settings, reduced: boolean, delay: number) {
  const build = useCallback((scope: Element) => buildCardOpen(scope, s, reduced), [s, reduced]);
  return usePlayer(stageRef, build, { delay });
}

// The inline bench: a stand-in page under the backdrop so the blur has
// something to blur, with its own transport.
export function CardStage({ s, reduced }: { s: Settings; reduced: boolean }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { tlRef, version } = useCardPlayer(stageRef, s, reduced, 250);
  useEffect(() => {
    window.__markCard = () => tlRef.current;
    return () => {
      delete window.__markCard;
    };
  }, [tlRef]);

  return (
    <div className="flex flex-col gap-4">
      <div ref={stageRef} id="card-stage" className="relative isolate h-[640px] overflow-hidden rounded-2xl [box-shadow:inset_0_0_0_1px_var(--color-border)]">
        <StandInPage />
        <div data-card="backdrop" className="absolute inset-0 flex justify-center overflow-hidden px-4 py-6 md:px-10 md:py-14">
          <div data-card="tint" className="pointer-events-none absolute inset-0 bg-background/70" />
          <div data-card="flash-page" className={`pointer-events-none absolute inset-0 opacity-0 ${flashTone(s)}`} />
          <CelStage s={s} where="page" />
          <CardShell s={s} />
        </div>
      </div>
      <Transport tlRef={tlRef} version={version} speed={1} markers={reduced ? [] : cardMarkers(s)} />
    </div>
  );
}

// The card as the trigger opens it: fixed over the whole lab, with the site's
// own modal primitives (scroll lock, Escape, focus trap).
export function CardOverlay({ s, reduced, onClose }: { s: Settings; reduced: boolean; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  useCardPlayer(stageRef, s, reduced, 0);
  useBodyScrollLock(true);
  useEscapeKey(true, onClose);
  useFocusTrap(stageRef, true);

  return (
    <div ref={stageRef} role="dialog" aria-modal="true" aria-label="The mark" className="fixed inset-0 z-50">
      <div
        data-card="backdrop"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="absolute inset-0 flex justify-center overflow-y-auto overscroll-contain px-4 py-6 md:px-10 md:py-14"
      >
        <div data-card="tint" className="pointer-events-none fixed inset-0 bg-background/70" />
        <div data-card="flash-page" className={`pointer-events-none fixed inset-0 opacity-0 ${flashTone(s)}`} />
        <CelStage s={s} where="page" />
        <CardShell s={s} onClose={onClose} />
      </div>
    </div>
  );
}

const STAND_IN_ROWS = ["A row of the book", "Another row", "A third row", "A photo row", "A longer row of the book", "Another row", "A short row", "One more row", "The last row"];

function StandInPage() {
  return (
    <div aria-hidden="true" className="absolute inset-0 select-none px-10 py-12">
      <p className="mb-6 font-display text-display-md text-foreground">Stand-in page</p>
      <ol className="flex flex-col">
        {STAND_IN_ROWS.map((row, i) => (
          <li key={i} className="flex items-baseline justify-between border-t border-border py-3 text-lg text-foreground">
            <span>{row}</span>
            <span className="text-sm text-muted">{2020 + (i % 6)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
