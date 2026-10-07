"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Portal } from "@/components/Portal";
import { Fill } from "@/components/fx/Fill";
import { AsMark } from "@/components/menu/BrandMark";
import { ListenDot } from "@/components/menu/ListenDot";
import { MenuPanel } from "@/components/menu/MenuPanel";
import { siteContent } from "@/lib/content";
import { FILL_PICK } from "@/lib/fx/fill";
import { closeMenu, getMenuOpen, openMenu, takeAfterClose, useHeaderHidden, useMenuOpen } from "@/lib/menu";
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { EASE } from "@/lib/motion";
import { navigateToSection } from "@/lib/scroll";

// M1: the Menu pill top-right IS the menu. On desktop it grows (width and
// height, 600ms on the site ease, no overshoot) into a right-hand panel,
// max(440px, 34vw) wide and the viewport tall less 16px top and bottom, and
// "Close" lands exactly where "Menu" was. On a phone the pill stays put as
// Close and a bottom sheet (82dvh, 8px insets, a grip) rises under it. Either
// way the page dims under a scrim and the coil keeps moving; there is no blur
// on the panel. Closing runs 450ms.
//
// Layering (z scale in the scaffold): scrim 35, pill and panel 40, under the
// playback pill (45) and modals (50). The pill is layout-mounted as a direct
// child of <body>, so it is never inside a transformed ancestor; the scrim is
// Portaled. The sheet renders inside the pill so one focus trap covers Close
// and the links; that is sound because the pill drops its blur (a containing
// block for fixed children) the moment it engages, and never carries a
// transform while engaged.
type Phase = "closed" | "opening" | "open" | "closing";
type Frame = "panel" | "sheet";

const PHONE_MAX = 640;
const MENU_ID = "site-menu";

const isPhone = () => window.innerWidth < PHONE_MAX;
const panelWidth = () => Math.round(Math.max(440, window.innerWidth * 0.34));
const panelHeight = () => window.innerHeight - 32;

// The section the reader is in when the menu opens, for the accent dot beside
// its link. Only the home document has sections; other routes mark none.
function currentSectionHref(pathname: string): string | null {
  if (pathname !== "/") return null;
  const line = window.scrollY + window.innerHeight * 0.35;
  let here = "#main";
  for (const id of ["work", "about", "connect"]) {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top + window.scrollY <= line) here = `#${id}`;
  }
  return here;
}

