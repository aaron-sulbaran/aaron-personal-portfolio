"use client";

import { useState, type CSSProperties, type MouseEvent } from "react";
import { motion, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { Moon, Snowflake, Sun } from "lucide-react";
import { Fill } from "@/components/fx/Fill";
import { MvpUnfurl } from "@/components/quick/MvpUnfurl";
import { siteContent } from "@/lib/content";
import { quickCopy } from "@/lib/content/quick";
import { closeMenu } from "@/lib/menu";
import { EXPRESS_PATH, HOME_PATH } from "@/lib/quick/transition";
import { goTo } from "@/lib/quick/transitionStore";
import { FILL_PICK } from "@/lib/fx/fill";
import { EASE } from "@/lib/motion";
import { THEME_STORAGE_KEY, syncThemeColorMeta, type Theme } from "@/lib/theme";
import { setFrozen, useFrozen } from "@/lib/waveform/freeze";

// The menu's content: the four pages in the display face, each with its number
// (01 to 04), a third of the way down, then the foot: the theme and wave freeze
// chips (the settings), the MVP on a line of its own, and the contact row. (The
// freeze is here so a phone with no music playing, which has no pill, can stop
// the wave too.) The MVP line is set like the email link; on a fine pointer its
// "MVP" unfurls to "Minimum Viable Portfolio" in place, with nothing beside it to
// cover (components/quick/MvpUnfurl), and where nothing unfurls a quiet note
// beside it spells the name out. On the MVP page the way home holds that line,
// so the Menu keeps one shape on both pages. MenuPill mounts it in one of two
// frames: inside the pill as it grows into the right-hand panel (desktop), or in
// the bottom sheet (phone). It animates only its own children; the frame's
// motion belongs to MenuPill.
//
// `stage` drives the choreography: "in" staggers the links up (60ms apart)
// and the footer after them; "out" fades everything quickly so the frame can
// shrink or slide away behind it.
export type MenuPanelStage = "in" | "out";

const linkVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  in: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EASE, delay: 0.2 + i * 0.06 },
  }),
  out: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" } },
};

const footVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  in: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 0.42 } },
  out: { opacity: 0, y: -8, transition: { duration: 0.16, ease: "easeIn" } },
};

const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  in: { opacity: 1, transition: { duration: 0.2 } },
  out: { opacity: 0, transition: { duration: 0.2 } },
};

// The foot's text links (the MVP line, the email, the socials): the label face's accent, deepening on hover.
const FOOT_LINK_CLASS = "text-accent transition-colors duration-200 hover:text-accent-hover";

// A plain click closes the Menu and then runs the page transition; a modified click opens the link as the browser would.
const closeThenGo = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  closeMenu(() => goTo(href));
};

