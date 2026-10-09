import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InlineCopy } from "@/components/inline/InlineCopy";

const html = (source: string) => renderToStaticMarkup(createElement(InlineCopy, { source }));

describe("InlineCopy", () => {
  it("renders plain copy as its text and nothing else", () => {
    expect(html("I spent three summers at Capital One.")).toBe("I spent three summers at Capital One.");
  });
  it("renders a definition as a dialog button inside the sentence", () => {
    expect(html("I am a [product](def:product)-focused engineer.")).toMatch(
      /^I am a <span class="inline-glue"><button [^>]*data-inline="def" data-inline-key="product"[^>]*aria-haspopup="dialog">product<\/button>-focused<\/span> engineer\.$/,
    );
  });
  it("wraps emphasis around text and links", () => {
    const out = html("**Bold** and *a [drone](tip:killer-drones) knockoff*");
    expect(out).toContain("<strong>Bold</strong> and ");
    expect(out).toMatch(/<em>a <\/em><em><button [^>]*data-inline="tip"[^>]*>drone<\/button><\/em><em> knockoff<\/em>$/);
  });
  it("renders an https link and the matcha pop as new-tab anchors", () => {
    expect(html("[grab a time on my calendar](https://cal.com/aaron-sulbaran)")).toMatch(
      /^<a [^>]*href="https:\/\/cal.com\/aaron-sulbaran" target="_blank" rel="noopener noreferrer"[^>]*>grab a time on my calendar<\/a>$/,
    );
    expect(html("([or matcha](pop:matcha))")).toMatch(
      /^<span class="inline-glue">\(<a [^>]*data-inline="pop"[^>]*target="_blank" rel="noopener noreferrer"[^>]*>or matcha<\/a>\)<\/span>$/,
    );
  });
  it("keeps a link, the word before it and the punctuation after it in one glue span", () => {
    expect(html("building[*](tip:killer-drones). Next")).toMatch(
      /^<span class="inline-glue">building<button [^>]*data-inline="tip" data-inline-key="killer-drones"[^>]*>\*<\/button>\.<\/span> Next$/,
    );
  });
  it("nests emphasis on a glued neighbour inside the glue span", () => {
    expect(html("**bold**[drone](tip:killer-drones) rest")).toMatch(
      /^<span class="inline-glue"><strong>bold<\/strong><button [^>]*data-inline="tip"[^>]*>drone<\/button><\/span> rest$/,
    );
  });
  it("adds no glue span to a link between spaces or at an edge", () => {
    expect(html("a [drone](tip:killer-drones) knockoff")).not.toContain("inline-glue");
    expect(html("[drone](tip:killer-drones) knockoff")).not.toContain("inline-glue");
  });
  it("renders an unknown key or a bad target as plain words and never throws", () => {
    expect(html("a [Rango](tip:rango) knockoff")).toBe("a Rango knockoff");
    expect(html("[x](javascript:alert(1))")).toBe("[x](javascript:alert(1))");
  });
});

describe("the inline link tokens", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const block = css.slice(css.indexOf("/* ---- inline links"), css.indexOf("/* ---- end inline links ---- */"));
  it("draws solid definitions and dotted tips from tokens, with no hex, keeps a ring out of the mask, and fades under reduced motion", () => {
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/\.inline-link\[data-inline="def"\] \{ text-decoration-style: solid; \}/);
    expect(block).toMatch(/\.inline-link\[data-inline="tip"\], \.inline-link\[data-inline="pop"\] \{ text-decoration-style: dotted; \}/);
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(block).toContain(".sections-line-mask:has(.inline-link) { overflow-x: visible !important; }");
    expect(block).toContain("prefers-reduced-motion: reduce");
  });
});
