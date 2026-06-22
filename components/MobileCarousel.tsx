"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import { siteContent, type HomeTile, type Photo, type WorkItem } from "@/lib/content";

// Payload handed back to the parent when a card is tapped, so it can open the
// right modal. Mirrors GlassTile's TileActivatePayload but lives here so the
// mobile carousel does not depend on the ring tile component.
export type CarouselOpenPayload =
  | { kind: "photo"; photo: Photo }
  | { kind: "work"; workItem: WorkItem };

type Props = {
  // The parent owns the open/closed state; the carousel plays its own enter and
  // exit tweens when this flips, then unmounts itself after the exit.
  active: boolean;
  // Card index to center when the carousel opens (the ring "home" card).
  initialFocus: number;
  onExitToPage: () => void; // swipe up: continue to the rest of the page
  onExitToRing: () => void; // swipe down: reform the ring
  onOpen: (payload: CarouselOpenPayload) => void; // tap the centered card
  onFocusChange?: (index: number) => void; // centered card changed (for an index readout)
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
const VISIBLE = 4;              // cards each side of center that render (the rest are culled)
const DRAG_PX_PER_CARD = 96;    // horizontal drag distance to advance one card
const TILT_MAX_DEG = 8;         // extra kinetic lean added in the swipe direction
const SNAP_SECONDS = 0.42;      // settle-to-card after a flick
const ENTER_SECONDS = 0.5;      // fade + rise when the carousel opens
const AXIS_LOCK_PX = 10;        // travel before committing to swipe vs. exit
const EXIT_SWIPE_PX = 64;       // vertical travel that counts as "leave"
const MOMENTUM_MS = 220;        // flick projection horizon

type Resolved =
  | { key: string; kind: "photo"; src: string; alt: string; payload: CarouselOpenPayload }
  | { key: string; kind: "work"; logo: string; alt: string; payload: CarouselOpenPayload };

function resolve(tile: HomeTile): Resolved | null {
  if (tile.kind === "photo") {
    const photo = siteContent.photos.find((p) => p.src === tile.src);
    if (!photo) return null;
    return { key: tile.key, kind: "photo", src: photo.src, alt: photo.alt, payload: { kind: "photo", photo } };
  }
  const workItem = siteContent.workItems.find((w) => w.slug === tile.slug);
  if (!workItem) return null;
  return {
    key: tile.key,
    kind: "work",
    logo: workItem.logo,
    alt: `${workItem.title} logo`,
    payload: { kind: "work", workItem },
  };
}

// Soft diagonal sheen + tinted wash, lifted from GlassTile so the carousel cards
// read as the same frosted glass as the ring (no visual drift between states).
const sheenStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, transparent 42%, rgba(255,255,255,0.04) 100%)",
};
const workTintStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, color-mix(in srgb, var(--color-glass) 50%, transparent) 48%, color-mix(in srgb, var(--color-accent) 40%, transparent) 100%)",
};

