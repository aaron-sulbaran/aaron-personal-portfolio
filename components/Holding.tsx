import localFont from "next/font/local";
import { siteContent } from "@/lib/content";
import { revealIndex } from "@/lib/motion";
import { BrandIcon } from "./BrandIcons";
import { HoldingDeck } from "./HoldingDeck";

// The "under remodeling" home, served at / while NEXT_PUBLIC_SITE_MODE=holding
// (lib/holding.ts). One viewport, no nav: the deck riffles up top, the serif
// headline and body below, then the social links as icon pills.
//
// The entrance is a CSS keyframe (.holding-rise in globals.css) staggered by
// revealIndex, not a Framer initial/animate pair: a Framer entrance ships
// opacity:0 in the server HTML and the page stays blank until hydration, which
// on a cold recruiter visit is the worst possible first frame. CSS plays as
// soon as the HTML paints, and the global reduced-motion rule collapses it to
// the final state.
// Headline face: Profa Black, the display direction settled in the September
// design-exploration rounds. Single upright cut, so no italic. The file lives
// in app/fonts/, which is gitignored (licensed, not for redistribution); see
// the deploy notes before shipping this from a git build.
const profaBlack = localFont({
  src: "../app/fonts/ProfaTrial-Black.ttf",
  weight: "900",
  display: "swap",
});

export function Holding() {
  const { label, heading, body, interim, socials } = siteContent.holding;
  const { copyright } = siteContent.footer;
  const links = socials.filter(
    (s): s is typeof s & { href: string } => s.href !== null,
  );

  return (
    <main
      id="main"
      className="flex min-h-[100svh] flex-col items-center justify-center px-6 py-12 text-center md:px-10"
    >
      <div className="holding-rise" style={revealIndex(0)}>
        <HoldingDeck />
      </div>

      <div
        className="holding-rise mt-8 flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted md:mt-10"
        style={revealIndex(1)}
      >
        <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
        <span>{label}</span>
        <span className="inline-block h-px w-8 bg-border" aria-hidden="true" />
      </div>

      <h1
        className={`holding-rise mt-5 text-display-sm text-foreground ${profaBlack.className}`}
        style={revealIndex(2)}
      >
        {heading}
      </h1>

      <p
        className="holding-rise mt-5 max-w-md text-base leading-relaxed text-muted md:text-lg"
        style={revealIndex(3)}
      >
        {body}
      </p>

      <p
        className="holding-rise mt-8 text-sm text-foreground/80 md:text-base"
        style={revealIndex(4)}
      >
        {interim}
      </p>

      <ul
        className="holding-rise mt-5 flex max-w-lg flex-wrap items-center justify-center gap-2.5"
        style={revealIndex(5)}
        aria-label="Where to find me"
      >
        {links.map((link) => {
          const external = link.href.startsWith("https://");
          return (
            <li key={link.key}>
              <a
                href={link.href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                data-cursor-hover
                className="group inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-border bg-glass px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-accent hover:text-accent"
              >
                <BrandIcon
                  name={link.icon}
                  className="h-[18px] w-[18px] shrink-0 text-muted transition-colors duration-200 group-hover:text-accent"
                />
                <span>{link.label}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <p
        className="holding-rise mt-12 text-[12px] tracking-wide text-muted"
        style={revealIndex(6)}
      >
        {copyright}
      </p>
    </main>
  );
}