export function MenuPanel({
  id,
  frame,
  stage,
  heightCss,
  width,
  currentHref,
  reducedMotion,
  onNavigate,
}: {
  id: string;
  frame: "panel" | "sheet";
  stage: MenuPanelStage;
  // The frame's height as a CSS length; the links start at 33 percent of it.
  heightCss: string;
  // The panel frame's fixed width in px (the pill grows around it); unused by
  // the sheet, which fills its frame.
  width?: number;
  currentHref: string | null;
  reducedMotion: boolean;
  onNavigate: (href: string) => void;
}) {
  const { items, themeToggleToDark, themeToggleToLight, themeAriaLabelToDark, themeAriaLabelToLight, email, socials, freeze, unfreeze } =
    siteContent.menu;
  const frozen = useFrozen();
  // The panel only ever mounts on the client (after a click), so it can read
  // the live theme straight off <html>.
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
  );
  const onQuick = usePathname() === EXPRESS_PATH;

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    syncThemeColorMeta(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  const link = reducedMotion ? fadeVariants : linkVariants;
  const foot = reducedMotion ? fadeVariants : footVariants;
  const sheet = frame === "sheet";

  return (
    <div
      id={id}
      className={`flex flex-col overflow-y-auto overscroll-contain ${
        sheet ? "absolute inset-0 px-6 pb-6 pt-7" : "absolute right-0 top-0 px-8 py-7"
      }`}
      style={{ "--menu-h": heightCss, ...(sheet ? {} : { width, height: heightCss }) } as CSSProperties}
    >
      <div aria-hidden="true" className="min-h-0 shrink" style={{ flexBasis: "calc(0.33 * var(--menu-h) - 28px)" }} />
      <nav aria-label={siteContent.menu.navAriaLabel} className="shrink-0">
        <ul className="flex flex-col gap-[2px]">
          {items.map((item, i) => {
            const here = item.href === currentHref;
            return (
              <li key={item.key}>
                <motion.a
                  href={item.href}
                  custom={i}
                  variants={link}
                  initial="hidden"
                  animate={stage}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.href);
                  }}
                  aria-current={here ? "location" : undefined}
                  data-cursor-hover
                  className={`group/link relative flex w-max items-baseline font-display leading-[1.02] tracking-[-0.01em] text-foreground transition-colors duration-[250ms] hover:text-accent focus-visible:text-accent ${
                    sheet ? "text-[52px]" : "text-[52px] sm:text-[60px]"
                  }`}
                >
                  <span aria-hidden="true" data-menu-number="" className="absolute right-full top-[0.52em] mr-1.5 font-label text-label-sm tabular-nums text-muted">
                    {item.number}
                  </span>
                  <span
                    className={`inline-block transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/link:translate-x-1.5 ${
                      here
                        ? "after:ml-3 after:inline-block after:h-2 after:w-2 after:rounded-full after:bg-accent after:align-[0.5em] after:content-['']"
                        : ""
                    }`}
                  >
                    {item.label}
                  </span>
                </motion.a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div aria-hidden="true" className="min-h-10 flex-1" />
      <motion.div
        variants={foot}
        initial="hidden"
        animate={stage}
        className="flex shrink-0 flex-col gap-[18px] border-t border-border pt-5"
      >
        <div className="flex flex-wrap gap-2.5">
          <Fill
            {...FILL_PICK.menu}
            onClick={toggleTheme}
            aria-label={theme === "dark" ? themeAriaLabelToLight : themeAriaLabelToDark}
            data-cursor-hover
            className="inline-flex h-[34px] items-center gap-2 rounded-[17px] pl-2.5 pr-3.5 font-label text-label text-accent shadow-[inset_0_0_0_1px_var(--color-border)]"
            overClassName="flex items-center gap-2 pl-2.5 pr-3.5"
          >
            <span data-fill-icon className="relative -top-px flex h-4 w-4 items-center justify-center">
              {theme === "dark" ? (
                <Sun aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
              ) : (
                <Moon aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
              )}
            </span>
            <span>{theme === "dark" ? themeToggleToLight : themeToggleToDark}</span>
          </Fill>
          {!reducedMotion && (
            <Fill
              {...FILL_PICK.menu}
              onClick={() => setFrozen(!frozen)}
              aria-pressed={frozen}
              data-cursor-hover
              data-menu-freeze=""
              className="inline-flex h-[34px] items-center gap-2 rounded-[17px] pl-2.5 pr-3.5 font-label text-label text-accent shadow-[inset_0_0_0_1px_var(--color-border)]"
              overClassName="flex items-center gap-2 pl-2.5 pr-3.5"
            >
              <span data-fill-icon className="relative -top-px flex h-4 w-4 items-center justify-center">
                <Snowflake aria-hidden="true" className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <span>{frozen ? unfreeze : freeze}</span>
            </Fill>
          )}
        </div>
        {/* One line, one link. The short word holds the line; under a fine pointer the full name is drawn over the empty line to its
            right, so nothing in the foot moves. Elsewhere the note (hidden under a fine pointer, globals.css "The MVP unfurl") sits
            beside it, or under it if the line is ever too narrow. */}
        <div data-menu-mvp-line="" className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 font-label text-label">
          {onQuick ? (
            <a href={HOME_PATH} onClick={closeThenGo(HOME_PATH)} data-cursor-hover data-menu-home="" className={FOOT_LINK_CLASS}>
              {quickCopy.back}
            </a>
          ) : (
            <>
              <a
                href={EXPRESS_PATH}
                onClick={closeThenGo(EXPRESS_PATH)}
                aria-label={quickCopy.menuLinkName}
                data-cursor-hover
                data-mvp-link=""
                data-menu-mvp=""
                className={FOOT_LINK_CLASS}
              >
                <MvpUnfurl overlay />
              </a>
              <span aria-hidden="true" data-menu-mvp-note="" className="mvp-note text-label-sm text-muted">
                {quickCopy.menuLinkNote}
              </span>
            </>
          )}
        </div>
        <div
          className={`flex font-label text-label ${
            sheet ? "flex-col gap-2.5" : "flex-wrap justify-between gap-x-5 gap-y-2.5"
          }`}
        >
          <a href={email.href} data-cursor-hover className={FOOT_LINK_CLASS}>
            {email.label}
          </a>
          <span className="flex gap-4">
            {socials.map((social) => (
              <a
                key={social.key}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-hover
                className={FOOT_LINK_CLASS}
              >
                {social.label}
              </a>
            ))}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
