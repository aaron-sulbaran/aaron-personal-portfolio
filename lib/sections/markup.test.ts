import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetricsSlots } from "@/components/metrics/MetricsStats";
import { Kicker } from "@/components/sections/Kicker";
import { SectionHeading, SectionSubline } from "@/components/sections/SectionTitle";
import { StickyColumn } from "@/components/sections/StickyColumn";
import { Connect } from "@/components/Connect";
import { WhoIAm } from "@/components/WhoIAm";
import { siteContent } from "@/lib/content";

// The sections leaves as the server renders them: whole, readable, unarmed.

describe("the kicker", () => {
  it("is one block: a drawable rule hidden from assistive tech, then its label in the label face", () => {
    const html = renderToStaticMarkup(createElement(Kicker, { label: "what I do" }));
    expect(html).toMatch(/^<div class="flex items-center gap-3 font-label text-label text-muted" data-sections-block="kicker">/);
    expect(html).toMatch(/<span data-sections-rule="true" aria-hidden="true" class="[^"]*\borigin-left\b[^"]*"><\/span>/);
    expect(html).toContain('<span data-sections-label="true">what I do</span>');
    expect(html).not.toContain("data-sections-state");
    expect(html).not.toContain("data-wave");
  });
});

describe("the section title and the line under it", () => {
  it("is the big display heading, an h2 of the heading kind, lines-split", () => {
    expect(renderToStaticMarkup(createElement(SectionHeading, {} as ComponentProps<typeof SectionHeading>, "proof of work"))).toBe(
      '<h2 class="font-display text-section" data-sections-block="heading" data-sections-split="lines">proof of work</h2>',
    );
  });

  it("is the muted small line, one block-split body paragraph around its inner span", () => {
    expect(renderToStaticMarkup(createElement(SectionSubline, {} as ComponentProps<typeof SectionSubline>, "My GitHub contributions"))).toBe(
      '<p class="max-w-xs text-sm leading-relaxed text-muted" data-sections-block="body" data-sections-split="block"><span data-sections-inner="true" class="block">My GitHub contributions</span></p>',
    );
  });

  it("puts an id on its block, for a group named by it", () => {
    expect(renderToStaticMarkup(createElement(SectionHeading, { id: "metrics-title" } as ComponentProps<typeof SectionHeading>, "proof of work"))).toContain('id="metrics-title"');
    expect(renderToStaticMarkup(createElement(SectionSubline, { id: "metrics-label" } as ComponentProps<typeof SectionSubline>, "My GitHub contributions"))).toContain('id="metrics-label"');
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
  const labels = blocks.flatMap((block) => [block.label, ...(block.sub ? [block.sub.label] : [])]);

  it("is the page's #about, the About screen and Right now sections gone", () => {
    expect(html).toMatch(new RegExp(`^<section id="about" aria-label="${label}"`));
    expect(html).not.toContain('id="up-to-now"');
    expect(html).not.toContain("data-up-to-now-slot");
    expect(html).not.toContain('data-sections-block="item"');
  });

  it("holds the lowercase heading and the small print in the sticky column, ahead of the blocks, with no kicker above the heading", () => {
    const held = html.slice(html.indexOf("sections-sticky-col"), html.indexOf(`data-sections-label="true">${blocks[0].label}`));
    expect(held).toContain(`<h2 class="font-display text-section" data-sections-block="heading" data-sections-split="lines">${heading}</h2>`);
    expect(held).toContain(smallPrint);
    expect(held.indexOf(heading)).toBeLessThan(held.indexOf(smallPrint));
    expect(html.indexOf('data-sections-block="kicker"'), "the first kicker is a block's, after the held column").toBeGreaterThan(html.indexOf(smallPrint));
  });

  it("draws a kicker for every block and sub-block, in order, each followed by its body, and none for the section", () => {
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

describe("Connect", () => {
  const html = renderToStaticMarkup(createElement(Connect));
  const { label, heading } = siteContent.connect;

  it("is the page's #connect, named by its label for assistive tech, with the big heading first and no kicker drawn", () => {
    expect(html).toMatch(new RegExp(`^<section id="connect" aria-label="${label}"`));
    expect(html).toContain(`<h2 class="font-display text-section" data-sections-block="heading" data-sections-split="lines">${heading}</h2>`);
    expect(html).not.toContain('data-sections-block="kicker"');
    expect(html).not.toContain("data-sections-label");
  });
});
