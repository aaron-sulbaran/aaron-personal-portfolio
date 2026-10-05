"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { syncThemeColorMeta, type Theme } from "@/lib/theme";
import { WorkModalCopy, ConnectCopy } from "./copies/Calls";
import { CoilBandToggle, HeroStage, WorkAndPhotos } from "./copies/Hero";
import { MenuChipCopy, MenuPillCopy, NavBarCopy } from "./copies/Menu";
import { BandCopy, CapsuleCopy, type CapsuleState } from "./copies/Playback";
import type { MusicState } from "./NoteGlyph";
import { NoteGallery, NoteInPlace } from "./NoteSection";
import { Panel, type View } from "./Panel";
import { INITIAL, labVars, type Settings } from "./settings";
import { Caption, Specimen } from "./ui";

// The bench: faithful static copies of the site's controls, each at its real
// size, restyled from one panel. Clicking a control only flips its own demo
// state; nothing here plays audio, reads a site store or draws WebGL.

const INITIAL_VIEW: View = { scrubOn: false, scrub: 0.5, reduce: false, moving: true, music: "on", cycle: false, collapsed: false };
const CYCLE: readonly MusicState[] = ["off", "on", "paused"];

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

export function ControlsLab() {
  const [s, setS] = useState<Settings>(INITIAL);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as Theme);
  const [nav, setNav] = useState("work");
  const [capsule, setCapsule] = useState<CapsuleState>("before");
  const edit = (update: (x: Settings) => Settings) => setS(update);

  useEffect(() => {
    if (!view.cycle) return;
    const id = window.setInterval(() => {
      setView((v) => ({ ...v, music: CYCLE[(CYCLE.indexOf(v.music) + 1) % CYCLE.length] }));
    }, 1600);
    return () => window.clearInterval(id);
  }, [view.cycle]);

  const c = s.controls;
  const note = { noteKey: s.note, anim: s.noteAnim, music: view.music };
  const capsuleCycle: Record<CapsuleState, CapsuleState> = { before: "on", on: "paused", paused: "on", off: "on" };

  return (
    <div
      className="controls-lab relative min-h-screen bg-background text-foreground"
      style={labVars(s, view.scrubOn ? view.scrub : null)}
      data-scrub={view.scrubOn ? "" : undefined}
      data-reduce={view.reduce ? "" : undefined}
      data-arrow-swap={s.arrowSwap ? "on" : "off"}
    >
      <div className={`px-6 pb-24 pt-28 md:px-10 ${view.collapsed ? "" : "lg:pr-[380px]"}`}>
        <Panel s={s} view={view} theme={theme} edit={edit} setView={setView} setTheme={setTheme} />
        <div className="mx-auto flex max-w-[1080px] flex-col">
          <Specimen
            index="1a"
            title="Menu pill, chips and nav links"
            source="components/menu/MenuPill.tsx, ListenDot.tsx, MenuPanel.tsx; components/SiteNav.tsx"
            note="The Listen dot always fills from its own note; the Menu label rolls to the mark on the fill's clock."
          >
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center gap-8">
                <MenuPillCopy fill={c.menu} note={note} />
                <div className="flex gap-2.5 rounded-xl bg-[var(--menu-panel)] p-3 [box-shadow:inset_0_0_0_1px_var(--color-border)]">
                  <MenuChipCopy fill={c.menu} kind="theme" label="Dark mode" />
                  <MenuChipCopy fill={c.menu} kind="music" note={note} label="Soundtrack on" />
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl [box-shadow:inset_0_0_0_1px_var(--color-border)]">
                <NavBarCopy fill={c.nav} active={nav} onPick={setNav} />
              </div>
            </div>
          </Specimen>

          <Specimen
            index="1b"
            title="Playback capsule and band controls"
            source="components/soundtrack/PlaybackPill.tsx, PillParts.tsx, BandInvite.tsx"
            note="The capsule fills from its glyph. The band's links keep today's underline at rest; the rise grows the fill out of it."
          >
            <div className="flex flex-col gap-10">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  {(["before", "on", "paused", "off"] as const).map((state) => (
                    <CapsuleCopy key={state} fill={c.capsule} state={state} noteKey={s.note} anim={s.noteAnim} />
                  ))}
                  <span className="mx-2 h-6 w-px bg-border" />
                  <CapsuleCopy fill={c.capsule} state={capsule} noteKey={s.note} anim={s.noteAnim} onClick={() => setCapsule((x) => capsuleCycle[x])} />
                </div>
                <Caption>Before a choice, playing, paused, declined; the last one is live (click it).</Caption>
              </div>
              <BandCopy fill={c.band} />
            </div>
          </Specimen>

          <Specimen
            index="1c, 1d"
            title="Hero: Work and photos, and the Coil and Band toggle"
            source="components/coil/HeroOverlay.tsx (bottom left, over the scene); the toggle is new"
            note="Over a stand-in scene: the poster field with real photo cards drifting across it. Click Band and Coil to watch the fill carry the state; hover the other side to see it lean."
          >
            <HeroStage moving={view.moving}>
              <WorkAndPhotos fill={c.hero} surface={s.heroSurface} />
              <CoilBandToggle fill={c.hero} surface={s.heroSurface} glyphs={s.toggleGlyphs} />
            </HeroStage>
          </Specimen>

          <Specimen index="1e" title="Work modal call to action and Connect" source="components/WorkModal.tsx, components/Connect.tsx">
            <div className="flex flex-col gap-12">
              <WorkModalCopy fill={c.cta} />
              <ConnectCopy fill={c.connect} />
            </div>
          </Specimen>

          <Specimen
            index="2a"
            title="The note in place"
            source="components/menu/NoteIcon.tsx in ListenDot, PillParts (DockGlyph) and the MenuPanel chip"
            note="The panel's off, on and paused drive the top row; the rows under it hold every state. Real sizes: the note box is 20px, its ink about 15px tall, like today's."
          >
            <NoteInPlace {...note} dark={theme === "dark"} menuFill={c.menu} capsuleFill={c.capsule} onMusic={(music) => setView((v) => ({ ...v, music, cycle: false }))} />
          </Specimen>

          <Specimen index="2b" title="Every note" source="app/lab/controls/notes.tsx" note="At 72px with the chosen animation, then 14, 16, 20 and 24px. Click one to pick it.">
            <NoteGallery noteKey={s.note} anim={s.noteAnim} music={view.music} onPick={(key) => edit((x) => ({ ...x, note: key }))} />
          </Specimen>
        </div>
      </div>
    </div>
  );
}
