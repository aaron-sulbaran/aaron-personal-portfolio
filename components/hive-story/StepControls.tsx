"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { hiveStoryCopy } from "@/lib/content/hive-story";

const { controls } = hiveStoryCopy;

type Props = {
  step: number; // 0 based
  count: number;
  playing: boolean;
  canPlay?: boolean; // false under reduced motion: stepping only, as still frames
  onBack: () => void;
  onNext: () => void;
  onToggle: () => void;
  label: string; // what is being stepped, for the buttons' names
};

/** Back, Play or Pause, Next, and where you are: every animation on the page can be stepped by hand. */
export function StepControls({ step, count, playing, canPlay = true, onBack, onNext, onToggle, label }: Props) {
  return (
    <div className="hive-controls" role="group" aria-label={`${label}: ${controls.group}`}>
      <button type="button" className="hive-control" onClick={onBack} disabled={step <= 0} aria-label={`${controls.back}, ${label}`}>
        <ChevronLeft aria-hidden="true" size={18} strokeWidth={2.25} />
      </button>
      {canPlay && (
        <button type="button" className="hive-control hive-control-wide" onClick={onToggle} aria-label={`${playing ? controls.pause : controls.play}, ${label}`}>
          {playing ? <Pause aria-hidden="true" size={16} strokeWidth={2.25} /> : <Play aria-hidden="true" size={16} strokeWidth={2.25} />}
          <span aria-hidden="true">{playing ? controls.pause : controls.play}</span>
        </button>
      )}
      <button type="button" className="hive-control" onClick={onNext} disabled={step >= count - 1} aria-label={`${controls.next}, ${label}`}>
        <ChevronRight aria-hidden="true" size={18} strokeWidth={2.25} />
      </button>
      <span className="hive-control-count tabular-nums" aria-live="polite">{controls.count(step + 1, count)}</span>
    </div>
  );
}
