// The shader field's drift, ported from min/Max (src/lib/brand/shader-drift.ts):
// how far the field has drifted, in seconds of shader time, after `elapsed`
// seconds on screen. Linear by default. With a ping-pong the field plays its
// opening exactly as tuned (speed 1 up to the first turn), then swings between
// `low` and `peak` forever, so the noise never wanders into looks nobody tuned.
//
// The wave is a smoothed triangle: every leg is linear and only the turns ease,
// over `ease` seconds of deceleration into the turn and `ease` seconds of
// acceleration out (constant acceleration, so position and speed stay
// continuous). A turn overshoots its linear leg by ease / 2, which is why
// `peak` and `low` are the true extremes. Clocks are in seconds.
export type PingPong = { low: number; peak: number; ease: number };

export function shaderDrift(elapsed: number, pingPong?: PingPong): number {
  if (!pingPong) return elapsed;
  const { low, peak, ease } = pingPong;
  const top = peak - ease / 2;
  if (elapsed < top) return elapsed;

  const turn = 2 * ease;
  const leg = peak - low - ease;
  const cycle = 2 * turn + 2 * leg;
  const t = (elapsed - top) % cycle;

  if (t < turn) return top + t - (t * t) / (2 * ease);
  if (t < turn + leg) return top - (t - turn);
  const bottom = low + ease / 2;
  if (t < 2 * turn + leg) {
    const u = t - turn - leg;
    return bottom - u + (u * u) / (2 * ease);
  }
  return bottom + (t - 2 * turn - leg);
}

// Dusk's ping-pong, in seconds of drift (the lab's DRIFT).
export const FIELD_DRIFT: PingPong = { low: 10, peak: 15, ease: 2 };
// The lab starts the field clock 10.5s in and plays it at 0.55 speed.
export const FIELD_CLOCK_START = 10.5;
export const FIELD_SPEED = 0.55;
// The still frame under reduced motion (and the poster's tuned moment).
export const FIELD_REST_TIME = 12.5;

// The field's shader time for a clock that has run `elapsed` seconds.
export function fieldTime(elapsed: number, reducedMotion = false) {
  if (reducedMotion) return FIELD_REST_TIME;
  return shaderDrift(elapsed + FIELD_CLOCK_START, FIELD_DRIFT) * FIELD_SPEED;
}
