import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent, type CardKey, type ModalPhoto } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { jpegSize } from "@/lib/testing/jpegSize";

const { cards, strand } = siteContent;
const keys = Object.keys(cards) as CardKey[];
const STRAND = ["mentorship", "min-max", "band", "talos", "travel", "capital-one", "hackathons", "anthropic", "misuki", "ieee", "jobs", "this-site", "fsdatalink", "building-in-public"];

describe("the fourteen cards", () => {
  it("are the approved keys in the strand order, lead card first", () => {
    expect(strand.order).toEqual(STRAND);
    expect(keys).toEqual(STRAND);
  });

  it("give each card its approved visual and modal kind", () => {
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].visual.kind]))).toEqual({
      mentorship: "photo", "min-max": "logo", band: "photo", talos: "logo", travel: "photo", "capital-one": "logo", hackathons: "photo",
      anthropic: "logo", misuki: "photo", ieee: "logo", jobs: "circles", "this-site": "mark", fsdatalink: "logo", "building-in-public": "photo",
    });
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].modal.kind]))).toEqual({
      ...Object.fromEntries(STRAND.map((key) => [key, "logo"])), travel: "photo", misuki: "photo", jobs: "timeline",
    });
    expect(cards.talos.visual).toEqual({ kind: "logo", logo: { src: "/work/logos/talos/mark.svg", srcDark: null, width: 512, height: 512 }, tile: "talos" });
  });

  it("lead with the HSF speaking picture, exported 3:4 from the original", () => {
    const visual = cards.mentorship.visual;
    const photo = visual.kind === "photo" ? visual.photo : null;
    if (!photo) throw new Error("the lead card needs its picture");
    expect(photo).toEqual({ src: "/photos/cards/mentorship-picture.jpg", width: 1200, height: 1600, crop: null, alt: "Me speaking into a microphone at a Hispanic Scholarship Fund event" });
    expect(jpegSize(join(process.cwd(), "public", photo.src))).toEqual([1200, 1600]);
  });

  it("keep every card picture 3:4 and at most three modal photos after it (four on the jobs timeline, whose picture is the circles), each tied to a block or, on the jobs card, a timeline entry", () => {
    for (const key of keys) {
      const { visual, modal } = cards[key];
      const picture = visual.kind === "photo" ? visual.photo : null;
      if (picture) expect(Math.abs(picture.width - (picture.height * 3) / 4), key).toBeLessThanOrEqual(1);
      if (picture) expect(picture.crop, key).toBeNull();
      expect(modal.photos.length, key).toBeLessThanOrEqual(modal.kind === "timeline" ? 4 : 3);
      for (const photo of modal.photos) {
        if (photo.block !== undefined) expect(photo.block, key).toBeLessThan(modal.blocks.length);
        else expect(key === "jobs" && photo.timeline < cards.jobs.timeline.length, key).toBe(true);
        expect(photo.src, key).not.toBe(picture?.src);
      }
    }
  });

  it("tie a modal photo to a paragraph or a timeline entry, never both", () => {
    const base = { src: "/photos/cards/mentorship-picture.jpg", width: 1084, height: 724, alt: "", crop: null, caption: "" };
    // @ts-expect-error a photo sits beside one thing
    const both: ModalPhoto = { ...base, block: 0, timeline: 1 };
    expect("block" in both && "timeline" in both).toBe(true);
  });

  it("caption each card picture in the modal, in my words", () => {
    expect(Object.fromEntries(keys.filter((key) => cards[key].modal.picture).map((key) => [key, cards[key].modal.picture?.caption]))).toEqual({
      mentorship: "Me speaking at my first HSF STEM Summit.",
      band: "Me as drum major in my last year of high school.",
      hackathons: "Me and my team winning UFCU Develop U, September 2026.",
      misuki: "Me and Misuki at a Longhorn Car Club photo shoot.",
      travel: "Me at Yosemite on a trip to San Francisco with my friends.",
      "building-in-public": "Me at Vercel Ship in New York City, one door LinkedIn opened this summer.",
    });
    for (const key of keys) if (cards[key].modal.picture) expect(cards[key].visual.kind, key).toBe("photo");
  });

  it("mirror no picture at draw time: the export baked the Building in public mirror in", () => {
    expect(keys.filter((key) => { const visual = cards[key].visual; return visual.kind === "photo" && visual.flipX; })).toEqual([]);
  });

  it("leave no card waiting on an asset", () => {
    const awaiting = keys.filter((key) => {
      const visual = cards[key].visual;
      if (visual.kind === "photo") return visual.photo === null;
      if (visual.kind === "logo") return visual.logo === null;
      if (visual.kind === "circles") return cards.jobs.timeline.some((entry) => entry.logo === null);
      return false;
    });
    expect(awaiting).toEqual([]);
  });

  it("hold the approved words (spot checks)", () => {
    expect(cards.ieee.book.meta).toBe("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026");
    expect(cards["min-max"].visual).toEqual({ kind: "logo", logo: { src: "/work/logos/min-max/mark.svg", srcDark: "/work/logos/min-max/mark-on-dark.svg", width: 548, height: 497 }, tile: "plain", subtitle: "minimize spend. Maximize rewards" });
    expect(cards["this-site"].book.meta).toBe("Portfolio (design playground), 2026");
    expect(cards.jobs.book).toEqual({ title: "\"unflattering\" jobs that paid for school", meta: "Popeyes to Aritzia, 2021 to 2026" });
    expect(cards.band.modal.blocks[1]).toContain("an invitational I *know* it had been chasing");
    expect(cards["capital-one"].modal.blocks[1].startsWith("**2024, business analyst.** My first look")).toBe(true);
    expect(cards.hackathons.modal.blocks.map((block) => block.slice(0, block.indexOf(".**") + 3))).toEqual(["**UFCU Develop U, fall 2026.**", "**AWS Agentic AI Hackathon (Austin), fall 2026.**", "**HackTX, fall 2026.**", "**Hook 'Em Hacks, spring 2026.**", "**Vercel one-day hackathon, New York.**"]);
    expect(cards.hackathons.modal.blocks.join(" ")).not.toContain("coming soon");
    expect(cards.hackathons.modal.links).toEqual([
      { label: "musefriends.tech", href: "https://musefriends.tech" },
      { label: "Muse Friends on GitHub", href: "https://github.com/aaron-sulbaran/muse-friends" },
    ]);
    expect(cards.jobs.timeline[0].tip.endsWith("basically unisex products...")).toBe(true);
    expect(cards.jobs.timeline[0].tip).toBe("My most random job. For the interview they asked me to dress in my best clothing, which I thought was funny. If you work here, all the women in your life will want a discount. With that said, the effortless pants and sweatfleece line are basically unisex products...");
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].modal.blocks.length]))).toEqual({
      mentorship: 2, "min-max": 1, band: 3, talos: 2, travel: 2, "capital-one": 5, hackathons: 5,
      anthropic: 2, misuki: 2, ieee: 5, jobs: 4, "this-site": 1, fsdatalink: 2, "building-in-public": 3,
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

  it("run the jobs timeline newest to oldest, one tip each", () => {
    expect(cards.jobs.timeline.map((entry) => entry.employer)).toEqual(["Aritzia", "Apple", "Student mentor, UT Austin", "MOD Pizza", "Popeyes"]);
    expect(cards.jobs.timeline.map((entry) => entry.role)).toEqual([null, "Specialist, then technical specialist", null, null, null]);
    for (const entry of cards.jobs.timeline) expect(entry.tip.length).toBeGreaterThan(0);
  });

  it("writes the jobs modal as Aaron's title and four paragraphs, with his LinkedIn post embedded beside the last", () => {
    const { modal, tag } = cards.jobs;
    expect(modal.title).toBe('The "unflattering" jobs that shaped me');
    expect(modal.blocks).toHaveLength(4);
    expect(modal.blocks[0]).toBe("I'm self-funded, so I've worked part-time alongside school almost every year since I legally could. Those jobs paid for my car in cash in high school, covered rent, and chipped away at tuition so I could graduate debt free.");
    expect(modal.blocks[1]).toBe("The money (although it was necessary) was secondary though. I realized that after finishing my degree, I have my whole life to work off a screen or in an office if I want to. So I intentionally went looking for jobs where I could interact with people face-to-face and solve their problem right away, even if that was looking for a shirt in the back.");
    expect(modal.blocks[2]).toBe("I think these jobs are an opportunity to experience the other side of daily interactions you might never think of after finishing your degree. That's why I've never shied away from a service industry job. I also learned how to make a fire pizza.");
    expect(modal.blocks[3]).toBe("I wrote about my work experience outside of class on LinkedIn, and my hook was \"I don't trust people who haven't worked an unflattering job.\" It got 130,000 impressions and almost a thousand reactions. My favorite line is \"You know to be nice to the person behind the counter because you were the person behind the counter.\" I guess it resonated with people.");
    expect(modal.links).toEqual([{ label: "The LinkedIn post", href: "https://lnkd.in/p/g3mXFGcY" }]);
    // Aaron's embed code, as written: the src exactly, the native size, and a title in my words (never "Embedded post").
    expect(modal.embed).toEqual({ src: "https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7463750786611630080", width: 504, height: 1258, title: "My LinkedIn post about unflattering jobs", beside: 3 });
    expect(modal.embed!.beside, "beside the paragraph about the post").toBe(modal.blocks.length - 1);
    expect(tag.name).toBe("Aaron");
    expect(tag.tipLabel).toBe("My tip");
    expect(tag.label("Apple")).toBe("My name tag from Apple, with my tip");
    for (const text of [modal.title, ...modal.blocks, modal.embed!.title, tag.name, tag.tipLabel, tag.label("Apple"), ...cards.jobs.timeline.map((entry) => entry.tip)]) expect(text, text).not.toMatch(/\u2014/);
  });

  it("gives a phone the post as a link card in the embed's place: the post's own link, its hook line as Aaron wrote it, his name", () => {
    const { modal } = cards.jobs;
    const card = modal.postCard!;
    expect(card).toEqual({ href: "https://lnkd.in/p/g3mXFGcY", byline: "Aaron Sulbaran", hook: "I don't trust people who haven't worked an unflattering job.", cta: "Read the post on LinkedIn" });
    expect(card.href, "the modal's own link to the post").toBe(modal.links[0].href);
    expect(modal.blocks[3], "the hook is the line his paragraph quotes").toContain(card.hook);
    for (const text of [card.byline, card.hook, card.cta]) expect(text, text).not.toMatch(/\u2014/);
  });

  it("name the six mentors who agreed, each with their own LinkedIn link and no line until I write one", () => {
    const { title, people } = cards.mentorship.mentors;
    expect(title).toBe("the people who shaped me");
    expect(people.map((mentor) => mentor.name)).toEqual(["Andrew Chang", "Diego Jimenez", "Jared Alonzo", "JJ Gonzales", "Joaquin Escobar", "Mike Ditson"]);
    for (const mentor of people) {
      expect(mentor.href, mentor.name).toMatch(/^https:\/\/www\.linkedin\.com\/in\/[a-z0-9-]+\/$/);
      expect(mentor.line, mentor.name).toBeNull();
    }
    expect(new Set(people.map((mentor) => mentor.href)).size).toBe(people.length);
  });

  it("mark only the IEEE square as an opaque logo, its own ground", () => {
    const opaque = keys.filter((key) => { const visual = cards[key].visual; return visual.kind === "logo" && visual.logo?.opaque; });
    expect(opaque).toEqual(["ieee"]);
    expect(cards.jobs.timeline.some((entry) => entry.logo?.opaque)).toBe(false);
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
