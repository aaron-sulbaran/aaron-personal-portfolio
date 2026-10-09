"use client";

import type { DriftPreset } from "@/lib/coil/drift";
import { Check, Field, Segmented, Slider } from "../controls/ui";
import type { BackdropKind } from "./FieldBackdrop";
import { RANGES, type Backdrop, type Ending, type FooterSettings } from "./settings";

// The panel's "The field" block: which field, how it ends, its depths.

type Props = {
  s: FooterSettings;
  backdrop: BackdropKind | null;
  forceStandIn: boolean;
  setForceStandIn: (on: boolean) => void;
  edit: (update: (s: FooterSettings) => FooterSettings) => void;
};

const KIND_NOTE: Record<BackdropKind, string> = {
  webgl: "live in WebGL 2.",
  standin: "the poster stand-in (no WebGL 2 in this browser), recolored and drifted by CSS.",
  "standin-forced": "the poster stand-in, forced (what a browser without WebGL 2 shows).",
};
const BACKDROP_LABELS: Record<Backdrop, string> = { hero: "hero field", footer: "footer field (rounds 1 to 3)" };
const BACKDROP_HINTS: Record<Backdrop, string> = {
  hero: "The hero's own field: its frame (the footer is the bottom of a hero as wide as the footer and as tall as the viewport, so its shapes are the hero's size), its drift (visible), its upsample and dither. The footer's depths, endings and tint ride on top.",
  footer: "The lab's field, framed to the footer's own box (its shapes scale with the footer's height), on the drift below.",
};
const ENDING_LABELS: Record<Ending, string> = { under: "fades under", clip: "clipped by the letters", above: "dies out above" };
const ENDING_HINTS: Record<Ending, string> = {
  under: "The field runs down behind the letters and is gone by the baseline; the letters are ink on top.",
  clip: "The field ends at the cap line outside the letters and keeps going inside them: the letters are windows onto it.",
  above: "The field is gone before the letters start; they stand on paper.",
};
const fx = (digits: number) => (n: number) => n.toFixed(digits);

export function FieldControls({ s, backdrop, forceStandIn, setForceStandIn, edit }: Props) {
  const setField = (patch: Partial<FooterSettings["field"]>) => edit((x) => ({ ...x, field: { ...x.field, ...patch } }));
  const R = RANGES;
  const f = s.field;
  const hero = f.backdrop === "hero";
  return (
    <>
      <Check label="Field behind the footer" checked={f.on} onChange={(on) => setField({ on })} />
      <p className="leading-snug text-muted">{f.on ? (backdrop ? `Drawn: ${KIND_NOTE[backdrop]}` : "Drawn: starting.") : "Backdrop: off."}</p>
      {f.on && (
        <>
          <Field label="Which field" hint={BACKDROP_HINTS[f.backdrop]}>
            <Segmented options={["hero", "footer"] as readonly Backdrop[]} value={f.backdrop} format={(b) => BACKDROP_LABELS[b]} onChange={(b) => setField({ backdrop: b })} />
          </Field>
          <Check label="Force the poster stand-in" checked={forceStandIn} onChange={setForceStandIn} />
          <Field label="How it ends" hint={ENDING_HINTS[f.ending]}>
            <Segmented options={["under", "clip", "above"] as readonly Ending[]} value={f.ending} format={(e) => ENDING_LABELS[e]} onChange={(ending) => setField({ ending })} />
          </Field>
          {hero && f.ending === "clip" && (
            <Check label="The letters show the hero name's surface" checked={f.nameSurface} onChange={(nameSurface) => setField({ nameSurface })} />
          )}
          {hero && f.ending === "clip" && f.nameSurface && (
            <p className="leading-snug text-muted">
              Inside the letters, the hero name&apos;s lit surface meets the field the way &quot;Hi, I&apos;m Aaron&quot; does (its ink, floor, chroma and grain), over the field at the depth below. WebGL 2 only; the stand-in shows the field.
            </p>
          )}
          <Slider label="Intensity behind the footer" value={f.intensity} {...R.intensity} format={fx(2)} hint="1 is the hero's field; 0 is paper; above 1 pushes it further from paper." onChange={(intensity) => setField({ intensity })} />
          {f.ending === "clip" && (
            <Slider label="Intensity inside the letters" value={f.letterIntensity} {...R.intensity} format={fx(2)} hint="The field the letters are windows onto, set apart from the field behind them." onChange={(letterIntensity) => setField({ letterIntensity })} />
          )}
          <Slider label="Last fade length" value={f.fade} {...R.fade} format={fx(2)} hint="In letter heights, ending where the choice above says." onChange={(fade) => setField({ fade })} />
          <Slider label="Rise from paper at the top" value={f.fadeIn} {...R.fadeIn} format={fx(2)} hint="Share of the footer's height." onChange={(fadeIn) => setField({ fadeIn })} />
          {f.ending === "clip" && <Slider label="Accent inside the letters" value={f.letterTint} {...R.letterTint} format={fx(2)} onChange={(letterTint) => setField({ letterTint })} />}
          {!hero && (
            <Field label="Drift">
              <Segmented options={["calm", "visible", "lively"] as readonly DriftPreset[]} value={f.drift} onChange={(drift) => setField({ drift })} />
            </Field>
          )}
          <Check label="Flip it (the glow pours from the top)" checked={f.flip} onChange={(flip) => setField({ flip })} />
        </>
      )}
    </>
  );
}
