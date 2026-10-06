"use client";

import { Choice, Group, Hint, Slider, Toggle } from "./parts";
import { RANGES, SECTION_LABELS, type Arrival, type LabSettings, type Reveal, type SectionKey, type SectionSettings, type Split, type UpLayout } from "./settings";

// One group per section: how its heading and body arrive, sticky or not.

const HEADING: { id: Reveal; label: string }[] = [
  { id: "mask", label: "Mask rise" },
  { id: "blur", label: "Blur in" },
  { id: "fade", label: "Fade" },
  { id: "none", label: "None" },
];
const BODY: { id: Reveal; label: string }[] = [...HEADING.slice(0, 2), { id: "words", label: "Words" }, ...HEADING.slice(2)];
const SPLIT: { id: Split; label: string }[] = [
  { id: "lines", label: "By line" },
  { id: "block", label: "Whole block" },
];
const ARRIVAL: { id: Arrival; label: string }[] = [
  { id: "hairline", label: "Draw a hairline" },
  { id: "rise", label: "Rise" },
  { id: "blur", label: "Blur" },
];
const LAYOUT: { id: UpLayout; label: string }[] = [
  { id: "beside", label: "Heading beside" },
  { id: "today", label: "Today's layout" },
];

type Edit = (next: Partial<LabSettings>) => void;

function SectionGroup({ id, s, edit }: { id: SectionKey; s: LabSettings; edit: Edit }) {
  const sec = s.sections[id];
  const set = (next: Partial<SectionSettings>) => edit({ sections: { ...s.sections, [id]: { ...sec, ...next } } });
  const stickyAllowed = id !== "about" && !(id === "up" && s.up.layout === "today");
  return (
    <Group title={SECTION_LABELS[id]}>
      <p className="text-xs">{id === "who" ? "Label" : "Heading"}</p>
      <Choice options={HEADING} value={sec.heading} onChange={(heading) => set({ heading })} />
      {id !== "up" && (
        <>
          <p className="mt-2 text-xs">{id === "connect" ? "Lede and link rows" : id === "who" ? "Paragraph" : "Lede"}</p>
          <Choice options={id === "connect" ? BODY.filter((b) => b.id !== "words") : BODY} value={sec.body} onChange={(body) => set({ body })} />
        </>
      )}
      <p className="mt-2 text-xs">Mask and blur</p>
      <Choice options={SPLIT} value={sec.split} onChange={(split) => set({ split })} />
      <Toggle label="Kicker rule draws itself" checked={sec.ruleDraw} onChange={(ruleDraw) => set({ ruleDraw })} />
      <Toggle label="Sticky heading (desktop)" checked={sec.sticky && stickyAllowed} disabled={!stickyAllowed} onChange={(sticky) => set({ sticky })} />
      {id === "about" && <Hint>No sticky here: the lede sits under the heading and would pass behind it.</Hint>}
      {id === "up" && (
        <>
          <p className="mt-2 text-xs">Layout</p>
          <Choice options={LAYOUT} value={s.up.layout} onChange={(layout) => edit({ up: { ...s.up, layout } })} />
          {s.up.layout === "today" && <Hint>Sticky needs the heading beside the items; over them it would cover them.</Hint>}
          <p className="mt-2 text-xs">Each item arrives by</p>
          <Choice options={ARRIVAL} value={s.up.arrival} onChange={(arrival) => edit({ up: { ...s.up, arrival } })} />
          <Slider label="Lag added per item" {...RANGES.itemLagStep} unit="s" value={s.up.itemLagStep} onChange={(itemLagStep) => edit({ up: { ...s.up, itemLagStep } })} />
        </>
      )}
      {id === "connect" && (
        <Toggle label="Row rules draw in turn" checked={s.connect.rowDraw} onChange={(rowDraw) => edit({ connect: { rowDraw } })} />
      )}
    </Group>
  );
}

export function PanelSections({ s, edit }: { s: LabSettings; edit: Edit }) {
  return (
    <>
      {(Object.keys(SECTION_LABELS) as SectionKey[]).map((id) => (
        <SectionGroup key={id} id={id} s={s} edit={edit} />
      ))}
    </>
  );
}
