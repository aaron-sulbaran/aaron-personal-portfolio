import { cards } from "./cards";
import { logos } from "./media";
import type { CardKey, CardPicture, LogoRef } from "./types";

// The lean portfolio (docs/superpowers/specs/2026-10-13-express-lane-design.md):
// one row per year, newest first, a sentence that sums the year up, and that
// year's cards as tiles that open the card's own modal.

export const quickCopy = {
  title: "My Lean Portfolio",
  intro: "Because I know my users, I built a lean version of my site for the busiest people (and recruiters) who still want to get to know me.",
  hint: "(Click each experience card to learn more)",
  back: "See the full site",
  listLabel: "My years, newest first",
  now: "now",
  menuChip: "My Lean Portfolio",
  tripLabel: "The trip so far",
  tripTo: (year: string) => `Go to ${year}`,
  invite: {
    pill: "In a rush? My Lean Portfolio",
    dismiss: "Dismiss the Lean Portfolio invite",
    toastTitle: "In a rush?",
    toastBody: "My Lean Portfolio has my years and my cards on one page.",
    yes: "Show me",
    no: "I'll explore",
    line: "In a rush? Here's My Lean Portfolio",
  },
} as const;

// Aaron's year lines, 2026-10-14. 2022's "in" is the missing word from his note.
export const quickYears = [
  { year: "2021", line: "I got my first part-time jobs (outside of working for the family business) at Popeyes and MOD Pizza, became woodwind captain, and helped start my school's Hispanic honor society." },
  { year: "2022", line: "I led the band as one of my high school's first drum majors, bought Misuki in cash, and took up a more important role in the family business." },
  { year: "2023", line: "I started ECE at UT Austin as a Ramshorn Scholar, joined IEEE as a freshman assistant officer, and became involved on campus." },
  { year: "2024", line: "I completed my first internship right out of freshman year at Capital One as an early business analyst intern, picked up a McCombs business minor, became IEEE's corporate director, and joined the Genius Bar at the Apple Store to pay for college." },
  { year: "2025", line: "I came back to Capital One as a product manager intern, was elected IEEE president, and started building min/Max. I also started showing up to hackathons and started winning." },
  { year: "2026", line: "I started a Claude builder club as a campus ambassador, spent a third Capital One summer in New York on applied AI, won at Hook 'Em Hacks and UFCU, and built Talos." },
] as const;

export type QuickYear = (typeof quickYears)[number]["year"];

// start files the card under its year; end is null while it is still going.
// role is the accent line; line is the teaser under it. A role that already
// names its year is the whole subtitle (quickSubtitle).
// slot is unique. id is the modal, so Capital One and the jobs can each appear
// once a year and still open the one card. tileLogo replaces the card's face
// on this tile only.
interface QuickDraft {
  id: CardKey;
  slot: string;
  role: string;
  start: string;
  end: string | null;
  line: string;
  title?: string;
  tileLogo?: LogoRef;
}

export interface QuickEntry extends Omit<QuickDraft, "tileLogo"> {
  title: string;
  tileLogo: LogoRef | null;
  photo: CardPicture | null;
  logo: LogoRef | null;
  mark: LogoRef | null;
}

const anthropicMark: LogoRef = {
  src: "/work/logos/anthropic/anthropic-mark.svg",
  srcDark: "/work/logos/anthropic/anthropic-mark-white.svg",
  width: 92.2,
  height: 65,
};

