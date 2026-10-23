import type { NameTarget } from "@/lib/coil/nameTarget";

// The loader lands its lockup ("Hi, I'm" over "Aaron") on the name the scene
// draws, then hands it over in one frame. The scene lives in a dynamic chunk
// behind CoilStage and the loader runs outside React, so the two meet here
// (the production loader's lib/loader/handoff.ts, restored): the stage provides
// the scene's lockup rect and its landing, the loader reads the rect when its
// shrink ends and lands the name there. With no provider (no scene yet, none
// at all) both answer nothing and the loader falls back to its DOM landing on
// the page's heading.

export type NameHandoff = {
  target: () => NameTarget | null;
  // Shows the canvas lockup this frame (the scene renders synchronously); false
  // when the scene cannot take it yet, and nothing changed.
  land: () => boolean;
};

let provider: NameHandoff | null = null;

export function provideNameHandoff(handoff: NameHandoff): () => void {
  provider = handoff;
  return () => {
    if (provider === handoff) provider = null;
  };
}

export function nameTarget(): NameTarget | null {
  return provider?.target() ?? null;
}

export function landName(): boolean {
  return provider?.land() ?? false;
}
