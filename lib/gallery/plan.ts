// Which photos sit beside which words in a card's modal. Aaron's pick from the
// gallery lab (rounds four to six, 2026-10-09; branch lab, app/lab/gallery/plan.ts
// at ae9b6dd, rotatingPlan), with one guard: the card picture never takes turns,
// because a parked flown card covers it. Pure: both layouts and the tests read it.

export interface PlanPhoto {
  // The word unit (a paragraph, or on the jobs card a timeline entry) this photo
  // belongs beside; undefined, or a unit the card lacks, names none.
  beside?: number;
}

export interface Slide {
  photo: number; // the row's first photo: the one standing still, or the first to show
  photos: number[]; // the row's photos, photo first; two or more take turns
  own?: number; // the word unit this row's photo owns
  before: number[]; // free units shown before own
  after: number[]; // and after it
}

export interface Plan {
  intro: number[]; // units before the first row: full width on desktop, the first page on a phone
  slides: Slide[];
  closing: number[]; // units after the last row
}

export interface Page extends Slide {
  links: boolean; // the card's links (and the mentors) sit on this page
  wordless?: boolean; // grouping B: a group's later photo alone with its caption
}

// A: a page a paragraph, the group turning in the stage. B: a page a photo, a
// group's later pages wordless. C: a page a paragraph, the rest of the group in a strip.
export type PhoneGrouping = "paragraph" | "photo" | "strip";
export type StageKind = "still" | "turns" | "strip";

const validIn = (count: number) => (unit: number | undefined): unit is number => unit !== undefined && Number.isInteger(unit) && unit >= 0 && unit < count;

// The card picture first, then the others in the order of the unit they name,
// those naming none last.
export function photoOrder(photos: readonly PlanPhoto[], wordCount: number, lead?: number): number[] {
  const valid = validIn(wordCount);
  const rest = photos.map((photo, i) => ({ i, key: valid(photo.beside) ? photo.beside : Infinity })).filter(({ i }) => i !== lead);
  rest.sort((a, b) => a.key - b.key || a.i - b.i);
  const hasLead = lead !== undefined && lead >= 0 && lead < photos.length;
  return [...(hasLead ? [lead] : []), ...rest.map(({ i }) => i)];
}

type Placed = { slide: Slide; at: number };

function claimWords(wordCount: number, photos: readonly PlanPhoto[], lead?: number): Placed[] {
  const valid = validIn(wordCount);
  const claimed = new Set<number>();
  return photoOrder(photos, wordCount, lead).map((photo) => {
    const named = photo === lead && wordCount > 0 ? 0 : photos[photo].beside;
    const own = valid(named) && !claimed.has(named) ? named : undefined;
    if (own !== undefined) claimed.add(own);
    // A photo whose unit was taken follows the photo that took it.
    const at = own !== undefined ? own : valid(named) ? named + 0.5 : Infinity;
    return { slide: { photo, photos: [photo], own, before: [], after: [] }, at };
  });
}

function giveEveryPhotoWords(placed: Placed[], wordCount: number, lead?: number): Placed[] {
  const owns = (list: readonly Placed[]) => list.flatMap(({ slide }) => (slide.own === undefined ? [] : [slide.own]));
  const taken = new Set(owns(placed));
  placed.forEach((item, i) => {
    if (item.slide.own !== undefined) return;
    const below = Math.max(-1, ...owns(placed.slice(0, i)));
    const above = Math.min(wordCount, ...owns(placed.slice(i + 1)));
    for (let unit = below + 1; unit < above; unit++) {
      if (taken.has(unit)) continue;
      item.slide.own = unit;
      item.at = unit;
      taken.add(unit);
      return;
    }
  });
  const rows: Placed[] = [];
  let waiting: number[] = [];
  for (const { slide, at } of placed) {
    const previous = rows[rows.length - 1];
    if (slide.own !== undefined) {
      rows.push({ slide: { ...slide, photos: [slide.photo, ...waiting] }, at });
      waiting = [];
    } else if (previous && previous.slide.photo !== lead) previous.slide.photos.push(slide.photo);
    else waiting.push(slide.photo);
  }
  const last = rows[rows.length - 1];
  if (last && last.slide.photo !== lead) last.slide.photos.push(...waiting);
  else if (waiting.length) rows.push({ slide: { photo: waiting[0], photos: waiting, before: [], after: [] }, at: Infinity });
  return rows;
}

function arrange(wordCount: number, placed: readonly Placed[]): Plan {
  const claimed = new Set(placed.flatMap(({ slide }) => (slide.own === undefined ? [] : [slide.own])));
  type Item = { kind: "slide"; slide: Slide; at: number } | { kind: "text"; unit: number; at: number };
  const items: Item[] = placed.map(({ slide, at }) => ({ kind: "slide", slide, at }));
  for (let unit = 0; unit < wordCount; unit++) if (!claimed.has(unit)) items.push({ kind: "text", unit, at: unit });
  items.sort((x, y) => x.at - y.at || (x.kind === "slide" ? -1 : 1) - (y.kind === "slide" ? -1 : 1));
  const slides = items.flatMap((item) => (item.kind === "slide" ? [item.slide] : []));
  const intro: number[] = [];
  const closing: number[] = [];
  let previous: Slide | undefined;
  let run: number[] = [];
  for (const item of items) {
    if (item.kind === "text") {
      run.push(item.unit);
      continue;
    }
    if (!previous) intro.push(...run);
    else {
      const half = Math.ceil(run.length / 2);
      previous.after.push(...run.slice(0, half));
      item.slide.before.push(...run.slice(half));
    }
    run = [];
    previous = item.slide;
  }
  if (previous) closing.push(...run);
  else intro.push(...run);
  return { intro, slides, closing };
}

