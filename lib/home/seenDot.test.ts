import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { PROFA_CAP_HEIGHT_EM, PROFA_X_HEIGHT_EM, SEEN_DOT_HALF_REM, hasLowercase, seenDotClass } from "@/lib/home/seenDot";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("the seen dot's vertical place", () => {
  it("is the x-height middle after a word with lowercase letters, and the capitals' middle after a word with none", () => {
    for (const word of ["Mentorship", "min/Max", "Jobs", "One", "site", "business"]) expect(seenDotClass(word), word).toBe("seen-dot");
    expect(hasLowercase("IEEE")).toBe(false);
    expect(seenDotClass("IEEE")).toBe("seen-dot seen-dot--caps");
  });

  it("reads Profa's measured metrics: capitals 700 units tall, x-height 535, of 1100", () => {
    expect(PROFA_CAP_HEIGHT_EM).toBeCloseTo(0.6364, 4);
    expect(PROFA_X_HEIGHT_EM).toBeCloseTo(0.4864, 4);
  });

  it("is written in the stylesheet from those numbers: half the cap height, a whole pixel, less the dot's half height", () => {
    const capMiddle = (PROFA_CAP_HEIGHT_EM / 2).toFixed(4);
    expect(css).toContain(`vertical-align: calc(${capMiddle}em - ${SEEN_DOT_HALF_REM}rem);`);
    expect(css).toContain(`vertical-align: calc(round(${capMiddle}em, 1px) - ${SEEN_DOT_HALF_REM}rem);`);
    expect(css).toContain(`vertical-align: calc(round(0.5ex, 1px) - ${SEEN_DOT_HALF_REM}rem);`);
  });

  it("only IEEE, of the fourteen titles' last words, has no lowercase", () => {
    const lastWords = siteContent.columns.order.flatMap((column) => column.groups.flatMap((group) => group.titles)).map((title) => title.short.split(" ").pop() ?? "");
    expect(lastWords).toHaveLength(14);
    expect(lastWords.filter((word) => !hasLowercase(word))).toEqual(["IEEE"]);
  });
});
