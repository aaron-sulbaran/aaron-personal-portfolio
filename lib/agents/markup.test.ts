import { describe, expect, it } from "vitest";
import { inlineToMarkdown, inlineToPlain } from "./markup";

describe("inlineToMarkdown", () => {
  it("turns popups into their words and keeps external links", () => {
    expect(inlineToMarkdown("I [design](tip:this-site-playground) the [repo](https://github.com/x/y) and love [leading](pop:leadership-award).")).toBe(
      "I design the [repo](https://github.com/x/y) and love leading.",
    );
  });

  it("keeps bold and drops a footnote asterisk", () => {
    expect(inlineToMarkdown("**Won.** Anyone[*](tip:killer-drones)")).toBe("**Won.** Anyone");
  });

  it("plain text drops links and bold", () => {
    expect(inlineToPlain("**A.** [b](https://x.dev/y) [c](def:product)")).toBe("A. b c");
  });
});
