import type { ReactNode } from "react";
import { stingStartMs, TALOS_AFTER } from "@/lib/gallery/steps";
import { partId } from "@/lib/gallery/timing";
import { TalosDiscord } from "./TalosDiscord";
import { TalosSting } from "./TalosSting";

// What Talos's modal draws after each of its opening paragraphs (the mask-in's
// own table, lib/gallery/steps TALOS_AFTER): the sting after the first, the Discord
// channel after the second.
export function talosAfter(unit: number, flying: boolean): ReactNode {
  const id = TALOS_AFTER[unit]?.[0];
  if (id === partId.sting) return <TalosSting key={id} startDelayMs={stingStartMs(flying)} />;
  if (id === partId.discord) return <TalosDiscord key={id} />;
  return null;
}
