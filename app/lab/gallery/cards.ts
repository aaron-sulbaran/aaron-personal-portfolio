import { photoBySrc } from "@/lib/content";

// The cards the brief names for tuning, with Aaron's approved words
// (docs/content/cards.md), the block each photo belongs with, its shape and
// its caption (docs/content/photos.md, second round). The real modal photos
// are not exported yet, so each slot holds a stand-in from public/photos,
// cropped by the lab to the real photo's shape, with the stand-in's own true
// first-person alt text. The caption is the real one: visible text that the
// real photo will carry.

export interface LabPhoto {
  src: string;
  width: number;
  height: number;
  alt: string;
  block?: number;
  // The real photo's width over height (photos.md). The flown card picture
  // is drawn at 3:4 whatever this says.
  shape: number;
  caption?: string;
  // What photos.md puts here, so the stand-in is never mistaken for the pick.
  intended: string;
}

export interface LabCard {
  id: string;
  name: string;
  // Where the flight lands: the logo slot for a logo card (no flownPhoto),
  // else the photo that is the card picture, drawn at 3:4
  // (modal-gallery.md, "Rules that hold").
  flownPhoto?: number;
  logo?: { light: string; dark: string };
  title: string;
  meta: string;
  blocks: string[];
  photos: LabPhoto[];
  links: { label: string; href: string }[];
}

export const CARD_PICTURE = 3 / 4;

// The shapes the real photos come in, 4:5 vertical to 2:1 horizontal.
export const SHAPES: readonly { label: string; aspect: number }[] = [
  { label: "4:5", aspect: 4 / 5 },
  { label: "3:4", aspect: 3 / 4 },
  { label: "1:1", aspect: 1 },
  { label: "1.15:1", aspect: 1.15 },
  { label: "4:3", aspect: 4 / 3 },
  { label: "1.41:1", aspect: 1.41 },
  { label: "3:2", aspect: 3 / 2 },
  { label: "1.87:1", aspect: 1.87 },
  { label: "2:1", aspect: 2 },
];

export const shapeLabel = (aspect: number) => SHAPES.find((s) => Math.abs(s.aspect - aspect) < 0.005)?.label ?? `${aspect.toFixed(2)}:1`;

const V = 3 / 4;
const H43 = 4 / 3;

function photo(src: string, block: number | undefined, shape: number, caption: string | undefined, intended: string): LabPhoto {
  const found = photoBySrc.get(src);
  if (!found) throw new Error(`No photo ${src} in lib/content.ts`);
  return { src, width: found.width, height: found.height, alt: found.alt, block, shape, caption, intended };
}

