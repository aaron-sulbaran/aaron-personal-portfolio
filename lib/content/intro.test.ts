import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { quickCopy } from "@/lib/content/quick";
import { registerHas } from "@/lib/content/register";

const { intro } = siteContent;

const sentencesOf = intro.blocks.flatMap((block) => block.sentences);

// The photo pops page 1 carries, each once. The leadership photo sits on "leading"; the Venezuela flag is off the page until Aaron places it (its media entry stays in the register); "wanderlust" has no pop yet.
const PAGE_ONE_POPS = ["leadership-award", "family", "friends", "3d-printing", "sandboarding", "downhill-skating", "skydiving", "rock-climbing"];

describe("page 1's blocks", () => {
  it("are two paragraphs: who I am and how I work, then what I love outside work", () => {
    expect(intro.blocks.map((block) => block.key)).toEqual(["who", "outside"]);
  });

  it("are Aaron's own sentences, verbatim, link markup and all", () => {
    expect(intro.blocks[0].sentences).toEqual([
      "I'm a [product](def:product)-focused engineer.",
      "I study Electrical and Computer Engineering (ECE) at UT Austin, but beyond class I'm passionate about building products people actually want to use.",
      "I love [leading](pop:leadership-award) people with very different skillsets to achieve ambitious goals.",
    ]);
    expect(intro.blocks[1].sentences).toEqual([
      "I also love people (you'll often see me with [family](pop:family) & [friends](pop:friends)) outside of work too.",
      "My biggest hobby is credit card-maxxing since it allows me to fulfill my wanderlust.",
      "I've also gotten into [3D printing](pop:3d-printing) because it lets me work on the engineering I don't get to do in class and have always been a fan of [extreme sports](pop:sandboarding) like [downhill skating](pop:downhill-skating), [skydiving](pop:skydiving), and [rock climbing](pop:rock-climbing).",
    ]);
  });

  it("hold two to three sentences each", () => {
    for (const block of intro.blocks) {
      expect(block.sentences.length, block.key).toBeGreaterThanOrEqual(2);
      expect(block.sentences.length, block.key).toBeLessThanOrEqual(3);
    }
  });

  it("carry the photo pops Aaron placed, each once, and not the Venezuela flag", () => {
    const keys = sentencesOf.flatMap((sentence) => parseInlineLinks(sentence, registerHas).segments.flatMap((segment) => (segment.kind === "pop" ? [segment.key] : [])));
    expect([...keys].sort()).toEqual([...PAGE_ONE_POPS].sort());
    expect(keys).not.toContain("venezuela-flag");
  });

  it("put the leadership photo on \"leading\"", () => {
    expect(intro.blocks[0].sentences[2]).toContain("[leading](pop:leadership-award)");
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
