"use client";

import type { OnPlay } from "@/lib/player/settings";
import { FullPlayer, type SurfaceProps } from "./FullPlayer";
import { SheetPlayer } from "./SheetPlayer";

// The lab's player in the variant On play chose.
export function Surface({ variant, ...props }: SurfaceProps & { variant: Exclude<OnPlay, "today"> }) {
  return variant === "sheet" ? <SheetPlayer {...props} /> : <FullPlayer {...props} />;
}
