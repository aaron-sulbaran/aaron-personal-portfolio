"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ScrollTrigger } from "@/lib/gsap";
import { Portal } from "./Portal";
import { getSoundtrackPlayer } from "@/lib/audio";
import { getSoundtrackState, type SoundtrackState } from "@/lib/soundtrack";

// Reactive twin-line particle waveform behind the back half, replacing the old
// ASCII glyph drift. A horizontal centerline of fine round dots displaces and
// fuzzes with energy, reading as a soundwave. It inherits the ASCII field's
// whole lifecycle: body level via Portal so the pinned #hero-pin transform never
// captures this fixed canvas, z-0 / pointer-events-none / aria-hidden, a
// ScrollTrigger keyed to #work that ramps the field in only once the journey
// begins, rAF that runs only while visible and the tab is foregrounded, colors
// read from the resolved theme tokens (re-read on the data-theme observer), and
// a full unmount under reduced motion. The canvas + effect live in an inner
// component INSIDE the Portal so the effect only runs once the canvas is mounted.
//
// The wave is always a blend of three regimes (spec section 3.3): idle (the big
// ambient drift, the only state Phase 1 shows), paused (a thin almost-flat
// waiting line), and reactive (the audio-driven wave). The reactive energy comes
// from an AudioFrame (lib/audio.ts getSoundtrackPlayer), a lazy AnalyserNode
// over the self-hosted tracks; the renderer never changes when the source does.
// regimeOf below maps the live soundtrack state (lib/soundtrack.ts) to the
// three regimes, so the wave tracks real playback, not a placeholder.
//
// Mobile is deferred (spec section 9): the effect bails on narrow viewports so
// no waveform runs there in v1.

type Regime = "idle" | "paused" | "reactive";

// before / off are the same big idle drift; on is reactive; paused is the thin
// waiting line. The felt difference between before and off lives in the pill
// (Phase 3), not the wave.
const regimeOf = (s: SoundtrackState): Regime =>
  s === "on" ? "reactive" : s === "paused" ? "paused" : "idle";

const SPACING_DESKTOP = 13; // px between columns, denser than the old 30px field
const SPACING_NARROW = 12;
const DOT_GAP = 6.5; // px vertical gap between stacked fuzz dots
const FRAME_MS = 22; // ~45fps, matching the playground's motion fidelity
const MOBILE_MAX = 767;

// The one accent color is reserved for the reactive wave's energy peaks. These
// gates sit above the idle drift's magnitude ceiling (~0.25) so idle and paused
// stay fully muted and accent only ever reads on music-on peaks. The playground's
// 0.42 / 0.5 starting points never crossed under the chill-playlist dynamics
// (section 3.2 says tune live), so accent never showed; these let the peaks read.
const ACCENT_LINE = 0.3; // centerline dot turns accent above this magnitude
const ACCENT_PEAK = 0.36; // fuzz tips turn accent above this magnitude

// cursor interaction (spec section 3.4)
const REPEL_RADIUS = 92;
const REPEL_FORCE = 26;
const CARVE_RADIUS = 74;

const TAU = Math.PI * 2;

export function Waveform() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <Portal>
      <WaveCanvas />
    </Portal>
  );
}

