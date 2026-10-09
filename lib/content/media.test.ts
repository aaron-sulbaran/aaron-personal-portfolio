import { statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent, type CardKey, type LogoRef } from "@/lib/content";
import { imageSize } from "@/lib/testing/imageSize";

const { cards, register } = siteContent;
const keys = Object.keys(cards) as CardKey[];
const PUBLIC = join(process.cwd(), "public");
const THIRD_PERSON = /\b(?:Aaron|he|him|his)\b/i;

interface Ref { where: string; src: string; width: number; height: number }

function logoRefs(where: string, logo: LogoRef | null): Ref[] {
  if (!logo) return [];
  const refs = [{ where, src: logo.src, width: logo.width, height: logo.height }];
  if (logo.srcDark) refs.push({ where: `${where} (dark)`, src: logo.srcDark, width: logo.width, height: logo.height });
  return refs;
}

const pictureRefs: Ref[] = keys.flatMap((key) => {
  const visual = cards[key].visual;
  return visual.kind === "photo" && visual.photo ? [{ where: `${key} picture`, ...visual.photo }] : [];
});
const photoRefs: Ref[] = [
  ...pictureRefs,
  ...keys.flatMap((key) => cards[key].modal.photos.map((photo, index) => ({ where: `${key} photo ${index}`, ...photo }))),
  ...Object.entries(register.pop).flatMap(([key, entry]) => (entry.file ? [{ where: `pop ${key}`, ...entry.file }] : [])),
];
const allRefs: Ref[] = [
  ...photoRefs,
  ...keys.flatMap((key) => { const visual = cards[key].visual; return visual.kind === "logo" ? logoRefs(`${key} logo`, visual.logo) : []; }),
  ...cards.jobs.timeline.flatMap((entry) => logoRefs(`jobs ${entry.employer}`, entry.logo)),
];

describe("every picture, photo, pop and logo the content names", () => {
  it("is a file in public with the recorded width and height", () => {
    expect(allRefs.length).toBe(60);
    for (const ref of allRefs) {
      const [width, height] = imageSize(join(PUBLIC, ref.src));
      expect(ref.width, ref.where).toBeCloseTo(width, 1);
      expect(ref.height, ref.where).toBeCloseTo(height, 1);
    }
  });
  it("keeps each card picture 3:4 within a pixel", () => {
    expect(pictureRefs.map((ref) => ref.where)).toEqual(["mentorship picture", "band picture", "travel picture", "hackathons picture", "misuki picture", "building-in-public picture"]);
    for (const ref of pictureRefs) expect(Math.abs(ref.width - (ref.height * 3) / 4), ref.where).toBeLessThanOrEqual(1);
  });
  it("keeps every photo file under 300,000 bytes, a modal photo within 1600 px and a pop within 800 px", () => {
    for (const ref of photoRefs) {
      expect(statSync(join(PUBLIC, ref.src)).size, ref.where).toBeLessThanOrEqual(300_000);
      expect(Math.max(ref.width, ref.height), ref.where).toBeLessThanOrEqual(ref.where.startsWith("pop ") ? 800 : 1600);
    }
  });
});

