import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";

const { intro, whoIAm } = siteContent;

// Everything About held, as one string per body, to look each cut up in.
const ABOUT = whoIAm.blocks.flatMap((block) => [block.body, ...(block.sub ? [block.sub.body] : [])]);
const sentencesOf = intro.blocks.flatMap((block) => block.sentences);

describe("page 1's blocks", () => {
  it("are four, who I am, what I love at work, what I love outside it and where I'm from", () => {
    expect(intro.blocks.map((block) => block.key)).toEqual(["who", "work", "outside", "from"]);
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

  it("bring back the six pops slice 1 cut, and the others the intro had", () => {
    const keys = sentencesOf.flatMap((sentence) => parseInlineLinks(sentence, registerHas).segments.flatMap((segment) => (segment.kind === "pop" ? [segment.key] : [])));
    for (const key of ["sandboarding", "downhill-skating", "skydiving", "rock-climbing", "venezuela-flag", "3d-printing"]) expect(keys).toContain(key);
    for (const key of ["leadership-award", "family", "friends"]) expect(keys).toContain(key);
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
    for (const text of [...sentencesOf, intro.more, ...Object.values(intro.teaser)]) expect(text).not.toMatch(/\u2014/);
  });
});

describe("the teaser", () => {
  it("asks in my words and offers the way to the cards and to the quick version", () => {
    expect(intro.teaser.line).toBe("Want to see what I've been up to?");
    expect(intro.teaser.deal).toBe("Deal me in");
    expect(intro.teaser.back).toBe("Back to my cards");
    expect(intro.teaser.quick).toBe("In a rush? The 30-second version");
  });
});
