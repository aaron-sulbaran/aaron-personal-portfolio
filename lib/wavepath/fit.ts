import { columnWeights, type WeightLayout } from "@/lib/waveform/weights";
import { dotReach } from "./columns";
import { RIPPLE } from "./constants";

// How much of the answer's ripple each band column may show. The band's
// weights keep the resting and breathing dots out from under its copy by
// dotReach(amp); the crest (RIPPLE.amp, plus its swell) reaches farther, so a
// column the copy allows only the resting reach gets a fit of 0 and one with
// room for the crest's whole reach gets 1. Laid out on resize, never per
// frame; `out` is reused when it already has the right length.
export function rippleFit(layout: Omit<WeightLayout, "reach">, amp: number, out: Float32Array | null): Float32Array {
  const rest = dotReach(amp);
  const crest = rest + amp * RIPPLE.amp * (1 + RIPPLE.swell);
  const weights = columnWeights({ ...layout, reach: crest });
  const fit = out && out.length === weights.length ? out : new Float32Array(weights.length);
  for (let j = 0; j < weights.length; j++) {
    const f = (weights[j] * crest - rest) / (crest - rest);
    fit[j] = f < 0 ? 0 : f > 1 ? 1 : f;
  }
  return fit;
}
