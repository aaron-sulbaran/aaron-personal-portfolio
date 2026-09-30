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
// A fixed field moment for a caller that asks fieldTime for a still. Nothing
// on the site draws it today: reduced motion mounts no scene and shows the
// posters, and the posters render fieldTime(0), the live field's first frame,
// so the poster-to-scene swap is seamless (components/coil/CoilStage.tsx).
export const FIELD_REST_TIME = 12.5;

// The field's shader time for a clock that has run `elapsed` seconds.
export function fieldTime(elapsed: number, reducedMotion = false) {
  if (reducedMotion) return FIELD_REST_TIME;
  return shaderDrift(elapsed + FIELD_CLOCK_START, FIELD_DRIFT) * FIELD_SPEED;
}

// ---- fx-hero: drift presets (Aaron, 2026-09-29: "you can't really tell
// that it's changing or moving") ----
//
// The field runs on two clocks. The orange clock is the one above, on the
// tuned window, and drives only the burnt orange lobe, so its share of the
// field holds near a fifth at every moment of every preset. The weather clock
// drives the blue structure (the warped vertical gradient and the soft glow);
// the presets widen its ping-pong, speed it up, and deepen the warp, so the
// movement reads within about five seconds while the orange stays put.
// `calm` is the field as it shipped: the weather rides the orange clock.

// The gradient warp the field was tuned at (the lab's 0.45).
export const FIELD_WARP_TUNED = 0.45;

export type DriftPreset = "calm" | "visible" | "lively";
export const DRIFT_PRESET_KEYS: readonly DriftPreset[] = ["calm", "visible", "lively"];
export const DEFAULT_DRIFT: DriftPreset = "visible";

type DriftValues = { pingPong: PingPong; speed: number; warp: number };
export const DRIFT_PRESETS: Readonly<Record<DriftPreset, DriftValues>> = {
  calm: { pingPong: FIELD_DRIFT, speed: FIELD_SPEED, warp: FIELD_WARP_TUNED },
  visible: { pingPong: { low: 5, peak: 21, ease: 3 }, speed: 1.4, warp: 0.7 },
  lively: { pingPong: { low: 3, peak: 27, ease: 3 }, speed: 2, warp: 0.82 },
};

export function parseDriftPreset(raw: string | null | undefined): DriftPreset {
  return DRIFT_PRESET_KEYS.find((key) => key === raw) ?? DEFAULT_DRIFT;
}

export type FieldClocks = { orange: number; weather: number };

// Both clocks for a field that has run `elapsed` seconds.
export function fieldClocks(elapsed: number, reducedMotion = false, preset: DriftPreset = DEFAULT_DRIFT): FieldClocks {
  if (reducedMotion) return { orange: FIELD_REST_TIME, weather: FIELD_REST_TIME };
  const orange = fieldTime(elapsed);
  if (preset === "calm") return { orange, weather: orange };
  const { pingPong, speed } = DRIFT_PRESETS[preset];
  return { orange, weather: shaderDrift(elapsed + FIELD_CLOCK_START, pingPong) * speed };
}
// ---- end fx-hero ----
