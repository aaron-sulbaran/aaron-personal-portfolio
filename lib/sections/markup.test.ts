import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MetricsSlots } from "@/components/metrics/MetricsStats";
import { Kicker } from "@/components/sections/Kicker";
import { SectionHeading, SectionSubline } from "@/components/sections/SectionTitle";
import { StickyColumn } from "@/components/sections/StickyColumn";
import { Connect } from "@/components/Connect";
import { siteContent } from "@/lib/content";
import { slotStats } from "@/lib/metrics/format";

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

  it("runs the line its full length from md up only when asked (the numbers strip's), narrow on phones", () => {
    const wide = renderToStaticMarkup(createElement(SectionSubline, { wide: true } as ComponentProps<typeof SectionSubline>, "a line"));
    expect(wide).toMatch(/^<p class="max-w-xs md:max-w-none text-sm leading-relaxed text-muted"/);
  });

  it("puts an id on its block, for a group named by it", () => {
    expect(renderToStaticMarkup(createElement(SectionHeading, { id: "metrics-title" } as ComponentProps<typeof SectionHeading>, "proof of work"))).toContain('id="metrics-title"');
    expect(renderToStaticMarkup(createElement(SectionSubline, { id: "metrics-label" } as ComponentProps<typeof SectionSubline>, "My GitHub contributions"))).toContain('id="metrics-label"');
  });
});

describe("the numbers strip's figures", () => {
  const withSlot = [{ key: "slot", value: "12", label: "a figure of my own", sub: "a note" }];

  it("renders nothing for the slots today: the LinkedIn figure is off and the fun slot is empty", () => {
    expect(renderToStaticMarkup(createElement(MetricsSlots, { stats: slotStats() }))).toBe("");
    expect(renderToStaticMarkup(createElement(MetricsSlots, { stats: [] }))).toBe("");
  });

  it("keeps a figure of my own in a list of its own, not in a group, for when one is set", () => {
    const html = renderToStaticMarkup(createElement(MetricsSlots, { stats: withSlot }));
    expect(html).not.toContain('role="group"');
    expect(html.match(/data-stat="/g)).toHaveLength(1);
    expect(html).toContain('data-stat="slot"');
    expect(html).toContain("a figure of my own");
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

describe("Connect", () => {
  const html = renderToStaticMarkup(createElement(Connect));
  const { label, heading } = siteContent.connect;

  it("is the page's #connect, named by its label for assistive tech, with the big heading first and no kicker drawn", () => {
    expect(html).toMatch(new RegExp(`^<section id="connect" data-wave-anchor="connect" aria-label="${label}"`));
    expect(html).toContain(`<h2 class="font-display text-section" data-sections-block="heading" data-sections-split="lines">${heading}</h2>`);
    expect(html).not.toContain('data-sections-block="kicker"');
    expect(html).not.toContain("data-sections-label");
  });
});
