"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { Fill } from "@/components/fx/Fill";
import { MarkTrigger } from "@/components/mark/MarkTrigger";
import { FILL_PICK } from "@/lib/fx/fill";
import { siteContent } from "@/lib/content";
import { useHomeReadiness } from "@/lib/home/readiness";
import { closeMenu, getMenuOpen, setHeaderHidden, useHeaderHidden, useMenuOpen } from "@/lib/menu";
import { navigateToSection } from "@/lib/scroll";

// H1. During the hero only the AS mark (top-left) and the Menu pill
// (top-right, components/menu) are on screen. Past the hero a 72px bar slides
// in behind them with Work, About and Connect, scroll-spy on the section being
// read. Headroom: after about 140px of scrolling down the bar tucks away, the
// mark and the pill with it; any scroll up (past 6px of jitter) brings all
// three back.
//
// "During the hero" means the home hero is not yet ready (the readiness
// store) or its sentinel (app/page.tsx, the first 90svh of #main) is still in
// view. Pages without a hero show the bar from the top; /recruiting keeps it
// pinned, since its sticky filter bar sits right under it.
//
// The mark lives in the pill's layer (z-40), above the menu scrim, so it
// stays sharp and clickable while the menu is open; the bar sits at z-30.
// The mark is MarkTrigger: a click scrolls to the top, a 650ms hold opens the
// mark's card.
const NAV_ITEMS = siteContent.menu.items.filter((item) => item.key !== "home");
const SPY_IDS = NAV_ITEMS.map((item) => item.href.slice(1));
const EASE_CLASS = "ease-[cubic-bezier(0.22,1,0.36,1)]";

export function SiteNav() {
  const pathname = usePathname();
  const readiness = useHomeReadiness();
  const menuOpen = useMenuOpen();
  const headerHidden = useHeaderHidden();
  const reducedMotion = !!useReducedMotion();
  const [heroInView, setHeroInView] = useState(true);
  const [activeHref, setActiveHref] = useState<string | null>(null);

  const home = pathname === "/";
  const pinned = pathname.startsWith("/recruiting");
  const bar = !(home && (readiness !== "ready" || heroInView));

  const barRef = useRef(bar);
  const pinnedRef = useRef(pinned);
  const track = useRef({ lastY: 0, down: 0, up: 0, revealedAt: 0 });

  useEffect(() => {
    if (!home) return;
    const sentinel = document.querySelector("[data-hero-sentinel]");
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [home]);

  // Every time the bar arrives (or the route changes) headroom starts fresh:
  // the bar shows, and it may only tuck away 220px below where it arrived.
  useEffect(() => {
    barRef.current = bar;
    pinnedRef.current = pinned;
    const y = window.scrollY;
    track.current = { lastY: y, down: 0, up: 0, revealedAt: y };
    setHeaderHidden(false);
  }, [bar, pinned]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const line = y + window.innerHeight * 0.4;
      let here: string | null = null;
      for (const id of SPY_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + y <= line) here = `#${id}`;
      }
      setActiveHref(here);

      const t = track.current;
      const dy = y - t.lastY;
      t.lastY = y;
      if (!barRef.current || pinnedRef.current) return;
      if (dy > 0) {
        t.down += dy;
        t.up = 0;
        if (t.down > 140 && y > t.revealedAt + 220) setHeaderHidden(true);
      } else if (dy < 0) {
        // Summed, so a slow or smooth scroll up returns the bar as surely as
        // a flick; 6px keeps trackpad jitter from flickering it.
        t.up -= dy;
        t.down = 0;
        if (t.up > 6) setHeaderHidden(false);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  const tucked = headerHidden && !menuOpen;
  const navShown = bar && !headerHidden;

  const goTo = (href: string) => {
    const jump = () => navigateToSection(href, reducedMotion);
    if (getMenuOpen()) closeMenu(jump);
    else jump();
  };

  return (
    <>
      <MarkTrigger
        ariaLabel={siteContent.menu.markAriaLabel}
        onActivate={() => goTo("#main")}
        className={`fixed left-4 top-4 z-40 block h-8 w-8 text-foreground transition-transform duration-[450ms] ${EASE_CLASS} focus-visible:translate-y-0 sm:left-6 sm:h-10 sm:w-10 ${
          tucked ? "-translate-y-[90px]" : ""
        }`}
      />

      <header
        className={`pointer-events-none fixed left-0 right-[var(--scrollbar-comp)] top-0 z-30 h-[72px] transition-transform duration-[450ms] ${EASE_CLASS} ${
          headerHidden ? "-translate-y-full" : ""
        }`}
      >
        <div
          aria-hidden="true"
          className={`absolute inset-0 border-b border-border bg-[var(--nav-bar)] transition-transform duration-500 ${EASE_CLASS} ${
            bar ? "" : "-translate-y-full"
          }`}
        />
        <nav
          aria-label={siteContent.menu.navAriaLabel}
          inert={!navShown}
          className={`absolute left-1/2 top-0 hidden h-[72px] -translate-x-1/2 items-center gap-8 font-label text-label transition-opacity duration-300 md:flex ${
            bar ? "pointer-events-auto opacity-100" : "opacity-0"
          }`}
        >
          {NAV_ITEMS.map((item) => {
            const active = activeHref === item.href;
            return (
              <Fill
                as="a"
                {...FILL_PICK.nav}
                shape="rect"
                key={item.key}
                href={item.href}
                aria-current={active ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  goTo(item.href);
                }}
                data-cursor-hover
                className={`-mx-2 inline-flex items-center px-2 py-1 font-label text-label text-accent ${
                  active ? "after:absolute after:-bottom-1 after:left-1/2 after:-ml-0.5 after:h-1 after:w-1 after:rounded-full after:bg-accent after:content-['']" : ""
                }`}
                overClassName="flex items-center px-2 py-1"
              >
                {item.label}
              </Fill>
            );
          })}
        </nav>
      </header>
    </>
  );
}
