import type { Page } from "@playwright/test";
import { scrollToY } from "./coil";
import { documentTop } from "./wave";

// Reading the playback pill on its dock (components/soundtrack/PlaybackPill,
// spec section 5). `armDock` installs a recorder before the page's own
// scripts run: one sample at every write to the pill's root or its inner
// wrapper (so the first frame of a tween, which GSAP renders inside the
// layout effect, is caught exactly) and one every `every` ms while recording.
// A deep load records from the first byte (`fromLoad`).

export const PILL = "[data-pill]";
export const CAPSULE = "[data-pill] .pill-hit";
export const SOUNDTRACK_KEY = "aaron-soundtrack";
export const GREETED_KEY = "aaron-soundtrack-greeted";

export type DockSample = {
  kind: "write" | "tick";
  t: number; // performance.now() in the page
  inert: boolean; // the root, so nothing inside is focusable
  shown: boolean; // the root's own opacity is 1 (the pill is out or on its way back)
  x: number; // the wrapper's centre, viewport px (transforms included)
  y: number;
  width: number;
  opacity: number; // the wrapper's computed opacity (the tween's)
  transform: string; // the wrapper's inline transform ("" at rest)
  computed: string; // the wrapper's computed transform ("none" at rest)
  text: string; // the capsule's open slots: the label line while it holds, else the capsule's text
};

type DockRecorder = {
  read: () => DockSample | null;
  start: (every: number) => void;
  stop: () => DockSample[];
};
type DockWindow = Window & { __e2eDock: DockRecorder };

export async function armDock(page: Page, { fromLoad = false }: { fromLoad?: boolean } = {}) {
  await page.addInitScript((fromLoad) => {
    const read = (kind: "write" | "tick" = "tick") => {
      const root = document.querySelector<HTMLElement>("[data-pill]");
      const wrapper = root?.firstElementChild as HTMLElement | null | undefined;
      const capsule = root?.querySelector<HTMLElement>(".pill-hit");
      if (!root || !wrapper || !capsule) return null;
      const r = wrapper.getBoundingClientRect();
      const style = getComputedStyle(wrapper);
      const text = [...capsule.children]
        .filter((el): el is HTMLElement => el instanceof HTMLElement && !!el.style.maxWidth && el.style.maxWidth !== "0px")
        .map((el) => el.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" | ");
      return {
        kind,
        t: performance.now(),
        inert: root.hasAttribute("inert"),
        shown: root.style.opacity === "1",
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        width: r.width,
        opacity: Number(style.opacity),
        transform: wrapper.style.transform,
        computed: style.transform,
        text,
      };
    };
    const samples: ReturnType<typeof read>[] = [];
    let recording = false;
    let id: ReturnType<typeof setInterval> | undefined;
    const take = (kind: "write" | "tick") => {
      if (!recording) return;
      const sample = read(kind);
      if (sample) samples.push(sample);
    };
    new MutationObserver((records) => {
      if (records.some((r) => r.target instanceof Element && r.target.matches("[data-pill], [data-pill] > div"))) take("write");
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ["style", "inert"] });
    const recorder = {
      read: () => read(),
      start(every: number) {
        samples.length = 0;
        recording = true;
        clearInterval(id);
        id = setInterval(() => take("tick"), every);
        take("tick");
      },
      stop() {
        recording = false;
        clearInterval(id);
        return samples.slice();
      },
    };
    Object.assign(window, { __e2eDock: recorder });
    if (fromLoad) recorder.start(50);
  }, fromLoad);
}

export const readDock = (page: Page) => page.evaluate(() => (window as unknown as DockWindow).__e2eDock.read());
export const dockText = async (page: Page) => (await readDock(page))?.text ?? null;
export const startDock = (page: Page, every = 50) => page.evaluate((every) => (window as unknown as DockWindow).__e2eDock.start(every), every);
export const stopDock = (page: Page) => page.evaluate(() => (window as unknown as DockWindow).__e2eDock.stop());

// The pill out, at rest on the dock: the root shown and reachable, the
// arrival's transform and opacity cleared.
export async function dockLanded(page: Page) {
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>("[data-pill]");
    const wrapper = root?.firstElementChild as HTMLElement | null | undefined;
    return (
      !!root &&
      !!wrapper &&
      !root.hasAttribute("inert") &&
      root.style.opacity === "1" &&
      !wrapper.style.transform &&
      getComputedStyle(wrapper).opacity === "1"
    );
  });
}

// Where the capsule sits, against where the dock says it should: the
// viewport's horizontal centre and the horizon's baseline (the probe's strip).
export async function dockGeometry(page: Page) {
  return page.evaluate(() => {
    const r = document.querySelector("[data-pill] .pill-hit")!.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      height: r.height,
      centre: document.documentElement.clientWidth / 2,
      baseline: window.__waveProbe!.strip()!.baseline,
    };
  });
}

export async function toAbout(page: Page) {
  await scrollToY(page, Math.round(await documentTop(page, "#about")));
}

// The band's visible control layer for a music state: "before" is Play it,
// "on" is Pause, "paused" is Resume.
export const bandControl = (page: Page, state: "before" | "on" | "paused") => page.locator(`#listen [data-control="${state}"]`);

export const bandLayerShown = (page: Page, state: "before" | "on" | "paused") =>
  page.evaluate((state) => !document.querySelector(`#listen [data-control="${state}"]`)!.closest("[inert]"), state);

export const storedChoice = (page: Page) => page.evaluate((key) => localStorage.getItem(key), SOUNDTRACK_KEY);
