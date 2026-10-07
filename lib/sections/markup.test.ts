import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Kicker } from "@/components/sections/Kicker";
import { StickyColumn } from "@/components/sections/StickyColumn";
import { UpToNow } from "@/components/UpToNow";
import { siteContent } from "@/lib/content";

// The sections leaves as the server renders them: whole, readable, unarmed.

describe("the kicker", () => {
  it("is one block: a drawable rule hidden from assistive tech, then its label in the label face", () => {
    const html = renderToStaticMarkup(createElement(Kicker, { label: "About" }));
    expect(html).toMatch(/^<div class="flex items-center gap-3 font-label text-label text-muted" data-sections-block="kicker">/);
    expect(html).toMatch(/<span data-sections-rule="true" aria-hidden="true" class="[^"]*\borigin-left\b[^"]*"><\/span>/);
    expect(html).toContain('<span data-sections-label="true">About</span>');
    expect(html).not.toContain("data-sections-state");
    expect(html).not.toContain("data-wave");
  });
});

describe("the sticky column", () => {
  it("holds its content from the grammar's values", () => {
    const html = renderToStaticMarkup(createElement(StickyColumn, { className: "md:col-span-4" } as ComponentProps<typeof StickyColumn>, createElement("p", null, "held")));
    expect(html).toBe(
      '<div class="sections-sticky-col md:col-span-4" style="--sections-sticky-top:112px;--sections-sticky-stop:120px"><div data-sections-sticky="true"><p>held</p></div></div>',
    );
  });
});

describe("Up to now", () => {
  it("renders every item as a block in one list, held heading beside it, words in a clip", () => {
    const html = renderToStaticMarkup(createElement(UpToNow));
    expect(html.match(/data-sections-block="item"/g)).toHaveLength(siteContent.upToNow.items.length);
    expect(html.match(/class="[^"]*overflow-clip[^"]*"><p data-sections-text/g)).toHaveLength(siteContent.upToNow.items.length);
    expect(html.indexOf("sections-sticky-col")).toBeLessThan(html.indexOf("<ol"));
    expect(html).not.toContain("data-up-to-now-slot");
  });
  it("gives the metrics slice one mount point after the items, outside the list and the hold", () => {
    const html = renderToStaticMarkup(createElement<NonNullable<ComponentProps<typeof UpToNow>>>(UpToNow, { after: createElement("div", { id: "skyline-probe" }) }));
    const slot = html.indexOf("data-up-to-now-slot");
    expect(slot).toBeGreaterThan(html.indexOf("</ol>"));
    expect(html.indexOf('id="skyline-probe"')).toBeGreaterThan(slot);
    expect(html.endsWith('<div id="skyline-probe"></div></div></section>')).toBe(true);
  });
});
