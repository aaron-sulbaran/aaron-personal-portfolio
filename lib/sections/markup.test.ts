import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetricsSlots } from "@/components/metrics/MetricsStats";
import { Kicker } from "@/components/sections/Kicker";
import { StickyColumn } from "@/components/sections/StickyColumn";
import { WhoIAm } from "@/components/WhoIAm";
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

  it("puts a label id on its words, for a group named by them", () => {
    expect(renderToStaticMarkup(createElement(Kicker, { label: "My GitHub contributions", labelId: "metrics-label" }))).toContain(
      '<span data-sections-label="true" id="metrics-label">My GitHub contributions</span>',
    );
  });
});

describe("the numbers strip's figures", () => {
  it("keeps my LinkedIn line in a list of its own, not in a group, and renders nothing for the empty fun slot", () => {
    const html = renderToStaticMarkup(createElement(MetricsSlots));
    expect(html).toMatch(/^<dl class="[^"]*">/);
    expect(html).not.toContain('role="group"');
    expect(html.match(/data-stat="/g)).toHaveLength(1);
    expect(html).toContain('data-stat="linkedin"');
    expect(html).toContain("450,000");
    expect(html).toContain("LinkedIn impressions in 3 months");
    expect(html).toContain("2,500+ followers");
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

describe("Who I am", () => {
  const html = renderToStaticMarkup(createElement(WhoIAm));
  const { label, heading, blocks, smallPrint } = siteContent.whoIAm;
  const labels = [label, ...blocks.flatMap((block) => [block.label, ...(block.sub ? [block.sub.label] : [])])];

  it("is the page's #about, the About screen and Right now sections gone", () => {
    expect(html).toMatch(new RegExp(`^<section id="about" aria-label="${label}"`));
    expect(html).not.toContain('id="up-to-now"');
    expect(html).not.toContain("data-up-to-now-slot");
    expect(html).not.toContain('data-sections-block="item"');
  });

  it("holds the label, the lowercase heading and the small print in the sticky column, ahead of the blocks", () => {
    const held = html.slice(html.indexOf("sections-sticky-col"), html.indexOf(`data-sections-label="true">${blocks[0].label}`));
    expect(held).toContain(`<h2 class="font-display text-section" data-sections-block="heading" data-sections-split="lines">${heading}</h2>`);
    expect(held).toContain(smallPrint);
  });

  it("draws a kicker for the section and for every block and sub-block, in order, each followed by its body", () => {
    expect([...html.matchAll(/data-sections-label="true">([^<]*)</g)].map((match) => match[1].replaceAll("&#x27;", "'"))).toEqual(labels);
    expect(html.match(/data-sections-block="kicker"/g)).toHaveLength(labels.length);
    expect(html.match(/data-sections-block="body"/g)).toHaveLength(blocks.length + blocks.filter((block) => block.sub).length + 1);
  });

  it("renders the definition and the photo pops as marked inline links", () => {
    expect(html.match(/data-inline="def"/g)).toHaveLength(1);
    expect([...html.matchAll(/data-inline="pop" data-inline-key="([a-z-]+)"/g)].map((match) => match[1])).toEqual([
      "leadership-award", "sandboarding", "downhill-skating", "skydiving", "rock-climbing", "venezuela-flag",
    ]);
    expect(html).not.toContain("](");
  });
});
