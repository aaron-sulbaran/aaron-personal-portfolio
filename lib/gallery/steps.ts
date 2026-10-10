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
// and before the links. lines counts a split part's lines.
export function cardSteps(gallery: Gallery, layout: "rows" | "pager", flying: boolean, lines?: (id: string) => number): MaskStep[] {
  const o: StepOptions = {
    flown: flying && layout === "rows" ? gallery.lead : undefined,
    hasCaption: (photo) => gallery.photos[photo]?.caption != null,
    hasLinks: siteContent.cards[gallery.key].modal.links.length > 0,
    trailing: gallery.key === "mentorship" && siteContent.cards.mentorship.mentors.people.length > 0 ? [partId.mentors] : [],
    lines,
  };
  const pages = phonePages(gallery.plan, PHONE_GROUPING);
  return layout === "pager" && pages.length > 0 ? pagerSteps(pages, o) : planSteps(gallery.plan, o);
}

// When the mask-in starts: at the landing (520ms) when a flown card lands, at
// once when nothing does (a book row, a touch tap), so the panel never sits
// empty waiting for a flight that is not coming.
export const maskStartMs = (flying: boolean) => (flying ? GALLERY.mask.landingMs : 0);
