import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent, type CardKey } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { jpegSize } from "@/lib/testing/jpegSize";

const { cards, strand, book } = siteContent;
const keys = Object.keys(cards) as CardKey[];
const STRAND = ["mentorship", "min-max", "band", "talos", "travel", "capital-one", "hackathons", "anthropic", "misuki", "ieee", "jobs", "this-site", "fsdatalink", "building-in-public"];

describe("the fourteen cards", () => {
  it("are the approved keys in the strand order, lead card first", () => {
    expect(strand.order).toEqual(STRAND);
    expect(keys).toEqual(STRAND);
  });

  it("fill the book's two columns by group, in Aaron's doc order", () => {
    expect([book.workHeading, book.peopleHeading]).toEqual(["Work", "People"]);
    expect(book.workOrder).toEqual(["min-max", "talos", "capital-one", "anthropic", "ieee", "hackathons", "this-site"]);
    expect(book.peopleOrder).toEqual(["mentorship", "band", "jobs", "fsdatalink", "misuki", "travel", "building-in-public"]);
    for (const key of book.workOrder) expect(cards[key].group).toBe("work");
    for (const key of book.peopleOrder) expect(cards[key].group).toBe("people");
    expect([...book.workOrder, ...book.peopleOrder].sort()).toEqual([...STRAND].sort());
  });

  it("give each card its approved visual and modal kind", () => {
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].visual.kind]))).toEqual({
      mentorship: "photo", "min-max": "logo", band: "photo", talos: "logo", travel: "photo", "capital-one": "logo", hackathons: "photo",
      anthropic: "logo", misuki: "photo", ieee: "logo", jobs: "circles", "this-site": "mark", fsdatalink: "logo", "building-in-public": "photo",
    });
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].modal.kind]))).toEqual({
      ...Object.fromEntries(STRAND.map((key) => [key, "logo"])), travel: "photo", misuki: "photo", jobs: "timeline",
    });
    expect(cards.talos.visual).toEqual({ kind: "logo", logo: null, tile: "anvil" });
  });

  it("lead with the HSF speaking photo, cropped 3:4 inside its source", () => {
    const visual = cards.mentorship.visual;
    const photo = visual.kind === "photo" ? visual.photo : null;
    const crop = photo?.crop;
    if (!photo || !crop) throw new Error("the lead card needs its cropped photo");
    expect(photo.src).toBe("/photos/hsf-speaking.jpeg");
    expect(jpegSize(join(process.cwd(), "public", photo.src))).toEqual([photo.width, photo.height]);
    expect(crop).toEqual({ x: 220, y: 0, w: 543, h: 724 });
    expect(crop.x + crop.w).toBeLessThanOrEqual(photo.width);
    expect(crop.y + crop.h).toBeLessThanOrEqual(photo.height);
    expect(photo.alt).toBe("Me speaking into a microphone at a Hispanic Scholarship Fund event");
    expect(photo.caption).toBeNull();
  });

  it("keep every card picture 3:4 and at most three modal photos after it, each tied to a block or, on the jobs card, a timeline entry", () => {
    for (const key of keys) {
      const { visual, modal } = cards[key];
      const picture = visual.kind === "photo" ? visual.photo : null;
      if (picture?.crop) expect(picture.crop.w / picture.crop.h, key).toBeCloseTo(3 / 4, 2);
      expect(modal.photos.length, key).toBeLessThanOrEqual(3);
      for (const photo of modal.photos) {
        if ("block" in photo) expect(photo.block, key).toBeLessThan(modal.blocks.length);
        else expect(key === "jobs" && photo.timeline < cards.jobs.timeline.length, key).toBe(true);
        expect(photo.src, key).not.toBe(picture?.src);
      }
    }
  });

  it("mirror only the Building in public picture", () => {
    expect(keys.filter((key) => { const visual = cards[key].visual; return visual.kind === "photo" && visual.flipX; })).toEqual(["building-in-public"]);
  });

  it("name the cards still waiting on C4's assets", () => {
    const awaiting = keys.filter((key) => {
      const visual = cards[key].visual;
      if (visual.kind === "photo") return visual.photo === null;
      if (visual.kind === "logo") return visual.logo === null;
      if (visual.kind === "circles") return cards.jobs.timeline.some((entry) => entry.logo === null);
      return false;
    });
    expect(awaiting).toEqual(["min-max", "band", "talos", "travel", "capital-one", "hackathons", "anthropic", "misuki", "ieee", "jobs", "fsdatalink", "building-in-public"]);
  });

  it("hold the approved words (spot checks)", () => {
    expect(cards.ieee.book.meta).toBe("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026");
    expect(cards["min-max"].visual).toEqual({ kind: "logo", logo: null, tile: "plain", subtitle: "minimize spend. Maximize rewards" });
    expect(cards["this-site"].book.meta).toBe("Portfolio (design playground), 2026");
    expect(cards.jobs.book).toEqual({ title: "\"unflattering\" jobs that paid for school", meta: "Popeyes to Aritzia, 2021 to 2026" });
    expect(cards.band.modal.blocks[1]).toContain("an invitational I *know* it had been chasing");
    expect(cards["capital-one"].modal.blocks[1].startsWith("**2024, business analyst.** My first look")).toBe(true);
    expect(cards.hackathons.modal.blocks.at(-1)).toBe("HackTX & others, coming soon.");
    expect(cards.hackathons.modal.blocks.slice(0, 3).map((block) => block.slice(0, block.indexOf(".**") + 3))).toEqual(["**UFCU Develop U, fall 2026.**", "**Hook 'Em Hacks, spring 2026.**", "**Vercel one-day hackathon, New York.**"]);
    expect(cards.jobs.timeline.at(-1)?.tip.endsWith("basically unisex products...")).toBe(true);
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].modal.blocks.length]))).toEqual({
      mentorship: 2, "min-max": 1, band: 3, talos: 2, travel: 2, "capital-one": 5, hackathons: 4,
      anthropic: 2, misuki: 2, ieee: 5, jobs: 3, "this-site": 1, fsdatalink: 2, "building-in-public": 3,
    });
  });

  it("shorten the modal meta only where the book's would crowd a phone", () => {
    expect(Object.fromEntries(keys.filter((key) => cards[key].modal.meta !== undefined).map((key) => [key, cards[key].modal.meta]))).toEqual({
      band: "Drum major, 2021 to 2023", ieee: "President, 2023 to 2026", "this-site": "Portfolio, 2026",
    });
  });

  it("open only labeled https links", () => {
    for (const key of keys) {
      for (const link of cards[key].modal.links) {
        expect(link.label.length).toBeGreaterThan(0);
        expect(link.href).toMatch(/^https:\/\//);
      }
    }
    expect(cards["building-in-public"].modal.links.map((link) => link.label)).toEqual(["LinkedIn", "X (@imaaronsulbaran)"]);
  });

  it("run the jobs timeline oldest to newest, one tip each", () => {
    expect(cards.jobs.timeline.map((entry) => entry.employer)).toEqual(["Popeyes", "MOD Pizza", "Student mentor, UT Austin", "Apple", "Aritzia"]);
    expect(cards.jobs.timeline.map((entry) => entry.role)).toEqual([null, null, null, "Specialist, then technical specialist", null]);
    for (const entry of cards.jobs.timeline) expect(entry.tip.length).toBeGreaterThan(0);
  });

  it("model the mentors list and hold it empty until each mentor agrees to be named", () => {
    expect(cards.mentorship.mentors).toEqual({ title: "the people who shaped me", people: [] });
  });

  it("resolve every inline link in a card to the register", () => {
    for (const key of keys) {
      const { book: row, modal } = cards[key];
      for (const text of [row.title, row.meta, modal.title, modal.meta ?? "", ...modal.blocks]) expect(parseInlineLinks(text, registerHas).unknown, key).toEqual([]);
    }
  });

  it("read the IEEE meta as plain words where a label needs them", () => {
    expect(plainText(cards.ieee.book.meta)).toBe("President, Corporate Director, and AO, 2023 to 2026");
  });

  it("write book and modal titles in sentence case", () => {
    const proper = new Set(["High", "School", "One", "UT", "Austin"]);
    for (const key of keys) {
      for (const title of [cards[key].book.title, cards[key].modal.title]) {
        for (const word of title.split(" ").slice(1)) if (/^[A-Z]/.test(word)) expect(proper.has(word), title).toBe(true);
      }
    }
  });
});
