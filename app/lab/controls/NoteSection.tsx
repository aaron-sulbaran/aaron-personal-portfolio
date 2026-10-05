"use client";

import { MenuChipCopy, MenuPillCopy } from "./copies/Menu";
import { CapsuleCopy, type CapsuleState } from "./copies/Playback";
import { NoteGlyph, type MusicState } from "./NoteGlyph";
import { CURRENT_KEY, NOTES, noteName } from "./notes";
import type { ControlFill, NoteAnim } from "./settings";
import { Caption } from "./ui";
import { siteContent } from "@/lib/content";

// Part 2 in place: the chosen note and animation in the Listen dot, the
// capsule and the menu chip, live (the panel's off / on / paused drives
// them) and in every state, then every candidate at 14, 16, 20 and 24px and
// one large. Clicking a candidate picks it.

const s = siteContent.soundtrack;
const CHIP_LABEL: Record<MusicState, string> = { on: s.menuToggleOn, paused: s.menuTogglePaused, off: s.menuToggleOff };
const CAPSULE_STATES: readonly CapsuleState[] = ["before", "on", "paused", "off"];

type Props = {
  noteKey: string;
  anim: NoteAnim;
  music: MusicState;
  menuFill: ControlFill;
  capsuleFill: ControlFill;
  onMusic: (next: MusicState) => void;
  onPick: (key: string) => void;
};

function InPlace({ noteKey, anim, music, menuFill, capsuleFill, onMusic }: Omit<Props, "onPick">) {
  const note = { noteKey, anim, music };
  const capsule: CapsuleState = music === "on" ? "on" : music === "paused" ? "paused" : "before";
  const next = (m: MusicState): MusicState => (m === "on" ? "paused" : "on");
  return (
    <div className="flex flex-col gap-6 bg-background p-6 text-foreground">
      <div className="flex flex-wrap items-center gap-6">
        <MenuPillCopy fill={menuFill} note={note} onListen={() => onMusic(next(music))} />
        <CapsuleCopy fill={capsuleFill} state={capsule} noteKey={noteKey} anim={anim} onClick={() => onMusic(next(music))} />
        <div className="rounded-xl bg-[var(--menu-panel)] p-3 [box-shadow:inset_0_0_0_1px_var(--color-border)]">
          <MenuChipCopy
            fill={menuFill}
            kind="music"
            note={note}
            label={CHIP_LABEL[music]}
            onClick={() => onMusic(music === "off" ? "on" : "off")}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {CAPSULE_STATES.map((state) => (
          <CapsuleCopy key={state} fill={capsuleFill} state={state} noteKey={noteKey} anim={anim} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {(["on", "paused", "off"] as const).map((m) => (
          <MenuChipCopy key={m} fill={menuFill} kind="music" note={{ noteKey, anim, music: m }} label={CHIP_LABEL[m]} />
        ))}
      </div>
    </div>
  );
}

export function NoteInPlace(props: Omit<Props, "onPick"> & { dark: boolean }) {
  const { dark, ...rest } = props;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <div className="overflow-hidden rounded-2xl [box-shadow:inset_0_0_0_1px_var(--color-border)]">
          <InPlace {...rest} />
        </div>
        <Caption>This theme. Click the Listen dot or the capsule to flip on and paused; the chip turns it on and off.</Caption>
      </div>
      {!dark ? (
        <div>
          <div data-theme="dark" className="overflow-hidden rounded-2xl [box-shadow:inset_0_0_0_1px_var(--color-border)]">
            <InPlace {...rest} />
          </div>
          <Caption>Dark, side by side. Switch the page to dark for the full dark view.</Caption>
        </div>
      ) : (
        <p className="self-center text-[12px] text-muted [font-family:system-ui]">
          Switch the page to light to see light and dark side by side (the light tokens live on :root only).
        </p>
      )}
    </div>
  );
}

const SIZES = [14, 16, 20, 24] as const;

export function NoteGallery({ noteKey, anim, music, onPick }: Pick<Props, "noteKey" | "anim" | "music" | "onPick">) {
  const keys = [CURRENT_KEY, ...NOTES.map((n) => n.key)];
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl bg-border [box-shadow:inset_0_0_0_1px_var(--color-border)] sm:grid-cols-2 xl:grid-cols-3">
      {keys.map((key) => {
        const picked = key === noteKey;
        const info = NOTES.find((n) => n.key === key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onPick(key)}
            aria-pressed={picked}
            className={`flex flex-col gap-4 bg-background p-5 text-left ${picked ? "outline outline-2 -outline-offset-2 outline-accent" : ""}`}
          >
            <div className="flex items-end gap-5">
              <NoteGlyph noteKey={key} state={music} anim={anim} size={72} />
              <div className="flex items-end gap-3 pb-1">
                {SIZES.map((px) => (
                  <span key={px} className="flex flex-col items-center gap-1.5">
                    <NoteGlyph noteKey={key} state="on" anim="none" size={px} />
                    <span className="text-[10px] tabular-nums text-muted [font-family:system-ui]">{px}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="text-[12px] leading-snug [font-family:system-ui]">
              <span className="font-semibold text-foreground">{noteName(key)}</span>
              <span className="text-muted">
                {" "}
                {info ? info.line : "The site's NoteIcon today: a 14 by 22 silhouette, outlined with a slash when off, filled and swaying when on."}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