const drafts: readonly QuickDraft[] = [
  { id: "band", slot: "band", role: "Section leader to drum major", start: "2021-08", end: "2023-05", line: "This is where I fell in love with leadership" },
  { id: "fsdatalink", slot: "fsdatalink", role: "Assistant manager and software engineer", start: "2022-01", end: null, line: "I learned how to run a business beside my dad and still work with him when I can" },
  { id: "jobs", slot: "popeyes", title: "Popeyes", role: "Shift Lead - 2022", start: "2022-06", end: "2022-12", line: "Cooked some chicken to pay my first bills", tileLogo: logos.popeyes },
  { id: "misuki", slot: "misuki", role: "2001 Mazda Miata, five-speed", start: "2022-09", end: null, line: "I bought her in cash senior year and she's still my daily driver" },
  { id: "jobs", slot: "mod", title: "MOD Pizza", role: "All-Star Squad Member - 2023", start: "2023-01", end: "2023-12", line: "Learned how to cook a pizza in an open brick oven", tileLogo: logos.mod },
  { id: "ieee", slot: "ieee", role: "Assistant officer to president", start: "2023-08", end: "2026-05", line: "IEEE was my home at UT, and a lot of how I lead comes from it." },
  { id: "mentorship", slot: "mentorship", role: "Coach, tutor and speaker", start: "2023-09", end: null, line: "People made time for me, so I make time back." },
  { id: "capital-one", slot: "capital-one-2024", role: "Business Analyst Intern - 2024", start: "2024-05", end: "2024-08", line: "Worked on revamping the customer contact strategy for the Internal Digital Recoveries team" },
  { id: "travel", slot: "travel", role: "The trips I plan on purpose", start: "2024-06", end: null, line: "This was the year I started realizing I loved to travel intentionally" },
  { id: "jobs", slot: "apple", title: "Apple", role: "From Specialist to Genius Bar - 2024", start: "2024-08", end: "2025-05", line: "Helped sell phones then quickly moved to repairing some of my favorite products", tileLogo: logos.apple },
  { id: "jobs", slot: "ut-austin", title: "UT Austin", role: "Student Mentor - 2024", start: "2024-09", end: "2025-05", line: "Got paid to mentor students I would have helped regardless of pay", tileLogo: logos["ut-austin"] },
  { id: "min-max", slot: "min-max", role: "Founder", start: "2025-01", end: null, line: "An agentic credit card co-pilot that gets users their best rewards" },
  { id: "hackathons", slot: "hackathons", role: "Builder", start: "2025-01", end: null, line: "I love spending my free time building, so why not get rewarded and compete for it?" },
  { id: "capital-one", slot: "capital-one-2025", role: "Product Manager Intern - 2025", start: "2025-05", end: "2025-08", line: "Helped lead NPI for the Venture X NPSL card for the Premium Card (Upmarket) team" },
  { id: "jobs", slot: "aritzia", title: "Aritzia", role: "Sales Associate - 2025", start: "2025-08", end: "2026-05", line: "Got paid a lot to dress well and give fashion advice", tileLogo: logos.aritzia },
  { id: "anthropic", slot: "anthropic", role: "Claude Campus Ambassador", start: "2026-01", end: "2026-05", line: "Helped students adopt AI tools into their work in an ethical way", tileLogo: anthropicMark },
  { id: "building-in-public", slot: "building-in-public", role: "LinkedIn and X", start: "2026-01", end: null, line: "How I share what I've learned so far with anyone who's willing to listen" },
  { id: "this-site", slot: "this-site", role: "Designer and product lead", start: "2026-04", end: null, line: "I design it, write the specs, and manage the agents that help me build it." },
  { id: "capital-one", slot: "capital-one-2026", role: "Applied AI (PM) Intern - 2026", start: "2026-05", end: "2026-08", line: "Built an agentic model testing framework for fraud models on the Third Party Fraud team" },
  { id: "talos", slot: "talos", role: "Builder", start: "2026-06", end: null, line: "My executive assistant. Talos is my own custom harness that grows with me every day" },
];

export const squareMarks: Partial<Record<CardKey, LogoRef>> = {
  anthropic: anthropicMark,
  fsdatalink: { src: "/work/logos/fsdatalink/fsdatalink-mark.png", srcDark: null, width: 681, height: 681, opaque: true },
};

function visualOf(id: CardKey): Pick<QuickEntry, "photo" | "logo" | "mark"> {
  const { visual } = cards[id];
  if (visual.kind === "photo") return { photo: visual.photo, logo: null, mark: null };
  if (visual.kind === "logo") return { photo: null, logo: visual.logo, mark: squareMarks[id] ?? visual.logo };
  return { photo: null, logo: null, mark: null };
}

export const quickEntries: readonly QuickEntry[] = drafts.map((draft) => ({
  ...draft,
  title: draft.title ?? cards[draft.id].book.title,
  tileLogo: draft.tileLogo ?? null,
  ...visualOf(draft.id),
}));

export const quickClosing = {
  label: "What's next",
  line: "Next, I'm looking for a product or builder role where I can bring people together and leverage different skillsets to build towards one goal.\n\n(Corporate America calls this \"cross-functional collaboration,\" but I call it a dream role)",
  links: ["linkedin", "email", "github"] as const,
};

export function quickRange(entry: Pick<QuickEntry, "start" | "end">): string {
  const year = (month: string) => month.slice(0, 4);
  const end = entry.end ? year(entry.end) : quickCopy.now;
  const start = year(entry.start);
  return start === end ? start : `${start} to ${end}`;
}

// A role that already names its year (2021 on) is the whole subtitle. A model
// year like Misuki's 2001 does not count, so those tiles still take the range.
export function quickSubtitle(entry: Pick<QuickEntry, "role" | "start" | "end">): string {
  return /\b20(?:1\d|2\d)\b/.test(entry.role) ? entry.role : `${entry.role}, ${quickRange(entry)}`;
}
