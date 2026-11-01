import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { quickCopy } from "@/lib/content/quick";
import { register, registerHas } from "@/lib/content/register";

const { intro } = siteContent;

const sentencesOf = intro.blocks.flatMap((block) => block.sentences);

// The photo pops page 1 carries, each once. The leadership photo sits on "leading", the Venezuela flag on "Venezuela", the Mt. Fuji photo on "wanderlust", and the four sports photos, cycling, on "thrill seeker".
const PAGE_ONE_POPS = ["leadership-award", "venezuela-flag", "family", "friends", "wanderlust", "3d-printing", "thrill-seeker"];

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
      "Born in [Venezuela](pop:venezuela-flag) and raised in Texas, I love spending time with [family](pop:family) & [friends](pop:friends) while always happy to meet new people.",
      "Outside of class, I use credit card-maxxing to fulfill my [wanderlust](pop:wanderlust) and [3D printing](pop:3d-printing) to satisfy my engineering itch.",
      "I'm also a huge [thrill seeker](pop:thrill-seeker) and will say yes to just about any adventure.",
    ]);
  });

  it("hold two to three sentences each", () => {
    for (const block of intro.blocks) {
      expect(block.sentences.length, block.key).toBeGreaterThanOrEqual(2);
      expect(block.sentences.length, block.key).toBeLessThanOrEqual(3);
    }
  });

  it("carry the photo pops Aaron placed, each once, the Venezuela flag, the Mt. Fuji photo and the cycling thrill seeker among them", () => {
    const keys = sentencesOf.flatMap((sentence) => parseInlineLinks(sentence, registerHas).segments.flatMap((segment) => (segment.kind === "pop" ? [segment.key] : [])));
    expect([...keys].sort()).toEqual([...PAGE_ONE_POPS].sort());
  });

  it("put the leadership photo on \"leading\", the Mt. Fuji photo on \"wanderlust\" and the four cycling sports photos on \"thrill seeker\"", () => {
    expect(intro.blocks[0].sentences[2]).toContain("[leading](pop:leadership-award)");
    expect(intro.blocks[1].sentences[1]).toContain("[wanderlust](pop:wanderlust)");
    expect(intro.blocks[1].sentences[2]).toContain("[thrill seeker](pop:thrill-seeker)");
    expect(sentencesOf.join(" ")).not.toContain("extreme sports");
  });

  it("no longer names the sports as links of their own: they are the thrill seeker's photos, in Aaron's order", () => {
    const text = sentencesOf.join(" ");
    for (const key of ["sandboarding", "downhill-skating", "skydiving", "rock-climbing"]) expect(text).not.toContain(`pop:${key}`);
    expect(register.pop["thrill-seeker"].cycle?.map((frame) => frame.file.src)).toEqual(
      ["sandboarding", "skydiving", "downhill-skating", "rock-climbing"].map((key) => `/photos/pops/${key}.jpg`),
    );
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
