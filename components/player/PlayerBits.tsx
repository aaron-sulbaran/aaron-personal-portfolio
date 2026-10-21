"use client";

import type { CSSProperties } from "react";
import { Pause, Play, SkipBack, SkipForward, Snowflake, Volume2 } from "lucide-react";
import { Cover, formatTime, iconButton } from "@/components/soundtrack/PillParts";
import { MarqueeTitle } from "@/components/soundtrack/MarqueeTitle";
import { siteContent } from "@/lib/content";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";
import type { PlayerControls } from "./usePlayerControls";

// The lab player's shared pieces, drawn from the same controls object: the
// title block, the seek bar, the transport row and the volume.

const range: CSSProperties = { flex: "1 1 auto", minWidth: 0, accentColor: "var(--color-accent)", cursor: "pointer" };

export function TitleBlock({ controls, coverSize, titleSize }: { controls: PlayerControls; coverSize: number; titleSize: number }) {
  const { track } = controls;
  return (
    <>
      <Cover size={coverSize} cover={track.cover} title={track.title} />
      <span className="min-w-0 flex-1">
        <MarqueeTitle text={track.title} style={{ fontFamily: "var(--font-display)", fontSize: titleSize, lineHeight: 1.15, color: "var(--color-foreground)" }} />
        <span className="mt-0.5 block truncate font-label text-label-sm text-muted">{track.artist}</span>
      </span>
    </>
  );
}

export function SeekRow({ controls }: { controls: PlayerControls }) {
  const { snap, position } = controls;
  const c = siteContent.soundtrack;
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-block min-w-[4ch] text-right font-label text-label-sm tabular-nums text-muted">{formatTime(position)}</span>
      <input
        type="range"
        min={0}
        max={Math.max(1, Math.round(snap.duration))}
        value={position}
        onChange={(event) => controls.seek(Number(event.target.value))}
        aria-label={c.ariaSeek}
        style={range}
      />
      <span className="inline-block min-w-[4ch] text-left font-label text-label-sm tabular-nums text-muted">{formatTime(Math.max(0, snap.duration - position))}</span>
    </div>
  );
}

export function PlayButton({ controls, size = 42 }: { controls: PlayerControls; size?: number }) {
  const c = siteContent.soundtrack;
  const Icon = controls.playing ? Pause : Play;
  return (
    <button
      type="button"
      data-cursor-hover
      onClick={controls.toggle}
      data-lab-play
      aria-label={controls.playing ? c.ariaPause : c.ariaPlay}
      style={{ ...iconButton(size), border: "none", background: "var(--color-accent)", color: "var(--color-background)" }}
    >
      <Icon aria-hidden="true" size={Math.round(size * 0.38)} fill="currentColor" />
    </button>
  );
}

export function StepButton({ controls, direction }: { controls: PlayerControls; direction: -1 | 1 }) {
  const c = siteContent.soundtrack;
  const Icon = direction < 0 ? SkipBack : SkipForward;
  return (
    <button type="button" data-cursor-hover onClick={() => controls.step(direction)} aria-label={direction < 0 ? c.ariaPrevious : c.ariaNext} style={iconButton()}>
      <Icon aria-hidden="true" size={17} fill="currentColor" />
    </button>
  );
}

export function TransportRow({ controls }: { controls: PlayerControls }) {
  const c = siteContent.soundtrack;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-[18px]">
        <StepButton controls={controls} direction={-1} />
        <PlayButton controls={controls} />
        <StepButton controls={controls} direction={1} />
      </div>
      <div className="flex w-20 flex-none items-center gap-2">
        <Volume2 aria-hidden="true" size={15} className="flex-none text-muted" />
        <input type="range" min={0} max={100} value={Math.round(controls.snap.volume * 100)} onChange={(event) => controls.setVolume(Number(event.target.value) / 100)} aria-label={c.ariaVolume} style={range} />
      </div>
    </div>
  );
}

// Freeze the wave as a small icon button, for the sheet: reachable while the
// music plays. Nothing moves under reduced motion, so it is not offered then.
export function FreezeButton({ reduce }: { reduce: boolean }) {
  const frozen = useFrozen();
  const c = siteContent.listen;
  if (reduce) return null;
  const label = frozen ? c.unfreeze : c.freeze;
  return (
    <button
      type="button"
      data-cursor-hover
      data-lab-freeze
      aria-pressed={frozen}
      aria-label={label}
      title={label}
      onClick={() => setFrozen(!frozen)}
      style={{ ...iconButton(26), color: frozen ? "var(--color-accent)" : "var(--color-muted)", borderColor: frozen ? "var(--color-accent)" : "var(--color-border)" }}
    >
      <Snowflake aria-hidden="true" size={13} />
    </button>
  );
}
