// Page 1's story, as pure layout: which side each paragraph block leans to, and
// the order of its items (the blocks, the soundtrack band, the phone's "More
// about me") for desktop and for a phone. The page renders the items in the
// default desktop order and moves them with CSS `order` from these numbers, so
// the lab can change the band's place or the phone's arrangement live and the
// server's first paint never depends on a knob.

export const WAVE_PLACEMENTS = [1, 2, 3] as const;
export type WavePlacement = (typeof WAVE_PLACEMENTS)[number];

export const PHONE_LAYOUTS = ["storyFirst", "teaserPeeks"] as const;
export type PhoneLayout = (typeof PHONE_LAYOUTS)[number];

export type Side = "left" | "right";
export type Stagger = { side: Side; shift: number };

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

// The blocks alternate, the first on the left. A right block is pushed across
// `offset` of the free width (the column less the block's own measure); a left
// block sits flush.
export function staggerPlan(count: number, offset: number): Stagger[] {
  const shift = clamp01(offset);
  return Array.from({ length: Math.max(0, count) }, (_, i) => (i % 2 === 0 ? { side: "left", shift: 0 } : { side: "right", shift }));
}

export type StoryKnobs = { wavePlacement: number; phoneLayout: PhoneLayout };

export type StoryItem = {
  id: string; // "block-1" to "block-N", "band", "more"
  // Where the item sits (a CSS order value; larger is later).
  order: { desktop: number; phone: number };
  // Folded away on a phone behind "More about me", unless that is open.
  collapsible: boolean;
};

export const BAND_ID = "band";
export const MORE_ID = "more";
export const blockId = (index: number) => `block-${index}`;

const STEP = 10;

// The band goes after block `placement`, held to 1 through N - 1: after the
// last block it would be the story's foot, and the teaser follows the story.
export function clampPlacement(placement: number, blocks: number): number {
  const whole = Number.isFinite(placement) ? Math.round(placement) : 2;
  return Math.min(Math.max(1, blocks - 1), Math.max(1, whole));
}

export function storyItems(blocks: number, knobs: StoryKnobs): StoryItem[] {
  const count = Math.max(0, blocks);
  const placement = clampPlacement(knobs.wavePlacement, count);
  const ids = Array.from({ length: count }, (_, i) => blockId(i + 1));
  const desktop = [...ids.slice(0, placement), BAND_ID, ...ids.slice(placement)];
  // "Teaser peeks" is a phone arrangement: the name, block 1 and the music
  // line, then a disclosure holding the rest, so the first screen reaches the
  // teaser. Everywhere else the story is whole.
  const peeks = knobs.phoneLayout === "teaserPeeks";
  const phone = peeks ? [ids[0], BAND_ID, MORE_ID, ...ids.slice(1)] : desktop;
  const at = (list: string[], id: string) => {
    const index = list.indexOf(id);
    return index < 0 ? list.length * STEP : index * STEP;
  };
  return [...desktop, MORE_ID].map((id) => ({
    id,
    order: { desktop: at(desktop, id), phone: at(phone, id) },
    collapsible: peeks && ids.indexOf(id) > 0,
  }));
}

// The ids in the order a viewer reads them.
export function sequenceOf(items: readonly StoryItem[], where: "desktop" | "phone"): string[] {
  return items
    .filter((item) => (item.id === MORE_ID ? where === "phone" && items.some((other) => other.collapsible) : true))
    .slice()
    .sort((a, b) => a.order[where] - b.order[where])
    .map((item) => item.id);
}
