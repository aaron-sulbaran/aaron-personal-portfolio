"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { syncThemeColorMeta, type Theme } from "@/lib/theme";
import { FOOTER_COPY } from "./content";
import type { BackdropKind } from "./FieldBackdrop";
import { FooterStage, type Readout } from "./FooterStage";
import { Panel, type View } from "./Panel";
import { useFooterSettings } from "./useFooterSettings";
import { useTypeface } from "./useTypeface";

// The bench: a stretch of page standing in for Connect, then the footer at
// the bottom, so scrolling down shows the rise the way a visitor meets it.
// The panel tunes it; "Copy values" hands Aaron's pick back as JSON.

function subscribeTheme(listener: () => void) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  syncThemeColorMeta(theme);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function FooterLab() {
  const [s, setS] = useFooterSettings();
  const [view, setView] = useState<View>({ reduce: false, forceStandIn: false, collapsed: false });
  const [backdrop, setBackdrop] = useState<BackdropKind | null>(null);
  const [readout, setReadout] = useState<Readout>({ sizePx: 0, spanPct: 0, stageWidth: 0, croppedPct: 0, fittedVw: null });
  const [replay, setReplay] = useState(0);
  const [drop, setDrop] = useState(0);
  const typeface = useTypeface(FOOTER_COPY.wordmark, s.face, s.font);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const systemReduced = usePrefersReducedMotion();
  const reduced = view.reduce || systemReduced;
  const onBackdrop = useCallback((kind: BackdropKind) => setBackdrop(kind), []);
  const onReadout = useCallback((r: Readout) => setReadout(r), []);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className={view.collapsed ? "" : "lg:pr-[372px]"}>
        <div className="flex min-h-[70vh] flex-col justify-end gap-4 px-6 pb-20 pt-28 md:px-10">
          <p className="text-[12px] text-muted [font-family:system-ui]">Footer lab. Scroll down: the wordmark rises the first time the footer is seen. Replay it from the panel.</p>
          <h2 className="font-display text-section">{FOOTER_COPY.heading}</h2>
          <p className="max-w-md text-muted">The end of Connect sits here on the site; the footer follows it.</p>
        </div>
        <FooterStage s={s} typeface={typeface} theme={theme} reduced={reduced} replay={replay} drop={drop} backdrop={s.field.on ? backdrop : null} forceStandIn={view.forceStandIn} onBackdrop={onBackdrop} onReadout={onReadout} />
      </div>
      <Panel
        s={s}
        typeface={typeface}
        view={view}
        theme={theme}
        backdrop={backdrop}
        readout={readout}
        systemReduced={systemReduced}
        edit={setS}
        setView={setView}
        setTheme={setTheme}
        onReplay={() => setReplay((n) => n + 1)}
        onDrop={() => setDrop((n) => n + 1)}
      />
    </div>
  );
}
