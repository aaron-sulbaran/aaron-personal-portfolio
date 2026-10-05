"use client";

import { Field, Segmented, Slider } from "./controls";
import { STEP_PX, TONES, TONE_COLORS, TONE_LABELS, type Settings } from "./settings";
import { editB, setLab, useLab } from "./store";

// Round 4's panel section, from the design review: a color per kind of small
// text, the seen row's meta, the three-step size scale (with a legend and the
// bench marks), and book meta wrapping under its title in a narrow column.
const WRAP_MODES = ["site", "fit", "column"] as const;
const toneName = (color: string) => (color === "same" ? "same as role" : color);

const STEP_LEGEND: Record<keyof typeof STEP_PX, string> = {
  sm: "credit, footer, freeze toggle, pill capsule, label, tip and artist",
  md: "back link, role lines up to 16px, book meta, kickers, nav, Menu, menu chips and links, band controls, Esc hints",
  lg: "the modal's call to action, a role line of 17px or more",
};

export function ReviewControls() {
  const lab = useLab();
  const b = lab.b;
  const setTone = (tone: (typeof TONES)[number]) => (color: Settings["toneColors"][typeof tone]) =>
    editB((s) => ({ ...s, toneColors: { ...s.toneColors, [tone]: color } }));
  return (
    <div className="flex flex-col gap-5 border-t border-border pt-4">
      <span className="text-[13px] font-semibold">Color by kind of text</span>
      {TONES.map((tone) => (
        <Field key={tone} label={TONE_LABELS[tone]}>
          <Segmented options={TONE_COLORS} value={b.toneColors[tone]} format={toneName} onChange={setTone(tone)} />
        </Field>
      ))}

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={b.seenMetaDim} onChange={(e) => editB((s) => ({ ...s, seenMetaDim: e.target.checked }))} />
        <span>A seen book row dims its meta too</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={b.threeSteps} onChange={(e) => editB((s) => ({ ...s, threeSteps: e.target.checked }))} />
          <span>Collapse to three size steps</span>
        </label>
        <ul className="flex flex-col gap-1 leading-snug text-muted">
          {(Object.keys(STEP_PX) as (keyof typeof STEP_PX)[]).map((step) => (
            <li key={step}>
              {(STEP_PX[step] * b.scale).toFixed(1)}px: {STEP_LEGEND[step]}
            </li>
          ))}
        </ul>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={lab.markSteps} onChange={(e) => setLab((s) => ({ ...s, markSteps: e.target.checked }))} />
          <span>Mark the step of every label on the bench (dotted, dashed, solid)</span>
        </label>
      </div>

      <Field label="Book meta when the row is tight">
        <Segmented
          options={WRAP_MODES}
          value={typeof b.metaWrap === "number" ? "column" : b.metaWrap}
          format={(mode) => (mode === "site" ? "as on site" : mode === "fit" ? "per row" : "whole column")}
          onChange={(mode) => editB((s) => ({ ...s, metaWrap: mode === "column" ? 520 : mode }))}
        />
        {typeof b.metaWrap === "number" && (
          <Slider label="When a column is narrower than" value={b.metaWrap} min={280} max={640} step={10} format={(n) => `${n}px`} onChange={(metaWrap) => editB((s) => ({ ...s, metaWrap }))} />
        )}
      </Field>
    </div>
  );
}
