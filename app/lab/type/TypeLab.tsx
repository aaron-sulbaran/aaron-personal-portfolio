"use client";

import { useEffect } from "react";
import { ShownSettings } from "./context";
import { Panel } from "./Panel";
import { Specimen } from "./Specimen";
import { labAttributes, labVars } from "./settings";
import { flipView, useLab } from "./store";
import { BookRows } from "./fragments/BookRows";
import { CaseHeader } from "./fragments/CaseHeader";
import { FooterRow } from "./fragments/FooterRow";
import { Kickers } from "./fragments/Kickers";
import { ModalMeta } from "./fragments/ModalMeta";
import { NavBar } from "./fragments/NavBar";
import { PillStates } from "./fragments/PillStates";
import { SoundBand } from "./fragments/SoundBand";

// The bench: every fragment where small text lives, restyled from one panel.
// The settings land on this root as CSS variables plus three attributes
// (lab.css reads them); with every role off, the fragments are the site.
export function TypeLab({ month }: { month: string }) {
  const lab = useLab();
  const shown = lab.view === "a" && lab.a ? lab.a : lab.b;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "f" && event.key !== "F") return;
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("select, textarea, input:not([type=range]):not([type=checkbox])")) return;
      flipView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ShownSettings.Provider value={shown}>
    <div className="type-lab relative min-h-screen bg-background text-foreground" style={labVars(shown)} {...labAttributes(shown)}>
      <div className={`px-6 pb-24 pt-28 md:px-10 ${lab.collapsed ? "lg:pr-[200px]" : "lg:pr-[380px]"}`}>
        <Panel />
        <div className="mx-auto flex max-w-[1240px] flex-col">
          <Specimen index={1} title="Case page header" source="app/work/[slug]/page.tsx">
            <CaseHeader />
          </Specimen>
          <Specimen index={2} title="Soundtrack band" source="components/soundtrack/BandInvite.tsx, BandStage.tsx">
            <SoundBand />
          </Specimen>
          <Specimen index={3} title="Book rows" source="components/book/Book.tsx, BookRow.tsx">
            <BookRows />
          </Specimen>
          <Specimen index={4} title="Nav bar, Menu pill, menu foot" source="components/SiteNav.tsx, components/menu/">
            <NavBar />
          </Specimen>
          <Specimen index={5} title="Section kicker and label" source="components/AboutIntro.tsx, WhoIAm.tsx">
            <Kickers />
          </Specimen>
          <Specimen index={6} title="Playback pill" source="components/soundtrack/PlaybackPill.tsx, PillLabel.tsx">
            <PillStates />
          </Specimen>
          <Specimen index={7} title="Modal meta and close hint" source="components/WorkModal.tsx, PhotoModal.tsx">
            <ModalMeta />
          </Specimen>
          <Specimen index={8} title="Footer row" source="components/Footer.tsx">
            <FooterRow month={month} />
          </Specimen>
        </div>
      </div>
    </div>
    </ShownSettings.Provider>
  );
}
