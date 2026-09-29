import { siteContent } from "@/lib/content";

// The hero's accessible greeting, server-rendered so view-source and a failed
// or reduced-motion scene still carry it. Visible without a scene; once the
// scene draws the name in the canvas (slice 3) the controller sets
// data-scene="on" on the hero and this h1 becomes visually hidden, staying the
// page's one top-level heading for assistive tech.
export const HERO_HEADING_ID = "hero-heading";

export function HeroText() {
  return (
    <h1
      id={HERO_HEADING_ID}
      className="text-balance text-center font-serif text-display text-foreground group-data-[scene=on]/hero:sr-only"
    >
      {siteContent.hero.heading}
    </h1>
  );
}
