"use client";

import { useState, type ReactNode } from "react";
import type { Theme } from "@/lib/theme";
import { Check, Chip, Field, Segmented, Select, Slider } from "../mark/ui";
import { CARD_PICTURE, CARDS, SHAPES, shapeLabel, type LabCard } from "./cards";
import { FRAMES, type FrameKey } from "./Frame";
import type { Measure } from "./GalleryContent";
import { ALIGN_LABELS, EASES, FIT_LABELS, LEAD_LABELS, PHOTO_MASK_LABELS, PRESETS, RANGES, SPLIT_LABELS, sameSettings, type Settings } from "./settings";

// The lab's controls, set in system-ui like the other labs so the chrome never
// reads as part of what is being judged.

export type LayoutMode = "auto" | "desktop" | "phone";
export type View = { card: string; frame: FrameKey; layout: LayoutMode; reduce: boolean; open: boolean };

type Props = {
  s: Settings;
  view: View;
  theme: Theme;
  osReduced: boolean;
  phone: boolean;
  measure: Measure | null;
  doneAtMs: number | null;
  values: unknown;
  card: LabCard;
  shapes: number[];
  setShape: (index: number, aspect: number) => void;
  resetShapes: () => void;
  edit: (update: (s: Settings) => Settings) => void;
  setView: (update: (v: View) => View) => void;
  setTheme: (theme: Theme) => void;
  replay: () => void;
  collapse: () => void;
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <span className="text-[13px] font-semibold">{title}</span>
      {children}
    </div>
  );
}

const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
const px = (n: number) => `${n}px`;
const ms = (n: number) => `${n}ms`;

