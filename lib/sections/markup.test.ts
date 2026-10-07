import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Kicker } from "@/components/sections/Kicker";
import { StickyColumn } from "@/components/sections/StickyColumn";

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
