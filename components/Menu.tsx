"use client";

import { usePathname } from "next/navigation";
import { Moon, Sun, X, Music } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { siteContent, type MenuItem } from "@/lib/content";
import { navigateToSection } from "@/lib/scroll";
import { THEME_STORAGE_KEY, syncThemeColorMeta, type Theme } from "@/lib/theme";
import { startSoundtrack, stopSoundtrack, useSoundtrack } from "@/lib/soundtrack";

const MOBILE_MAX = 767;

// Top-right menu. Collapsed state is just a two-bar hamburger icon. Expanded
// state covers the viewport with a frosted backdrop, a big-serif item list,
// and the theme toggle below a thin rule. Items smooth-scroll to in-page
// sections (no route change); the menu still auto-closes if the route changes.
export function Menu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const music = useSoundtrack();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const {
    items,
    ariaLabelOpen,
    ariaLabelClose,
    themeToggleToDark,
    themeToggleToLight,
    themeAriaLabelToDark,
    themeAriaLabelToLight,
  } = siteContent.menu;
  const soundtrack = siteContent.soundtrack;
  const navItems: readonly MenuItem[] = items;

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) ?? "light";
    setTheme(current);
  }, []);

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useBodyScrollLock(open);
  useEscapeKey(open, () => setOpen(false));
  useFocusTrap(dialogRef, open);

  // Close the menu, then smooth-scroll to the section once the body-scroll lock
  // has released. The lock is torn down in an effect on the next commit, so a
  // synchronous scroll would run while body overflow is still hidden; two rAFs
  // push the scroll past that. The hash is updated for shareable deep links.
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setOpen(false);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => navigateToSection(href, !!prefersReducedMotion)),
      );
    },
    [prefersReducedMotion],
  );

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    syncThemeColorMeta(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  const themeAriaLabel = theme === "dark" ? themeAriaLabelToLight : themeAriaLabelToDark;
  const themeToggleLabel = theme === "dark" ? themeToggleToLight : themeToggleToDark;

  const musicOn = music === "on" || music === "paused";
  const musicToggleLabel = musicOn ? soundtrack.menuToggleOff : soundtrack.menuToggleOn;
  const musicAriaLabel = musicOn ? soundtrack.menuAriaLabelOff : soundtrack.menuAriaLabelOn;

  const toggleMusic = useCallback(() => {
    if (music === "off" || music === "before") startSoundtrack();
    else stopSoundtrack();
  }, [music]);

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25, ease: "easeOut" as const } },
    exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" as const } },
  };

  const listVariants = prefersReducedMotion
    ? overlayVariants
    : {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const, delay: 0.05 } },
        exit: { opacity: 0, y: 8, transition: { duration: 0.2, ease: "easeIn" as const } },
      };

  return (
    <>
      <button
        id="site-menu-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabelOpen}
        aria-expanded={open}
        aria-controls="site-menu"
        className="fixed top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-[0_2px_16px_-6px_rgba(10,10,10,0.22)] backdrop-blur-md transition-colors duration-200 hover:text-accent [right:calc(1rem+var(--scrollbar-comp))] md:top-6 md:[right:calc(1.5rem+var(--scrollbar-comp))]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            key="menu-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            ref={dialogRef}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={overlayVariants}
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto overscroll-contain bg-background/95 px-6 py-6 backdrop-blur-xl md:px-10 md:py-8"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg italic text-foreground">{siteContent.meta.title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={ariaLabelClose}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <motion.nav
              variants={listVariants}
              className="flex flex-1 shrink-0 flex-col items-start justify-center gap-6 py-12 md:gap-8"
            >
              <ul className="flex flex-col gap-2 md:gap-4">
                {navItems.map((item, i) => (
                  <li key={item.key}>
                    <a
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className="group relative flex items-start gap-4 focus:outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-3 text-[11px] font-medium uppercase tracking-caps text-muted md:mt-4"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="relative grid items-end justify-items-start overflow-hidden px-[0.04em] pb-[0.14em] font-serif text-[clamp(3.5rem,10vw,7rem)] italic leading-[1] tracking-tight">
                        <span className="col-start-1 row-start-1 block whitespace-nowrap text-foreground transition-transform duration-[600ms] ease-[cubic-bezier(0.77,0,0.175,1)] group-hover:-translate-y-[110%] group-focus-visible:-translate-y-[110%]">
                          {item.label}
                        </span>
                        <span
                          aria-hidden="true"
                          className="col-start-1 row-start-1 block translate-y-[110%] whitespace-nowrap font-grotesk not-italic text-accent transition-transform duration-[600ms] ease-[cubic-bezier(0.77,0,0.175,1)] group-hover:translate-y-0 group-focus-visible:translate-y-0"
                        >
                          {item.label}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex w-full max-w-md items-center gap-6 border-t border-border/70 pt-6">
                {!isMobile && (
                  <button
                    type="button"
                    onClick={toggleMusic}
                    aria-label={musicAriaLabel}
                    aria-pressed={musicOn}
                    className="group inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted transition-colors duration-200 hover:text-accent"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 group-hover:text-accent">
                      <Music aria-hidden="true" className="h-[15px] w-[15px]" />
                    </span>
                    <span>{musicToggleLabel}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={themeAriaLabel}
                  className="group inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted transition-colors duration-200 hover:text-accent"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 group-hover:text-accent">
                    {theme === "dark" ? (
                      <Sun aria-hidden="true" className="h-[15px] w-[15px]" />
                    ) : (
                      <Moon aria-hidden="true" className="h-[15px] w-[15px]" />
                    )}
                  </span>
                  <span>{themeToggleLabel}</span>
                </button>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
