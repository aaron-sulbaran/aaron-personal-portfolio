import { siteContent } from "@/lib/content";
import { headingParts } from "@/lib/home/heading";
import { HERO_LOCKUP, heroLockupCss } from "@/lib/loader/lockup";

// The hero's greeting, server-rendered so view-source carries it: the h1 is
// the "Hi, I'm" over "Aaron" lockup at the loader's resting pose (the same
// rules, lib/loader/lockup.ts, in the server's HTML, so the pose needs no
// JavaScript), at COIL.lockup.stillInk. It is the hero's name while the
// still is loading and when it never decodes; the loader's resting lockup
// holds it at opacity 0 until the loader goes (loaderMarkup.ts). Once the
// canvas draws the name (data-scene="on") or a decoded hero still carries it
// behind its cards (data-still-ready) it is visually hidden, staying the
// page's one top-level heading for assistive tech; its accessible name is the
// whole heading.
export const HERO_HEADING_ID = "hero-heading";

const cls = (selector: string) => selector.slice(1);

export function HeroText() {
  const { greeting, between, name, after } = headingParts(siteContent.hero);
  return (
    <>
      <style href="hero-lockup" precedence="medium">
        {heroLockupCss()}
      </style>
      <h1 id={HERO_HEADING_ID} className={`${cls(HERO_LOCKUP.container)} group-data-[scene=on]/hero:sr-only group-has-[[data-still-ready]]/hero:sr-only`}>
        <span className={cls(HERO_LOCKUP.layer)}>
          <span className={cls(HERO_LOCKUP.greet)}>{greeting}</span>
          {between}
          <span className={cls(HERO_LOCKUP.name)}>
            {name}
            <span className={cls(HERO_LOCKUP.stop)}>{after}</span>
          </span>
        </span>
      </h1>
    </>
  );
}