export const CARDS: readonly LabCard[] = [
  {
    id: "capital-one",
    name: "Capital One",
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
      photo("/photos/capital-one.jpeg", 1, V, "Me at my first internship, the Analyst Early Internship Program.", "the 2024 welcome banner, vertical"),
      photo("/photos/uncs-grad.jpeg", 2, V, "Me with my co-interns my second summer.", "the McLean office, vertical"),
      photo("/photos/traveling.jpeg", 3, V, "Me in New York City for my final Capital One internship.", "the New York rooftop, vertical"),
    ],
    links: [],
  },
  {
    id: "hackathons",
    name: "Hackathons",
    flownPhoto: 1,
    title: "Hackathons",
    meta: "Builder, 2026 to now",
    blocks: [
      "**Hook 'Em Hacks, spring 2026.** Won the finance track with the first build and MVP/Proof of Concept of min/Max.",
      "**UFCU Develop U, fall 2026.** Won with UFCU Front Desk, a digital front desk assistant that makes joining a credit union simple and still sounds like them.",
      "**Vercel one-day hackathon, New York.** Where I started Talos.",
      "HackTX & others, coming soon.",
    ],
    photos: [
      photo("/photos/hsf-speaking.jpeg", 0, 1.41, "Me at Hook 'Em Hacks, winning.", "the min/Max winner slide, horizontal 1.41:1"),
      photo("/photos/claude-hackathon.jpeg", 1, V, "Me and my team winning UFCU Develop U.", "the UFCU check, the card picture at 3:4"),
      photo("/photos/mt-fuji.jpeg", 2, V, "Me at a one-day Vercel hackathon in New York City.", "the Built in NYC poster, vertical"),
    ],
    links: [],
  },
  {
    id: "mentorship",
    name: "Mentorship",
    flownPhoto: 0,
    title: "Mentorship",
    meta: "Coach, tutor and speaker, ongoing",
    blocks: [
      "I wouldn't be where I am now without the mentors who have shaped me. People made time for me, so I make time back. I've coached first-year scholars, worked as a student mentor on campus, and been an official mentor to Hispanic Scholarship Fund (HSF) scholars at the annual STEM Summit.",
      "I take coffee chats in both directions. If I'm asking people for their time, I should be willing to give mine, and I lose track of time in them.",
    ],
    photos: [
      photo("/photos/hsf-speaking.jpeg", 0, V, "Me at my first HSF.", "the HSF speaking photo, the card picture at 3:4"),
      photo("/photos/drum-major.jpeg", 1, 1.15, "Me at my second HSF, this time as a mentor.", "the STEM Summit photo booth print, 1.15:1"),
      photo("/photos/hsf-speaking.jpeg", undefined, H43, "Me at HSF my first year, as a scholar.", "the red sponsor backdrop group, horizontal 4:3"),
      photo("/photos/drum-major.jpeg", undefined, H43, "Me at my first SHPE national convention, 2023.", "the SHPE Familia sign group, horizontal 4:3"),
    ],
    links: [{ label: "Grab some time with me", href: "https://cal.com/aaron-sulbaran" }],
  },
  {
    id: "ieee",
    name: "IEEE UT Austin",
    logo: { light: "/work/logos/ieee.svg", dark: "/work/logos/ieee.svg" },
    title: "IEEE UT Austin",
    meta: "President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026",
    blocks: [
      "IEEE UT was my home away from home at UT. I credit much of my leadership development to my experience here. From assistant officer my freshman year to president my junior year, I made some of my closest friends in this organization.",
      "My Freshman year I helped host events to bring ECE majors together, particularly my fellow freshmen going through the same struggles I was going through. I also performed at Cockrell's yearly Ramshorn Talent show as \"Aango,\" a [Rango](tip:aango) knockoff that rapped.",
      "My Sophomore year I jumped to an exec role and started the year out with a balance sheet that said the previous year had $200 in profit (because we were spending everything we earned). I set a goal of $5K, answered company emails almost every day for a school year, and we ended at about $10K.",
      "My Junior year I helped lead the org I came to love and helped bring home the Outstanding Large Student Branch Chapter award, served as the broader IEEE Central Texas Section student representative, and wore many hats as I supported my fellow officers for one final year.",
      "My proudest moments in IEEE came when ECE students told me that a company I brought to an IEEE event is the reason they got their internships or jobs. I aim to never stop making an impact, no matter where I go.",
    ],
    photos: [
      photo("/photos/hsf-speaking.jpeg", 1, 1.5, "Me at a rock climbing social with IEEE and other engineering orgs.", "the Austin Boulder Project social, horizontal 3:2"),
      photo("/photos/drum-major.jpeg", 3, 1.87, "Us receiving our Outstanding Large Student Branch plaque.", "the award group, horizontal 1.87:1"),
      photo("/photos/yosemite-hiking.jpeg", undefined, V, "Me at my last IEEE Rising Stars conference as president of the chapter.", "the Rising Stars banner, vertical"),
    ],
    links: [{ label: "ieee.ece.utexas.edu", href: "https://ieee.ece.utexas.edu/" }],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    logo: { light: "/work/logos/anthropic-symbol.svg", dark: "/work/logos/anthropic-symbol-dark.svg" },
    title: "Anthropic",
    meta: "Claude Campus Ambassador, 2026",
    blocks: [
      "In spring 2026 I was a Claude ambassador at UT Austin. We grew the club to over a thousand members, with meetings of 60 to 80 people on average and about 100 at our end of year hackathon.",
      "What I loved most was teaching people to use these tools fast. By the end of the meetings, students were already building their own things with skills they developed in one hour classes I helped lead.",
    ],
    photos: [
      photo("/photos/hsf-speaking.jpeg", 0, H43, "Me, my co-ambassadors and the judges at Hooked on Claude, our hackathon.", "the Hooked on Claude group, horizontal 4:3"),
      photo("/photos/claude-hackathon.jpeg", 1, V, "Me teaching a live Claude session for a student org.", "the context is key session, vertical"),
      photo("/photos/drum-major.jpeg", undefined, H43, "Me teaching during one of our learning sessions.", "the lesson plan lecture hall, horizontal 4:3"),
    ],
    links: [{ label: "txclaude.org", href: "https://txclaude.org" }],
  },
  {
    id: "misuki",
    name: "Misuki",
    flownPhoto: 3,
    title: "Misuki",
    meta: "2001 Mazda Miata, five-speed",
    blocks: [
      "I worked all through high school to set myself up for college. That included an ongoing hunt for a car. I ended up buying this car early Senior year in cash, because I didn't want a car loan. The day my dad went to buy her for me, I was conducting a game-day halftime show and got a bank alert on my watch for a huge withdrawal from my bank account. I was nervous the whole performance, and then found out later he was trying to surprise me.",
      "Her engine blew in college, a family friend in Houston rebuilt it, and she's still my daily driver. I named her Misuki, from the M in Mazda and a nod to [Fast and Furious](tip:misuki-suk). I took her around Circuit of the Americas once, and it was one of the most fun days of my life.",
    ],
    photos: [
      photo("/photos/uncs-grad.jpeg", 0, V, "I drove Misuki to my high school graduation and had to take a photo with her.", "the graduation night, vertical, levelled"),
      photo("/photos/misuki.jpeg", 1, V, "Misuki breaks down on me, but I keep her going.", "the engine on the lift, vertical"),
      photo("/photos/hsf-speaking.jpeg", undefined, H43, "Owning a manual Miata is part of why I went to the Mazda Museum in Hiroshima, where I saw the real Mazda 787B that won Le Mans in 1991.", "the Mazda 787B, horizontal 4:3"),
      photo("/photos/traveling.jpeg", undefined, V, "Misuki outside Gregory Gym.", "the interim card picture, Texas Fight stairs, 3:4"),
    ],
    links: [],
  },
];

export const cardById = (id: string) => CARDS.find((card) => card.id === id) ?? CARDS[0];

// The shape a photo is drawn at: the flown card picture at 3:4, every other
// photo at its own shape (or the lab's override for it).
export function drawnShape(card: LabCard, index: number, override?: number) {
  return index === card.flownPhoto ? CARD_PICTURE : (override ?? card.photos[index].shape);
}

// The approved copy marks emphasis with **bold** and *italic*, and tips as
// [words](tip:key); a block is split into runs for the markup to render.
export type Run = { text: string; bold?: boolean; italic?: boolean; tip?: string };

export function runsOf(block: string): Run[] {
  const runs: Run[] = [];
  const pattern = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((?:tip|pop):([^)]+)\)/g;
  let last = 0;
  for (const match of block.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) runs.push({ text: block.slice(last, at) });
    if (match[1] !== undefined) runs.push({ text: match[1], bold: true });
    else if (match[2] !== undefined) runs.push({ text: match[2], italic: true });
    else runs.push({ text: match[3], tip: match[4] });
    last = at + match[0].length;
  }
  if (last < block.length) runs.push({ text: block.slice(last) });
  return runs;
}
