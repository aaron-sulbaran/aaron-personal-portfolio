import { COIL } from "@/lib/coil/constants";
import { FIELD } from "@/lib/coil/field.glsl";
import { pickCard, poseAt, projectPoint, rayThrough, restHelix } from "@/lib/coil/geometry";
import { hoverJumpTarget, setRowHold, startGlide, type JumpBand } from "@/lib/coil/motion";
import { heroVisibleFraction } from "@/lib/coil/capture";
import { setSceneHover } from "@/lib/cursor/hover";
import type { Cards } from "./cards";
import type { LoopLink, SceneCtx, SceneFrame } from "./state";
import type { CoilCardRef } from "./types";

// What the pointer is over, and the book's row hold. Picking runs every
// frame (cards move under a still pointer) and publishes the hit to the
// custom cursor (lib/cursor/hover.ts); the canvas never sets a CSS cursor.
// A hovered or focused book row holds the coil still on its card after one
// hover-jump glide.

// A hover-jump lands a card's center at least a quarter card inside the
// visible band, so most of the card shows.
const JUMP_INSET_CARDS = 0.25;

// How much of the hero is on screen, 0 to 1.
export function heroVisible(host: HTMLElement) {
  const rect = host.getBoundingClientRect();
  return heroVisibleFraction(rect.top, rect.height, window.innerHeight);
}

export function createHover(ctx: SceneCtx, cards: Cards, loop: LoopLink) {
  const { st, host, live, tiles, tileCount } = ctx;
  const { slots, tileIndex } = cards;
  let focusKey: string | null = null;

  // The slot under a canvas point, from the last rendered frame.
  function pickAt(x: number, y: number) {
    if (!st.geoCamera || st.poses.length === 0) return -1;
    return pickCard(st.poses, rayThrough(st.geoCamera, x, y));
  }

  // The card under a viewport point.
  function cardAt(clientX: number, clientY: number): CoilCardRef | null {
    const x = clientX - (st.view.docLeft - window.scrollX);
    const y = clientY - (st.view.docTop - window.scrollY);
    const slot = pickAt(x, y);
    if (slot < 0) return null;
    return { key: tiles[slots[slot].tile].key, slot };
  }

  // Update step: the hovered slot, picked every frame, since cards move under a still pointer.
  function picking(f: SceneFrame) {
    const { props } = f;
    const pickable = st.pointer.inside && st.pointer.known && props.interactive && props.input === "fine";
    const nextHover = pickable ? pickAt(st.pointer.x, st.pointer.y) : -1;
    st.hoveredSlot = nextHover;
    setSceneHover(nextHover >= 0);
  }

  // Where a flown card's lift is heading: the hover rule above, with the
  // flown card counted on its seat at its own alpha.
  function liftTarget(slot: number, alpha: number) {
    const props = live.current;
    if (!st.geoCamera || !st.pointer.inside || !st.pointer.known || !props.interactive || props.input !== "fine") return 0;
    const seats = st.poses.map((pose, j) => (j === slot ? { ...pose, alpha } : pose));
    return pickCard(seats, rayThrough(st.geoCamera, st.pointer.x, st.pointer.y)) === slot ? 1 : 0;
  }

  // ---- fx-input: the row hold ----
  function canRowHold() {
    const props = live.current;
    return (
      st.ready &&
      props.interactive &&
      !props.frozen &&
      !st.frozenByApi &&
      !st.unwind.latched &&
      heroVisible(host) >= COIL.rowHold.minHeroVisible
    );
  }
  // ---- end fx-input ----

  // The row's card to the part of the helix still on screen: the copy whose
  // projected center lands inside the hero's visible rows (clear of the
  // narrow header band and the bottom seam fade), or the nearest that will
  // be once the hero scrolls back. Nothing while unwound.
  function hoverJump(key: string) {
    const props = live.current;
    const tile = tileIndex.get(key);
    if (tile === undefined || !st.geo || !st.geoCamera || !st.ready) return;
    if (st.unwind.latched || props.frozen || st.frozenByApi || !props.interactive) return;
    const rect = host.getBoundingClientRect();
    const inset = JUMP_INSET_CARDS * st.geo.cardPx;
    const band: JumpBand = {
      top: Math.max(0, -rect.top, st.geo.clearTopPx) + inset,
      bottom: Math.min(st.view.height, window.innerHeight - rect.top, st.view.height * (1 - FIELD.seamFade)) - inset,
      left: inset,
      right: st.view.width - inset,
    };
    const frame = restHelix(st.geo, st.theme.card.recede);
    const camera = st.geoCamera;
    const maxU = st.geo.slotCount / 2 - COIL.lab.endFadeSlots;
    const { to } = hoverJumpTarget(tile, st.conveyor.offset, tileCount, st.geo.cardsPerTurn, maxU, (u) =>
      projectPoint(camera, poseAt(frame, u).position), band);
    startGlide(st.conveyor, to, performance.now());
    loop.wake();
  }

  // Hover-jump from a book row (api.focusCard); null ends the focus.
  function focusCard(key: string | null) {
    focusKey = key;
    // ---- fx-input: the row hold ----
    // A held row stills the coil on its card (idle and page scroll at
    // zero) after one glide; letting go resumes the idle after a beat. A
    // hero under a quarter in view has nothing to show: the row does
    // nothing to the coil.
    const now = performance.now();
    const hold = key !== null && canRowHold();
    setRowHold(st.rowHold, hold, now);
    if (hold && key) hoverJump(key);
    loop.wake();
    // ---- end fx-input ----
  }

  return { pickAt, cardAt, picking, liftTarget, focusCard, focusKey: () => focusKey };
}

export type Hover = ReturnType<typeof createHover>;
