"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Cover, iconButton } from "@/components/soundtrack/PillParts";
import { MarqueeTitle } from "@/components/soundtrack/MarqueeTitle";
import { siteContent } from "@/lib/content";
import type { PlayerControls } from "./usePlayerControls";

// The lab player's shared pieces, drawn from the same controls object: the
// title block and the transport buttons. Title and artist are both
// MarqueeTitle, so a long name (an artist "featuring" someone) fades at the
// edges and scrolls in every player state.

export function TitleBlock({ controls, coverSize, titleSize }: { controls: PlayerControls; coverSize: number; titleSize: number }) {
  const { track } = controls;
  return (
    <>
      <Cover size={coverSize} cover={track.cover} title={track.title} />
      <span className="min-w-0 flex-1">
        <MarqueeTitle text={track.title} style={{ fontFamily: "var(--font-display)", fontSize: titleSize, lineHeight: 1.15, color: "var(--color-foreground)" }} />
        <MarqueeTitle text={track.artist} className="mt-0.5 font-label text-label-sm text-muted" />
      </span>
    </>
  );
}

// The main play button: a round accent button between the two skips.
export function PlayButton({ controls, size = 42 }: { controls: PlayerControls; size?: number }) {
  const c = siteContent.soundtrack;
  const Icon = controls.playing ? Pause : Play;
  return (
    <button
      type="button"
      data-cursor-hover
      onClick={controls.toggle}
      data-player-play
      aria-label={controls.playing ? c.ariaPause : c.ariaPlay}
      style={{ ...iconButton(size), border: "none", background: "var(--color-accent)", color: "var(--color-background)" }}
    >
      <Icon aria-hidden="true" size={Math.round(size * 0.4)} fill="currentColor" />
    </button>
  );
}

export function StepButton({ controls, direction, size = 36 }: { controls: PlayerControls; direction: -1 | 1; size?: number }) {
  const c = siteContent.soundtrack;
  const Icon = direction < 0 ? SkipBack : SkipForward;
  return (
    <button
      type="button"
      data-cursor-hover
      onClick={() => controls.step(direction)}
      data-player-step={direction < 0 ? "previous" : "next"}
      aria-label={direction < 0 ? c.ariaPrevious : c.ariaNext}
      style={{ ...iconButton(), width: size, height: size, borderRadius: 999, color: "var(--color-foreground)" }}
    >
      <Icon aria-hidden="true" size={Math.round(size * 0.55)} fill="currentColor" />
    </button>
  );
}
