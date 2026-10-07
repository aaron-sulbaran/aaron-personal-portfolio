import { siteContent } from "@/lib/content";

// The hero's accessible greeting, server-rendered so view-source carries it.
// It shows whenever nothing else greets: no canvas name, no decoded still,
// no resting lockup (whose stylesheet holds this h1 at opacity 0,
// loaderMarkup.ts). Once the canvas draws the name (data-scene="on") or a
// decoded hero still shows it (data-still-ready) it is visually hidden,
// staying the page's one top-level heading for assistive tech.
export const HERO_HEADING_ID = "hero-heading";

export function HeroText() {
  return (
    <h1
      id={HERO_HEADING_ID}
      className="text-balance text-center font-display text-display text-foreground group-data-[scene=on]/hero:sr-only group-has-[[data-still-ready]]/hero:sr-only"
    >
      {siteContent.hero.heading}
    </h1>
  );
}