export function MobileCarousel({
  active,
  initialFocus,
  onExitToPage,
  onExitToRing,
  onOpen,
  onFocusChange,
}: Props) {
  // Resolved once: siteContent is a static import, so this never changes. Keep
  // it referentially stable so the touch effect below attaches its listeners
  // exactly once per open. (A fresh array each render re-ran that effect mid-
  // swipe, tearing the gesture state down and freezing the cards.)
  const cards = useMemo(
    () => siteContent.homeTiles.map(resolve).filter(Boolean) as Resolved[],
    [],
  );
  const total = cards.length;

  // Mounted while open OR while the exit tween is still playing, so the fade-out
  // is visible before we remove the overlay.
  const [mounted, setMounted] = useState(false);
  const [displayFocus, setDisplayFocus] = useState(initialFocus);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rotationRef = useRef(initialFocus); // focus in card units; round() = centered card
  const enterTweenRef = useRef<gsap.core.Tween | null>(null);
  const moveTweenRef = useRef<gsap.core.Tween | null>(null);

  // Signed shortest offset of card i from the focus, wrapped to [-total/2, total/2)
  // so the row loops forever with no end wall.
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

  // Write every card's transform/opacity/stacking from the current rotation.
  // tiltDeg is the transient kinetic lean added in the swipe direction.
  const layout = useCallback(
    (tiltDeg: number) => {
      const vw = window.innerWidth;
      const stepX = (vw * STEP_VW) / 100;
      for (let i = 0; i < total; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const off = wrapOff(i - rotationRef.current);
        const aoff = Math.abs(off);
        if (aoff > VISIBLE + 0.5) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }
        // Side cards turn to face center: left of center (off<0) faces right,
        // right of center faces left. Ramps to the full angle by one card out.
        const faceDir = off === 0 ? 0 : off < 0 ? 1 : -1;
        const face = faceDir * Math.min(aoff, 1) * FACE_DEG;
        const tx = off * stepX;
        const ty = -aoff * SIDE_LIFT_PX;
        const tz = -aoff * DEPTH_PX;
        el.style.transform =
          `translate(-50%, -50%) translate3d(${tx}px, ${ty}px, ${tz}px) rotateY(${face + tiltDeg}deg)`;
        // Center card opaque; neighbors fade to translucent glass so the stack
        // behind reads through them.
        el.style.opacity = String(Math.max(0.18, 1 - aoff * 0.26));
        el.style.zIndex = String(1000 - Math.round(aoff * 10));
        el.style.pointerEvents = aoff < 0.5 ? "auto" : "none";
      }
    },
    [total, wrapOff],
  );

  const emitFocus = useCallback(() => {
    const f = focusedIndex();
    setDisplayFocus((prev) => (prev === f ? prev : f));
    onFocusChange?.(f);
  }, [focusedIndex, onFocusChange]);

  // ---- Open / close: fade + rise the whole stage, never touch the cards' own
  // coverflow transforms (those are owned by layout()).
  useEffect(() => {
    if (active) {
      rotationRef.current = initialFocus;
      setDisplayFocus(initialFocus);
      setMounted(true);
      return;
    }
    if (!mounted) return;
    // Closing: fade out, then unmount.
    enterTweenRef.current?.kill();
    const stage = stageRef.current;
    if (!stage) {
      setMounted(false);
      return;
    }
    enterTweenRef.current = gsap.to(stage, {
      autoAlpha: 0,
      y: 26,
      scale: 0.92,
      duration: 0.32,
      ease: "power2.in",
      onComplete: () => setMounted(false),
    });
  }, [active, mounted, initialFocus]);

  // Once mounted (and open), lay the cards out and play the entrance.
  useEffect(() => {
    if (!mounted) return;
    layout(0);
    emitFocus();
    const stage = stageRef.current;
    if (!stage) return;
    enterTweenRef.current?.kill();
    gsap.set(stage, { autoAlpha: 0, y: 30, scale: 0.9 });
    enterTweenRef.current = gsap.to(stage, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: ENTER_SECONDS,
      ease: "power3.out",
    });
    return () => {
      enterTweenRef.current?.kill();
      moveTweenRef.current?.kill();
    };
    // layout/emitFocus are stable; we only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ---- Touch: horizontal swipe rotates the row; a deliberate vertical swipe
  // exits (up -> page, down -> ring); a tap on the centered card opens it.
  useEffect(() => {
    if (!mounted) return;
    const surface = stageRef.current?.parentElement;
    if (!surface) return;

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let vX = 0; // px/ms
    let axis: "x" | "y" | null = null;
    let base = rotationRef.current;
    let moved = false;
    // The carousel can mount in the middle of the swipe that opened it (that
    // finger is still down). That touch never fired onStart here, so its start
    // coordinates would be garbage and it would lock to the wrong axis and
    // freeze. Only act on a gesture that began with a fresh onStart on this
    // surface; ignore the tail of the opening swipe until the finger lifts.
    let started = false;

    const onStart = (e: TouchEvent) => {
      moveTweenRef.current?.kill();
      const t = e.touches[0];
      if (!t) return;
      startX = lastX = t.clientX;
      startY = t.clientY;
      lastT = e.timeStamp;
      vX = 0;
      axis = null;
      moved = false;
      base = rotationRef.current;
      started = true;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      e.preventDefault(); // the carousel owns every touch while open
      if (!started) return; // tail of the opening swipe; wait for a fresh touch
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        moved = true;
      }
      if (axis !== "x") return; // vertical resolves on release
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
    const onEnd = (e: TouchEvent) => {
      if (!started) return; // never saw a fresh start (opening-swipe tail)
      started = false;
      if (axis === "y") {
        const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
        if (dy <= -EXIT_SWIPE_PX) return onExitToPage();
        if (dy >= EXIT_SWIPE_PX) return onExitToRing();
        return;
      }
      if (!moved) {
        onOpen(cards[focusedIndex()].payload);
        return;
      }
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

    const onCancel = () => {
      started = false;
      axis = null;
    };

    surface.addEventListener("touchstart", onStart, { passive: true });
    surface.addEventListener("touchmove", onMove, { passive: false });
    surface.addEventListener("touchend", onEnd, { passive: true });
    surface.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      surface.removeEventListener("touchstart", onStart);
      surface.removeEventListener("touchmove", onMove);
      surface.removeEventListener("touchend", onEnd);
      surface.removeEventListener("touchcancel", onCancel);
    };
    // Attach exactly once per open. cards is memoized and every callback below
    // is stable, so re-running this effect would only happen on a focus-driven
    // re-render, which used to reset the in-flight gesture and freeze the cards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Re-lay out on viewport resize/orientation change so the fan stays centered.
  useEffect(() => {
    if (!mounted) return;
    const onResize = () => layout(0);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted, layout]);

  if (!mounted) return null;

  const focusedCard = cards[displayFocus];

  return (
    <div
      className="fixed inset-0 z-40 overflow-hidden [touch-action:none] md:hidden"
      aria-label="Photo and work carousel"
    >
      {/* Perspective stage. autoAlpha/scale/y are tweened on enter and exit.
          bg-background sits on the stage (not the fixed root) so it fades in
          with the cards on open and fades out on exit, crossfading cleanly to
          the ring (swipe down) or the page scrolled behind it (swipe up). */}
      <div
        ref={stageRef}
        className="absolute inset-0 bg-background"
        style={{ perspective: `${PERSPECTIVE_PX}px`, perspectiveOrigin: "center 46%" }}
      >
        {cards.map((card, i) => (
          <div
            key={card.key}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="absolute left-1/2 top-[46%] overflow-hidden rounded-[14px] shadow-[0_20px_50px_-18px_rgba(10,10,10,0.6)] ring-1 ring-white/20 [backface-visibility:hidden] [will-change:transform]"
            style={{ width: `${CARD_VW}vw`, height: `${CARD_VW * (4 / 3)}vw` }}
          >
            {card.kind === "photo" ? (
              <Image
                src={card.src}
                alt={card.alt}
                fill
                quality={90}
                sizes="62vw"
                className="object-cover opacity-90"
              />
            ) : (
              <>
                <span aria-hidden="true" className="absolute inset-0" style={workTintStyle} />
                <div className="absolute inset-0 flex items-center justify-center p-[14%]">
                  <Image
                    src={card.logo}
                    alt={card.alt}
                    width={240}
                    height={240}
                    className="h-auto w-[86%] object-contain opacity-90"
                  />
                </div>
              </>
            )}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={sheenStyle} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.14)]"
            />
          </div>
        ))}
      </div>

      {/* Index readout + gesture hint, pinned under the fan. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[7%] z-[1100] flex flex-col items-center gap-1 px-6 text-center">
        {focusedCard && (
          <span className="font-serif text-lg italic text-foreground">
            {siteContent.homeTiles[displayFocus]?.title}
          </span>
        )}
        <span className="text-[10px] font-medium uppercase tracking-caps text-muted">
          {displayFocus + 1} / {total} · swipe up to continue · down for the ring
        </span>
      </div>
    </div>
  );
}
