import { cards } from "./cards";
import type { CardKey, CardPicture, LogoRef } from "./types";

// The Express lane (docs/superpowers/specs/2026-10-13-express-lane-design.md): one
// row per year, a sentence that sums the year up, and that year's cards as tiles
// that open the card's own modal. Every line marked DRAFT is mine to rewrite.

export const quickCopy = {
  title: "Express lane",
  // DRAFT: the spec's intro line.
  intro: "Because I know my users, I built a quick version of this site for the busiest people who still want to get to know me.",
  back: "See the full site",
  listLabel: "My years, 2021 to now",
  now: "now",
  menuChip: "Express lane",
  tripLabel: "The trip so far",
  tripTo: (year: string) => `Go to ${year}`,
  invite: {
    // DRAFT: the spec's pill label (mode A).
    pill: "In a rush? Express lane",
    dismiss: "Dismiss the Express lane invite",
    // DRAFT: the toast (mode C) keeps round 1's words with the new name.
    toastTitle: "In a rush?",
    toastBody: "The Express lane has my years and my cards on one page.",
    yes: "Show me",
    no: "I'll explore",
    // DRAFT: the spec's hero line (mode B).
    line: "In a rush? Here's the Express lane",
  },
} as const;

// DRAFT, every sentence: the spec's year drafts, from public site copy and résumé-level facts only.
export const quickYears = [
  { year: "2021", line: "I got my first jobs at Popeyes and MOD Pizza, became woodwind captain, and helped start my school's Hispanic honor society." },
  { year: "2022", line: "I led the band as one of Jordan's first drum majors, bought Misuki with cash, and started working in my dad's business." },
  { year: "2023", line: "I graduated, started ECE at UT Austin, and joined IEEE as a freshman assistant officer." },
  { year: "2024", line: "I spent my first Capital One summer as a business analyst, picked up a McCombs business minor, became IEEE's corporate director, and joined the Apple Store." },
  { year: "2025", line: "I came back to Capital One as a product manager, was elected IEEE president, and started building min/Max." },
  { year: "2026", line: "I started a Claude builder club as a campus ambassador, spent a third Capital One summer in New York on applied AI, won at Hook 'Em Hacks and UFCU, and built Talos." },
] as const;

export type QuickYear = (typeof quickYears)[number]["year"];

// start files the card under its year; end is null while it is still going.
// role and line are the tile's two lines under its title (round 2's drafts).
interface QuickDraft {
  id: CardKey;
  role: string;
  start: string;
  end: string | null;
  line: string;
}

// photo and logo are the card's own (lib/content/cards.ts); a card shows one or neither.
// mark is the logo for a small square: the logo itself, or the brand's square mark
// where the card's logo is a wordmark too wide to read at that size.
export interface QuickEntry extends QuickDraft {
  title: string;
  photo: CardPicture | null;
  logo: LogoRef | null;
  mark: LogoRef | null;
}

// DRAFT, every role and line: round 2's teasers, carried over for me to rewrite.
const drafts: readonly QuickDraft[] = [
  { id: "jobs", role: "Popeyes to Aritzia", start: "2021-08", end: "2026-05", line: "I worked almost every year since high school so I could graduate without debt." },
  { id: "band", role: "Section leader to drum major", start: "2021-08", end: "2023-05", line: "I led a few hundred students through a score and a marching book, and that is where I fell in love with leadership." },
  { id: "fsdatalink", role: "Assistant manager and software engineer", start: "2022-01", end: "2024-12", line: "I learned the business beside my dad: the books, the taxes, and the tools the field engineers actually used." },
  { id: "misuki", role: "2001 Mazda Miata, five-speed", start: "2022-09", end: null, line: "I bought her in cash senior year, and she is still the car I drive." },
  { id: "ieee", role: "Assistant officer to president", start: "2023-08", end: "2026-05", line: "IEEE was my home at UT, and a lot of how I lead comes from it." },
  { id: "mentorship", role: "Coach, tutor and speaker", start: "2023-09", end: null, line: "People made time for me, so I make time back." },
  { id: "capital-one", role: "Intern, then product", start: "2024-05", end: "2026-08", line: "Three summers, each one closer to product." },
  { id: "travel", role: "The trips I plan on purpose", start: "2024-06", end: null, line: "Japan and Dubai are two of my favorite trips, and my sister's agency is a big reason I take travel seriously." },
  { id: "min-max", role: "Founder", start: "2025-01", end: null, line: "An agentic credit card co-pilot that picks the best card in the wallet for every purchase." },
  { id: "building-in-public", role: "LinkedIn and X", start: "2026-01", end: null, line: "I would rather be useful than look flawless, so I share what worked and what did not." },
  { id: "hackathons", role: "Builder", start: "2026-01", end: null, line: "I use a weekend to find out if an idea is real." },
  { id: "anthropic", role: "Claude Campus Ambassador", start: "2026-01", end: "2026-05", line: "I helped people get fast with the tools, then build something of their own in the same hour." },
  { id: "this-site", role: "Designer and product lead", start: "2026-04", end: null, line: "I design it, write the specs, and manage the agents that help me build it." },
  { id: "talos", role: "Builder", start: "2026-06", end: null, line: "My executive assistant. It reads the inboxes and tells me what needs me first, and its limits are written in code." },
];

export const squareMarks: Partial<Record<CardKey, LogoRef>> = {
  anthropic: { src: "/work/logos/anthropic/anthropic-mark.svg", srcDark: "/work/logos/anthropic/anthropic-mark-white.svg", width: 92.2, height: 65 },
  fsdatalink: { src: "/work/logos/fsdatalink/fsdatalink-mark.png", srcDark: null, width: 681, height: 681, opaque: true },
};

function visualOf(id: CardKey): Pick<QuickEntry, "photo" | "logo" | "mark"> {
  const { visual } = cards[id];
  if (visual.kind === "photo") return { photo: visual.photo, logo: null, mark: null };
  if (visual.kind === "logo") return { photo: null, logo: visual.logo, mark: squareMarks[id] ?? visual.logo };
  return { photo: null, logo: null, mark: null };
}

export const quickEntries: readonly QuickEntry[] = drafts.map((draft) => ({ ...draft, title: cards[draft.id].book.title, ...visualOf(draft.id) }));

// The end of the road. links are siteContent.connect's keys, in order; primary is its booking link.
export const quickClosing = {
  label: "What's next",
  // DRAFT: built from "want to do the same in my full-time work" in Who I am.
  line: "Next, I'm looking for a full-time product role where I get people with very different skills building towards one goal.",
  links: ["linkedin", "email", "github"] as const,
};

export function quickRange(entry: Pick<QuickEntry, "start" | "end">): string {
  const year = (month: string) => month.slice(0, 4);
  const end = entry.end ? year(entry.end) : quickCopy.now;
  const start = year(entry.start);
  return start === end ? start : `${start} to ${end}`;
}
