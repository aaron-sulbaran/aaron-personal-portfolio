"use client";

import { faceById } from "./faces";
import { Field, Segmented, Slider } from "./controls";
import { withPlacement, type Placement, type RoleLine, type RoleLineSpot, type Settings } from "./settings";
import { editB, useLab } from "./store";

// Round 2's panel section: icon and label pairs, the band's control row, and
// where the role line sits beside its title.
const PLACEMENTS: readonly Placement[] = ["above", "below"];
const ROLE_LINE_SIZES = [12, 13, 14, 15, 16, 18, 20] as const;
const px = (n: number) => `${n}px`;

function RoleLineControls({ spot, label, line }: { spot: RoleLineSpot; label: string; line: RoleLine }) {
  const key: keyof Settings = spot === "case" ? "roleLineCase" : "roleLineModal";
  const set = (next: RoleLine) => editB((s) => ({ ...s, [key]: next }));
  return (
    <Field label={label}>
      <Segmented options={PLACEMENTS} value={line.placement} onChange={(placement) => set(withPlacement(spot, placement))} />
      <Slider label="Gap to the title" value={line.gap} min={0} max={32} step={1} format={px} onChange={(gap) => set({ ...line, gap })} />
      <Field label="Size, before the scale">
        <Segmented options={ROLE_LINE_SIZES} value={line.size} format={px} onChange={(size) => set({ ...line, size })} />
      </Field>
    </Field>
  );
}

export function LayoutControls() {
  const b = useLab().b;
  const face = faceById(b.face);
  return (
    <>
      <div className="flex flex-col gap-5 border-t border-border pt-4">
        <span className="text-[13px] font-semibold">Icons beside labels</span>
        <Field label="Back link arrow">
          <Segmented options={["glyph", "icon"] as const} value={b.arrow} onChange={(arrow) => editB((s) => ({ ...s, arrow }))} />
        </Field>
        <Slider label="Back arrow size" value={b.iconSize} min={12} max={22} step={0.5} format={px} onChange={(iconSize) => editB((s) => ({ ...s, iconSize }))} />
        <Slider label="Arrow stroke" value={b.iconStroke} min={1} max={3.5} step={0.25} format={(n) => n.toFixed(2)} onChange={(iconStroke) => editB((s) => ({ ...s, iconStroke }))} />
        <Slider label="Icon vertical offset" value={b.iconOffset} min={-3} max={3} step={0.5} format={px} onChange={(iconOffset) => editB((s) => ({ ...s, iconOffset }))} />
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={b.iconGap === null} onChange={(e) => editB((s) => ({ ...s, iconGap: e.target.checked ? null : 6 }))} />
            <span>Icon to text gap as on the site</span>
          </label>
          {b.iconGap !== null && (
            <Slider label="Icon to text gap" value={b.iconGap} min={0} max={16} step={0.5} format={px} onChange={(iconGap) => editB((s) => ({ ...s, iconGap }))} />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5 border-t border-border pt-4">
        <span className="text-[13px] font-semibold">Play it and Not now</span>
        <Field label="Row alignment">
          <Segmented options={["site", "baseline", "center"] as const} value={b.controlAlign} format={(a) => (a === "site" ? "as built" : a)} onChange={(controlAlign) => editB((s) => ({ ...s, controlAlign }))} />
        </Field>
        <Slider label="Not now, baseline nudge" value={b.secondaryNudge} min={-4} max={4} step={0.5} format={px} onChange={(secondaryNudge) => editB((s) => ({ ...s, secondaryNudge }))} />
        <Slider label="Gap after the question" value={b.headingGap} min={8} max={64} step={1} format={px} onChange={(headingGap) => editB((s) => ({ ...s, headingGap }))} />
        <Slider label="Gap between them" value={b.controlGap} min={8} max={48} step={1} format={px} onChange={(controlGap) => editB((s) => ({ ...s, controlGap }))} />
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={b.quietSecondary} onChange={(e) => editB((s) => ({ ...s, quietSecondary: e.target.checked }))} />
          <span>Not now in muted (a quieter secondary)</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={b.secondaryUnderline !== null} onChange={(e) => editB((s) => ({ ...s, secondaryUnderline: e.target.checked ? 40 : null }))} />
          <span>Faint underline under Not now</span>
        </label>
        {b.secondaryUnderline !== null && (
          <Slider label="Underline, percent of muted" value={b.secondaryUnderline} min={10} max={100} step={5} format={(n) => `${n}%`} onChange={(secondaryUnderline) => editB((s) => ({ ...s, secondaryUnderline }))} />
        )}
      </div>

      <div className="flex flex-col gap-5 border-t border-border pt-4">
        <span className="text-[13px] font-semibold">Role line</span>
        <RoleLineControls spot="case" label="Case page header" line={b.roleLineCase} />
        <RoleLineControls spot="modal" label="Work modal" line={b.roleLineModal} />
        <Field label="Weight once below the title">
          <Segmented options={face.weights} value={b.subtitleWeight} onChange={(subtitleWeight) => editB((s) => ({ ...s, subtitleWeight }))} />
        </Field>
        <p className="leading-snug text-muted">Book rows set the meta beside the title (under it below 720px wide), so they have no above or below.</p>
      </div>
    </>
  );
}
