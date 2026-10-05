"use client";

import type { CSSProperties } from "react";
import { siteContent } from "@/lib/content";
import { Fx } from "../Fx";
import { NoteGlyph } from "../NoteGlyph";
import { CURRENT_KEY } from "../notes";
import type { ControlFill, NoteAnim } from "../settings";

// Static copies of the playback capsule (components/soundtrack/PlaybackPill,
// PillParts) and the band's controls (BandInvite). The capsule is 36px tall
// with a 44px hit area, 13px in on the glyph side and 16px on the text side;
// the band's controls keep their underlines, which the rise fill grows from.

const base = (px: number) => ({ "--base": `${px}px` }) as CSSProperties;
const s = siteContent.soundtrack;
const l = siteContent.listen;

export type CapsuleState = "before" | "on" | "paused" | "off";

export function capsuleText(state: CapsuleState) {
  if (state === "on") return s.tracks[0].title;
  if (state === "paused") return s.capsulePaused;
  if (state === "before") return s.capsuleUnanswered;
  return s.capsuleOff;
}

export function CapsuleCopy({
  fill,
  state,
  noteKey,
  anim,
  onClick,
}: {
  fill: ControlFill;
  state: CapsuleState;
  noteKey: string;
  anim: NoteAnim;
  onClick?: () => void;
}) {
  const music = state === "on" ? "on" : state === "paused" ? "paused" : "off";
  return (
    <Fx
      variant={fill.variant}
      colorway={fill.colorway}
      origin="start"
      className="w-fit border border-border bg-glass-strong shadow-[var(--pill-shadow)] backdrop-blur-[16px]"
      inner="relative flex h-[34px] items-center pl-[13px] pr-4"
      onClick={onClick}
    >
      <span data-fx-icon className="flex h-5 min-w-4 items-center justify-center">
        {noteKey === CURRENT_KEY && music === "paused" ? (
          <span className="block h-0.5 w-4 rounded-[1px] bg-muted opacity-70" />
        ) : (
          <NoteGlyph noteKey={noteKey} state={music} anim={anim} size={20} />
        )}
      </span>
      <span className="lab-label pl-2" style={base(12)}>
        {capsuleText(state)}
      </span>
      {fill.variant === "circle" && <span data-fx-seed className="absolute right-[6px] top-1/2 h-[6px] w-[6px] -translate-y-1/2" />}
    </Fx>
  );
}

// The band in its first state (the question, "Play it", "Not now"), then the
// two controls that replace them once the music is on or paused.
export function BandCopy({ fill, onAnswer }: { fill: ControlFill; onAnswer?: (answer: "on" | "off" | "paused") => void }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline gap-x-7 gap-y-3">
        <h3 className="font-display text-[26px] leading-[1.1] text-foreground">{l.line}</h3>
        <div className="flex items-baseline gap-6">
          <Fx
            variant={fill.variant}
            colorway={fill.colorway}
            origin="start"
            shape="rect"
            line={1.5}
            lineInset={6}
            className="-mx-1.5"
            inner="flex px-1.5 pb-[3px] pt-px"
            onClick={() => onAnswer?.("on")}
          >
            <span className="font-display text-[20px] leading-[1.1]">{l.accept}</span>
          </Fx>
          <Fx
            variant={fill.variant}
            colorway={fill.colorway}
            origin="start"
            shape="rect"
            line={0}
            className="-mx-1.5"
            inner="flex px-1.5 pb-[3px] pt-px"
            onClick={() => onAnswer?.("off")}
          >
            <span className="lab-label" style={base(14)}>
              {l.decline}
            </span>
          </Fx>
        </div>
      </div>
      <div className="flex items-baseline gap-6">
        {[l.pause, l.resume].map((label) => (
          <Fx
            key={label}
            variant={fill.variant}
            colorway={fill.colorway}
            origin="start"
            shape="rect"
            line={1}
            lineInset={6}
            className="-mx-1.5"
            inner="flex px-1.5 pb-[2px] pt-px"
            onClick={() => onAnswer?.(label === l.pause ? "paused" : "on")}
          >
            <span className="lab-label" style={base(14)}>
              {label}
            </span>
          </Fx>
        ))}
      </div>
    </div>
  );
}