export function Panel({ s, view, theme, osReduced, phone, measure, doneAtMs, values, card, shapes, setShape, resetShapes, edit, setView, setTheme, replay, collapse }: Props) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const preset = PRESETS.find((p) => sameSettings(p.settings, s));
  const set = <K extends keyof Settings>(key: K) => (value: Settings[K]) => edit((x) => ({ ...x, [key]: value }));
  const range = (key: keyof typeof RANGES) => RANGES[key];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(values, null, 2));
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 1600);
  };

  return (
    <aside
      aria-label="Gallery lab settings"
      className="fixed inset-x-3 bottom-3 z-[70] flex max-h-[46vh] flex-col gap-5 overflow-y-auto rounded-2xl bg-[var(--menu-panel)] p-5 text-[12px] text-foreground [box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)] [font-family:system-ui] lg:inset-x-auto lg:right-4 lg:top-4 lg:max-h-none lg:w-[340px]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-semibold">Modal photos</span>
        <button type="button" onClick={collapse} className="text-muted underline underline-offset-2 hover:text-foreground">
          Hide
        </button>
      </div>

      <Field label="Presets">
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((p, i) => (
            <Chip key={p.id} pressed={sameSettings(s, p.settings)} onClick={() => edit(() => p.settings)}>
              {i === 0 ? `${p.name} (pick)` : p.name}
            </Chip>
          ))}
        </div>
        <p className="leading-snug text-muted">{preset?.note ?? "Custom settings."}</p>
      </Field>

      <Field label="Card">
        <div className="grid grid-cols-2 gap-1.5">
          {CARDS.map((c) => (
            <Chip key={c.id} pressed={view.card === c.id} onClick={() => setView((v) => ({ ...v, card: c.id, open: true }))}>
              {`${c.name} (${c.flownPhoto === undefined ? "logo" : "picture"} + ${c.flownPhoto === undefined ? c.photos.length : c.photos.length - 1})`}
            </Chip>
          ))}
        </div>
      </Field>
      <ShapePicker card={card} shapes={shapes} setShape={setShape} resetShapes={resetShapes} wideFrom={s.wideFrom} />
      <Field label="Viewport">
        <Select label="Viewport" value={view.frame} options={(Object.keys(FRAMES) as FrameKey[]).map((k) => ({ value: k, label: FRAMES[k].label }))} onChange={(frame) => setView((v) => ({ ...v, frame }))} />
      </Field>
      <Field label="Layout" value={phone ? "phone stage" : "desktop rows"} hint="Auto follows the viewport: rows from 1024px, the stage under it.">
        <Segmented options={["auto", "desktop", "phone"] as const} value={view.layout} onChange={(layout) => setView((v) => ({ ...v, layout }))} />
      </Field>
      <Field label="Theme">
        <Segmented options={["light", "dark"] as const} value={theme} onChange={setTheme} />
      </Field>
      <Check label="Preview reduced motion" checked={view.reduce} onChange={(reduce) => setView((v) => ({ ...v, reduce }))} />
      {osReduced && <p className="leading-snug text-muted">Your system asks for reduced motion: no masks and no auto-advance, everything is simply there.</p>}
      <div className="grid grid-cols-2 gap-1.5">
        <Chip onClick={replay}>Replay the mask-in</Chip>
        <Chip onClick={() => setView((v) => ({ ...v, open: !v.open }))}>{view.open ? "Close the modal" : "Open the modal"}</Chip>
      </div>

      <Readout measure={measure} doneAtMs={doneAtMs} />

      <Group title="Desktop rows">
        <Field label="A photo card's card picture leads" hint="The modal opens on the card picture (the flown card), then up to three photos. Beside the title keeps every other photo beside its own words.">
          <Segmented options={["title", "block"] as const} value={s.leadMode} format={(m) => LEAD_LABELS[m]} onChange={set("leadMode")} />
        </Field>
        <Slider label="Panel width" value={s.panelWidth} {...range("panelWidth")} format={px} hint="Today's modals are 576px (WorkModal) and 896px (PhotoModal)." onChange={set("panelWidth")} />
        <Slider label="Photo width" value={s.photoWidth} {...range("photoWidth")} format={(n) => `${n}px (${Math.round((n * 4) / 3)}px tall)`} onChange={set("photoWidth")} />
        <Slider label="Gap between rows" value={s.rowGap} {...range("rowGap")} format={px} onChange={set("rowGap")} />
        <Slider label="Gap between photo and text" value={s.columnGap} {...range("columnGap")} format={px} onChange={set("columnGap")} />
        <Field label="Text beside its photo">
          <Segmented options={["center", "start"] as const} value={s.textAlign} format={(a) => ALIGN_LABELS[a]} onChange={set("textAlign")} />
        </Field>
        <Slider label="Vertical extras to a row" value={s.extrasPerRow} {...range("extrasPerRow")} format={String} hint="Vertical photos after the last block; a horizontal extra always takes its own row." onChange={set("extrasPerRow")} />
      </Group>

      <Group title="Horizontal photos (desktop)">
        <Slider label="Spans the row from" value={s.wideFrom} {...range("wideFrom")} format={(n) => `${n.toFixed(2)}:1`} hint="Narrower photos sit beside their paragraph. The HSF photo booth print is 1.15:1." onChange={set("wideFrom")} />
        <Slider label="Width at most" value={s.wideWidth} {...range("wideWidth")} format={(n) => `${n}% of the row`} onChange={set("wideWidth")} />
        <Slider label="Height at most" value={s.wideMaxHeight} {...range("wideMaxHeight")} format={px} hint="A wide photo narrows to stay under this, never below 320px wide." onChange={set("wideMaxHeight")} />
        <Slider label="Caption to paragraph" value={s.stackGap} {...range("stackGap")} format={px} onChange={set("stackGap")} />
      </Group>

      <Group title="Phone stage">
        <Slider label="Stage height at most" value={s.stageMaxHeight} {...range("stageMaxHeight")} format={(n) => `${n}% of the height`} onChange={set("stageMaxHeight")} />
        <Slider label="Auto-advance" value={s.autoAdvance} {...range("autoAdvance")} format={(n) => (n === 0 ? "off" : `${n}s a photo, one pass`)} onChange={set("autoAdvance")} />
        <Slider label="Crossfade" value={s.crossfadeMs} {...range("crossfadeMs")} format={ms} onChange={set("crossfadeMs")} />
        <Field label="Stage height">
          <Segmented options={["each", "tallest"] as const} value={s.stageFit} format={(f) => FIT_LABELS[f]} onChange={set("stageFit")} />
        </Field>
        {s.stageFit === "each" && <Slider label="Easing between shapes" value={s.stageEaseMs} {...range("stageEaseMs")} format={ms} onChange={set("stageEaseMs")} />}
      </Group>

      <Group title="Masking in">
        <Slider label="Flight lands at" value={s.landingMs} {...range("landingMs")} format={ms} hint="A stand-in for the flight: the flown slot fills here and the masks start." onChange={set("landingMs")} />
        <Slider label="Mask length" value={s.maskMs} {...range("maskMs")} format={ms} onChange={set("maskMs")} />
        <Slider label="Stagger between parts" value={s.staggerMs} {...range("staggerMs")} format={ms} onChange={set("staggerMs")} />
        <Field label="Text masks">
          <Segmented options={["lines", "block"] as const} value={s.textSplit} format={(t) => SPLIT_LABELS[t]} onChange={set("textSplit")} />
        </Field>
        {s.textSplit === "lines" && <Slider label="Between lines" value={s.lineStaggerMs} {...range("lineStaggerMs")} format={ms} onChange={set("lineStaggerMs")} />}
        <Field label="Photo mask">
          <Select label="Photo mask" value={s.photoMask} options={options(PHOTO_MASK_LABELS)} onChange={set("photoMask")} />
        </Field>
        <Slider label="Settle" value={s.settle} {...range("settle")} format={(n) => (n === 0 ? "off" : `${(1 + n / 100).toFixed(3)} to 1`)} hint="A time-based scale on each photo over its mask; never scroll-linked." onChange={set("settle")} />
        <Field label="Ease">
          <Select label="Ease" value={s.ease} options={options({ site: EASES.site.name, power3: EASES.power3.name })} onChange={set("ease")} />
        </Field>
      </Group>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Chip onClick={copy}>{copied === "done" ? "Copied" : copied === "failed" ? "Copy failed, the values are below" : "Copy values (JSON)"}</Chip>
        <details>
          <summary className="cursor-pointer text-muted">Show values</summary>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-snug text-muted">{JSON.stringify(values, null, 2)}</pre>
        </details>
      </div>
    </aside>
  );
}

