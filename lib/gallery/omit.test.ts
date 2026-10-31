import { describe, expect, it } from "vitest";
import { siteContent, type CardKey } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { phoneCopy } from "@/lib/gallery/omit";

const keys = Object.keys(siteContent.cards) as CardKey[];

describe("phoneCopy", () => {
  const source = "One thing. **Two things** and [a tip](tip:x). Three.";
  it("leaves the paragraph exactly as written at level 0", () => {
    expect(phoneCopy(source, ["One thing."], 0)).toBe(source);
    expect(phoneCopy(source, undefined, 3)).toBe(source);
  });
  it("drops whole sentences in the order given, with the space that joined each, and keeps the inline markup", () => {
    expect(phoneCopy(source, ["One thing.", "Three."], 1)).toBe("**Two things** and [a tip](tip:x). Three.");
    expect(phoneCopy(source, ["One thing.", "Three."], 2)).toBe("**Two things** and [a tip](tip:x).");
  });
  it("ignores a sentence the paragraph does not hold", () => {
    expect(phoneCopy(source, ["Not here."], 1)).toBe(source);
  });
});

// The omissions are Aaron's sentences, verbatim and whole: each is in its paragraph exactly once, starts and ends a sentence, and
// dropping every one leaves the paragraph more than half its words.
describe("every card's phone omissions", () => {
  it("are whole sentences of their paragraph, verbatim, each once, and never most of it", () => {
    const words = (text: string) => visibleText(text).split(/\s+/).filter(Boolean).length;
    for (const key of keys) {
      const { blocks, phoneOmit } = siteContent.cards[key].modal;
      for (const [index, sentences] of Object.entries(phoneOmit ?? {})) {
        const block = blocks[Number(index)];
        expect(block, `${key} ${index}: a paragraph the card has`).toBeDefined();
        for (const sentence of sentences) {
          expect(block.split(sentence).length - 1, `${key}: ${sentence}`).toBe(1);
          expect(sentence, `${key}: a whole sentence`).toMatch(/[.!?]["*)]*$/);
          const at = block.indexOf(sentence);
          expect(at === 0 || /[.!?]["*)]* $/.test(block.slice(0, at)), `${key}: ${sentence} starts a sentence`).toBe(true);
        }
        expect(words(phoneCopy(block, sentences, sentences.length)) / words(block), `${key} ${index}`).toBeGreaterThan(0.5);
      }
    }
  });
});
