import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PopCycle } from "@/components/inline/PopCycle";
import { POP_CYCLE_MS } from "@/lib/inline/cycle";
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
  it("marks which of the four photos is showing, in a pill over the photo's corner, so people know there are more", () => {
    expect(html.match(/data-pop-mark="\d"/g)).toHaveLength(4);
    expect(html).toMatch(/<span aria-hidden="true"[^>]*data-pop-marks="">/);
    // The first photo's mark is the wide one with the fill timed to the beat; the other three are dots.
    expect(html.match(/data-rotator-fill="timed"/g)).toHaveLength(1);
    expect(html).toContain(`animation-duration:${POP_CYCLE_MS}ms`);
    expect(html).toMatch(/<span class="relative block h-1 w-3[^>]*data-pop-mark="0"/);
    expect(html.match(/<span class="block h-1 w-1 rounded-full bg-muted"[^>]*data-pop-mark="[123]"/g)).toHaveLength(3);
  });
  it("shows no marks for a lone photo", () => {
    expect(renderToStaticMarkup(createElement(PopCycle, { frames: frames.slice(0, 1), live: true }))).not.toContain("data-pop-marks");
  });
});