const group = (members: number[], own?: number): Slide => ({ photo: members[0], photos: members, own, before: [], after: [] });

export function galleryPlan(wordCount: number, photos: readonly PlanPhoto[], lead?: number): Plan {
  if (photos.length <= wordCount) return arrange(wordCount, giveEveryPhotoWords(claimWords(wordCount, photos, lead), wordCount, lead));
  const order = photoOrder(photos, wordCount, lead);
  const own = wordCount === 1 ? 0 : undefined;
  if (wordCount <= 1) {
    const hasLead = lead !== undefined && order[0] === lead;
    if (!hasLead || order.length < 2) return { intro: [], slides: [group(order, own)], closing: [] };
    return { intro: [], slides: [group([order[0]], own), group(order.slice(1))], closing: [] };
  }
  const [first, ...rest] = order;
  const rows = wordCount - 1;
  const base = Math.floor(rest.length / rows);
  const extra = rest.length % rows;
  const slides = [group([first], 0)];
  let taken = 0;
  for (let row = 0; row < rows; row++) {
    const size = base + (row >= rows - extra ? 1 : 0);
    slides.push(group(rest.slice(taken, taken + size), row + 1));
    taken += size;
  }
  return { intro: [], slides, closing: [] };
}

// Photos grouped by the unit each names, in unit order, those naming none in the
// last group; skip leaves one photo out (namedPlan's card picture).
function groupsOf(wordCount: number, photos: readonly PlanPhoto[], skip?: number): Placed[] {
  const valid = validIn(wordCount);
  const groups = new Map<number, number[]>();
  const strays: number[] = [];
  photos.forEach((photo, i) => {
    if (i === skip) return;
    if (valid(photo.beside)) groups.set(photo.beside, [...(groups.get(photo.beside) ?? []), i]);
    else strays.push(i);
  });
  const placed: Placed[] = [...groups.entries()].sort(([a], [b]) => a - b).map(([own, members]) => ({ slide: group(members, own), at: own }));
  const last = placed[placed.length - 1];
  if (last) last.slide.photos.push(...strays);
  else if (strays.length) placed.push({ slide: group(strays), at: Infinity });
  return placed;
}

export function groupedPlan(wordCount: number, photos: readonly PlanPhoto[]): Plan {
  return arrange(wordCount, groupsOf(wordCount, photos));
}

// cards.md's pairing to the letter, for the photo cards the lab never showed
// Aaron (the band and Travel): the card picture stands alone in the first row,
// where the flight lands (cards.md: it is not paired), taking only the opening
// units no photo names; every other photo sits beside the unit it names,
// photos naming one unit taking turns; the other units ride with the rows as
// they do in groupedPlan.
export function namedPlan(wordCount: number, photos: readonly PlanPhoto[], lead: number): Plan {
  const { intro, slides, closing } = arrange(wordCount, groupsOf(wordCount, photos, lead));
  return { intro: [], slides: [{ ...group([lead]), before: intro }, ...slides], closing };
}

// A page a row: the opening units on the first page, the closing units and the
// links on the last.
export function pagesOf(plan: Plan): Page[] {
  const last = plan.slides.length - 1;
  return plan.slides.map((slide, i) => ({
    ...slide,
    photos: [...slide.photos],
    before: i === 0 ? [...plan.intro, ...slide.before] : [...slide.before],
    after: i === last ? [...slide.after, ...plan.closing] : [...slide.after],
    links: i === last,
  }));
}

// B: a group's first photo keeps the words; each later photo is a page alone.
export function photoPages(plan: Plan): Page[] {
  return pagesOf(plan).flatMap((page) => {
    const [first, ...rest] = page.photos;
    const wordless = rest.map((photo): Page => ({ photo, photos: [photo], before: [], after: [], links: false, wordless: true }));
    return [{ ...page, photo: first, photos: [first] }, ...wordless];
  });
}

export function phonePages(plan: Plan, grouping: PhoneGrouping): Page[] {
  return grouping === "photo" ? photoPages(plan) : pagesOf(plan);
}

export function stageKind(page: Page, grouping: PhoneGrouping): StageKind {
  if (page.photos.length < 2) return "still";
  return grouping === "paragraph" ? "turns" : grouping === "strip" ? "strip" : "still";
}

export function slideWords(slide: Slide): number[] {
  return [...slide.before, ...(slide.own === undefined ? [] : [slide.own]), ...slide.after];
}
