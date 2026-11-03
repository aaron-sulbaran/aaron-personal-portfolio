import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardVideo } from "@/components/card/CardVideo";
import { galleryOf } from "@/lib/gallery/card";

const markup = (key: "min-max" | "hackathons") => {
  const photo = galleryOf(key).photos.find((p) => p.video)!;
  return renderToStaticMarkup(createElement(CardVideo, { video: photo.video!, label: photo.alt }));
};

describe("a card's video as first painted", () => {
  it("shows its poster, muted and inline with its controls, never looping (the clip is played once and held on its last frame)", () => {
    const html = markup("min-max");
    expect(html).toContain('poster="/media/min-max/min-max-answer-poster.jpg"');
    expect(html).toContain('src="/media/min-max/min-max-answer.mp4"');
    expect(html).toContain("controls");
    expect(html).toMatch(/playsInline/i);
    expect(html).toContain("muted");
    expect(html).not.toMatch(/\sloop[\s=>]/);
    // CardVideo starts it once the card has landed; the markup itself never autoplays, so a reduced-motion reader is never started.
    expect(html).not.toContain("autoplay");
  });
  it("fetches the whole small clip up front only where it will play by itself", () => {
    expect(markup("min-max")).toContain('preload="auto"');
    expect(markup("hackathons")).toContain('preload="metadata"');
  });
});
