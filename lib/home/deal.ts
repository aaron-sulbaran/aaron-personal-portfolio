"use client";

// Whether the cards have been dealt into the Coil. Always true for now: the
// Coil is at rest from the first frame. The deal's choreography (the deck, the
// riffle, the flight into the helix) reads and writes this.
export function useDealt(): boolean {
  return true;
}
