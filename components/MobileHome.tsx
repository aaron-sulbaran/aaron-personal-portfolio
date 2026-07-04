"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotionValue } from "framer-motion";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { siteContent, photoBySrc, workItemBySlug, type HomeTile, type Photo, type WorkItem } from "@/lib/content";
import { GlassTile } from "./GlassTile";

// Payload handed back to the parent when a card is tapped, so it can open the
// right modal. Mirrors GlassTile's TileActivatePayload but lives here so the
// mobile home does not depend on the ring tile component.
export type CarouselOpenPayload =
  | { kind: "photo"; photo: Photo }
  | { kind: "work"; workItem: WorkItem };

type Props = {
  // Tap the centered coverflow card (or a ring card) to open its modal. No
  // flight on mobile, so the parent opens the modal with renderMedia.
  onOpen: (payload: CarouselOpenPayload) => void;
  // The shared hero copy wrapper (owned by TileRing). Faded out imperatively as
  // the ring collapses into the coverflow, exactly like the desktop collapse
  // fades it, so the centered hero text never lingers behind the cards.
  heroContentRef: React.RefObject<HTMLDivElement | null>;
  // Gate scroll-collapse setup until the entrance has resolved (mirrors the
  // desktop scrollReady gate) so the pin's reflow never snaps the hero fade.
  scrollReady: boolean;
  prefersReducedMotion: boolean;
};

// ---- Coverflow geometry. A real 3D fan: the centered card faces the viewer
// head-on and is opaque; cards step out to the sides, turning to face center,
// receding in depth, and fading to translucent glass so the ones behind show
// through. Tuned in viewport units so it reads the same across phone sizes.
const PERSPECTIVE_PX = 680;     // stage depth; smaller = stronger 3D foreshortening
const CARD_VW = 46;             // focused card width as a fraction of viewport width
const STEP_VW = 27;             // horizontal gap between adjacent card centers (vw); < card width so they overlap
const DEPTH_PX = 84;            // px each step recedes into the screen
const FACE_DEG = 50;            // how far side cards turn to face center (center card is flat)
const SIDE_LIFT_PX = 6;         // small vertical rise per step so the fan arcs
const VISIBLE = 4;              // cards each side of center that render in the coverflow
const COVERFLOW_Y_FRAC = -0.04; // lift the whole fan slightly above center so the index readout fits below

// ---- Ring geometry. The SAME cards rest in a circle (mirroring the desktop
// ring) when collapsed all the way back. Cards are laid out at full coverflow
// size and scaled DOWN into the ring (never up), so the photos stay sharp; a
// scale-up would rerasterize the small bitmap and blur it (the old bug). The
// desktop ring rests its tiles at 9vmin on a 42vmin radius (~70% arc fill, no
// overlap); CARD_VW (46vw, ~=46vmin in portrait) * RING_SCALE lands the mobile
// ring card at ~9.2vmin to match that proven spacing.
const RING_RADIUS_VMIN = 42;    // ring radius (matches the desktop ring radius)
const RING_SCALE = 0.2;         // card scale at rest in the ring (full size -> ~9vmin ring size)
// Glass-detail multiplier for the mobile GlassTile. The card is laid out at full
// CARD_VW (~179px at 390px wide), so to read like desktop's 8px-radius-on-72px
// card (~11% roundness), the mobile radius must be ~20px -> detailScale ~2.5.
// The radius/card ratio is invariant under CSS transform scale, so this same
// value keeps the frosted look cohesive at the ring scale (0.2) and at the
// coverflow scale (1). See GlassTile's detailScale prop doc.
const DETAIL_SCALE = 2.5;

// ---- Scroll-collapse scrub. Scrolling down scrubs progress 0 (ring) -> 1
// (settled coverflow); scrolling past the end releases the pin to the rest of
// the page; scrolling back up reforms the ring. Snap nudges to whichever state
// is nearer if the user stops mid-scrub.
const PIN_END = "+=65%";        // scroll distance the ring->coverflow transition spans
const SCRUB = 0.4;              // smoothed scrub so chunky touch deltas glide
const FADE_FAR_AT = 0.7;        // far (culled) cards finish fading by this progress so they do not streak

