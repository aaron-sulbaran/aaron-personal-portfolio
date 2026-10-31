import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { quickCopy } from "@/lib/content/quick";
import { registerHas } from "@/lib/content/register";

const { intro, whoIAm } = siteContent;

// Everything About held, as one string per body, to look each cut up in.
const ABOUT = whoIAm.blocks.flatMap((block) => [block.body, ...(block.sub ? [block.sub.body] : [])]);
const sentencesOf = intro.blocks.flatMap((block) => block.sentences);

// The four-paragraph page's photo pops, every one of which page 1 still carries.
const PAGE_ONE_POPS = ["leadership-award", "family", "friends", "3d-printing", "sandboarding", "downhill-skating", "skydiving", "rock-climbing", "venezuela-flag"];

describe("page 1's blocks", () => {
  it("are two paragraphs: who I am and how I work, then what I love outside work and where I'm from", () => {
    expect(intro.blocks.map((block) => block.key)).toEqual(["who", "outside"]);
  });

  it("are the draft's whole sentences, as cut from About, link markup and all", () => {
    expect(intro.blocks[0].sentences).toEqual([
      "I'm a [product](def:product)-focused engineer.",
      "I study Electrical and Computer Engineering (ECE) at UT Austin, but I spend most of my time building and talking to the people I'm building for.",
      "I tend to gravitate towards [leadership positions](pop:leadership-award) because I love getting a group of people with very different skillsets working towards one goal.",
    ]);
    expect(intro.blocks[1].sentences).toEqual([
      "I love people ([family](pop:family) & [friends](pop:friends)) outside of work too.",
      "I love credit card-maxxing since it allows me to fulfill my wanderlust, recently got into [3D printing](pop:3d-printing) because it lets me work on the engineering I don't get to do in class, and love [extreme sports](pop:sandboarding) like [downhill skating](pop:downhill-skating), [skydiving](pop:skydiving), and [rock climbing](pop:rock-climbing).",
      "I was born in Maracaibo, [Venezuela](pop:venezuela-flag), and moved to the U.S. when I was around 4.",
    ]);
  });

  it("hold two to three sentences each", () => {
    for (const block of intro.blocks) {
      expect(block.sentences.length, block.key).toBeGreaterThanOrEqual(2);
      expect(block.sentences.length, block.key).toBeLessThanOrEqual(3);
    }
  });

  it("are cut word for word from the About copy, markup and all, and say nothing new", () => {
    for (const sentence of sentencesOf) expect(ABOUT.some((body) => body.includes(sentence)), sentence).toBe(true);
  });

  it("keep each block's sentences in the order About has them", () => {
    const about = ABOUT.join(" ");
    for (const block of intro.blocks) {
      let at = -1;
      for (const sentence of block.sentences) {
        const found = about.indexOf(sentence);
        expect(found, sentence).toBeGreaterThan(at);
        at = found;
      }
    }
  });

  it("keep every photo pop the four paragraphs had, each once: the six slice 1 cut and the others the intro had", () => {
    const keys = sentencesOf.flatMap((sentence) => parseInlineLinks(sentence, registerHas).segments.flatMap((segment) => (segment.kind === "pop" ? [segment.key] : [])));
    expect([...keys].sort()).toEqual([...PAGE_ONE_POPS].sort());
  });

  it("point every link at the register", () => {
    for (const sentence of sentencesOf) expect(parseInlineLinks(sentence, registerHas).unknown, sentence).toEqual([]);
  });

  it("keep the product definition, the one def on the page", () => {
    expect(sentencesOf.some((sentence) => sentence.includes("](def:product)"))).toBe(true);
  });

  it("read as plain sentences once the markup is read", () => {
    for (const sentence of sentencesOf) expect(plainText(sentence), sentence).toMatch(/[.!?]$/);
  });

  it("use no em dash", () => {
    for (const text of [...sentencesOf, ...Object.values(intro.teaser)]) expect(text).not.toMatch(/\u2014/);
  });
});

describe("the teaser", () => {
  it("asks in my words and offers the way to the cards and to the quick version", () => {
    expect(intro.teaser.line).toBe("Want to see what I've been up to?");
    expect(intro.teaser.deal).toBe("Deal me in");
    expect(intro.teaser.back).toBe("Back to my cards");
    expect(intro.teaser.quick).toBe("In a rush? The MVP");
  });
  it("ends the line on the MVP's short word, which is what unfurls, and names the whole of it for assistive tech", () => {
    expect(intro.teaser.quick.endsWith(` ${quickCopy.titleShort}`)).toBe(true);
    expect(intro.teaser.quickName).toBe("In a rush? The MVP, my Minimum Viable Portfolio");
    expect(intro.teaser.quickName.startsWith(intro.teaser.quick)).toBe(true);
    expect(intro.teaser.quickName.endsWith(quickCopy.title)).toBe(true);
    expect(JSON.stringify(intro)).not.toContain("30-second");
  });
});
