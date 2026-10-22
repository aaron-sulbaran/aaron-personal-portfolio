import { cards } from "./cards";
import { visibleText } from "./links";
import type { CardKey } from "./types";

// The cards section's two columns of titles on either side of the Coil. Work
// on the left; Builds on the right with a small group of what I do off the
// clock under it. Every card is in exactly one group.
export type ColumnKey = "work" | "builds";
export interface ColumnGroupSpec { heading: string | null; keys: readonly CardKey[] }
export interface ColumnSpec { key: ColumnKey; heading: string; groups: readonly ColumnGroupSpec[] }

export const columnSpecs: readonly ColumnSpec[] = [
  { key: "work", heading: "Work", groups: [{ heading: null, keys: ["capital-one", "anthropic", "ieee", "fsdatalink", "jobs", "mentorship"] }] },
  {
    key: "builds",
    heading: "Builds",
    groups: [
      { heading: null, keys: ["min-max", "talos", "this-site", "hackathons", "building-in-public"] },
      { heading: "Off the clock", keys: ["band", "misuki", "travel"] },
    ],
  },
];

// A title: the short words shown, and the card's full book title for assistive tech.
export interface ColumnTitle { key: CardKey; short: string; full: string }
export interface ColumnGroupView { heading: string | null; titles: readonly ColumnTitle[] }
export interface ColumnView { key: ColumnKey; heading: string; groups: readonly ColumnGroupView[] }

export function columnView(spec: ColumnSpec): ColumnView {
  return {
    key: spec.key,
    heading: spec.heading,
    groups: spec.groups.map((group) => ({
      heading: group.heading,
      titles: group.keys.map((key) => ({ key, short: cards[key].short, full: visibleText(cards[key].book.title) })),
    })),
  };
}

export const cardColumns: readonly ColumnView[] = columnSpecs.map(columnView);
