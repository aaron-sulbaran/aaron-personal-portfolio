import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PopCycle } from "@/components/inline/PopCycle";
import { tipView } from "@/lib/inline/view";

const frames = tipView("pop", "thrill-seeker")!.cycle!;
const html = renderToStaticMarkup(createElement(PopCycle, { frames, live: true }));

describe("PopCycle's first paint", () => {
  it("stacks all four photos in the one frame, loaded at once, with only the first showing", () => {
    expect(html.match(/<img /g)).toHaveLength(4);
    expect(html.match(/data-state="active"/g)).toHaveLength(2); // the first photo and the first caption
    expect(html).toMatch(/<img [^>]*alt="Me sandboarding down a dune in the Dubai desert"[^>]*data-state="active"|<img [^>]*data-state="active"[^>]*alt="Me sandboarding down a dune in the Dubai desert"/);
    expect(html.match(/<img [^>]*data-state="idle"/g)).toHaveLength(3);
    expect(html).not.toContain('data-state="previous"');
    expect(html).not.toContain('loading="lazy"');
  });
  it("crops each photo around its own focus point", () => {
    expect(html).toContain("object-position:50% 45%");
    expect(html).toContain("object-position:55% 50%");
    expect(html).toContain("object-position:50% 75%");
    expect(html).toContain("object-position:50% 100%");
  });
  it("holds all four captions in one stacked line, the first showing", () => {
    expect(html).toContain("Sandboarding on dunes just outside of Dubai");
    expect(html).toContain("Catch me on El Capitan next... right...");
    expect(html.match(/<span data-state="(?:active|idle)">/g)).toHaveLength(4);
  });
});
