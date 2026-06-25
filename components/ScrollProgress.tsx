"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { scrollToTarget } from "@/lib/scroll";
import { Portal } from "./Portal";

// Four journey sections. Home is the entire hero: the entrance, the ring, and
// the scroll collapse into the desktop deck / mobile coverflow (the hamburger's
// "Home" jumps back to the ring), so it is the first node, not an afterthought.
const SECTIONS = [
  { id: "home", label: "Home", href: "#main" },
  { id: "work", label: "Work", href: "#work" },
  { id: "about", label: "About", href: "#about" },
  { id: "connect", label: "Connect", href: "#connect" },
] as const;

// Node fractions down the spine (4 evenly spaced dots: 0, 1/3, 2/3, 1).
const F_WORK = 1 / 3;
const F_ABOUT = 2 / 3;

// The back-half progress indicator, body-level via Portal (the pinned #hero-pin
// transform would otherwise capture these fixed elements). Desktop is a left-edge
// spine that is also the wayfinding control (clickable, keyboard-focusable nodes
// with always-visible subtle labels). Mobile is a slim top progress bar. Per
// docs/navbar-direction.md this indicator takes over wayfinding from SiteNav.
//
// The fill is mapped piecewise to each section's real scroll position, so it
// reaches the Work dot exactly when Work arrives, the About dot at About, and is
// only completely full at Connect, never before. It appears once the hero
// entrance is ready (Home is a real section, present on the ring), z-[31] above
// SiteNav (z-30) and below the Menu (z-40).
export function ScrollProgress() {
  const spineRef = useRef<HTMLDivElement | null>(null);
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const barWrapRef = useRef<HTMLDivElement | null>(null);
  const barFillRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<string>("home");
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const work = document.getElementById("work");
    const about = document.getElementById("about");
    const connect = document.getElementById("connect");
    if (!work || !about || !connect) return;

    // A section is "reached" when its top crosses a reading line ~40% down the
    // viewport (LEAD). Using a reading line, not the very top of the viewport,
    // keeps the last section (Connect) reachable even when the page bottom clamps
    // its top below the viewport top. `arr` holds each section's arrival scroll
    // position in document coords; re-measured on resize / after the hero pin
    // spacer and fonts settle, so the scroll handler never reads layout per frame.
    const LEAD = 0.4;
    const arr = { work: 0, about: 0, connect: 0 };
    const measure = () => {
      const y = window.scrollY;
      const lead = window.innerHeight * LEAD;
      arr.work = Math.max(1, work.getBoundingClientRect().top + y - lead);
      arr.about = about.getBoundingClientRect().top + y - lead;
      arr.connect = connect.getBoundingClientRect().top + y - lead;
    };

    // Piecewise fill: 0 at the very top (Home), F_WORK at the Work arrival,
    // F_ABOUT at About, 1 at Connect. Each section's own scroll span maps onto its
    // fixed dot segment, so the fill tracks where you actually are rather than
    // racing ahead, and is only completely full once Connect is reached.
    const fillFor = (y: number) => {
      if (arr.connect <= 0 || arr.work <= 0) return 0;
      if (y <= 0) return 0;
      if (y < arr.work) return (y / arr.work) * F_WORK;
      if (y < arr.about) return F_WORK + ((y - arr.work) / (arr.about - arr.work)) * (F_ABOUT - F_WORK);
      if (y < arr.connect) return F_ABOUT + ((y - arr.about) / (arr.connect - arr.about)) * (1 - F_ABOUT);
      return 1;
    };
    const activeFor = (y: number) => {
      if (arr.work <= 0 || y < arr.work) return "home";
      if (y < arr.about) return "work";
      if (y < arr.connect) return "about";
      return "connect";
    };

    let raf = 0;
    const update = () => {
      raf = 0;
      // Re-measure each frame: the hero pin spacer, font swaps, and resizes all
      // shift section tops, and 3 getBoundingClientRect reads per rAF (scroll
      // only) are negligible here. Keeps the fill honest in every state.
      measure();
      const y = window.scrollY;
      const f = fillFor(y);
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${f})`;
      if (barFillRef.current) barFillRef.current.style.transform = `scaleX(${f})`;
      const a = activeFor(y);
      // setState bails when unchanged, so this is not a per-frame render.
      setActive((prev) => (prev === a ? prev : a));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onResize = () => {
      measure();
      update();
    };

    measure();
    update();

    // Reveal the indicator once the hero entrance reaches "ready" (the hero
    // exposes its phase via data-state), so Home is represented on the ring
    // rather than the indicator only appearing at Work.
    const hero = document.querySelector("[data-state]");
    const reveal = () => {
      setVisible(true);
      measure();
      update();
    };
    let mo: MutationObserver | null = null;
    if (!hero || hero.getAttribute("data-state") === "ready") {
      reveal();
    } else {
      mo = new MutationObserver(() => {
        if (hero.getAttribute("data-state") === "ready") {
          mo?.disconnect();
          reveal();
        }
      });
      mo.observe(hero, { attributes: true, attributeFilter: ["data-state"] });
    }

    // Re-measure after the pin spacer and font swaps settle (the hero pin is
    // created shortly after "ready", which shifts every section's top).
    const settle = window.setTimeout(onResize, 700);
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(onResize).catch(() => {});
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      mo?.disconnect();
      window.clearTimeout(settle);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const navigate = (href: string) => {
    scrollToTarget(href, !!prefersReducedMotion);
    if (href === "#main") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      window.history.replaceState(null, "", href);
    }
  };

  return (
    <Portal>
      {/* Desktop spine + wayfinding. role=group (not a nav landmark) so it does
          not duplicate SiteNav's nav landmark with the same destinations;
          aria-hidden + non-focusable until it has faded in. */}
      <div
        ref={spineRef}
        role="group"
        aria-label="Section progress"
        aria-hidden={!visible}
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.4s var(--ease-out)" }}
        className={`fixed left-5 top-1/2 z-[31] hidden -translate-y-1/2 md:block ${
          visible ? "" : "pointer-events-none"
        }`}
      >
        <ol className="relative flex flex-col gap-6">
          <span
            aria-hidden="true"
            className="absolute left-[3.5px] bottom-1 top-1 w-px bg-border"
          />
          <span
            ref={fillRef}
            aria-hidden="true"
            style={{ transform: "scaleY(0)" }}
            className="absolute left-[3.5px] bottom-1 top-1 w-px origin-top bg-accent"
          />
          {SECTIONS.map((s) => {
            const isActive = active === s.id;
            return (
              <li key={s.id} className="relative">
                <button
                  type="button"
                  onClick={() => navigate(s.href)}
                  tabIndex={visible ? undefined : -1}
                  aria-label={`Jump to ${s.label}`}
                  aria-current={isActive ? "location" : undefined}
                  data-cursor-hover
                  className="group flex items-center gap-3"
                >
                  <span
                    aria-hidden="true"
                    className={`relative z-10 h-2 w-2 rounded-full border transition-colors duration-200 ${
                      isActive
                        ? "border-accent bg-accent"
                        : "border-border bg-background group-hover:border-accent"
                    }`}
                  />
                  {/* Labels show full-time only where the gutter has room
                      (>=1400px); below that they would overlap the left-aligned
                      headings, so they stay hidden and reveal on hover/focus.
                      Inactive sits in a light, low-attention tone and only the
                      current section switches to the accent. */}
                  <span
                    className={`hidden text-[10px] font-medium uppercase tracking-caps transition-colors duration-200 group-hover:inline group-focus-visible:inline min-[1400px]:inline ${
                      isActive ? "text-accent" : "text-muted/50 group-hover:text-accent"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mobile top progress bar (progress-only) */}
      <div
        ref={barWrapRef}
        aria-hidden="true"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.4s var(--ease-out)" }}
        className="fixed inset-x-0 top-0 z-[31] h-[2px] md:hidden"
      >
        <div
          ref={barFillRef}
          style={{ transform: "scaleX(0)" }}
          className="h-full origin-left bg-accent"
        />
      </div>
    </Portal>
  );
}
