"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { navigateToSection } from "@/lib/scroll";

// Section jump targets mirrored from the in-page anchors. Shown inline on
// desktop; mobile relies on the hamburger menu instead.
const NAV_LINKS = [
  { label: "Work", href: "#work" },
  { label: "About", href: "#about" },
  { label: "Connect", href: "#connect" },
] as const;

// The favicon mark, inlined so the nav logo stays consistent with the browser
// tab icon. Fixed brand colors by design (a small accent chip in both themes).
function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#1B3A5C" />
      <text
        x="16.5"
        y="24.5"
        textAnchor="middle"
        fontFamily="Instrument Serif, Georgia, 'Times New Roman', serif"
        fontStyle="italic"
        fontSize="25"
        fill="#FAFAF7"
      >
        A
      </text>
    </svg>
  );
}

// Sticky top nav, the second navigation channel alongside the hamburger. It is
// absent during the hero (Apple-style), slides in once scrolled past it, then
// follows the headroom pattern: hides on scroll-down, reappears on scroll-up.
export function SiteNav() {
  const prefersReducedMotion = useReducedMotion();
  const headerRef = useRef<HTMLElement | null>(null);
  const lastY = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [retracted, setRetracted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const revealAt = window.innerHeight * 0.6;
        const past = y > revealAt;
        setRevealed(past);
        if (!past) {
          setRetracted(false);
        } else if (Math.abs(y - lastY.current) > 4) {
          setRetracted(y > lastY.current);
        }
        lastY.current = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Deep link on load: if the URL carries a section hash, hold until the ring's
  // entrance reaches "ready" (it locks body scroll during the early phases),
  // then scroll there. The hero section exposes its phase via data-state.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || hash === "#main") return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hero = document.querySelector("[data-state]");
    const go = () =>
      requestAnimationFrame(() =>
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
      );
    if (!hero || hero.getAttribute("data-state") === "ready") {
      go();
      return;
    }
    const observer = new MutationObserver(() => {
      if (hero.getAttribute("data-state") === "ready") {
        observer.disconnect();
        go();
      }
    });
    observer.observe(hero, { attributes: true, attributeFilter: ["data-state"] });
    return () => observer.disconnect();
  }, []);

  // Scroll-spy: highlight the nav link for the section crossing the upper
  // middle of the viewport. One observer over the section anchors.
  useEffect(() => {
    const sections = NAV_LINKS.map((l) => document.getElementById(l.href.slice(1))).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  // inert when off-screen so the hidden links never take keyboard focus.
  const shown = revealed && !retracted;
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    if (shown) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [shown]);

  const navigate = (href: string) => {
    navigateToSection(href, !!prefersReducedMotion);
  };

  return (
    <motion.header
      ref={headerRef}
      initial={false}
      animate={{ y: shown ? 0 : "-100%", opacity: shown ? 1 : 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
      }
      aria-hidden={!shown}
      className="fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md"
    >
      <nav
        aria-label="Primary"
        className="flex items-center gap-8 px-6 py-3 md:px-10"
      >
        <button
          type="button"
          onClick={() => navigate("#main")}
          aria-label="Back to top"
          data-cursor-hover
          className="inline-flex shrink-0 items-center rounded-md transition-opacity duration-200 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <BrandMark />
        </button>

        <ul className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => {
            const active = activeId === link.href.slice(1);
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  aria-current={active ? "true" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(link.href);
                  }}
                  data-cursor-hover
                  className={`text-[11px] font-medium uppercase tracking-caps transition-colors duration-200 hover:text-accent focus-visible:text-accent ${
                    active ? "text-accent" : "text-muted"
                  }`}
                >
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </motion.header>
  );
}