function Readout({ measure, doneAtMs }: { measure: Measure | null; doneAtMs: number | null }) {
  const lines: string[] = [];
  if (doneAtMs !== null) lines.push(doneAtMs === 0 ? "Reduced motion: nothing masks." : `Everything is in ${doneAtMs}ms after the modal opens.`);
  if (measure?.flownTopPx === null) lines.push("The flown card picture is not the stage's first photo, so the flight has nowhere on screen to land.");
  else if (measure?.flownTopPx !== undefined) lines.push(`The flight lands at ${measure.flownTopPx}px: ${measure.flownTopPx < measure.foldPx ? "on screen" : "below the fold"}.`);
  if (measure?.mode === "desktop") {
    lines.push(`First photo row, caption and paragraph included, ends at ${measure.keyBottomPx}px of ${measure.foldPx}: ${measure.fits ? "above the fold" : "below the fold"}.`);
    if (measure.photoBottomPx !== undefined) lines.push(`The first photo itself ends at ${measure.photoBottomPx}px.`);
    if (measure.textColumnPx) lines.push(`The text beside the first photo is ${measure.textColumnPx}px wide.`);
  }
  if (measure?.mode === "phone") {
    if (measure.stagePx) lines.push(`The stage is ${measure.stagePx}px, ${Math.round((measure.stagePx / measure.foldPx) * 100)}% of the height.`);
    lines.push(`The first block's two lines end at ${measure.keyBottomPx}px of ${measure.foldPx}: ${measure.fits ? "in view" : "below the fold"}.`);
  }
  return (
    <div className="flex flex-col gap-1 rounded-md bg-background p-3 tabular-nums leading-snug text-muted shadow-[inset_0_0_0_1px_var(--color-border)]" aria-live="polite">
      {lines.length ? lines.map((line) => <p key={line}>{line}</p>) : <p>Open the modal to measure.</p>}
    </div>
  );
}

// One shape per photo on this card, 4:5 vertical to 2:1 horizontal. The
// stand-ins are cropped to it; the defaults are the real photos' shapes.
function ShapePicker({ card, shapes, setShape, resetShapes, wideFrom }: { card: LabCard; shapes: number[]; setShape: (index: number, aspect: number) => void; resetShapes: () => void; wideFrom: number }) {
  // The list, plus the photo's own shape when it is not one of them (the
  // LinkedIn screenshot is 1.03:1), sorted from tall to wide.
  const optionsFor = (own: number, current: number) =>
    [...new Set([...SHAPES.map((sh) => sh.aspect), own, current])].sort((a, b) => a - b).map((aspect) => ({ value: String(aspect), label: shapeLabel(aspect) }));
  return (
    <Field label="Photo shapes on this card" hint="Stand-ins cropped to the real photos' shapes (photos.md). Change one to see the layout adapt.">
      <div className="flex flex-col gap-2">
        {card.photos.map((photo, i) => {
          const flown = i === card.flownPhoto;
          const aspect = shapes[i] ?? photo.shape;
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-muted" title={photo.intended}>
                {`${i + 1}. ${photo.intended}`}
              </span>
              {flown ? (
                <span className="shrink-0 text-muted">{`${shapeLabel(CARD_PICTURE)}, flown`}</span>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11px] text-muted">{aspect >= wideFrom ? "row" : "beside"}</span>
                  <Select label={`Shape of photo ${i + 1}`} value={String(aspect)} options={optionsFor(photo.shape, aspect)} onChange={(v) => setShape(i, Number(v))} />
                </div>
              )}
            </div>
          );
        })}
        <Chip onClick={resetShapes}>Back to the real shapes</Chip>
      </div>
    </Field>
  );
}
