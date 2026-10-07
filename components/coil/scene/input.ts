import { COIL } from "@/lib/coil/constants";
import {
  decideWheel,
  gestureOwner,
  nudgeShown,
  pageScrolled,
  pointerMoved,
  type CaptureState,
} from "@/lib/coil/capture";
import { insideSilhouette } from "@/lib/coil/geometry";
import { addWheel, rowHoldWeight, stepConveyor, stepEnvelope, wheelPixels } from "@/lib/coil/motion";
import { Observer } from "@/lib/gsap";
import type { Cards } from "./cards";
import { pushStat } from "./debug";
import { heroVisible, type Hover } from "./hover";
import type { LoopLink, SceneCtx, SceneFrame } from "./state";

// What moves the coil. A fine pointer's wheel spins it when the gesture
// starts on a card, or in the seam between two, after a real pointer move
// (ownership per gesture, lib/coil/capture.ts; the rules are
// docs/coil-input-model.md section 3), and a click opens the card
// under it; a coarse pointer drags it sideways and throws it, and a tap opens
// the card with no flight. Each frame the conveyor takes its feeds (idle,
// wheel, the throw's coast) through one smoothing stage and the spin cap, and
// the nudge shows while a coil gesture is held. Page scroll is not a feed: the
// coil keeps its own pace while the page moves (Aaron, 2026-10-06).

// Slice 7, the touch drag: a released flick coasts on this time constant (an
// exponential throw, distance = velocity * tau) and settles on a card.
const COAST_TAU_S = 0.325;
const COAST_SETTLED_CARDS = 0.002;
const DRAG_MINIMUM_PX = 4;
const CLICK_SLOP_PX = 6;

