"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Check, Chip, Field, Segmented, Slider } from "../controls/ui";
import { RANGES, type Caps, type Face, type FooterSettings, type Join } from "./settings";
import type { Typeface } from "./useTypeface";
import { FONT_CANDIDATES, candidateFont, fontQueryParams, normalizeFamily, variationSettings, type AxisValues } from "./webFont";

// The panel's "Letters" block: which face draws the word, and that face's
// own controls. The web font picker takes any Google Fonts family by name;
// the seeded candidates and any ?font= in the URL are one click each.

type Props = { s: FooterSettings; typeface: Typeface; edit: (update: (s: FooterSettings) => FooterSettings) => void };

const FACES: readonly Face[] = ["constructed", "procedural", "profa", "font"];
const FACE_LABELS: Record<Face, string> = { constructed: "Constructed", procedural: "Procedural", profa: "Profa Black", font: "Web font" };
const FACE_HINTS: Record<Face, string> = {
  constructed:
    "This lab's cut-flat alphabet: rectangles for stems and bars, elliptical bands and D bowls for curves, every end cut flat and every join one shape. Stem and bar are numbers, so it swells, and the press dents it without thinning a bar.",
  procedural: "This lab's own alphabet: weight is a number, so it swells. Its ends and bowls below set how soft it reads.",
  profa: "The hero's face, one weight, so it leans or grows instead of swelling.",
  font: "Any Google Fonts family, by name. A weight or width axis carries the swell through font-variation-settings; ligatures are off, so every letter swells on its own.",
};
const CAP_LABELS: Record<Caps, string> = { round: "round", butt: "flat", square: "square" };
const fx = (digits: number, unit = "") => (n: number) => `${n.toFixed(digits)}${unit}`;

let urlCache: { search: string; fonts: string[] } = { search: "", fonts: [] };
const NO_FONTS: string[] = [];
function urlFonts() {
  if (urlCache.search !== window.location.search) urlCache = { search: window.location.search, fonts: fontQueryParams(window.location.search) };
  return urlCache.fonts;
}

export function LettersControls({ s, typeface, edit }: Props) {
  const set = (patch: Partial<FooterSettings>) => edit((x) => ({ ...x, ...patch }));
  return (
    <>
      <Field label="Letters" hint={FACE_HINTS[s.face]}>
        <Segmented options={FACES} value={s.face} format={(f) => FACE_LABELS[f]} onChange={(face) => set({ face })} />
      </Field>
      {s.face === "constructed" && <ConstructedControls s={s} edit={edit} />}
      {s.face === "procedural" && (
        <>
          <Slider label="Stroke weight" value={s.weight} {...RANGES.weight} format={fx(3)} hint="Share of the letter height." onChange={(weight) => set({ weight })} />
          <Field label="Stroke ends" hint="Flat and square cut the stems and the f and t hooks; square also squares the dots.">
            <Segmented options={["round", "butt", "square"] as readonly Caps[]} value={s.caps} format={(c) => CAP_LABELS[c]} onChange={(caps) => set({ caps })} />
          </Field>
          <Field label="Joins" hint="Where a stroke turns a corner. Sharpest on squared bowls; build.stuff has no v, w or z.">
            <Segmented options={["round", "miter", "bevel"] as readonly Join[]} value={s.join} onChange={(join) => set({ join })} />
          </Field>
          <Slider
            label="Bowl corners"
            value={s.corners}
            {...RANGES.corners}
            format={(n) => (n === 0 ? "round" : n.toFixed(2))}
            hint="Squares the bowls of b, d, u and s, so they meet their stems at a corner instead of a curve."
            onChange={(corners) => set({ corners })}
          />
        </>
      )}
      {(s.face === "constructed" || s.face === "procedural") && <PeriodControls s={s} edit={edit} />}
      {s.face === "font" && <FontPicker s={s} typeface={typeface} edit={edit} />}
    </>
  );
}

type ShapeProps = Pick<Props, "s" | "edit">;

function ConstructedControls({ s, edit }: ShapeProps) {
  const set = (patch: Partial<FooterSettings["constructed"]>) => edit((x) => ({ ...x, constructed: { ...x.constructed, ...patch } }));
  const c = s.constructed;
  return (
    <>
      <Slider label="Stem thickness (S)" value={c.stem} {...RANGES.stem} format={fx(3)} hint="A vertical's thickness, in letter heights. The swell adds to it." onChange={(stem) => set({ stem })} />
      <Slider label="Bar thickness (B)" value={c.bar} {...RANGES.bar} format={fx(3)} hint="A horizontal's thickness. Under the stem reads monoline; the s thins its bars a little so its counters stay open." onChange={(bar) => set({ bar })} />
      <Slider
        label="Bowl roundness"
        value={c.roundness}
        {...RANGES.roundness}
        format={(n) => (n === 0 ? "true ellipse" : n === 1 ? "squared" : n.toFixed(2))}
        hint="From true elliptical bowls toward squared superellipses, in b, d, u, s and the t and f hooks."
        onChange={(roundness) => set({ roundness })}
      />
      <Slider label="Letter gap" value={c.gap} {...RANGES.letterGap} format={fx(3)} hint="Between two straight sides, in letter heights; round sides and the t and f arms sit closer." onChange={(gap) => set({ gap })} />
    </>
  );
}