// ---- Swipe browsing (only once settled at progress 1). Horizontal swipe
// rotates the row; a tap opens the centered card. Vertical drags are left to
// native scroll, which drives the scrub (up reforms the ring, down leaves).
const DRAG_PX_PER_CARD = 96;    // horizontal drag distance to advance one card
const TILT_MAX_DEG = 8;         // extra kinetic lean added in the swipe direction
const SNAP_SECONDS = 0.42;      // settle-to-card after a flick
const AXIS_LOCK_PX = 10;        // travel before committing to horizontal swipe vs. vertical scroll
const MOMENTUM_MS = 220;        // flick projection horizon

// ---- Entrance choreography. A faithful, smaller-scale port of the desktop
// ring entrance (computeTarget in TileRing): the deck piles at center, riffles
// like a card dealer (one card pops to the top in a fast cycle), then fans out
// along a curved arc to the ring seats. Driven by one entrance clock (ms) so
// layout() stays the single owner of every card transform. See docs/design.md
// "Home-ring entrance choreography".
const ENTER_FIRST_MS = 200;      // first card fades in alone at center
const ENTER_STACK_MS = 150;      // the rest flash in on top of it
const ENTER_SHUFFLE_MS = 460;    // riffle window before the fan
const ENTER_SHUFFLE_TICK_MS = 150; // how fast the top card cycles during the riffle
const ENTER_FAN_MS = 720;        // per-card travel time from the deck to its ring seat
const ENTER_FAN_STAGGER_MS = 16; // tiles bloom in ring order so the fan sweeps the circle

// Pile depth + riffle pop, in px (the deck is tiny on mobile, so a few px of Z
// stagger is enough to keep the stacked glass slabs from z-fighting).
const STACK_Z_STEP_PX = 3;       // per-card depth stagger while piled
// Depth clearance for the popped riffle card ABOVE the deepest pile card.
// zIndex alone cannot lift it: the cards live in the root's 3D rendering
// context (perspective), where depth sorting beats z-index, so without a real
// Z pop the "top" card renders behind the pile and gets sliced by the cards
// in front (the mobile shuffle-clip bug, confirmed via runtime depth logs
// 2026-07-03). Mirrors desktop's SHUFFLE_TOP_Z.
const SHUFFLE_TOP_CLEARANCE_PX = 12;
const SHUFFLE_LIFT_VMIN = 1.2;   // the popped card lifts this far
const SHUFFLE_TILT_DEG = 4;      // and cants left/right by index parity
const SHUFFLE_SCALE = 1.04;      // and grows slightly as it pops

// Curved fan-out arc (revolve), matching the desktop fan: each tile bows past
// the straight chord and swings gently clockwise into its seat.
const FAN_SWEEP_DEG = 36;
const FAN_ARC_LIFT_VMIN = 6;

type Resolved = {
  key: string;
  tile: HomeTile;
  title: string;
  payload: CarouselOpenPayload;
};

