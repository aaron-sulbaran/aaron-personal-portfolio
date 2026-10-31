import { COIL } from "@/lib/coil/constants";
import {
  armCapture,
  decideWheel,
  gestureOwner,
  nudgeShown,
  pageScrolled,
  pointerMoved,
  type CaptureState,
} from "@/lib/coil/capture";
import { moveDrag, pressDrag, releaseVelocity, type DragTrack } from "@/lib/coil/dragAxis";
import { insideSilhouette } from "@/lib/coil/geometry";
import { addWheel, rowHoldWeight, stepConveyor, stepEnvelope, wheelPixels } from "@/lib/coil/motion";
import type { Cards } from "./cards";
import { pushStat } from "./debug";
import { canvasPoint, heroVisible, type Hover } from "./hover";
import type { LoopLink, SceneCtx, SceneFrame } from "./state";

// What moves the coil. A wheel spins it when the gesture starts on a card, or
// in the seam between two, after a real pointer move (ownership per gesture,
// lib/coil/capture.ts; the rules are docs/coil-input-model.md section 3), and
// a fine pointer's click opens the card under it; a coarse pointer, and any
// pointer in page 2's phone layout, drags it sideways and throws it, and a
// coarse pointer's tap opens the card with no flight. Each frame the conveyor
// takes its feeds (idle, wheel, the throw's coast) through one smoothing stage
// and the spin cap, and the nudge shows while a coil gesture is held. Page
// scroll is not a feed: the coil keeps its own pace while the page moves
// (Aaron, 2026-10-06).

// Slice 7, the touch drag: a released flick coasts on this time constant (an
// exponential throw, distance = velocity * tau) and settles on a card.
const COAST_TAU_S = 0.325;
const COAST_SETTLED_CARDS = 0.002;
const CLICK_SLOP_PX = 6;