describe("the modal photos", () => {
  it("sit beside the approved paragraph or timeline entry", () => {
    const pairing = Object.fromEntries(keys.filter((key) => cards[key].modal.photos.length).map((key) => [key, cards[key].modal.photos.map((photo) => (photo.block !== undefined ? `block ${photo.block}` : `timeline ${photo.timeline}`))]));
    expect(pairing).toEqual({
      mentorship: ["block 0", "block 0", "block 1"],
      band: ["block 0", "block 1", "block 2"],
      travel: ["block 0", "block 0", "block 0"],
      "capital-one": ["block 1", "block 2", "block 3"],
      hackathons: ["block 1", "block 2"],
      anthropic: ["block 0", "block 1", "block 1"],
      misuki: ["block 0", "block 1", "block 1"],
      ieee: ["block 0", "block 3", "block 4"],
      jobs: ["timeline 1", "timeline 1", "timeline 3", "timeline 4"],
      "building-in-public": ["block 0", "block 0"],
    });
  });
  it("carry Aaron's approved captions, in order", () => {
    const captions = Object.fromEntries(keys.filter((key) => cards[key].modal.photos.length).map((key) => [key, cards[key].modal.photos.map((photo) => photo.caption)]));
    expect(captions).toEqual({
      mentorship: ["Me at my second HSF, this time as a mentor.", "Me at HSF my first year, as a scholar.", "Me at my first SHPE national convention, 2023. I've been to every one since."],
      band: ["Me with my section, the low reeds.", "Practicing back when I was just a section leader for the low reeds.", "Right after a competition run, seeing my friends and laughing."],
      travel: ["Me at Mount Fuji on my second trip to Japan.", "Me at the Museum of the Future in Dubai.", "Me in Cartagena, Colombia."],
      "capital-one": ["Me at my first internship, the Analyst Early Internship Program.", "Me with my co-interns my second summer.", "Me in New York City for my final Capital One internship."],
      hackathons: ["Me at Hook 'Em Hacks, winning.", "Me at a one-day Vercel hackathon in New York City."],
      anthropic: ["Me, my co-ambassadors and the judges at Hooked on Claude, our hackathon.", "Me teaching a live Claude session for Longhorn Neurotech.", "Me teaching during one of our learning sessions."],
      misuki: ["Me and Misuki outside Gregory Gym.", "Misuki breaks down on me (a lot), but I keep her going.", "Owning a manual Miata is part of why I went to the Mazda Museum in Hiroshima, where I saw the real Mazda 787B that won Le Mans in 1991."],
      ieee: ["Me at a rock climbing social with IEEE and other engineering orgs.", "Us receiving our Outstanding Large Student Branch plaque.", "Me at my last IEEE Rising Stars conference as president of the chapter."],
      jobs: ["Me at my MOD store, in a Keep MOD Weird tee.", "My last clock-out at MOD, April 15, 2023, 10 pm, with two stickers to leave my mark.", "My Apple employee badge.", "The poster that introduced me to the team at Aritzia."],
      "building-in-public": ["My top performing posts on LinkedIn.", "Me in Toronto, another one."],
    });
  });
  it("give only Misuki's Hiroshima photo a short phone caption", () => {
    const short = keys.flatMap((key) => cards[key].modal.photos.filter((photo) => photo.captionShort).map((photo) => [key, photo.captionShort]));
    expect(short).toEqual([["misuki", "The real Mazda 787B that won Le Mans in 1991, at the Mazda Museum in Hiroshima."]]);
  });
  it("are written in my voice: no caption or alt describes me in the third person", () => {
    const texts = [
      ...keys.flatMap((key) => cards[key].modal.photos.flatMap((photo) => [photo.caption, photo.captionShort ?? "", photo.alt])),
      ...pictureRefs.map((ref) => (ref as Ref & { alt: string }).alt),
      ...keys.map((key) => cards[key].modal.picture?.caption ?? ""),
      ...Object.values(register.pop).flatMap((entry) => [entry.alt, entry.caption ?? ""]),
    ];
    for (const text of texts) expect(text, text).not.toMatch(THIRD_PERSON);
  });
});

describe("the logos", () => {
  it("show the mark or wordmark chosen per card, with the white file on dark where one exists", () => {
    const chosen = Object.fromEntries(keys.flatMap((key) => { const visual = cards[key].visual; return visual.kind === "logo" ? [[key, [visual.logo?.src, visual.logo?.srcDark]]] : []; }));
    expect(chosen).toEqual({
      "min-max": ["/work/logos/min-max/mark.svg", "/work/logos/min-max/mark-on-dark.svg"],
      talos: ["/work/logos/talos/mark.svg", null],
      "capital-one": ["/work/logos/capital-one/capital-one-logo.svg", null],
      anthropic: ["/work/logos/anthropic/anthropic-wordmark.svg", "/work/logos/anthropic/anthropic-wordmark-white.svg"],
      ieee: ["/work/logos/ieee/ieee-ut-logo.jpg", null],
      fsdatalink: ["/work/logos/fsdatalink/fsdatalink-logo.avif", null],
    });
    expect(cards.jobs.timeline.map((entry) => [entry.employer, entry.logo?.src, entry.logo?.srcDark])).toEqual([
      ["Popeyes", "/work/logos/jobs/popeyes-logo.svg", null],
      ["MOD Pizza", "/work/logos/jobs/mod-pizza-logo.svg", null],
      ["Student mentor, UT Austin", "/work/logos/jobs/ut-austin-logo.svg", "/work/logos/jobs/ut-austin-logo-white.svg"],
      ["Apple", "/work/logos/jobs/apple-logo-black.svg", "/work/logos/jobs/apple-logo-white.svg"],
      ["Aritzia", "/work/logos/jobs/aritzia-logo.svg", null],
    ]);
  });
});
