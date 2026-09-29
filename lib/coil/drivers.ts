import { COIL, type CoilConstants } from "./constants";
import type { Viewport } from "./geometry";

// One object, two drivers. Composition follows the pane's aspect (narrow under
// 0.8 width to height: tablet portrait composes narrow, landscape wide); input
// follows capability (a fine, hovering pointer gets hover, pick, and wheel
// capture; a coarse pointer gets time plus horizontal drag-to-spin). Reduced
// motion renders no scene at all: the poster, the DOM greeting, and the book.
// Pure, so every combination is tested; the controller feeds it live values.
export type Composition = "wide" | "narrow";
export type InputDriver = "fine" | "coarse";

export type Capabilities = {
  viewport: Viewport;
  finePointer: boolean; // (pointer: fine)
  canHover: boolean; // (hover: hover)
  reducedMotion: boolean;
};

export type Drivers = {
  composition: Composition;
  input: InputDriver;
  scene: boolean; // whether the WebGL scene may mount at all
};

export function compositionFor(viewport: Viewport, c: CoilConstants = COIL): Composition {
  if (viewport.height <= 0) return "wide";
  return viewport.width / viewport.height < c.narrow.aspectBelow ? "narrow" : "wide";
}

export function inputFor(finePointer: boolean, canHover: boolean): InputDriver {
  return finePointer && canHover ? "fine" : "coarse";
}

export function selectDrivers(capabilities: Capabilities, c: CoilConstants = COIL): Drivers {
  return {
    composition: compositionFor(capabilities.viewport, c),
    input: inputFor(capabilities.finePointer, capabilities.canHover),
    scene: !capabilities.reducedMotion,
  };
}

export function sameDrivers(a: Drivers, b: Drivers) {
  return a.composition === b.composition && a.input === b.input && a.scene === b.scene;
}

// What the scene may spend: the device pixel ratio cap and the card texture
// size. Fine pointers keep the desktop budget; coarse pointers (phones,
// tablets) get the decision record's 256 to 384px textures and a DPR cap of 2.
// The field pass stays at a third of the CSS resolution either way.
export type RenderBudget = { dprCap: number; textureSize: readonly [number, number] };

export function budgetFor(input: InputDriver, c: CoilConstants = COIL): RenderBudget {
  return input === "coarse" ? c.lab.coarse : { dprCap: c.lab.dprCap, textureSize: c.lab.textureSize };
}

export function sameBudget(a: RenderBudget, b: RenderBudget) {
  return a.dprCap === b.dprCap && a.textureSize[0] === b.textureSize[0] && a.textureSize[1] === b.textureSize[1];
}
