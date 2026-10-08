import { photoBySrc } from "@/lib/content";

// The four cards the brief names for the first tuning pass, with Aaron's
// approved words (docs/content/cards.md) and the block each photo belongs
// beside (docs/content/photos.md). The real gallery photos are not exported
// yet, so each slot holds a stand-in from public/photos with its own true,
// first-person alt text; the slot keeps the pairing the real photo will take.

export interface LabPhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
  block?: number;
  // What photos.md puts here, so the stand-in is never mistaken for the pick.
  intended: string;
}

export interface LabCard {
  id: string;
  name: string;
  // Where the flight lands: the logo slot for a logo card, the first photo
  // for a photo card (modal-gallery.md, "Rules that hold").
  flown: "logo" | "first-photo";
  logo?: { light: string; dark: string };
  title: string;
  meta: string;
  blocks: string[];
  photos: LabPhoto[];
  links: { label: string; href: string }[];
}

function photo(src: string, block: number | undefined, intended: string): LabPhoto {
  const found = photoBySrc.get(src);
  if (!found) throw new Error(`No photo ${src} in lib/content.ts`);
  return { src, width: found.width, height: found.height, alt: found.alt, block, intended };
}

export const CARDS: readonly LabCard[] = [
  {
    id: "capital-one",
    name: "Capital One",
    flown: "logo",
    logo: { light: "/work/logos/capital-one.svg", dark: "/work/logos/capital-one.svg" },
    title: "Capital One",
    meta: "Intern, 2024 to 2026",
    blocks: [
      "I spent three summers at Capital One, and each one moved me closer to product.",
      "**2024, business analyst.** My first look at corporate America. I met my first product manager, who told me a PM is a manager \"that gets people to trust them and their decisions without having the power to change their salaries.\" That sentence changed my career trajectory.",
      "**2025, product manager.** The summer I started explaining the job to other people. Explaining it made me realize how much I enjoyed the work that comes with being a PM.",
      "**2026, applied AI (product manager).** My first stab at building agentic workflows inside Capital One's internal machine learning tools to test how those models behaved.",
      "If you want to learn more, I'll say what I can in person.",
    ],
    photos: [
      photo("/photos/capital-one.jpeg", 1, "the 2024 welcome banner"),
      photo("/photos/uncs-grad.jpeg", 2, "the McLean office, 2025"),
      photo("/photos/traveling.jpeg", 3, "the New York rooftop, 2026"),
    ],
    links: [],
  },
  {
    id: "hackathons",
    name: "Hackathons",
    flown: "first-photo",
    title: "Hackathons",
    meta: "Builder, 2026 to now",
    blocks: [
      "**Hook 'Em Hacks, spring 2026.** Won the finance track with the first build and MVP/Proof of Concept of min/Max.",
      "**UFCU Develop U, fall 2026.** Won with UFCU Front Desk, a digital front desk assistant that makes joining a credit union simple and still sounds like them.",
      "**Vercel one-day hackathon, New York.** Where I started Talos.",
      "HackTX & others, coming soon.",
    ],
    photos: [
      photo("/photos/claude-hackathon.jpeg", 0, "the min/Max winner slide"),
      photo("/photos/mt-fuji.jpeg", 1, "the giant UFCU check"),
      photo("/photos/yosemite-hiking.jpeg", 2, "the Built in NYC poster"),
    ],
    links: [],
  },
  {
    id: "mentorship",
    name: "Mentorship",
    flown: "first-photo",
    title: "Mentorship",
    meta: "Coach, tutor and speaker, ongoing",
    blocks: [
      "I wouldn't be where I am now without the mentors who have shaped me. People made time for me, so I make time back. I've coached first-year scholars, worked as a student mentor on campus, and been an official mentor to Hispanic Scholarship Fund (HSF) scholars at the annual STEM Summit.",
      "I take coffee chats in both directions. If I'm asking people for their time, I should be willing to give mine, and I lose track of time in them.",
    ],
    photos: [
      photo("/photos/hsf-speaking.jpeg", 0, "the HSF STEM Summit photo booth (a big group)"),
      photo("/photos/drum-major.jpeg", 1, "the HSF event on the red backdrop"),
      photo("/photos/misuki.jpeg", undefined, "the SHPE familia sign, photo only"),
    ],
    links: [{ label: "Grab some time with me", href: "https://cal.com/aaron-sulbaran" }],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    flown: "logo",
    logo: { light: "/work/logos/anthropic-symbol.svg", dark: "/work/logos/anthropic-symbol-dark.svg" },
    title: "Anthropic",
    meta: "Claude Campus Ambassador, 2026",
    blocks: [
      "In spring 2026 I was a Claude ambassador at UT Austin. We grew the club to over a thousand members, with meetings of 60 to 80 people on average and about 100 at our end of year hackathon.",
      "What I loved most was teaching people to use these tools fast. By the end of the meetings, students were already building their own things with skills they developed in one hour classes I helped lead.",
    ],
    photos: [
      photo("/photos/claude-hackathon.jpeg", 0, "the Hooked on Claude group (landscape, cropped left)"),
      photo("/photos/hsf-speaking.jpeg", 1, "the context is key workshop slide (landscape)"),
      photo("/photos/yosemite-hiking.jpeg", undefined, "the networking reception"),
    ],
    links: [{ label: "txclaude.org", href: "https://txclaude.org" }],
  },
];

export const cardById = (id: string) => CARDS.find((card) => card.id === id) ?? CARDS[0];

// The approved copy marks emphasis with **bold** and *italic*; a block is
// split into plain and emphasised runs for the markup to render.
export type Run = { text: string; bold?: boolean; italic?: boolean };

export function runsOf(block: string): Run[] {
  const runs: Run[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  for (const match of block.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) runs.push({ text: block.slice(last, at) });
    runs.push(match[1] !== undefined ? { text: match[1], bold: true } : { text: match[2], italic: true });
    last = at + match[0].length;
  }
  if (last < block.length) runs.push({ text: block.slice(last) });
  return runs;
}