export function MenuPill() {
  const open = useMenuOpen();
  const headerHidden = useHeaderHidden();
  const pathname = usePathname();
  const reducedMotion = !!useReducedMotion();
  const { pillLabel, closeLabel, ariaLabelOpen, ariaLabelClose, dialogLabel } = siteContent.menu;

  const [phase, setPhase] = useState<Phase>("closed");
  const [frame, setFrame] = useState<Frame>("panel");
  const [panelSize, setPanelSize] = useState({ w: 440, h: 600 });
  const [currentHref, setCurrentHref] = useState<string | null>(null);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<Phase>("closed");
  const closedSize = useRef({ w: 0, h: 40 });
  const running = useRef<{ stop: () => void } | null>(null);
  const runToken = useRef(0);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const engaged = phase !== "closed";
  const active = phase === "opening" || phase === "open";

  useBodyScrollLock(engaged);
  useEscapeKey(active, () => closeMenu());
  useFocusTrap(pillRef, active);

  const stopRunning = () => {
    runToken.current += 1;
    running.current?.stop();
    running.current = null;
  };

  const clearPillSize = () => {
    const pill = pillRef.current;
    if (!pill) return;
    pill.style.width = "";
    pill.style.height = "";
  };

  // Snap shut with no animation: a route change, or a resize across the
  // phone breakpoint while open.
  const hardReset = useCallback(() => {
    stopRunning();
    takeAfterClose();
    phaseRef.current = "closed";
    if (getMenuOpen()) closeMenu();
    clearPillSize();
    setPhase("closed");
  }, []);

  const onPillClick = () => {
    if (getMenuOpen()) {
      closeMenu();
      return;
    }
    if (phaseRef.current === "closed" && pillRef.current) {
      const rect = pillRef.current.getBoundingClientRect();
      closedSize.current = { w: rect.width, h: rect.height };
    }
    openMenu();
  };

  // The store is the intent; the phase is where the choreography stands.
  // Layout effect so the frame and the panel size land before first paint.
  useLayoutEffect(() => {
    const current = phaseRef.current;
    if (open && (current === "closed" || current === "closing")) {
      setFrame(isPhone() ? "sheet" : "panel");
      setPanelSize({ w: panelWidth(), h: panelHeight() });
      setCurrentHref(currentSectionHref(window.location.pathname));
      go("opening");
    } else if (!open && (current === "opening" || current === "open")) {
      go("closing");
    }
  }, [open, go]);

  useLayoutEffect(() => {
    if (phase !== "opening" && phase !== "closing") return;
    stopRunning();
    const token = runToken.current;
    const settle = (next: Phase) => () => {
      if (token !== runToken.current) return;
      go(next);
    };

    if (frame === "panel") {
      const pill = pillRef.current;
      if (!pill) return;
      if (phase === "opening") {
        if (!pill.style.width) {
          pill.style.width = `${closedSize.current.w}px`;
          pill.style.height = `${closedSize.current.h}px`;
        }
        const controls = animate(
          pill,
          { width: panelSize.w, height: panelSize.h },
          { duration: reducedMotion ? 0 : 0.6, ease: EASE },
        );
        running.current = controls;
        controls.then(settle("open"));
      } else {
        const controls = animate(
          pill,
          { width: closedSize.current.w, height: closedSize.current.h },
          reducedMotion ? { duration: 0, delay: 0.2 } : { duration: 0.45, delay: 0.08, ease: EASE },
        );
        running.current = controls;
        controls.then(settle("closed"));
      }
      return;
    }

    const sheet = sheetRef.current;
    if (!sheet) return;
    const shown = { transform: "translateY(0%)", opacity: 1 };
    const away = reducedMotion
      ? { transform: "translateY(0%)", opacity: 0 }
      : { transform: "translateY(104%)", opacity: 1 };
    const controls =
      phase === "opening"
        ? animate(sheet, shown, reducedMotion ? { duration: 0.2 } : { duration: 0.6, ease: EASE })
        : animate(sheet, away, reducedMotion ? { duration: 0.2 } : { duration: 0.45, delay: 0.06, ease: EASE });
    running.current = controls;
    controls.then(settle(phase === "opening" ? "open" : "closed"));
  }, [phase, frame, panelSize, reducedMotion, go]);

  // The pill returns to its natural width in the same commit that restores
  // the Listen dot and the Menu label, so no frame shows a stale size.
  useLayoutEffect(() => {
    if (phase === "closed") clearPillSize();
  }, [phase]);

  // Once shut and the scroll lock is released (its cleanup ran in this same
  // commit), run whatever the close was for: two frames later, so a section
  // jump scrolls an unlocked body.
  useEffect(() => {
    if (phase !== "closed") return;
    const after = takeAfterClose();
    if (!after) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(after);
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [phase]);

  // Close on route change.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (phaseRef.current !== "closed" || getMenuOpen()) hardReset();
  }, [pathname, hardReset]);

  // A resize while open refits the panel; crossing the phone breakpoint
  // closes outright rather than morphing between frames.
  useEffect(() => {
    if (!engaged) return;
    const onResize = () => {
      if (isPhone() !== (frame === "sheet")) {
        hardReset();
        return;
      }
      if (frame !== "panel") return;
      const next = { w: panelWidth(), h: panelHeight() };
      setPanelSize(next);
      if (phaseRef.current === "open" && pillRef.current) {
        pillRef.current.style.width = `${next.w}px`;
        pillRef.current.style.height = `${next.h}px`;
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [engaged, frame, hardReset]);

  useEffect(() => stopRunning, []);

  const onNavigate = (href: string) => {
    closeMenu(() => navigateToSection(href, reducedMotion));
  };

  const tucked = headerHidden && !engaged;
  const asPanel = engaged && frame === "panel";
  const surface = !engaged
    ? "bg-[var(--menu-pill)] backdrop-blur-[8px] [box-shadow:inset_0_0_0_1px_var(--color-border)]"
    : asPanel
      ? "bg-[var(--menu-panel)] [box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)]"
      : "bg-[var(--menu-panel)] [box-shadow:inset_0_0_0_1px_var(--color-border)]";
  const stage = phase === "closing" ? "out" : "in";

  return (
    <>
      <div
        ref={pillRef}
        data-menu-pill
        role={engaged ? "dialog" : undefined}
        aria-modal={engaged ? true : undefined}
        aria-label={engaged ? dialogLabel : undefined}
        className={`fixed right-[calc(12px+var(--scrollbar-comp))] top-3 z-40 min-h-10 rounded-[20px] text-foreground transition-transform duration-[450ms] ease-[cubic-bezier(0.22,1,0.36,1)] sm:right-[calc(20px+var(--scrollbar-comp))] sm:top-4 ${surface} ${
          engaged ? "overflow-hidden" : ""
        } ${tucked ? "-translate-y-[90px] focus-within:translate-y-0" : ""}`}
      >
        <div className="relative z-[2] flex h-10 items-center justify-end">
          <ListenDot hidden={engaged} />
          <Fill
            {...FILL_PICK.menu}
            onClick={onPillClick}
            aria-label={open ? ariaLabelClose : ariaLabelOpen}
            aria-expanded={open}
            aria-controls={MENU_ID}
            data-cursor-hover
            className={`flex h-10 items-center rounded-full pr-[17px] font-label text-label focus-visible:rounded-full focus-visible:outline-offset-[-3px] ${
              engaged ? "pl-[14px]" : "pl-1.5"
            }`}
            overClassName={`flex items-center pr-[17px] ${engaged ? "pl-[14px]" : "pl-1.5"}`}
          >
            <span aria-hidden="true" data-fill-icon className="relative grid h-[22px] overflow-hidden">
              <span
                className={`col-start-1 row-start-1 block h-[22px] overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  engaged ? "-translate-y-[110%]" : ""
                }`}
              >
                <span className="fx-odometer block">
                  <span className="flex h-[22px] items-center justify-end text-accent">{pillLabel}</span>
                  <span className="flex h-[22px] items-center justify-center">
                    <AsMark fit="tight" className="h-[22px] w-[15px]" />
                  </span>
                </span>
              </span>
              <span
                className={`col-start-1 row-start-1 flex h-[22px] items-center justify-end text-accent transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  engaged ? "" : "translate-y-[110%]"
                }`}
              >
                {closeLabel}
              </span>
            </span>
          </Fill>
        </div>

        {asPanel && (
          <MenuPanel
            id={MENU_ID}
            frame="panel"
            stage={stage}
            width={panelSize.w}
            heightCss={`${panelSize.h}px`}
            currentHref={currentHref}
            reducedMotion={reducedMotion}
            onNavigate={onNavigate}
          />
        )}

        {engaged && frame === "sheet" && (
          <div
            ref={sheetRef}
            style={reducedMotion ? { opacity: 0 } : { transform: "translateY(104%)" }}
            className="fixed bottom-2 left-2 right-2 h-[82vh] rounded-[26px] bg-[var(--menu-panel)] [box-shadow:inset_0_0_0_1px_var(--color-border),var(--menu-shadow)] supports-[height:100dvh]:h-[82dvh]"
          >
            <span aria-hidden="true" className="absolute left-1/2 top-2.5 -ml-[18px] h-1 w-9 rounded-sm bg-border" />
            <MenuPanel
              id={MENU_ID}
              frame="sheet"
              stage={stage}
              heightCss="82dvh"
              currentHref={currentHref}
              reducedMotion={reducedMotion}
              onNavigate={onNavigate}
            />
          </div>
        )}
      </div>

      {engaged && (
        <Portal>
          <motion.div
            aria-hidden="true"
            onClick={() => closeMenu()}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "closing" ? 0 : 1 }}
            transition={
              phase === "closing"
                ? { duration: reducedMotion ? 0.2 : 0.45, delay: reducedMotion ? 0 : 0.08, ease: "easeOut" }
                : { duration: reducedMotion ? 0.2 : 0.6, ease: "easeOut" }
            }
            className="fixed inset-0 z-[35] bg-[var(--menu-scrim)]"
          />
        </Portal>
      )}
    </>
  );
}
