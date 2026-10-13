import { cards } from "./cards";
import type { CardKey, CardPicture, LogoRef } from "./types";

// Draft for the quick page. Years are parsed out of the book rows; the lines
// are first-person drafts for me to rewrite. end is null while it is still going.

export type QuickGroup = "work" | "people";

interface QuickDraft {
  id: CardKey;
  group: QuickGroup;
  role: string;
  org: string;
  start: string;
  end: string | null;
  line: string;
  outcomes: readonly string[];
}

// photo and logo are the card's own (lib/content/cards.ts); a card shows one or neither.
// mark is the logo for a small round node: the logo itself, or the brand's square mark
// where the card's logo is a wordmark too wide to read at that size.
export interface QuickEntry extends QuickDraft {
  photo: CardPicture | null;
  logo: LogoRef | null;
  mark: LogoRef | null;
}

export const quickCopy = {
  kicker: "The 30-second version",
  title: "Aaron Sulbaran",
  lede: "Fourth-year ECE at UT Austin, headed into product management.",
  back: "See the full site",
  filters: { all: "All", work: "Work", people: "Fun stuff" },
  filterLabel: "Show",
  listLabel: "What I've done, by date",
  now: "now",
  rushTitle: "In a rush?",
  rushBody: "The quick version of my work is one tap away.",
  rushYes: "Show me",
  rushNo: "I'll explore",
  rushLink: "In a rush? The 30-second version",
  menuChip: "Quick view",
} as const;