export function createInput(ctx: SceneCtx, cards: Cards, hover: Hover, loop: LoopLink) {
  const { st, host, live, tiles, debug, flags } = ctx;
  const { pointer, view, conveyor, envelope, rowHold, unwind } = st;
  const { pinned } = flags;
  const { slots } = cards;

  function updatePointerLocal() {
    const local = canvasPoint(host, pointer.clientX, pointer.clientY);
    pointer.x = local.x;
    pointer.y = local.y;
  }

  // Only the canvas itself counts: the overlay's control, the mark, the Menu
  // pill and its scrim all sit over the hero and must never pick a card.
  function pointerOverHero(target: EventTarget | null) {
    if (!(target instanceof Node) || !host.contains(target)) return false;
    return pointer.x >= 0 && pointer.x <= view.width && pointer.y >= 0 && pointer.y <= view.height;
  }

  // ---- fx-input: wheel ownership (lib/coil/capture.ts) ----
  // The hero may take a wheel gesture: ready, entrance over, not frozen, not
  // unwound, and not a pinch (ctrl + wheel). Any input driver: a phone never
  // sends a wheel, but a tablet's trackpad and a desktop browser emulating a
  // phone (Chrome's device toolbar, a coarse pointer with no hover) do, and
  // the wheel moves the cards there as it does on a desktop (Aaron, 2026-10-30).
  function wheelInteractive(event: WheelEvent) {
    const props = live.current;
    return st.ready && !props.frozen && !st.frozenByApi && props.interactive && !event.ctrlKey && !unwind.on;
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
    // A coarse pointer sends no hover moves (a tablet's trackpad may; Chrome's
    // device toolbar never does), so a fresh gesture's own position is the
    // pointer's sighting: a wheel where the last one was is a still pointer,
    // and one that has moved rearmPx since the page last scrolled arms capture,
    // the same rule the fine pointer's moves keep.
    if (fresh && live.current.input === "coarse" && (event.clientX !== 0 || event.clientY !== 0)) {
      const moved = !pointer.known || event.clientX !== pointer.clientX || event.clientY !== pointer.clientY;
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
      pointer.known = true;
      updatePointerLocal();
      pointer.inside = pointerOverHero(event.target);
      if (moved) setCapture(pointerMoved(st.capture, { nowMs: now, insideSilhouette: pointerInsideHelix(), x: event.clientX, y: event.clientY }), now);
    }
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
    // A coarse pointer's click (a tablet's trackpad) is a tap too: it has no
    // hover to pick with.
    if (event.pointerType === "touch" || live.current.input === "coarse") {
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

  // ---- slice 7: the drag-to-spin ----
  // The hero is touch-action: pan-y, so the browser keeps every vertical swipe
  // (a swipe starting on a card scrolls the page, never hijacked; the browser
  // cancels the pointer when it takes the pan) and hands horizontal ones to
  // these pointer listeners, which lock each press to its first axis
  // (lib/coil/dragAxis.ts). A horizontal drag moves the conveyor's target
  // under the finger (the front card follows it); the release throws it, and
  // the throw coasts through the same smoothing stage and speed cap and
  // settles on a card. A new press catches a coasting coil. Nothing before the
  // entrance ends, while frozen or unwound. The drag is the coarse pointer's,
  // and any pointer's in page 2's phone layout (a mouse in a phone-width
  // window, a tablet's trackpad): plain pointer events, never touch events,
  // since a browser decides at load whether it has touch (Chrome's device
  // toolbar switched on after load sends touches as pointer events only), and
  // a trackpad's press is no touch at all. On a desktop the fine pointer's
  // wheel and hover do the work.
  let pressScrollY = 0;
  let press: { id: number; track: DragTrack } | null = null;
  function dragDriver() {
    return live.current.input === "coarse" || st.phoneStage;
  }
  function canDrag() {
    const props = live.current;
    return st.ready && props.interactive && dragDriver() && !props.frozen && !st.frozenByApi && !unwind.on;
  }
  // Cards per px of horizontal finger travel: the front card's arc per card,
  // across the screen.
  function dragCardsPerPx() {
    if (!st.geo) return 0;
    return 1 / Math.max(1, st.geo.step * st.geo.cardPx * Math.cos(st.geo.axisRad));
  }
  const onDragPress = (event: PointerEvent) => {
    // One press at a time (a second finger is a pinch, not a drag), the main button only.
    if (press || (event.pointerType === "mouse" && event.button !== 0) || !dragDriver()) return;
    press = { id: event.pointerId, track: pressDrag(event.clientX, event.clientY, performance.now()) };
    pressScrollY = window.scrollY;
    st.pressCaughtCoil = st.coast !== null;
    if (st.coast) {
      conveyor.target = conveyor.offset;
      st.coast = null;
    }
  };
  const onDragMove = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    const next = moveDrag(press.track, event.clientX, event.clientY, performance.now());
    press.track = next.track;
    // The page moved: the browser took this press as a vertical pan.
    if (next.track.axis !== "x" || Math.abs(window.scrollY - pressScrollY) > 2 || !canDrag()) return;
    st.dragging = true;
    conveyor.glide = null;
    conveyor.target += next.dx * dragCardsPerPx();
    loop.wake();
  };
  const onDragRelease = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return;
    const track = press.track;
    press = null;
    if (!st.dragging) return;
    st.dragging = false;
    if (!canDrag()) return;
    const cap = COIL.spinCapCardsPerSecond;
    const velocity = Math.min(cap, Math.max(-cap, releaseVelocity(track, performance.now()) * dragCardsPerPx()));
    st.coast = { rest: Math.round(conveyor.target + velocity * COAST_TAU_S) };
    loop.wake();
  };
  function listenDrag() {
    // The press on the canvas; the moves and the release wherever the pointer
    // goes, after the hero's own tap listeners (bubbling), so a drag's release
    // is still a drag when the tap check reads it.
    host.addEventListener("pointerdown", onDragPress);
    window.addEventListener("pointermove", onDragMove, { passive: true });
    window.addEventListener("pointerup", onDragRelease);
    window.addEventListener("pointercancel", onDragRelease);
    return () => {
      host.removeEventListener("pointerdown", onDragPress);
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragRelease);
      window.removeEventListener("pointercancel", onDragRelease);
      press = null;
    };
  }
  // ---- end slice 7 ----

  // Update step: the pointer's canvas position at the page's current scroll,
  // and, the frame the Coil becomes the reader's (the deal's unfurl: the props'
  // interactive turns true), capture armed: the deal's own scroll to the cards
  // disarmed it, and the reader should not have to nudge the mouse to take the
  // wheel. A gesture already running keeps its owner (lib/coil/capture.ts armCapture).
  // Only a deal that played (its clock exists) arms: a load straight into the
  // cards, or a reduced-motion one, keeps the rule that a pointer must really
  // move before the page can slide a card under it into the coil's hands.
  let wasInteractive = false;
  function scroll() {
    updatePointerLocal();
    const interactive = live.current.interactive;
    const dealPlayed = live.current.entrance?.clockMs !== undefined;
    if (interactive && !wasInteractive && dealPlayed) setCapture(armCapture(st.capture), performance.now());
    wasInteractive = interactive;
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
