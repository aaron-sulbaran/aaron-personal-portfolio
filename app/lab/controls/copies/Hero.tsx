"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { siteContent } from "@/lib/content";
import { Fx, FxArrow } from "../Fx";
import type { ControlFill, HeroSurface } from "../settings";

// The hero's bottom-left corner over a stand-in for the scene: the poster
// field (public/coil) and real photo cards drifting across it, so the
// controls are judged on a busy, moving background without WebGL.
// "Work and photos" is the hero control the design review named (removed
// from the hero in PR 15, decisions 2.9); the Coil and Band toggle is new.

const base = (px: number) => ({ "--base": `${px}px` }) as CSSProperties;

const CARDS = [
  { src: "/photos/mt-fuji.jpeg", left: "8%", top: "34%", w: 132, rot: -9, delay: "0s" },
  { src: "/photos/hsf-speaking.jpeg", left: "38%", top: "6%", w: 150, rot: 7, delay: "-3.5s" },
  { src: "/photos/yosemite-hiking.jpeg", left: "70%", top: "22%", w: 124, rot: -5, delay: "-7s" },
  { src: "/photos/claude-hackathon.jpeg", left: "22%", top: "64%", w: 140, rot: 11, delay: "-10.5s" },
  { src: "/photos/drum-major.jpeg", left: "56%", top: "58%", w: 118, rot: -13, delay: "-5s" },
  { src: "/photos/capital-one.jpeg", left: "86%", top: "68%", w: 128, rot: 6, delay: "-12s" },
];

export function HeroStage({ moving, children }: { moving: boolean; children: ReactNode }) {
  return (
    <div
      className="relative h-[460px] overflow-hidden rounded-2xl bg-background"
      style={{ "--stage-play": moving ? "running" : "paused" } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/coil/field-light.avif" alt="" className="absolute inset-0 h-full w-full object-cover dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/coil/field-dark.avif" alt="" className="absolute inset-0 hidden h-full w-full object-cover dark:block" />
      <span
        aria-hidden="true"
        className="absolute left-[6%] top-[30%] font-display text-[180px] leading-none tracking-[-0.02em] text-[color:var(--name-grad-bottom)] opacity-60"
      >
        {siteContent.hero.name}
      </span>
      {CARDS.map((card) => (
        <span
          key={card.src}
          aria-hidden="true"
          className="stage-card absolute block"
          style={{ left: card.left, top: card.top, width: card.w, animationDelay: card.delay }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.src}
            alt=""
            className="block aspect-[3/4] w-full rounded-[10px] object-cover shadow-[var(--pill-shadow)]"
            style={{ transform: `rotate(${card.rot}deg)` }}
          />
        </span>
      ))}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl [box-shadow:inset_0_0_0_1px_var(--color-border)]" />
      <div className="absolute bottom-[24px] left-[28px] flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const SURFACE: Record<HeroSurface, string> = {
  pill: "tg-surface-pill",
  solid: "tg-surface-solid",
  bare: "",
};

export function WorkAndPhotos({ fill, surface }: { fill: ControlFill; surface: HeroSurface }) {
  const circle = fill.variant === "circle";
  return (
    <Fx
      variant={fill.variant}
      colorway={fill.colorway}
      origin="start"
      line={fill.variant === "rise" ? 1 : 0}
      lineInset={16}
      className={`w-fit ${SURFACE[surface]}`}
      inner={`relative flex h-10 items-center gap-2.5 pl-4 ${circle ? "pr-1" : "pr-4"}`}
    >
      <span className="lab-label" style={base(16)}>
        {siteContent.book.ariaLabel}
      </span>
      {circle && (
        <span data-fx-seed className="fx-seed h-8 w-8">
          <FxArrow size={16} />
        </span>
      )}
    </Fx>
  );
}

type Layout = "coil" | "band";

// The toggle. The selection is the fill itself (controls.css, .tg): moving to
// the other side, the leading edge runs ahead and the trailing edge follows,
// and the labels change color exactly where the fill passes because the
// selected color is a clipped second copy, as in Fx. It carries its own
// surface (the Menu pill's glass), so the labels never sit on the scene.
export function CoilBandToggle({ fill, surface, glyphs }: { fill: ControlFill; surface: HeroSurface; glyphs: boolean }) {
  const [state, setState] = useState<Layout>("coil");
  const [dir, setDir] = useState<"left" | "right" | "none">("none");
  const pick = (next: Layout) => {
    if (next === state) return;
    setDir(next === "band" ? "right" : "left");
    setState(next);
  };
  const labels: { key: Layout; label: string }[] = [
    { key: "coil", label: "Coil" },
    { key: "band", label: "Band" },
  ];
  return (
    <div
      role="group"
      aria-label="Hero layout"
      data-state={state}
      data-dir={dir}
      data-colorway={fill.colorway}
      className={`tg w-fit ${SURFACE[surface]}`}
      style={{ "--tg-pad": surface === "bare" ? "0px" : "3px" } as CSSProperties}
    >
      <span className="tg-base grid grid-cols-2">
        {labels.map((seg) => (
          <button
            key={seg.key}
            type="button"
            data-seg={seg.key}
            aria-pressed={state === seg.key}
            onClick={() => pick(seg.key)}
            data-cursor-hover
            className="tg-seg flex h-10 items-center justify-center gap-1.5 px-4"
          >
            {glyphs && <LayoutGlyph kind={seg.key} />}
            <span className="lab-label" style={base(14)}>
              {seg.label}
            </span>
          </button>
        ))}
      </span>
      <span aria-hidden="true" className="tg-over grid grid-cols-2">
        {labels.map((seg) => (
          <span key={seg.key} className="flex h-10 items-center justify-center gap-1.5 px-4">
            {glyphs && <LayoutGlyph kind={seg.key} />}
            <span className="lab-label" style={base(14)}>
              {seg.label}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

function LayoutGlyph({ kind }: { kind: Layout }) {
  return (
    <svg viewBox="0 0 16 16" className="block h-3.5 w-3.5 flex-none" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      {kind === "coil" ? (
        <>
          <path d="M2 4.5c2.4 0 4 2.3 6 3.5s3.6 3.5 6 3.5" />
          <path d="M2 11.5c2.4 0 4-2.3 6-3.5s3.6-3.5 6-3.5" opacity={0.45} />
        </>
      ) : (
        <ellipse cx="8" cy="8" rx="6.2" ry="2.8" transform="rotate(-14 8 8)" />
      )}
    </svg>
  );
}
