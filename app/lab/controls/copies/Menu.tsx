"use client";

import { Moon } from "lucide-react";
import type { CSSProperties } from "react";
import { AsMark } from "@/components/menu/BrandMark";
import { siteContent } from "@/lib/content";
import { Fx } from "../Fx";
import { NoteGlyph, type MusicState } from "../NoteGlyph";
import type { ControlFill, NoteAnim, Variant } from "../settings";

// Static copies of components/menu (MenuPill with its Listen dot, the
// panel's two chips) and the SiteNav bar's links, at their real sizes.

const base = (px: number) => ({ "--base": `${px}px` }) as CSSProperties;

type NoteProps = { noteKey: string; anim: NoteAnim; music: MusicState };

export function MenuPillCopy({
  fill,
  note,
  onListen,
  onMenu,
}: {
  fill: ControlFill;
  note: NoteProps;
  onListen?: () => void;
  onMenu?: () => void;
}) {
  const v = fill.variant;
  return (
    <div className="flex h-10 w-fit items-center justify-end rounded-[20px] bg-[var(--menu-pill)] text-foreground backdrop-blur-[8px] [box-shadow:inset_0_0_0_1px_var(--color-border)]">
      <Fx
        variant="icon"
        colorway={fill.colorway}
        inner="relative flex h-10 min-w-[34px] items-center justify-center px-1.5"
        ariaLabel="Listen"
        pressed={note.music === "on"}
        onClick={onListen}
      >
        <span data-fx-icon className="flex">
          <NoteGlyph noteKey={note.noteKey} state={note.music} anim={note.anim} size={20} />
        </span>
      </Fx>
      <Fx variant={v} colorway={fill.colorway} origin="end" inner="relative flex h-10 items-center pl-2 pr-[17px]" onClick={onMenu}>
        <span data-fx-icon className="relative grid h-[22px] overflow-hidden">
          <span className="fx-odometer block">
            <span className="lab-label flex h-[22px] items-center justify-end" style={base(14)}>
              {siteContent.menu.pillLabel}
            </span>
            <span className="flex h-[22px] items-center justify-center">
              <AsMark fit="tight" className="h-[22px] w-[15px]" />
            </span>
          </span>
        </span>
        {v === "circle" && <span data-fx-seed className="absolute right-[6px] top-1/2 h-[6px] w-[6px] -translate-y-1/2" />}
      </Fx>
    </div>
  );
}

export function MenuChipCopy({
  fill,
  kind,
  note,
  label,
  onClick,
}: {
  fill: ControlFill;
  kind: "theme" | "music";
  note?: NoteProps;
  label: string;
  onClick?: () => void;
}) {
  const v: Variant = fill.variant;
  return (
    <Fx
      variant={v}
      colorway={fill.colorway}
      origin="start"
      className="w-fit [box-shadow:inset_0_0_0_1px_var(--color-border)]"
      inner="relative flex h-[34px] items-center gap-2 pl-2.5 pr-3.5"
      onClick={onClick}
    >
      <span data-fx-icon className="flex h-4 min-w-4 items-center justify-center">
        {kind === "theme" ? (
          <Moon aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
        ) : (
          note && <NoteGlyph noteKey={note.noteKey} state={note.music} anim={note.anim} size={20} />
        )}
      </span>
      <span className="lab-label" style={base(13)}>
        {label}
      </span>
      {v === "circle" && <span data-fx-seed className="absolute right-[5px] top-1/2 h-[5px] w-[5px] -translate-y-1/2" />}
    </Fx>
  );
}

const NAV = siteContent.menu.items.filter((item) => item.key !== "home");

export function NavBarCopy({ fill, active, onPick }: { fill: ControlFill; active: string; onPick: (key: string) => void }) {
  return (
    <div className="relative flex h-[72px] items-center justify-center border-b border-border bg-[var(--nav-bar)]">
      <span className="absolute left-6 top-5 block h-8 w-8 text-foreground">
        <AsMark className="block h-full w-full" />
      </span>
      <nav aria-label="Sections, copy" className="flex items-center gap-6">
        {NAV.map((item) => {
          const here = item.key === active;
          return (
            <span key={item.key} className="relative">
              <Fx
                as="a"
                variant={fill.variant}
                colorway={fill.colorway}
                origin="start"
                shape="rect"
                line={0}
                className="-mx-2"
                inner="flex items-center px-2 py-1"
                onClick={() => onPick(item.key)}
              >
                <span className="lab-label" style={base(14)}>
                  {item.label}
                </span>
              </Fx>
              {here && <span aria-hidden="true" className="absolute -bottom-2 left-1/2 -ml-0.5 h-1 w-1 rounded-full bg-accent" />}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
