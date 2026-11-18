import { COIL } from "@/lib/coil/constants";
import { DEFAULT_KNOBS, type DealKnobs, type NumericKnob } from "@/lib/home/dealKnobs";

// The deal lab's three speeds: today's defaults and the two quicker presets in
// COIL.deal.speedPresets. A preset names a set of knobs; everything else is left
// to the reader's own settings.

export const SPEED_PRESETS = ["today", "faster", "fastest"] as const;
export type SpeedPreset = (typeof SPEED_PRESETS)[number];
export const PRESET_NAMES: Record<SpeedPreset, string> = { today: "Today", faster: "Faster", fastest: "Fastest" };

const NAMED = Object.keys(COIL.deal.speedPresets.faster) as NumericKnob[];

export function presetPatch(preset: SpeedPreset): Partial<DealKnobs> {
  const patch: Partial<DealKnobs> = {};
  for (const key of NAMED) {
    const value = preset === "today" ? DEFAULT_KNOBS[key] : (COIL.deal.speedPresets[preset] as Record<string, number>)[key];
    (patch as Record<string, number>)[key] = value;
  }
  return patch;
}

export function presetOf(knobs: DealKnobs): SpeedPreset | "custom" {
  for (const preset of SPEED_PRESETS) {
    const patch = presetPatch(preset) as Record<string, number>;
    if (NAMED.every((key) => knobs[key] === patch[key])) return preset;
  }
  return "custom";
}
