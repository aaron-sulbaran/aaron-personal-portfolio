import { siteContent } from "@/lib/content";
import type { Gallery } from "./card";
import { GALLERY, PHONE_GROUPING } from "./constants";
import { phonePages } from "./plan";
import { pagerSteps, partId, planSteps, type MaskStep, type StepOptions } from "./timing";

// Which parts of a card's modal mask in, and in what order: the desktop rows
// (and a phone card with no photos, which is its words alone) through
// planSteps, the phone pager through pagerSteps. Beside the rows the flown
// card's photo never masks, because a parked flown card covers it; on a phone
// the flown card parks on the header's tile, which never masks, so the first
// page's picture masks like any photo. Mentorship's mentors mask after the rows
// and before the links; Talos's sting follows its first paragraph, its Discord channel
// its second, and its team's two paragraphs come where the mentors would. lines counts a split part's lines.
export function cardSteps(gallery: Gallery, layout: "rows" | "pager", flying: boolean, lines?: (id: string) => number): MaskStep[] {
  const o: StepOptions = {
    flown: flying && layout === "rows" ? gallery.lead : undefined,
    hasCaption: (photo) => gallery.photos[photo]?.caption != null,
    hasLinks: siteContent.cards[gallery.key].modal.links.length > 0,
    after: gallery.key === "talos" ? TALOS_AFTER : undefined,
    trailing: gallery.key === "mentorship" && siteContent.cards.mentorship.mentors.people.length > 0 ? [partId.mentors] : gallery.key === "talos" ? [partId.talos] : [],
    lines,
  };
  const pages = phonePages(gallery.plan, PHONE_GROUPING);
  return layout === "pager" && pages.length > 0 ? pagerSteps(pages, o) : planSteps(gallery.plan, o);
}

// When the mask-in starts: at the landing (520ms) when a flown card lands, at
// once when nothing does (a book row, a touch tap), so the panel never sits
// empty waiting for a flight that is not coming.
export const maskStartMs = (flying: boolean) => (flying ? GALLERY.mask.landingMs : 0);

// What follows each of Talos's opening paragraphs: the sting after the first,
// the Discord channel after the second (components/card/talosParts).
export const TALOS_AFTER: Readonly<Record<number, readonly string[]>> = { 0: [partId.sting], 1: [partId.discord] };

// When Talos's sting starts at the earliest: once its stage has masked in, which is
// the fourth step (the title, the meta line, the first paragraph, then the sting),
// so the coin is whole on screen first. The sting itself also waits to be in view.
export const stingStartMs = (flying: boolean) => maskStartMs(flying) + 3 * GALLERY.mask.staggerMs + GALLERY.mask.lengthMs;