function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    const source = getSoundtrackPlayer();

    // Deferred on mobile in v1 (spec section 9): the rAF / draw is gated off below
    // narrow viewports so the canvas stays inert there. Recomputed in build() on
    // resize, so crossing the boundary either way recovers without a reload.
    let isMobile = false;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let spacing = SPACING_DESKTOP;
    let columns = 0;
    let startX = 0;
    let baseline = 0;
    let maxAmp = 0;

    // per-column smoothed state, preserved across resizes
    const mag: number[] = []; // current magnitude (thickness) per column
    const carve: number[] = []; // current cursor carve depth per column

    // regime levels lerp toward their targets so transitions are felt, not cut
    let idleLevel = regimeOf(getSoundtrackState()) === "idle" ? 1 : 0;
    let pausedLevel = 0;
    let reactLevel = 0;

    let muted: [number, number, number] = [136, 136, 136];
    let accent: [number, number, number] = [127, 168, 201];
    const cursor = { x: -9999, y: -9999, on: false };

    let fieldAlpha = 0; // global ramp-in, lerps toward alphaTarget
    let alphaTarget = 0; // 0..1 from the #work scroll ramp
    let raf = 0;
    let last = 0;

    // reused per-frame dot buffers: flat [x, y, r, ...], muted then accent
    const mDots: number[] = [];
    const aDots: number[] = [];

    const hexToRgb = (hex: string): [number, number, number] => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    const readColors = () => {
      const style = getComputedStyle(document.documentElement);
      const m = style.getPropertyValue("--color-muted").trim();
      const a = style.getPropertyValue("--color-accent").trim();
      if (m.startsWith("#")) muted = hexToRgb(m);
      if (a.startsWith("#")) accent = hexToRgb(a);
    };

    const build = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      isMobile = w <= MOBILE_MAX;
      spacing = w < 760 ? SPACING_NARROW : SPACING_DESKTOP;
      columns = Math.floor(w / spacing);
      startX = (w - columns * spacing) / 2 + spacing / 2;
      baseline = h * 0.52;
      maxAmp = Math.min(h * 0.42, 300);
      for (let i = 0; i < columns; i++) {
        if (mag[i] === undefined) mag[i] = 0;
        if (carve[i] === undefined) carve[i] = 0;
      }
    };

    // push a dot with the cursor repel applied (spec section 3.4)
    const pushDot = (arr: number[], px: number, py: number, r: number) => {
      if (cursor.on) {
        const dx = px - cursor.x;
        const dy = py - cursor.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < REPEL_RADIUS * REPEL_RADIUS && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const force = (1 - d / REPEL_RADIUS) * REPEL_FORCE;
          px += (dx / d) * force;
          py += (dy / d) * force;
        }
      }
      arr.push(px, py, r);
    };

    const fillDots = (arr: number[], rgb: [number, number, number], alpha: number) => {
      if (!arr.length) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.beginPath();
      for (let k = 0; k < arr.length; k += 3) {
        // moveTo to the circle's right edge before arc, so consecutive dots are
        // not joined by a stray chord in the single batched path.
        ctx.moveTo(arr[k] + arr[k + 2], arr[k + 1]);
        ctx.arc(arr[k], arr[k + 1], arr[k + 2], 0, TAU);
      }
      ctx.fill();
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      mDots.length = 0;
      aDots.length = 0;

      // Read the live soundtrack state each frame and map it to the three
      // regimes. The asymmetric lerp rates are what make the transitions felt
      // (spec 3.3): opt-in springs reactive up from near-zero audio (reading as
      // the thin line coming alive), pause collapses fast into the thin waiting
      // line and holds there, and only opt-out blooms slowly back to idle.
      const soundtrack = getSoundtrackState();
      const regime = regimeOf(soundtrack);
      const idleT = regime === "idle" ? 1 : 0;
      const pausedT = regime === "paused" ? 1 : 0;
      const reactT = regime === "reactive" ? 1 : 0;
      idleLevel += (idleT - idleLevel) * (idleT ? 0.03 : 0.07);
      pausedLevel += (pausedT - pausedLevel) * (pausedT ? 0.14 : 0.06);
      reactLevel += (reactT - reactLevel) * (reactT ? 0.05 : 0.11);

      const frame = source.sample(t, columns);

      // draw() receives the rAF timestamp in MILLISECONDS; every wave sine below
      // is authored in SECONDS, exactly like the playground's `now / 1000`.
      // Converting once here is what keeps the drift calm and coherent; using the
      // raw millisecond clock aliases the motion ~1000x too fast (the jitter).
      const time = t / 1000;

      for (let i = 0; i < columns; i++) {
        const x = startX + i * spacing;

        const ambient =
          0.11 + 0.07 * Math.sin(time * 0.5 + i * 0.35) + 0.05 * Math.sin(time * 0.21 + i * 0.12);
        const thin = 0.035 + 0.015 * Math.sin(time * 1.3 + i * 0.6);
        const reactive = frame.bands[i];
        const fuzz = 0.016;

        let target =
          fuzz + ambient * idleLevel + thin * pausedLevel + reactive * reactLevel;

        // carve: suppress the columns near the cursor toward zero, healing back
        // smoothly as the cursor moves away (rate ~0.1).
        const cd = Math.abs(x - cursor.x);
        const nearBand = Math.abs(cursor.y - baseline) < maxAmp + 70;
        const carveTarget =
          cursor.on && nearBand && cd < CARVE_RADIUS ? 1 - cd / CARVE_RADIUS : 0;
        carve[i] += (carveTarget - carve[i]) * 0.1;
        target *= 1 - carve[i] * 0.9;

        // magnitude springs up quickly, eases down slowly
        mag[i] += (target - mag[i]) * (target > mag[i] ? 0.35 : 0.12);
        const H = mag[i];
        const amp = H * maxAmp;

        // signed displacement: the waving shape. Idle and paused drifts are
        // shaped here; the reactive amplitude rides the audio level.
        const dAmb = Math.sin(i * 0.25 + time * 0.6) * 0.16;
        const dThin = Math.sin(i * 0.4 + time * 1.0) * 0.02;
        const dMusic =
          (Math.sin(i * 0.3 - time * 3) * 0.42 + Math.sin(i * 0.13 - time * 1.5) * 0.2) *
          frame.level;
        const disp =
          (dAmb * idleLevel + dThin * pausedLevel + dMusic * reactLevel) * maxAmp;

        const cy = baseline - disp;
        const peak = H > ACCENT_PEAK;
        pushDot(H > ACCENT_LINE ? aDots : mDots, x, cy, 2.2);

        const thick = Math.floor(amp / DOT_GAP);
        for (let k = 1; k <= thick; k++) {
          const off = k * DOT_GAP;
          const fade = 1 - k / (thick + 1.5);
          const shimmer = 0.5 + 0.5 * Math.sin(time * 6 + i * 1.3 + k * 2.1);
          const tip = k >= thick && peak;
          if (shimmer < 0.5 + fade * 0.45) {
            pushDot(tip ? aDots : mDots, x, cy - off, 1.8);
            pushDot(tip ? aDots : mDots, x, cy + off, 1.8);
          }
        }
      }

      // presence comes from size and density, not opacity, so the layers stay
      // muted (0.55) with accent only at the peaks (0.9), faded by the ramp.
      fillDots(mDots, muted, 0.55 * fieldAlpha);
      fillDots(aDots, accent, 0.9 * fieldAlpha);
      ctx.globalAlpha = 1;
    };

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < FRAME_MS) return;
      last = t;
      fieldAlpha += (alphaTarget - fieldAlpha) * 0.08;
      if (alphaTarget < 0.003 && fieldAlpha < 0.004) {
        fieldAlpha = 0;
        draw(t);
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      draw(t);
    };

    const ensureRunning = () => {
      if (!raf && !document.hidden && !isMobile) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    readColors();
    build();

    // Scroll ramp keyed to #work, identical hardening to the old field: onUpdate
    // tracks gradual scrolling; the leave/enter handlers keep it correct on jumps
    // (anchor clicks, the spine's section jumps) that skip the range in one step.
    const work = document.getElementById("work");
    const createTrigger = () =>
      ScrollTrigger.create({
        trigger: work as Element,
        // Reveal only once the pinned ring/deck has cleared: #work reaching the
        // top of the viewport is the moment the hero pin fully releases, so the
        // wave blooms in as the last of the deck slides away, not during it.
        start: "top 12%",
        end: "top top",
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          alphaTarget = self.progress;
          if (alphaTarget > 0.003) ensureRunning();
        },
        onEnter: ensureRunning,
        onEnterBack: ensureRunning,
        onLeave: () => {
          alphaTarget = 1;
          ensureRunning();
        },
        onLeaveBack: () => {
          alphaTarget = 0;
        },
      });

    // The wave never draws below MOBILE_MAX, so skip the trigger there; the
    // resize handler below creates it if the viewport later crosses up to
    // desktop width.
    let st: ScrollTrigger | null =
      work && window.innerWidth > MOBILE_MAX ? createTrigger() : null;

    if (work && work.getBoundingClientRect().top < window.innerHeight * 0.12) {
      alphaTarget = 1;
      ensureRunning();
    }

    const onMove = (e: PointerEvent) => {
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      cursor.on = true;
    };
    const onLeaveWindow = () => {
      cursor.on = false;
      cursor.x = -9999;
      cursor.y = -9999;
    };
    const onResize = () => {
      readColors();
      build();
      if (isMobile) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
        ctx.clearRect(0, 0, w, h);
      } else {
        // Crossed from mobile to desktop with no trigger yet (it was skipped
        // at setup): create it now so the scroll ramp comes alive.
        if (work && !st) st = createTrigger();
        if (alphaTarget > 0.003) ensureRunning();
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      } else if (alphaTarget > 0.003) {
        ensureRunning();
      }
    };
    const themeObserver = new MutationObserver(readColors);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    if (fine) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("mouseleave", onLeaveWindow);
    }
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      st?.kill();
      themeObserver.disconnect();
      if (fine) {
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("mouseleave", onLeaveWindow);
      }
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
