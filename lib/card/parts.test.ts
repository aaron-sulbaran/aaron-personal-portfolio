import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { strandCardByKey, type CardKey } from "@/lib/content";
import { CardFace } from "@/components/card/CardFace";
import { CardHeader } from "@/components/card/CardHeader";
import { CardLinks } from "@/components/card/CardLinks";
import { MentorsList } from "@/components/card/MentorsList";
import { TimelineEntry } from "@/components/card/TimelineEntry";

// next/image's optimizer needs a server; a plain img is enough to read the markup.
vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => createElement("img", { src: props.src, alt: props.alt, className: props.className, style: props.style }) }));

const face = (key: CardKey) => {
  const f = strandCardByKey.get(key)?.face;
  if (!f) throw new Error(`${key} is not on the strand`);
  return renderToStaticMarkup(createElement(CardFace, { face: f }));
};
const header = (cardKey: CardKey, compact: boolean) => renderToStaticMarkup(createElement(CardHeader, { cardKey, renderMedia: true, compact }));

describe("the header tile's face", () => {
  it("puts a logo with no dark file on a plate that shows only in the dark theme, never IEEE's square or Talos's anvil", () => {
    expect(face("capital-one")).toContain('data-plate=""');
    expect(face("capital-one")).toContain("dark:block");
    expect(face("ieee")).not.toContain("data-plate");
    expect(face("talos")).not.toContain("data-plate");
    expect(face("talos")).toContain("bg-[color:var(--card-anvil)]");
  });
  it("swaps to a logo's dark file in the dark theme", () => {
    expect(face("min-max")).toContain('src="/work/logos/min-max/mark-on-dark.svg"');
    expect(face("min-max")).toContain('src="/work/logos/min-max/mark.svg"');
  });
  it("draws the jobs card's five discs, This site's mark and a photo card's picture in its pane", () => {
    expect(face("jobs").match(/data-disc=/g)?.length).toBe(5);
    expect(face("this-site")).toContain("<svg");
    expect(face("mentorship")).toContain('data-face="photo"');
    expect(face("mentorship")).toContain('src="/photos/cards/mentorship-picture.jpg"');
  });
});

describe("the header", () => {
  it("carries the flight's slot: a photo card's only on a phone, every other card's in both layouts", () => {
    expect(header("mentorship", false)).not.toContain("data-tile-slot");
    expect(header("mentorship", true)).toContain('data-tile-slot="photo"');
    expect(header("talos", false)).toMatch(/data-tile-slot="work"[^>]*style="width:60px;height:80px"/);
    expect(header("talos", true)).toMatch(/data-tile-slot="work"[^>]*style="width:51px;height:68px"/);
    expect(header("capital-one", true)).toMatch(/data-tile-slot="work"[^>]*style="width:42px;height:56px"/);
  });
  it("shows IEEE's AO tip in the meta beside the rows, and the shorter meta on a phone", () => {
    expect(header("ieee", false)).toMatch(/<button [^>]*data-inline="tip" data-inline-key="ieee-ao"[^>]*>AO<\/button>/);
    expect(header("ieee", true)).toContain("President, 2023 to 2026");
    expect(header("ieee", true)).not.toContain("ieee-ao");
  });
});

describe("the timeline entry", () => {
  it("makes the employer's name its insider tip and shows the role and when", () => {
    const html = renderToStaticMarkup(createElement(TimelineEntry, { entry: 3, unit: 6 }));
    expect(html).toMatch(/<button [^>]*data-inline="tip" data-inline-key="job-3"[^>]*>Apple<\/button>/);
    expect(html).toContain("Specialist, then technical specialist");
    expect(html).toContain("2024 to 2025");
    expect(html).toContain('data-mask="words-6"');
  });
});

describe("the mentors and the links", () => {
  it("links each of the six mentors to LinkedIn in a new tab under my heading", () => {
    const html = renderToStaticMarkup(createElement(MentorsList, {}));
    expect(html).toContain("the people who shaped me");
    expect(html.match(/<a [^>]*href="https:\/\/www\.linkedin\.com\/in\/[^"]+" target="_blank" rel="noopener noreferrer"/g)?.length).toBe(6);
  });
  it("opens a card's links in a new tab, and renders nothing for a card with none", () => {
    expect(renderToStaticMarkup(createElement(CardLinks, { cardKey: "anthropic" }))).toMatch(/<a [^>]*href="https:\/\/txclaude.org" target="_blank" rel="noopener noreferrer"/);
    expect(renderToStaticMarkup(createElement(CardLinks, { cardKey: "min-max" }))).toBe("");
  });
});