function resolve(tile: HomeTile): Resolved | null {
  if (tile.kind === "photo") {
    const photo = photoBySrc.get(tile.src);
    if (!photo) return null;
    return { key: tile.key, tile, title: tile.title, payload: { kind: "photo", photo } };
  }
  const workItem = workItemBySlug.get(tile.slug);
  if (!workItem) return null;
  return { key: tile.key, tile, title: tile.title, payload: { kind: "work", workItem } };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
// easeOutQuint, matching the desktop fan's baked-in decelerate.
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

export function MobileHome({ onOpen, heroContentRef, scrollReady, prefersReducedMotion }: Props) {
  // Resolved once: siteContent is a static import, so this never changes. Keep
  // it referentially stable so the touch effect attaches its listeners exactly
  // once. (A fresh array each render re-ran that effect mid-swipe, tearing the
  // gesture state down and freezing the cards.)
  const cards = useMemo(
    () => siteContent.homeTiles.map(resolve).filter(Boolean) as Resolved[],
    [],
  );
  const total = cards.length;
  // The coverflow opens centered on the middle card (the ring "home" card).
  const homeFocus = Math.floor(total / 2);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Static proximity-flip inputs for GlassTile. The desktop ring drives these
  // from cursor proximity; mobile has no hover, so they stay flat and the cards
  // never tilt on their own (the coverflow's own rotateY does all the turning).
  const flipRotateX = useMotionValue(0);
  const flipRotateY = useMotionValue(0);

  // Live scrub + browse state, kept in refs so the rAF/scroll/touch paths can
  // write them every frame without re-rendering the 20 cards.
  const progressRef = useRef(0);          // 0 ring -> 1 settled coverflow
  const rotationRef = useRef(homeFocus);  // focus in card units; round() = centered card
  const settledRef = useRef(false);       // progress has reached the coverflow end
  const readyRef = useRef(false);         // entrance choreography has finished
  const entranceMsRef = useRef(0);        // entrance clock in ms (drives pile/shuffle/fan)
  const moveTweenRef = useRef<gsap.core.Tween | null>(null);

  // Centered card for the index readout, only re-rendered on a focus change
  // (debounced to whole-card snaps). `entering` toggles GlassTile's opaque
  // backing during the entrance; `engaged` reveals the coverflow caption.
  const [displayFocus, setDisplayFocus] = useState(homeFocus);
  const [entering, setEntering] = useState(true);
  const [engaged, setEngaged] = useState(false);

  // Entrance window boundaries (ms), derived from the per-phase durations.
  const fanTotalMs = ENTER_FAN_MS + ENTER_FAN_STAGGER_MS * (total - 1);
  const tFirstEnd = ENTER_FIRST_MS;
  const tStackEnd = tFirstEnd + ENTER_STACK_MS;
  const tShuffleEnd = tStackEnd + ENTER_SHUFFLE_MS;
  const tFanStart = tShuffleEnd;
  const tFanEnd = tShuffleEnd + fanTotalMs;

  // Signed shortest offset of card i from the focus, wrapped to [-total/2,
  // total/2) so the row loops forever with no end wall.
  const wrapOff = useCallback(
    (off: number) => {
      const half = total / 2;
      return ((((off + half) % total) + total) % total) - half;
    },
    [total],
  );

  const focusedIndex = useCallback(
    () => ((Math.round(rotationRef.current) % total) + total) % total,
    [total],
  );

  const ease = useMemo(() => gsap.parseEase("power2.inOut"), []);

  // Write every card's transform/opacity/stacking. Two regimes share the same
  // ring-seat geometry so the handoff is seamless:
  //   - Entrance (clock < tFanEnd, not ready): pile -> riffle -> curved fan from
  //     center out to the ring seat. progress is 0 here, so this owns position.
  //   - Ready: straight interpolation from the ring seat (progress 0) to the
  //     coverflow slot (progress 1), driven by the scroll scrub + swipe.
  // The fan ends exactly at the ring seat at scale RING_SCALE, which is also the
  // ready regime's progress-0 state, so there is no jump at the handoff.
  const layout = useCallback(
    (tiltDeg: number) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const vmin = Math.min(vw, vh);
      const ringR = (RING_RADIUS_VMIN / 100) * vmin;
      const ms = entranceMsRef.current;
      const inEntrance = !prefersReducedMotion && !readyRef.current && ms < tFanEnd;

      // Riffle: which card is currently popped to the top of the deck.
      const shuffleTop =
        ms >= tStackEnd && ms < tShuffleEnd
          ? Math.floor((ms - tStackEnd) / ENTER_SHUFFLE_TICK_MS) % total
          : -1;

      for (let i = 0; i < total; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;

        // Ring seat: a circle around the hero center, each card tangent to the
        // ring (its local up-vector aligned with the radial).
        const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
        const tangentDeg = (angle * 180) / Math.PI + 90;
        const ringX = Math.cos(angle) * ringR;
        const ringY = Math.sin(angle) * ringR;

        if (inEntrance) {
          // ---- Entrance regime: pile / riffle / curved fan-out. ----
          // Per-card fan progress: tiles unfurl in ring order, staggered.
          const fp = clamp01((ms - (tFanStart + i * ENTER_FAN_STAGGER_MS)) / ENTER_FAN_MS);
          const u = easeOutQuint(fp);

          // Reveal: the first card fades in alone, then the rest flash in.
          let revealOpacity: number;
          if (ms < tFirstEnd) revealOpacity = i === 0 ? clamp01(ms / tFirstEnd) : 0;
          else if (ms < tStackEnd) revealOpacity = i === 0 ? 1 : clamp01((ms - tFirstEnd) / ENTER_STACK_MS);
          else revealOpacity = 1;

          // Curved arc from the center deck (0,0) to the ring seat. Quadratic
          // bezier with a control point swung back and bowed past the chord.
          const seatAngle = Math.atan2(ringY, ringX);
          const seatRadius = Math.hypot(ringX, ringY);
          const sweepRad = (FAN_SWEEP_DEG * Math.PI) / 180;
          const controlAngle = seatAngle - sweepRad / 2;
          const controlRadius = seatRadius / 2 + (FAN_ARC_LIFT_VMIN / 100) * vmin;
          const controlX = Math.cos(controlAngle) * controlRadius;
          const controlY = Math.sin(controlAngle) * controlRadius;
          const x = 2 * (1 - u) * u * controlX + u * u * ringX;
          const y = 2 * (1 - u) * u * controlY + u * u * ringY;
          const rotZ = tangentDeg * u;

          // Pile depth eases to 0 as the card fans; the popped card pops to a
          // REAL depth above the whole pile (see SHUFFLE_TOP_CLEARANCE_PX).
          const isTop = i === shuffleTop;
          const pileZ = i * STACK_Z_STEP_PX;
          const z = isTop
            ? (total - 1) * STACK_Z_STEP_PX + SHUFFLE_TOP_CLEARANCE_PX
            : (1 - u) * pileZ;
          const liftPx = isTop ? (SHUFFLE_LIFT_VMIN / 100) * vmin : 0;
          const tilt = isTop ? (i % 2 === 0 ? SHUFFLE_TILT_DEG : -SHUFFLE_TILT_DEG) : 0;
          const scale = RING_SCALE * (isTop ? SHUFFLE_SCALE : 1);

          el.style.transform =
            `translate(-50%, -50%) translate3d(${x}px, ${y - liftPx}px, ${z}px) rotateY(0deg) rotate(${rotZ + tilt}deg) scale(${scale})`;
          el.style.opacity = String(revealOpacity);
          el.style.zIndex = String(isTop ? 1500 : 1000 + i);
          el.style.pointerEvents = "none";
          continue;
        }

        // ---- Ready regime: ring seat (progress 0) -> coverflow slot (1). ----
        const p = progressRef.current;
        const e = p <= 0 ? 0 : p >= 1 ? 1 : ease(p);
        const rotation = rotationRef.current;
        const stepX = (vw * STEP_VW) / 100;
        const coverY = COVERFLOW_Y_FRAC * vh;

        const off = wrapOff(i - rotation);
        const aoff = Math.abs(off);
        const visible = aoff <= VISIBLE + 0.5;
        const faceDir = off === 0 ? 0 : off < 0 ? 1 : -1;
        const face = faceDir * Math.min(aoff, 1) * FACE_DEG;
        const cfX = off * stepX;
        const cfY = -aoff * SIDE_LIFT_PX + coverY;
        const cfZ = -aoff * DEPTH_PX;
        const cfOpacity = visible ? Math.max(0.18, 1 - aoff * 0.26) : 0;

        const x = (1 - e) * ringX + e * cfX;
        const y = (1 - e) * ringY + e * cfY;
        const z = e * cfZ;
        const scale = RING_SCALE + e * (1 - RING_SCALE);
        const rotZ = (1 - e) * tangentDeg;
        const rotY = e * (face + (settledRef.current ? tiltDeg : 0));
        // Far cards (culled in the coverflow) finish fading early so they do not
        // streak across the screen during the collapse; near cards fade with e.
        const fade = cfOpacity <= 0.001 ? clamp01(1 - p / FADE_FAR_AT) : 1;
        const baseOpacity = (1 - e) * 1 + e * cfOpacity;

        el.style.transform =
          `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateY(${rotY}deg) rotate(${rotZ}deg) scale(${scale})`;
        el.style.opacity = String(baseOpacity * fade);
        el.style.zIndex = String(1000 - Math.round(aoff * 10));
        // Tappable in the ring rest and on the settled coverflow; inert mid-
        // scrub so a tap never opens a half-collapsed card.
        const tappable = baseOpacity * fade > 0.05 && (p < 0.02 || settledRef.current);
        el.style.pointerEvents = tappable ? "auto" : "none";
      }

      // Fade the shared hero as the ring gathers into the coverflow, matching the
      // desktop collapse (which fades the same wrapper). Untouched during the
      // entrance (the hero stays hidden until the ring is ready anyway).
      const hero = heroContentRef.current;
      if (hero && !inEntrance) {
        const p = progressRef.current;
        const e = p <= 0 ? 0 : p >= 1 ? 1 : ease(p);
        hero.style.opacity = String(1 - Math.min(1, e * 1.4));
        hero.style.pointerEvents = e > 0.02 ? "none" : "";
      }
    },
    [total, wrapOff, ease, heroContentRef, prefersReducedMotion, tFanEnd, tFanStart, tFirstEnd, tStackEnd, tShuffleEnd],
  );

  const emitFocus = useCallback(() => {
    const f = focusedIndex();
    setDisplayFocus((prev) => (prev === f ? prev : f));
  }, [focusedIndex]);

  // ---- Entrance: pile -> riffle -> fan the cards into the ring as soon as the
  // component mounts, NOT gated on scrollReady. layout() is the single owner of
  // every card's transform (including the translate(-50%,-50%) that centers it),
  // so if we waited on the desktop phase machine's scrollReady (~2s) the cards
  // would sit at their raw CSS default for that whole window. Running the
  // choreography on mount means the deck is laid out and animating from frame
  // one. The pin/scrub below still waits on scrollReady so its reflow never
  // snaps the hero fade.
  useGSAP(
    () => {
      if (prefersReducedMotion) return;
      readyRef.current = false;
      entranceMsRef.current = 0;
      progressRef.current = 0;
      rotationRef.current = homeFocus;
      settledRef.current = false;
      setEntering(true);
      layout(0);

      const clock = { ms: 0 };
      const tween = gsap.to(clock, {
        ms: tFanEnd,
        duration: tFanEnd / 1000,
        ease: "none",
        onUpdate: () => {
          entranceMsRef.current = clock.ms;
          layout(0);
        },
        onComplete: () => {
          readyRef.current = true;
          entranceMsRef.current = tFanEnd;
          setEntering(false);
          layout(0);
        },
      });
      return () => {
        tween.kill();
      };
    },
    { scope: rootRef, dependencies: [total, prefersReducedMotion] },
  );

  // ---- Scroll-collapse setup: pin the hero block and scrub the ring into the
  // coverflow. Reuses #hero-pin (the same block the desktop collapse pins),
  // gated by matchMedia so the desktop and mobile pins never coexist. Reduced
  // motion gets a static ring (no pin, no scrub) in the effect below. The
  // entrance is owned by the mount effect above, so this only wires pin/scrub.
  useGSAP(
    () => {
      if (!scrollReady) return;
      if (prefersReducedMotion) return;
      const heroPin = document.getElementById("hero-pin");
      if (!heroPin) return;

      const mm = gsap.matchMedia();

      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        // Re-assert the scrub baseline; the entrance is owned by the mount
        // effect, so do NOT reset entranceMsRef here.
        progressRef.current = 0;
        settledRef.current = false;
        layout(0);

        const st = ScrollTrigger.create({
          trigger: heroPin,
          start: "top top",
          end: PIN_END,
          pin: heroPin,
          pinType: "fixed",
          pinSpacing: true,
          anticipatePin: 1,
          scrub: SCRUB,
          // Catch the ring or the settled coverflow so a stop mid-scrub nudges to
          // whichever is nearer; near the very end leave the value alone so a
          // downward scroll can release the pin to the rest of the page.
          snap: {
            snapTo: (value: number) => (value < 0.5 ? 0 : value < 0.96 ? 1 : value),
            duration: 0.3,
            delay: 0.05,
            ease: "power2.inOut",
          },
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            // The scrub can fire before the entrance clock finishes (the gates
            // overlap by a hair); force ready so the collapse always wins.
            readyRef.current = true;
            progressRef.current = self.progress;
            settledRef.current = self.progress >= 0.999;
            setEngaged((prev) => {
              const next = self.progress > 0.5;
              return prev === next ? prev : next;
            });
            layout(0);
            emitFocus();
          },
        });

        return () => {
          moveTweenRef.current?.kill();
          st.kill();
          const hero = heroContentRef.current;
          if (hero) {
            hero.style.opacity = "";
            hero.style.pointerEvents = "";
          }
        };
      });

      // Keep pin/scrub measurements correct after the post-ready layout and async
      // font swaps. Also re-derives the scrub from a restored scroll position so a
      // deep reload mid-coverflow re-lays-out for free.
      ScrollTrigger.refresh();
      if (typeof document !== "undefined" && document.fonts) {
        document.fonts.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
      }

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [scrollReady, prefersReducedMotion, total] },
  );

  // ---- Reduced motion: static ring, no pin, no scrub. The cards rest in the
  // ring (tappable to open) and the page scrolls past normally.
  useEffect(() => {
    if (!prefersReducedMotion) return;
    readyRef.current = true;
    entranceMsRef.current = tFanEnd;
    progressRef.current = 0;
    rotationRef.current = homeFocus;
    settledRef.current = false;
    setEntering(false);
    layout(0);
  }, [prefersReducedMotion, homeFocus, layout, tFanEnd]);

  // ---- Touch: once settled at the coverflow, a horizontal swipe rotates the
  // row and a tap opens the centered card. Vertical drags are NOT intercepted,
  // so native scroll drives the scrub (down releases the pin to the page, up
  // reforms the ring). While not settled, every touch is left to native scroll.
  useEffect(() => {
    if (prefersReducedMotion) return;
    const surface = rootRef.current;
    if (!surface) return;

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let vX = 0; // px/ms
    let axis: "x" | "y" | null = null;
    let base = rotationRef.current;
    let active = false; // a gesture that began settled and is browsing horizontally

    const onStart = (e: TouchEvent) => {
      moveTweenRef.current?.kill();
      const t = e.touches[0];
      if (!t) return;
      startX = lastX = t.clientX;
      startY = t.clientY;
      lastT = e.timeStamp;
      vX = 0;
      axis = null;
      base = rotationRef.current;
      active = settledRef.current;
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      // Only the settled coverflow owns horizontal browsing. Mid-scrub (or in the
      // ring) leave the touch to native scroll so it drives the collapse.
      if (!active || !settledRef.current) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      }
      if (axis !== "x") return; // vertical: let native scroll reform the ring / leave
      e.preventDefault(); // horizontal browse owns the gesture
      const now = e.timeStamp;
      const dt = now - lastT;
      if (dt > 0) vX = (t.clientX - lastX) / dt;
      lastX = t.clientX;
      lastT = now;
      rotationRef.current = base - dx / DRAG_PX_PER_CARD;
      const tilt = Math.max(-TILT_MAX_DEG, Math.min(TILT_MAX_DEG, -vX * 40));
      layout(tilt);
      emitFocus();
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (axis !== "x") return; // vertical resolved by native scroll
      // Flick: project momentum, then snap to the nearest card.
      const projected = rotationRef.current - (vX * MOMENTUM_MS) / DRAG_PX_PER_CARD;
      const target = Math.round(projected);
      moveTweenRef.current?.kill();
      const o = { v: rotationRef.current };
      moveTweenRef.current = gsap.to(o, {
        v: target,
        duration: SNAP_SECONDS,
        ease: "power3.out",
        onUpdate: () => {
          rotationRef.current = o.v;
          layout(0);
          emitFocus();
        },
        onComplete: () => {
          rotationRef.current = target;
          layout(0);
          emitFocus();
        },
      });
    };

    surface.addEventListener("touchstart", onStart, { passive: true });
    surface.addEventListener("touchmove", onMove, { passive: false });
    surface.addEventListener("touchend", onEnd, { passive: true });
    surface.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      surface.removeEventListener("touchstart", onStart);
      surface.removeEventListener("touchmove", onMove);
      surface.removeEventListener("touchend", onEnd);
      surface.removeEventListener("touchcancel", onEnd);
    };
    // Attach once. cards is memoized and every callback is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion]);

  // Re-lay out on viewport resize/orientation change so the ring and fan stay
  // centered.
  useEffect(() => {
    const onResize = () => layout(0);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [layout]);

  // Tap a card. The centered card opens its modal; a side card snaps to center
  // first. In the ring rest any card opens directly. A horizontal swipe never
  // reaches here (the touch handler calls preventDefault, which cancels the
  // synthetic click). GlassTile fires this through onActivate.
  const handleCardActivate = useCallback(
    (i: number) => {
      if (!readyRef.current) return;
      if (!settledRef.current) {
        // Ring rest (progress 0): open the tapped card directly.
        if (progressRef.current < 0.02) onOpen(cards[i].payload);
        return;
      }
      const off = wrapOff(i - rotationRef.current);
      if (Math.abs(off) < 0.5) {
        onOpen(cards[i].payload);
        return;
      }
      // Side card: snap it to center.
      const target = Math.round(rotationRef.current + off);
      moveTweenRef.current?.kill();
      const o = { v: rotationRef.current };
      moveTweenRef.current = gsap.to(o, {
        v: target,
        duration: SNAP_SECONDS,
        ease: "power3.out",
        onUpdate: () => {
          rotationRef.current = o.v;
          layout(0);
          emitFocus();
        },
      });
    },
    [cards, wrapOff, onOpen, layout, emitFocus],
  );

  return (
    <div
      ref={rootRef}
      aria-label="Photo and work cards"
      className="absolute inset-0 z-10 md:hidden [touch-action:pan-y]"
      style={{ perspective: `${PERSPECTIVE_PX}px`, perspectiveOrigin: "center 50%" }}
    >
      {cards.map((card, i) => (
        <div
          key={card.key}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          // opacity-0 until the entrance layout writes an inline opacity, so the
          // cards never flash as a raw stacked pile before the first layout runs
          // (their centering + transform are applied imperatively by layout).
          className="absolute left-1/2 top-1/2 opacity-0 [backface-visibility:hidden] [transform-style:preserve-3d] [will-change:transform,opacity]"
          style={{ width: `${CARD_VW}vw`, height: `${CARD_VW * (4 / 3)}vw` }}
        >
          {/* The real frosted GlassTile, same component the desktop ring uses, so
              the mobile cards read as the identical translucent glass (no visual
              drift). Proximity flip is disabled; the coverflow's own rotateY
              turns the cards. `entering` adds the opaque backing during the
              pile/riffle so stacked cards do not bleed through one another. */}
          <GlassTile
            tile={card.tile}
            entering={entering}
            flipEnabled={false}
            flipRotateX={flipRotateX}
            flipRotateY={flipRotateY}
            detailScale={DETAIL_SCALE}
            onActivate={() => handleCardActivate(i)}
          />
        </div>
      ))}

      {/* Index readout + gesture hint. Shown ONLY once the coverflow is engaged;
          on the ring/hero state it stays hidden (the ring has no caption, just
          like desktop). */}
      <div
        aria-hidden={!engaged}
        className="pointer-events-none absolute inset-x-0 bottom-[7%] z-[1100] flex flex-col items-center gap-1 px-6 text-center transition-opacity duration-300"
        style={{ opacity: engaged ? 1 : 0 }}
      >
        <span className="font-serif text-lg italic text-foreground">
          {cards[displayFocus]?.title}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-caps text-muted">
          {displayFocus + 1} / {total} · swipe to browse · scroll to continue
        </span>
      </div>
    </div>
  );
}
