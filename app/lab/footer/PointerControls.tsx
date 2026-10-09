"use client";

import { Check, Field, Segmented, Slider } from "../controls/ui";
import { RANGES, type FooterSettings, type TypeResponse } from "./settings";
import { effectiveResponse, type Typeface } from "./useTypeface";

// The panel's "Pointer" controls: how the word answers the pointer. A path
// face (procedural or constructed) swells or slices at the waist; a typeset
// face swells through its axes, leans or grows.

type Props = { s: FooterSettings; typeface: Typeface; edit: (update: (s: FooterSettings) => FooterSettings) => void };

const fx = (digits: number, unit = "") => (n: number) => `${n.toFixed(digits)}${unit}`;
const PATH_RESPONSES: readonly TypeResponse[] = ["swell", "slice"];
const TYPESET_RESPONSES: readonly TypeResponse[] = ["swell", "lean", "grow", "none"];
const RESPONSE_LABELS: Partial<Record<TypeResponse, string>> = { slice: "waist slice" };

export function PointerControls({ s, typeface, edit }: Props) {
  const set = (patch: Partial<FooterSettings>) => edit((x) => ({ ...x, ...patch }));
  const setSlice = (patch: Partial<FooterSettings["slice"]>) => edit((x) => ({ ...x, slice: { ...x.slice, ...patch } }));
  const R = RANGES;
  const typeset = typeface.kind === "typeset" ? typeface : null;
  // A typeset face cannot slice; it shows the swell the slice falls back to.
  const shown = typeset ? (s.response === "slice" ? "swell" : s.response) : effectiveResponse(s.response, null);
  const hint = typeset
    ? typeset.canSwell
      ? "Swell moves the family's axes by the swells set under Letters."
      : `${typeset.label} has no axis to swell, so swell grows it.`
    : shown === "slice"
      ? "The letter under the pointer is cut at the middle of its x-height and its halves slide apart on a spring."
      : "The letters near the pointer thicken.";
  const swells = shown === "swell" && (!typeset || typeset.canSwell);

  return (
    <>
      <Slider label="Swell radius" value={s.swellRadius} {...R.swellRadius} format={fx(2)} hint="In letter heights." onChange={(swellRadius) => set({ swellRadius })} />
      <Field label="Response" hint={hint}>
        <Segmented
          options={typeset ? TYPESET_RESPONSES : PATH_RESPONSES}
          value={shown}
          format={(r) => RESPONSE_LABELS[r] ?? r}
          onChange={(response) => set({ response })}
        />
      </Field>
      {typeset && shown === "lean" && <Slider label="Lean" value={s.leanDeg} {...R.leanDeg} format={fx(1, "deg")} onChange={(leanDeg) => set({ leanDeg })} />}
      {typeset && (shown === "grow" || (shown === "swell" && !typeset.canSwell)) && (
        <Slider label="Grow" value={s.grow} {...R.grow} format={fx(2)} onChange={(grow) => set({ grow })} />
      )}
      {!typeset && shown === "swell" && (
        <Slider
          label="Swell amount"
          value={s.swellAmount}
          {...R.swellAmount}
          format={fx(3)}
          hint={s.face === "constructed" ? "Extra stem at the pointer; the bar rises with it." : "Extra stroke weight at the pointer."}
          onChange={(swellAmount) => set({ swellAmount })}
        />
      )}
      {!typeset && shown === "slice" && (
        <>
          <Slider label="Slide apart" value={s.slice.shift} {...R.sliceShift} format={fx(3)} hint="In letter heights, the upper half one way and the lower the other." onChange={(shift) => setSlice({ shift })} />
          <Slider label="Slice spring stiffness" value={s.slice.stiffness} {...R.sliceStiffness} format={fx(0)} onChange={(stiffness) => setSlice({ stiffness })} />
          <Slider label="Slice spring damping" value={s.slice.damping} {...R.sliceDamping} format={fx(2)} hint="Under 1 overshoots and settles." onChange={(damping) => setSlice({ damping })} />
        </>
      )}
      {swells && <Check label="A swelling letter pushes its neighbors" checked={s.reflow} onChange={(reflow) => set({ reflow })} />}
      <Slider label="Swell easing" value={s.swellEaseS} {...R.swellEaseS} format={fx(2, "s")} onChange={(swellEaseS) => set({ swellEaseS })} />
      <Slider label="Press depth" value={s.pressDepth} {...R.pressDepth} format={fx(2)} hint="Click and hold over the letters: how flat the nearest press." onChange={(pressDepth) => set({ pressDepth })} />
      <Slider label="Press spring stiffness" value={s.pressStiffness} {...R.pressStiffness} format={fx(0)} onChange={(pressStiffness) => set({ pressStiffness })} />
      <Slider label="Press spring damping" value={s.pressDamping} {...R.pressDamping} format={fx(2)} hint="Under 1 bounces back; 1 and over settles without a bounce." onChange={(pressDamping) => set({ pressDamping })} />
    </>
  );
}
