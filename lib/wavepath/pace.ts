import { dotReach } from "./columns";
import { CROSS_S, DRAW_SPEED, TRAIN_FADE } from "./constants";
import type { Span } from "./spine";
import type { SpineSamples } from "./geometry";
import type { RouteKind } from "./serpentine";

// The head's pace. The head draws the line at a calm speed while any ink of its train is on the screen, so the wave crosses
// the page the way a reader scrolls it, and runs at DRAW_SPEED only while none is: it catches up with the reader behind the
// edges, the cards section's field and the top of the page, where nobody sees it go. Pure: the view feeds it the frame.

// The calm speed, px of arc per second: the screen's width over the seconds a crossing takes (CROSS_S).
export const calmSpeed = (kind: RouteKind, width: number): number => width / CROSS_S[kind];

export interface InkFrame {
  samples: SpineSamples;
  head: number; // arc, px
  tail: number; // arc, px: where the train's ink starts (-Infinity: the whole line behind the head)
  train: number | null; // px of arc, or null when everything behind the head stays drawn
  width: number;
  viewTop: number; // layer px
  viewHeight: number;
  amplitude: number;
  cards: Span; // the cards section's field hides the line
  dt: number; // seconds the frame steps: the head may cover DRAW_SPEED of it before the next look
}

// Whether any ink of the train is on the screen, or will be by the end of this frame's step at the fastest: a spine sample between
// the tail (past the part of the fade that is nearly clear) and the head, within the dots' reach of the viewport, and not behind
// the cards section's field. The train is looked at a frame's travel at DRAW_SPEED farther out at both ends, so the head has
// slowed by the time its first dot shows and never lurches in.
export function inkOnScreen(f: InkFrame): boolean {
  const { samples: s } = f;
  const reach = dotReach(f.amplitude);
  const ahead = DRAW_SPEED * f.dt;
  const from = Math.max(0, (f.train === null ? 0 : f.tail + 0.2 * f.train * TRAIN_FADE) - ahead);
  const last = Math.min(s.count - 1, Math.floor((f.head + ahead) / s.step));
  for (let i = Math.ceil(from / s.step); i <= last; i++) {
    const y = s.y[i];
    if (y > f.viewTop - reach && y < f.viewTop + f.viewHeight + reach && s.x[i] > -reach && s.x[i] < f.width + reach && !(y >= f.cards.top && y <= f.cards.bottom)) return true;
  }
  return false;
}

// The speed the head may go at this frame.
export const headCap = (calm: number, f: InkFrame): number => (inkOnScreen(f) ? Math.min(calm, DRAW_SPEED) : DRAW_SPEED);
