"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { siteContent } from "@/lib/content";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

// Top-right menu. Collapsed state is just a two-bar hamburger icon. Expanded
// state covers the viewport with a frosted backdrop, a big-serif item list,
// and the theme toggle below a thin rule. Auto-closes on route change.
export function Menu() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme | null>(null);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const { items, ariaLabelOpen, ariaLabelClose } = siteContent.menu;

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

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* localStorage unavailable */
    }
  }, [theme]);

  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

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
        className="fixed right-4 top-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-[0_2px_16px_-6px_rgba(10,10,10,0.22)] backdrop-blur-md transition-colors duration-200 hover:text-accent md:right-6 md:top-6"
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
            className="fixed inset-0 z-50 flex flex-col bg-background/95 px-6 py-6 backdrop-blur-xl md:px-10 md:py-8"
          >
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg italic text-foreground">Aaron Sulbaran</span>
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
              className="flex flex-1 flex-col items-start justify-center gap-6 py-12 md:gap-8"
            >
              <ul className="flex flex-col gap-2 md:gap-4">
                {items.map((item, i) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="group relative flex items-start gap-4 focus:outline-none"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-3 text-[11px] font-medium uppercase tracking-caps text-muted md:mt-4"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="relative block overflow-hidden px-[0.04em] pb-[0.14em] font-serif text-[clamp(3.5rem,10vw,7rem)] italic leading-[1] tracking-tight">
                        <span className="block text-foreground transition-transform duration-[600ms] ease-[cubic-bezier(0.77,0,0.175,1)] group-hover:-translate-y-[110%] group-focus-visible:-translate-y-[110%]">
                          {item.label}
                        </span>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 flex translate-y-[110%] items-start px-[0.04em] pb-[0.14em] text-accent transition-transform duration-[600ms] ease-[cubic-bezier(0.77,0,0.175,1)] group-hover:translate-y-0 group-focus-visible:translate-y-0"
                        >
                          {item.label}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex w-full max-w-md items-center gap-6 border-t border-border/70 pt-6">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={themeLabel}
                  className="group inline-flex items-center gap-3 text-[11px] font-medium uppercase tracking-caps text-muted transition-colors duration-200 hover:text-accent"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 group-hover:text-accent">
                    {theme === "dark" ? (
                      <Sun aria-hidden="true" className="h-[15px] w-[15px]" />
                    ) : (
                      <Moon aria-hidden="true" className="h-[15px] w-[15px]" />
                    )}
                  </span>
                  <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                </button>
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
