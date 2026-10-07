import type { RefObject } from "react";
import type { Quad } from "@/lib/coil/geometry";
import type { InputDriver } from "@/lib/coil/drivers";
import type { Rect } from "@/lib/coil/flight";
import type { NameTarget } from "@/lib/loader/handoff";
import type { HeroOverlayHandle } from "../HeroOverlay";

// The Coil scene's public types: the props CoilStage passes, the api the
// controller, the overlay and FlyingTile call, and the entrance timing.
// CoilScene.tsx re-exports every one; nothing outside components/coil/
// imports this file directly.

// tap: the card was touched (slice 7), so it opens with no flight.
export type CoilCardRef = { key: string; slot: number; tap?: boolean };

// ---- slice 5 api: the book, the unwind egg and the flight ----
export type CoilCardFaces = { front: HTMLCanvasElement; back: HTMLCanvasElement };

export type CoilFlightApi = {
  // The flight's source: the slot's bent corners as last rendered, or the
  // flat card's corners when a card nearly edge on folds them concave.
  flightQuadOf: (slot: number) => Quad | null;
  // The card's own painted faces (the canvases its textures upload).
  facesOf: (slot: number) => CoilCardFaces | null;
  // The slot showing a card: its latched copy while unwound, else the
  // front-most visible copy. -1 when none is on screen.
  slotOfKey: (key: string) => number;
  // Hover-jump: glides the nearest copy of the card to the front of the
  // visible helix (600ms, site ease); null ends the focus.
  focusCard: (key: string | null) => void;
  // The unwind egg: sets (or toggles) it; false winds the coil back.
  unwind: (on?: boolean) => void;
};
// ---- end slice 5 api ----

// ---- fx-flight api: the flown card ----
// One flight, from the card's seat in the coil into the modal's slot and
// back. The scene draws the card itself (the card shader, its bend, shading
// and lift) into a canvas of its own above the modal, so both swaps between
// the mesh and the flown card draw the same pixels.
export type CoilFlightHandle = {
  // Draws the flown card at e: 0 on its seat, 1 in `rect` (the modal's slot,
  // viewport px; null keeps the last one). dt (seconds) moves the lift on the
  // way home. Returns the card's four corners in viewport px (the flat
  // card's), or null when the card cannot be drawn any more.
  draw: (e: number, rect: Rect | null, dt: number) => Quad | null;
  // The card reached the slot.
  arrive: () => void;
  // The card heads home.
  close: () => void;
  // The scene's layout as the last draw saw it: a parked card is drawn again
  // when this changes (a resize).
  stamp: () => string;
  // The card is drawn on its seat: the mesh shows, the flown card clears,
  // and the scene resumes on the next frame.
  land: () => void;
  // Torn down part way: the mesh shows where it is.
  abort: () => void;
};

export type CoilFlownApi = {
  // Starts a flight for the slot, mounting the flown card's canvas in `mount`
  // (a fixed layer above the modal). Draws the card on its seat and hides the
  // mesh before it returns. Null when the card cannot be flown.
  beginFlight: (slot: number, mount: HTMLElement) => CoilFlightHandle | null;
};
// ---- end fx-flight api ----

// For slices 4 and 5 (the entrance and the flight): the live scene, read
// without a React render.
export type CoilSceneApi = CoilFlightApi &
  CoilFlownApi & {
  // Stops (true) or resumes (false) rendering at once; the last frame stays.
  // The flight freezes before its modal activates, so the blur sits over a
  // still scene and the card's rendered pose equals its flight pose.
  freeze: (on: boolean) => void;
  // The card under a viewport point, from the last rendered frame.
  cardAt: (clientX: number, clientY: number) => CoilCardRef | null;
  // A slot's four bent corners in viewport px, as last rendered (lift included).
  quadOf: (slot: number) => Quad | null;
  // Hides one slot's mesh (the flown card) or none.
  hideSlot: (slot: number | null) => void;
  // ---- slice 4: the loader's continuity exit ----
  // The canvas lockup in viewport px (the name's ink box, baseline and
  // gradient, the greeting's ink), for the loader to land its DOM lockup on;
  // null until the scene has laid out.
  nameRect: () => NameTarget | null;
  // Shows the canvas lockup now, rendering this frame synchronously, so the
  // loader can drop its DOM lockup in the same task with no frame between.
  // False (nothing drawn) until the entrance that waits for the loader has
  // reached a frame.
  landName: () => boolean;
  // ---- end slice 4 ----
};

// Slice 4: when the entrance plays. startMs is on the performance.now()
// clock (it may be in the future: the loader overlaps its exit); -Infinity
// means no entrance (a fast start), so the coil is at rest from its first
// frame. nameFromLoader: the loader lands the name (the canvas name waits for
// landName); otherwise it fades up behind the band as the band opens.
export type CoilEntrance = { startMs: number; nameFromLoader: boolean };

export type CoilSceneProps = {
  frozen: boolean; // a modal is open
  interactive: boolean; // the hero is ready (no entrance playing)
  input: InputDriver;
  overlay: RefObject<HeroOverlayHandle | null>;
  api?: RefObject<CoilSceneApi | null>;
  onFirstFrame: () => void;
  onContextLost: () => void;
  onError: (error: unknown) => void;
  // Slice 5 flies the card into its modal; until then a click does nothing.
  onCardClick?: (card: CoilCardRef) => void;
  // ---- slice 4: the entrance ----
  // Null: not started (cards hidden, the name held by the loader).
  entrance?: CoilEntrance | null;
  // Once, when the entrance's clock has run out (at once for a fast start).
  onEntranceEnd?: () => void;
  // ---- end slice 4 ----
};

// What the React component holds: sync (the props changed; the input driver
// may have, and with it the budget), wake and dispose.
export type CoilRuntime = { wake: () => void; sync: () => void; dispose: () => void };