export function createInput(ctx: SceneCtx, cards: Cards, hover: Hover, loop: LoopLink) {
  const { st, host, live, tiles, debug, flags } = ctx;
  const { pointer, view, conveyor, envelope, rowHold, unwind } = st;
  const { pinned } = flags;
  const { slots } = cards;

  function updatePointerLocal() {
    pointer.x = pointer.clientX - (view.docLeft - window.scrollX);
    pointer.y = pointer.clientY - (view.docTop - window.scrollY);
  }

  // Only the canvas itself counts: the overlay's control, the mark, the Menu
  // pill and its scrim all sit over the hero and must never pick a card.
  function pointerOverHero(target: EventTarget | null) {
    if (!(target instanceof Node) || !host.contains(target)) return false;
    return pointer.x >= 0 && pointer.x <= view.width && pointer.y >= 0 && pointer.y <= view.height;
  }

  // ---- fx-input: wheel ownership (lib/coil/capture.ts) ----
  // The hero may take a wheel gesture: ready, entrance over, not frozen, not
  // unwound, a fine pointer, and not a pinch (ctrl + wheel).
  function wheelInteractive(event: WheelEvent) {
    const props = live.current;
    return (
      st.ready &&
      !props.frozen &&
      !st.frozenByApi &&
      props.interactive &&
      props.input === "fine" &&
      !event.ctrlKey &&
      !unwind.on
    );
  }

  // The pointer over the canvas and inside the helix's projected hull (gaps
  // between cards included), from the last rendered frame: what releases a
  // coil gesture.
  function pointerInsideHelix() {
    return pointer.inside && st.sil !== null && insideSilhouette(st.sil, pointer.x, pointer.y);
  }

  // The pointer over the canvas and on a card picking could pick, or within
  // the seam margin of one, from the last rendered frame: where a gesture may
  // start.
  function pointerOnCard() {
    return pointer.inside && hover.nearCardAt(pointer.x, pointer.y);
  }

  function setCapture(next: CaptureState, nowMs: number) {
    if (debug && gestureOwner(st.capture, nowMs) === "coil" && next.owner === "page") debug.released += 1;
    st.capture = next;
  }

  // Only a real move counts: a card or a gap passing under a still pointer is
  // not a move, so it never releases a coil gesture, and it never arms one.
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const moved = !pointer.known || event.clientX !== pointer.clientX || event.clientY !== pointer.clientY;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.known = true;
    updatePointerLocal();
    pointer.inside = pointerOverHero(event.target);
    const now = performance.now();
    if (moved) {
      const facts = { nowMs: now, insideSilhouette: pointerInsideHelix(), x: event.clientX, y: event.clientY };
      setCapture(pointerMoved(st.capture, facts), now);
    }
    loop.wake();
  };

  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget) return;
    pointer.inside = false;
    pointer.known = false;
    const now = performance.now();
    setCapture(pointerMoved(st.capture, { nowMs: now, insideSilhouette: false, x: event.clientX, y: event.clientY }), now);
  };

  // The page scrolled, by any means (a page gesture, keyboard, the scrollbar,
  // an anchor jump): outside a coil gesture, the next gesture waits for a real
  // pointer move, so the page sliding a card under a still pointer never
  // hands that card the wheel.
  const onScroll = () => {
    const now = performance.now();
    const x = pointer.known ? pointer.clientX : Number.NaN;
    const y = pointer.known ? pointer.clientY : Number.NaN;
    setCapture(pageScrolled(st.capture, { nowMs: now, x, y }), now);
  };

  // Decided once per gesture (events under COIL.capture.gestureGapMs apart,
  // trackpad inertia included): a gesture that starts on a card or a seam
  // (or anywhere inside the helix while the last coil gesture still holds the
  // pointer), armed by a real pointer move since the page last scrolled, with
  // the hero at least half in view, spins the coil from its first event, in
  // both directions, and the page does not move; any other gesture scrolls
  // the page natively. The coil responds on the frame after the event (one
  // smoothing stage and the spin cap, nothing before the first motion).
  const onWheel = (event: WheelEvent) => {
    const now = performance.now();
    const fresh = gestureOwner(st.capture, now) === null;
    if (fresh) {
      // Some synthesized wheels carry no position (0, 0); the last pointer
      // position stands in, as in the lab.
      if (event.clientX !== 0 || event.clientY !== 0 || !pointer.known) {
        pointer.clientX = event.clientX;
        pointer.clientY = event.clientY;
      }
      updatePointerLocal();
      pointer.inside = pointerOverHero(event.target);
    }
    setCapture(
      decideWheel(st.capture, {
        nowMs: now,
        interactive: wheelInteractive(event),
        heroVisible: fresh ? heroVisible(host) : 1,
        onCard: fresh ? pointerOnCard() : true,
        insideSilhouette: fresh ? pointerInsideHelix() : true,
        x: pointer.clientX,
        y: pointer.clientY,
      }),
      now,
    );
    if (st.capture.owner !== "coil") return;
    event.preventDefault();
    if (fresh && debug) debug.captured += 1;
    addWheel(conveyor, wheelPixels(event.deltaX, event.deltaY, event.deltaMode, view.height));
    loop.wake();
  };

  // Wheels elsewhere on the page (the host never sees them) still belong to
  // the running gesture: a gesture that left the hero stays the page's, and
  // one that began outside it never becomes the coil's on arrival.
  const onWindowWheel = (event: WheelEvent) => {
    if (event.target instanceof Node && host.contains(event.target)) return;
    const now = performance.now();
    const facts = { nowMs: now, interactive: false, heroVisible: 0, onCard: false, insideSilhouette: false, x: event.clientX, y: event.clientY };
    setCapture(decideWheel(st.capture, facts), now);
  };
  // ---- end fx-input ----

  function listenPointer() {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut);
    host.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("wheel", onWindowWheel, { passive: true }); // fx-input
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerOut);
      host.removeEventListener("wheel", onWheel);
      window.removeEventListener("wheel", onWindowWheel); // fx-input
      window.removeEventListener("scroll", onScroll);
    };
  }

  let downAt: { x: number; y: number } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    downAt = { x: event.clientX, y: event.clientY };
  };
  // The browser took the touch as a pan (a vertical swipe): no tap.
  const onPointerCancel = () => {
    downAt = null;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = downAt;
    downAt = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
    // ---- slice 7: a tap opens the card under the finger, with no flight ----
    if (event.pointerType === "touch") {
      const props = live.current;
      if (!st.ready || st.dragging || st.pressCaughtCoil || !props.interactive || props.frozen || st.frozenByApi || unwind.on) return;
      const card = hover.cardAt(event.clientX, event.clientY);
      if (card) props.onCardClick?.({ ...card, tap: true });
      return;
    }
    // ---- end slice 7 ----
    if (!st.ready || st.hoveredSlot < 0 || live.current.input !== "fine") return;
    const slot = slots[st.hoveredSlot];
    const tile = tiles[slot.tile];
    // Slice 5 wiring block (the flight): the handler freezes, projects the
    // card's quad through the api and opens the modal. Until then it is unset.
    live.current.onCardClick?.({ key: tile.key, slot: st.hoveredSlot });
  };

  function listenTaps() {
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerCancel);
    return () => {
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerCancel);
    };
  }

  // ---- slice 7: the coarse pointer's drag-to-spin ----
  // The hero is touch-action: pan-y, so the browser keeps every vertical swipe
  // (a swipe starting on a card scrolls the page, never hijacked) and hands
  // horizontal ones to this Observer, which locks each gesture to its first
  // axis. A horizontal drag moves the conveyor's target under the finger (the
  // front card follows it); the release throws it, and the throw coasts
  // through the same smoothing stage and speed cap and settles on a card. A
  // new touch catches a coasting coil. Nothing before the entrance ends, while
  // frozen or unwound, or on a fine pointer (its wheel and hover do the work).
  let pressScrollY = 0;
  function canDrag() {
    const props = live.current;
    return st.ready && props.interactive && props.input === "coarse" && !props.frozen && !st.frozenByApi && !unwind.on;
  }
  // Cards per px of horizontal finger travel: the front card's arc per card,
  // across the screen.
  function dragCardsPerPx() {
    if (!st.geo) return 0;
    return 1 / Math.max(1, st.geo.step * st.geo.cardPx * Math.cos(st.geo.axisRad));
  }
  function listenDrag() {
    const dragObserver = Observer.create({
      target: host,
      type: "touch",
      lockAxis: true,
      dragMinimum: DRAG_MINIMUM_PX,
      onPress: () => {
        pressScrollY = window.scrollY;
        st.pressCaughtCoil = st.coast !== null;
        if (st.coast) {
          conveyor.target = conveyor.offset;
          st.coast = null;
        }
      },
      onDrag: (self) => {
        // The page moved: the browser took this gesture as a vertical pan.
        if (self.axis !== "x" || Math.abs(window.scrollY - pressScrollY) > 2 || !canDrag()) return;
        st.dragging = true;
        conveyor.glide = null;
        conveyor.target += self.deltaX * dragCardsPerPx();
        loop.wake();
      },
      onRelease: (self) => {
        if (!st.dragging) return;
        st.dragging = false;
        if (!canDrag()) return;
        const cap = COIL.spinCapCardsPerSecond;
        const velocity = Math.min(cap, Math.max(-cap, self.velocityX * dragCardsPerPx()));
        st.coast = { rest: Math.round(conveyor.target + velocity * COAST_TAU_S) };
        loop.wake();
      },
    });
    return () => dragObserver.kill(); // slice 7
  }
  // ---- end slice 7 ----

  // Update step: the pointer's canvas position at the page's current scroll.
  function scroll() {
    updatePointerLocal();
  }

  // Update step: the conveyor's feeds, its one smoothing stage and spin cap, and the stretch envelope.
  function feedConveyor(f: SceneFrame) {
    const { dt, now } = f;
    const previous = conveyor.offset;
    if (!pinned) {
      // Slice 7: a released drag's throw decays into the target, which the
      // one smoothing stage and the speed cap then carry, as for the wheel.
      if (st.coast) conveyor.target += (st.coast.rest - conveyor.target) * (1 - Math.exp(-dt / COAST_TAU_S));
      // ---- fx-input: the conveyor's feeds ----
      // A held book row stills the idle drift (and eases it back after it
      // lets go); the idle drift also waits while a finger holds or throws
      // the coil, so the coast lands exactly on its card.
      const holdWeight = rowHoldWeight(rowHold, now);
      stepConveyor(conveyor, { dt, nowMs: now, idleWeight: st.dragging || st.coast ? 0 : holdWeight });
      // ---- end fx-input ----
      stepEnvelope(envelope, conveyor.excessVelocity, dt);
      if (st.coast && Math.abs(st.coast.rest - conveyor.offset) < COAST_SETTLED_CARDS) st.coast = null;
    }
    if (debug) {
      pushStat(debug.steps, conveyor.offset - previous);
      pushStat(debug.envelope, envelope.value);
    }
  }

  // ---- fx-input: the nudge ----
  // Update step. Only while a coil gesture has been held 2.6s; gone the
  // instant the gesture ends or passes to the page. A caret by the cursor
  // points off the helix.
  function nudge(f: SceneFrame) {
    const overlay = f.props.overlay.current;
    const sil = st.sil;
    if (sil && pointer.known && nudgeShown(st.capture, f.now)) {
      const px = pointer.x - sil.ax;
      const py = pointer.y - sil.ay;
      const along = px * sil.dx + py * sil.dy;
      let nx = px - along * sil.dx;
      let ny = py - along * sil.dy;
      const length = Math.hypot(nx, ny);
      if (length < 1) {
        nx = -sil.dy;
        ny = sil.dx;
      } else {
        nx /= length;
        ny /= length;
      }
      overlay?.nudge({ x: pointer.x, y: pointer.y, angle: Math.atan2(ny, nx) });
    } else {
      overlay?.nudge(null);
    }
  }
  // ---- end fx-input ----

  // QA: the touch drag.
  function dragState() {
    return {
      dragging: st.dragging,
      coast: st.coast?.rest ?? null,
      offset: conveyor.offset,
      target: conveyor.target,
      velocity: conveyor.velocity,
      cardsPerPx: dragCardsPerPx(),
    };
  }

  return { listenPointer, listenTaps, listenDrag, scroll, conveyor: feedConveyor, nudge, dragState };
}

export type Input = ReturnType<typeof createInput>;
