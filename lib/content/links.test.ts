import { describe, expect, it } from "vitest";
import { parseInlineLinks, plainText, visibleText, type InlineKind } from "@/lib/content/links";

const known = (kind: InlineKind, key: string) =>
  (kind === "tip" && (key === "ieee-ao" || key === "aango")) || (kind === "pop" && key === "sister-kyoto") || (kind === "def" && key === "product");

describe("parseInlineLinks", () => {
  it("returns nothing for an empty string and one text segment for plain copy", () => {
    expect(parseInlineLinks("", known)).toEqual({ segments: [], unknown: [] });
    expect(parseInlineLinks("I spent three summers at Capital One.", known)).toEqual({ segments: [{ kind: "text", text: "I spent three summers at Capital One." }], unknown: [] });
  });

  it("splits a tip out of the middle of a book meta", () => {
    expect(parseInlineLinks("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026", known)).toEqual({
      segments: [{ kind: "text", text: "President, Corporate Director, and " }, { kind: "tip", text: "AO", key: "ieee-ao" }, { kind: "text", text: ", 2023 to 2026" }],
      unknown: [],
    });
  });

  it("reads def, pop and https links, at the start and at the end", () => {
    expect(parseInlineLinks("[product](def:product)-focused, [my sister](pop:sister-kyoto) and [Sulara](https://sularatravel.com/)", known).segments).toEqual([
      { kind: "def", text: "product", key: "product" }, { kind: "text", text: "-focused, " }, { kind: "pop", text: "my sister", key: "sister-kyoto" },
      { kind: "text", text: " and " }, { kind: "external", text: "Sulara", href: "https://sularatravel.com/" },
    ]);
  });

  it("keeps quotes and punctuation around a link outside it", () => {
    expect(parseInlineLinks("called \"[Sulara](https://sularatravel.com/).\"", known).segments).toEqual([
      { kind: "text", text: "called \"" }, { kind: "external", text: "Sulara", href: "https://sularatravel.com/" }, { kind: "text", text: ".\"" },
    ]);
  });

  it("reports a key the register lacks and keeps its words as text", () => {
    expect(parseInlineLinks("a [Rango](tip:rango) knockoff", known)).toEqual({
      segments: [{ kind: "text", text: "a Rango knockoff" }],
      unknown: [{ text: "Rango", target: "tip:rango" }],
    });
  });

  it("never makes a link of a target that is not https or a known kind", () => {
    for (const target of ["http://example.com", "mailto:me@example.com", "javascript:void", "ftp://example.com", "tip:Bad_Key", "tip:", "foo:bar"]) {
      expect(parseInlineLinks(`see [x](${target})`, known)).toEqual({ segments: [{ kind: "text", text: "see x" }], unknown: [{ text: "x", target }] });
    }
  });

  it("leaves malformed markup literal and never throws", () => {
    for (const source of ["[x] (tip:aango)", "[](tip:aango)", "[ ](tip:aango)", "[x](tip:aango", "x](tip:aango)", "[[x]](tip:aango)", "[x](javascript:alert(1))"]) {
      expect(parseInlineLinks(source, known)).toEqual({ segments: [{ kind: "text", text: source }], unknown: [] });
    }
  });

  it("reads adjacent links, a lone asterisk, a link in parentheses, and leaves literal brackets", () => {
    expect(parseInlineLinks("[a](tip:aango)[b](tip:ieee-ao)", known).segments).toEqual([{ kind: "tip", text: "a", key: "aango" }, { kind: "tip", text: "b", key: "ieee-ao" }]);
    expect(parseInlineLinks("no matter what you're building[*](tip:aango).", known).segments[1]).toEqual({ kind: "tip", text: "*", key: "aango" });
    expect(parseInlineLinks("a coffee ([or matcha](pop:sister-kyoto)).", known).segments.map((segment) => segment.text)).toEqual(["a coffee (", "or matcha", ")."]);
    expect(parseInlineLinks("I said [sic] and [AO](tip:ieee-ao)", known).segments[0]).toEqual({ kind: "text", text: "I said [sic] and " });
    expect(parseInlineLinks("[Rango](https://en.wikipedia.org/wiki/Rango_(2011_film))", known).unknown).toEqual([]);
  });

  it("leaves bold and italic markers for the renderer", () => {
    const source = "**2024, business analyst.** My first look, I *know* it.";
    expect(parseInlineLinks(source, known).segments).toEqual([{ kind: "text", text: source }]);
  });
});

describe("plainText", () => {
  it("reads a link as its words", () => {
    expect(plainText("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026")).toBe("President, Corporate Director, and AO, 2023 to 2026");
  });

  it("matches the parsed segments' words for known, unknown, external and malformed links", () => {
    for (const source of ["a [Rango](tip:rango) knockoff", "[product](def:product)-focused", "go [check her out](https://www.instagram.com/travelwithbarbss/)!", "[x] (tip:aango)"]) {
      expect(parseInlineLinks(source, known).segments.map((segment) => segment.text).join("")).toBe(plainText(source));
    }
  });
});

describe("visibleText", () => {
  it("drops paired emphasis markers and keeps a lone asterisk", () => {
    expect(visibleText("**2024, business analyst.** My first look at corporate America.")).toBe("2024, business analyst. My first look at corporate America.");
    expect(visibleText("an invitational I *know* it had been chasing")).toBe("an invitational I know it had been chasing");
    expect(visibleText("building[*](tip:aango).")).toBe("building*.");
  });
});
