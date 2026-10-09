"use client";

import { Chip, Field, Segmented, Slider } from "../controls/ui";
import { eggTotalMs } from "./egg";
import { RANGES, type EggTrigger, type FooterSettings } from "./settings";

// The panel's "The period" block: the Easter egg's trigger and its tuning.

type Props = { s: FooterSettings; edit: (update: (s: FooterSettings) => FooterSettings) => void; onDrop: () => void };

const fx = (digits: number, unit = "") => (n: number) => `${n.toFixed(digits)}${unit}`;
const ms = (n: number) => `${Math.round(n)}ms`;
const TRIGGER_LABELS: Record<EggTrigger, string> = { period: "period only", anywhere: "anywhere on the footer" };

export function EggControls({ s, edit, onDrop }: Props) {
  const set = (patch: Partial<FooterSettings["egg"]>) => edit((x) => ({ ...x, egg: { ...x.egg, ...patch } }));
  const e = s.egg;
  const R = RANGES;
  return (
    <>
      <p className="leading-snug text-muted">
        Click the period, or Tab to it and press Enter: it squashes, hops with a turn, lands past square and settles, and a ripple runs out from where it landed through the
        letters and the field. A click while it runs queues one more. Reduced motion: it only turns in place. The hop takes {Math.round(eggTotalMs(e))}ms.
      </p>
      <Field label="Trigger" hint={e.trigger === "anywhere" ? "A click anywhere starts the ripple there; the period hops as the ring reaches it." : undefined}>
        <Segmented options={["period", "anywhere"] as readonly EggTrigger[]} value={e.trigger} format={(t) => TRIGGER_LABELS[t]} onChange={(trigger) => set({ trigger })} />
      </Field>
      <Chip onClick={onDrop}>Drop the period</Chip>
      <Slider label="Anticipation" value={e.anticipationMs} {...R.anticipationMs} format={ms} hint="The squash before it leaves the ground." onChange={(anticipationMs) => set({ anticipationMs })} />
      <Slider label="Hop height" value={e.hop} {...R.hop} format={fx(2)} hint="In letter heights; held under the tallest letter's top." onChange={(hop) => set({ hop })} />
      <Slider label="Airtime" value={e.airMs} {...R.airMs} format={ms} onChange={(airMs) => set({ airMs })} />
      <Slider label="Turn" value={e.turnDeg} {...R.turnDeg} format={fx(0, "deg")} hint="In the air, fastest at the apex; it settles on the nearest quarter turn." onChange={(turnDeg) => set({ turnDeg })} />
      <Slider label="Landing overshoot" value={e.overshootDeg} {...R.overshootDeg} format={fx(1, "deg")} onChange={(overshootDeg) => set({ overshootDeg })} />
      <Slider label="Squash" value={e.squash} {...R.squash} format={fx(2)} hint="Share of its height lost at takeoff and landing." onChange={(squash) => set({ squash })} />
      <Slider label="Shadow strength" value={e.shadow} {...R.shadow} format={fx(2)} onChange={(shadow) => set({ shadow })} />
      <Slider label="Ripple speed" value={e.rippleSpeed} {...R.rippleSpeed} format={fx(1, " heights/s")} onChange={(rippleSpeed) => set({ rippleSpeed })} />
      <Slider label="Ripple in the letters" value={e.rippleLetters} {...R.rippleLetters} format={fx(2)} hint="Share of a letter's height the passing ring dents, through the press spring." onChange={(rippleLetters) => set({ rippleLetters })} />
      <Slider label="Ripple in the field" value={e.rippleField} {...R.rippleField} format={fx(2)} hint="In letter heights: how far the ring pushes the field." onChange={(rippleField) => set({ rippleField })} />
      <Slider label="Ripple decay" value={e.rippleDecay} {...R.rippleDecay} format={fx(1, "/s")} onChange={(rippleDecay) => set({ rippleDecay })} />
    </>
  );
}