function PeriodControls({ s, edit }: ShapeProps) {
  const set = (patch: Partial<FooterSettings["aperture"]>) => edit((x) => ({ ...x, aperture: { ...x.aperture, ...patch } }));
  const a = s.aperture;
  return (
    <>
      <Check label="The period is a shutter" checked={a.on} onChange={(on) => set({ on })} />
      {a.on && (
        <>
          <p className="leading-snug text-muted">Its blades meet at a pivot that leans toward the pointer over the footer and settles back when it leaves. Still under reduced motion.</p>
          <Field label="Blades">
            <Segmented options={["3", "4"] as const} value={String(a.blades) as "3" | "4"} onChange={(b) => set({ blades: b === "3" ? 3 : 4 })} />
          </Field>
          {s.face === "constructed" && (
            <Slider label="Shutter size" value={a.scale} {...RANGES.apertureScale} format={(n) => `${n.toFixed(2)} stems`} hint="The square's side in stems; 1 is a plain period's." onChange={(scale) => set({ scale })} />
          )}
          <Slider label="Gap between blades" value={a.gap} {...RANGES.apertureGap} format={fx(3)} hint="A share of the square." onChange={(gap) => set({ gap })} />
          <Slider label="Pivot ease" value={a.ease} {...RANGES.apertureEase} format={fx(2)} hint="Share of the way the pivot moves each frame at 60fps; lower is lazier." onChange={(ease) => set({ ease })} />
        </>
      )}
    </>
  );
}

function fontStatus(t: Typeface, family: string): string {
  if (t.kind === "loading") return `Loading ${family} from Google Fonts.`;
  if (t.kind === "failed") return `Could not load "${family}" from Google Fonts. Check the name as fonts.google.com spells it, capitals included.`;
  if (t.kind !== "typeset" || !t.info) return "";
  const { wght, wdth, ROND } = t.info.axes;
  const axes = [wght && `weight ${wght[0]} to ${wght[1]}`, wdth && `width ${wdth[0]} to ${wdth[1]}`, ROND && `roundness ${ROND[0]} to ${ROND[1]}`].filter(Boolean);
  if (!axes.length) return `${t.label}: static weights only (${t.info.weights.join(", ")}), so it grows or leans instead of swelling.`;
  const pose = (v: AxisValues) => variationSettings(v).replace(/"/g, "");
  const swell = t.canSwell ? ` Swells to ${pose(t.heavy)}.` : " No swell set, so it rests.";
  return `${t.label} axes: ${axes.join(", ")}. Rests at ${pose(t.rest)}.${swell}`;
}

function FontPicker({ s, typeface, edit }: Props) {
  const fromUrl = useSyncExternalStore(() => () => {}, urlFonts, () => NO_FONTS);
  const [typed, setTyped] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const setFont = (patch: Partial<FooterSettings["font"]>) => edit((x) => ({ ...x, font: { ...x.font, ...patch } }));
  const families = [...new Set([...FONT_CANDIDATES.map((c) => c.family), ...fromUrl, ...typed, s.font.family])];
  const candidate = FONT_CANDIDATES.find((c) => c.family === s.font.family);
  const info = typeface.kind === "typeset" ? typeface.info : null;
  const wght = info?.axes.wght ?? (info?.weights.length ? ([info.weights[0], info.weights[info.weights.length - 1]] as const) : null);
  const { wdth, ROND } = info?.axes ?? {};

  const pick = (family: string) => {
    const seed = FONT_CANDIDATES.find((c) => c.family === family);
    edit((x) => ({ ...x, face: "font", font: seed ? candidateFont(seed) : { ...x.font, family } }));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const family = normalizeFamily(draft);
    if (!family) return;
    setTyped((list) => (list.includes(family) ? list : [...list, family]));
    setDraft("");
    pick(family);
  };

  return (
    <>
      <Field label="Family" hint={candidate?.why}>
        <div className="flex flex-wrap gap-1">
          {families.map((family) => (
            <Chip key={family} pressed={s.font.family === family} onClick={() => pick(family)}>
              {family}
            </Chip>
          ))}
        </div>
      </Field>
      <form onSubmit={submit} className="flex gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Any Google Fonts family"
          aria-label="Google Fonts family name"
          className="min-w-0 flex-1 rounded-md bg-transparent px-2.5 py-1 text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border)] placeholder:text-muted"
        />
        <button type="submit" className="rounded-md px-2.5 py-1 text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border)] hover:[box-shadow:inset_0_0_0_1px_var(--color-muted)]">
          Load
        </button>
      </form>
      <p className="leading-snug text-muted">{fontStatus(typeface, s.font.family)}</p>
      {wght && (
        <Slider label="Weight (wght)" value={s.font.weight} min={wght[0]} max={wght[1]} step={info?.axes.wght ? 10 : 100} format={fx(0)} onChange={(weight) => setFont({ weight })} />
      )}
      {info?.axes.wght && (
        <Slider label="Weight swell at the pointer" value={s.font.swell} min={0} max={wght![1] - wght![0]} step={10} format={(n) => `+${n.toFixed(0)}`} onChange={(swell) => setFont({ swell })} />
      )}
      {wdth && <Slider label="Width (wdth)" value={s.font.width} min={wdth[0]} max={wdth[1]} step={RANGES.fontWidth.step} format={fx(1)} onChange={(width) => setFont({ width })} />}
      {wdth && (
        <Slider label="Width swell at the pointer" value={s.font.widthSwell} min={0} max={wdth[1] - wdth[0]} step={RANGES.fontWidthSwell.step} format={(n) => `+${n.toFixed(1)}`} onChange={(widthSwell) => setFont({ widthSwell })} />
      )}
      {ROND && <Slider label="Roundness (ROND)" value={s.font.round} min={ROND[0]} max={ROND[1]} step={RANGES.fontRound.step} format={fx(0)} hint="0 is crisp ends; 100 is the soft, rounded cut." onChange={(round) => setFont({ round })} />}
    </>
  );
}