const drafts: readonly QuickDraft[] = [
  {
    id: "jobs",
    group: "people",
    role: "The jobs that paid for school",
    org: "Popeyes to Aritzia",
    start: "2021-08",
    end: "2026-05",
    line: "I worked almost every year since high school so I could graduate without debt.",
    outcomes: ["Paid for a car in cash, rent, and tuition.", "A LinkedIn post about it reached about 130,000 people."],
  },
  {
    id: "band",
    group: "people",
    role: "Section leader to drum major",
    org: "Jordan High School band",
    start: "2021-08",
    end: "2023-05",
    line: "I led a few hundred students through a score and a marching book, and that is where I fell in love with leadership.",
    outcomes: ["Woodwind captain, then drum major.", "We won a regional championship just before I left."],
  },
  {
    id: "fsdatalink",
    group: "people",
    role: "Assistant manager and software engineer",
    org: "The family business",
    start: "2022-01",
    end: "2024-12",
    line: "I learned the business beside my dad: the books, the taxes, and the tools the field engineers actually used.",
    outcomes: ["Built internal tools and workflows.", "This is where optimizing money and technology started for me."],
  },
  {
    id: "misuki",
    group: "people",
    role: "Owner and daily driver",
    org: "Misuki, a 2001 Mazda Miata",
    start: "2022-09",
    end: null,
    line: "I bought her in cash senior year, and she is still the car I drive.",
    outcomes: ["No car loan.", "A family friend rebuilt the engine after it blew in college."],
  },
  {
    id: "ieee",
    group: "work",
    role: "Assistant officer to president",
    org: "IEEE UT Austin",
    start: "2023-08",
    end: "2026-05",
    line: "IEEE was my home at UT, and a lot of how I lead comes from it.",
    outcomes: ["Took a year that cleared about $200 and finished near $10K.", "Students told me a company I brought to an event is why they got the internship."],
  },
  {
    id: "mentorship",
    group: "people",
    role: "Coach, tutor and speaker",
    org: "Mentorship",
    start: "2023-09",
    end: null,
    line: "People made time for me, so I make time back.",
    outcomes: ["Coached first-year scholars and mentored HSF scholars at the STEM Summit.", "I take coffee chats in both directions."],
  },
  {
    id: "capital-one",
    group: "work",
    role: "Intern, then product",
    org: "Capital One",
    start: "2024-05",
    end: "2026-08",
    line: "Three summers, each one closer to product.",
    outcomes: ["2024 business analyst, 2025 product manager, 2026 applied AI.", "The first PM I met is the reason I pointed my career this way."],
  },
  {
    id: "travel",
    group: "people",
    role: "The trips I plan on purpose",
    org: "Travel",
    start: "2024-06",
    end: null,
    line: "Japan and Dubai are two of my favorite trips, and my sister's agency is a big reason I take travel seriously.",
    outcomes: ["Yosemite, Mt. Fuji, and more on the card.", "I ask for destination recommendations."],
  },
  {
    id: "min-max",
    group: "work",
    role: "Founder",
    org: "min/Max",
    start: "2025-01",
    end: null,
    line: "An agentic credit card co-pilot that picks the best card in the wallet for every purchase.",
    outcomes: ["Not launched yet.", "The first proof of concept won the finance track at Hook 'Em Hacks."],
  },
  {
    id: "building-in-public",
    group: "people",
    role: "Writing it down as I go",
    org: "LinkedIn and X",
    start: "2026-01",
    end: null,
    line: "I would rather be useful than look flawless, so I share what worked and what did not.",
    outcomes: ["2,500+ people on LinkedIn.", "About 450,000 impressions in three months."],
  },
  {
    id: "hackathons",
    group: "work",
    role: "Builder",
    org: "Hackathons",
    start: "2026-01",
    end: null,
    line: "I use a weekend to find out if an idea is real.",
    outcomes: ["Won UFCU Develop U.", "Started Talos at a one-day Vercel hackathon in New York."],
  },
  {
    id: "anthropic",
    group: "work",
    role: "Claude Campus Ambassador",
    org: "Anthropic",
    start: "2026-01",
    end: "2026-05",
    line: "I helped people get fast with the tools, then build something of their own in the same hour.",
    outcomes: ["Grew the UT club past a thousand members.", "Meetings ran 60 to 80 people, and about 100 at the end-of-year hackathon."],
  },
  {
    id: "this-site",
    group: "work",
    role: "Designer and product lead",
    org: "This site",
    start: "2026-04",
    end: null,
    line: "I design it, write the specs, and manage the agents that help me build it.",
    outcomes: ["The repo is public.", "It is the test of how I would run a product team."],
  },
  {
    id: "talos",
    group: "work",
    role: "Builder",
    org: "Talos",
    start: "2026-06",
    end: null,
    line: "My executive assistant. It reads the inboxes and tells me what needs me first, and its limits are written in code.",
    outcomes: ["Saves me hours every week.", "I plan to open source it."],
  },
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

export const quickEntries: readonly QuickEntry[] = drafts.map((draft) => ({ ...draft, ...visualOf(draft.id) }));

// Dated life details that stand between the entries. Each one is copy already
// on the site: evidence is the words it comes from, verbatim (the content test
// finds every one in the cards' copy). Only the year is shown; where the copy
// gives no month, the month in at only places the sign among the entries.
// yearFrom names a year the copy implies but never states, for me to confirm.
export interface QuickSign {
  key: string;
  group: QuickGroup;
  at: string;
  text: string;
  evidence: readonly string[];
  yearFrom?: string;
}

export const quickSigns: readonly QuickSign[] = [
  { key: "mod-last-shift", group: "people", at: "2023-04", text: "My last clock-out at MOD Pizza", evidence: ["My last clock-out at MOD, April 15, 2023, 10 pm"] },
  {
    key: "started-ece", group: "work", at: "2023-08", text: "Started ECE at UT Austin",
    evidence: ["From assistant officer my freshman year", "President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026"],
    yearFrom: "IEEE's 2023 to 2026 and assistant officer my freshman year",
  },
  { key: "first-shpe", group: "people", at: "2023-10", text: "My first SHPE national convention", evidence: ["Me at my first SHPE national convention, 2023."] },
  { key: "first-pm", group: "work", at: "2024-06", text: "Met my first product manager", evidence: ["**2024, business analyst.** My first look at corporate America. I met my first product manager"] },
  { key: "apple", group: "people", at: "2024-08", text: "Started at Apple as a specialist", evidence: ["Specialist, then technical specialist", "2024 to 2025"] },
  { key: "aritzia", group: "people", at: "2025-08", text: "Joined Aritzia", evidence: ["Aritzia", "2025 to 2026"] },
  { key: "hsf-scholar", group: "people", at: "2025-09", text: "My first HSF event, as a scholar", evidence: ["Hispanic Scholarship Fund event, September 2025", "Me at HSF my first year, as a scholar."] },
  { key: "rising-stars", group: "work", at: "2026-01", text: "My last IEEE Rising Stars, as chapter president", evidence: ["IEEE Rising Stars conference in Las Vegas, January 2026", "Me at my last IEEE Rising Stars conference as president of the chapter."] },
  { key: "hook-em", group: "work", at: "2026-03", text: "min/Max won the finance track at Hook 'Em Hacks", evidence: ["**Hook 'Em Hacks, spring 2026.** Won the finance track with the first build and MVP/Proof of Concept of min/Max."] },
  { key: "hsf-mentor", group: "people", at: "2026-09", text: "Back at HSF, this time as a mentor", evidence: ["Hispanic Scholarship Fund STEM Summit photo booth, September 2026", "Me at my second HSF, this time as a mentor."] },
];

// The end of the road. links are siteContent.connect's keys, in order; primary is its booking link.
export const quickClosing = {
  label: "What's next",
  // DRAFT: mine to rewrite. Built from "want to do the same in my full-time work" in Who I am.
  line: "Next, I'm looking for a full-time product role where I get people with very different skills building towards one goal.",
  links: ["linkedin", "email", "github"] as const,
};

export function quickRange(entry: QuickEntry): string {
  const year = (month: string) => month.slice(0, 4);
  const end = entry.end ? year(entry.end) : quickCopy.now;
  const start = year(entry.start);
  return start === end ? start : `${start} to ${end}`;
}

export function quickSorted(entries: readonly QuickEntry[] = quickEntries): QuickEntry[] {
  return [...entries].sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : a.org.localeCompare(b.org)));
}
