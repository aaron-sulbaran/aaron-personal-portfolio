import type { Cards } from "./cards";
import type { FlightWiring } from "./flight";
import type { Hover } from "./hover";
import type { Name } from "./name";
import type { UnwindWiring } from "./unwind";
import type { CoilSceneApi } from "./types";

// The live scene as the controller, the overlay, the loader and FlyingTile
// read it (CoilSceneApi in types.ts), assembled from the parts that own each
// call, in the order the old closure built it.

type ApiParts = { cards: Cards; hover: Hover; unwinder: UnwindWiring; flyer: FlightWiring; name: Name };

export function createApi({ cards, hover, unwinder, flyer, name }: ApiParts): CoilSceneApi {
  return {
    // ---- slice 5 api: the book, the unwind egg and the flight ----
    flightQuadOf: cards.flightQuadOf,
    facesOf: cards.facesOf,
    slotOfKey: cards.slotOfKey,
    focusCard: hover.focusCard,
    unwind: unwinder.unwind,
    // ---- fx-flight api: the flown card ----
    beginFlight: flyer.beginFlight,
    freeze: flyer.freeze,
    cardAt: hover.cardAt,
    quadOf: cards.quadOf,
    hideSlot: flyer.hideSlot,
    // ---- slice 4: the loader's continuity exit ----
    nameRect: name.nameRect,
    landName: name.landName,
  };
}
