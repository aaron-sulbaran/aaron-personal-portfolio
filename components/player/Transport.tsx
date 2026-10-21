"use client";

import { Repeat, Repeat1, Shuffle } from "lucide-react";
import { playerStrings } from "@/lib/content/player";
import { iconButton } from "@/components/soundtrack/PillParts";
import { PlayButton, StepButton } from "./PlayerBits";
import type { PlayerControls } from "./usePlayerControls";

// Shuffle and repeat are quiet toggles at the ends of the row: muted until on,
// then the accent with a small dot under them, so the state reads without a
// label. Repeat cycles off, all tracks, this track.
function Toggle({ kind, mode, on, label, pressed, onClick, children }: { kind: "shuffle" | "repeat"; mode: string; on: boolean; label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      data-cursor-hover
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      data-player-toggle={kind}
      data-state={mode}
      className="relative"
      style={{ ...iconButton(), width: 32, height: 32, borderRadius: 999, color: on ? "var(--color-accent)" : "var(--color-muted)" }}
    >
      {children}
      <span aria-hidden="true" className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-accent transition-opacity duration-200" style={{ opacity: on ? 1 : 0 }} />
    </button>
  );
}

// Previous, a larger round play button, next, with shuffle at the left end and repeat at the right.
export function Transport({ controls }: { controls: PlayerControls }) {
  const { queue } = controls;
  const RepeatIcon = queue.repeat === "one" ? Repeat1 : Repeat;
  return (
    <div className="flex items-center justify-between" data-player-transport>
      <Toggle kind="shuffle" mode={queue.shuffle ? "on" : "off"} on={queue.shuffle} pressed={queue.shuffle} label={playerStrings.shuffle} onClick={controls.toggleShuffle}>
        <Shuffle aria-hidden="true" size={16} />
      </Toggle>
      <div className="flex items-center gap-4">
        <StepButton controls={controls} direction={-1} />
        <PlayButton controls={controls} size={48} />
        <StepButton controls={controls} direction={1} />
      </div>
      <Toggle kind="repeat" mode={queue.repeat} on={queue.repeat !== "off"} label={playerStrings.repeat[queue.repeat]} onClick={controls.cycleRepeat}>
        <RepeatIcon aria-hidden="true" size={16} />
      </Toggle>
    </div>
  );
}
