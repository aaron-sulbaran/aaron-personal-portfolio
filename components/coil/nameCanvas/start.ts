import { firstText, lineAnchors, paintedBaseline, textPx } from "@/lib/coil/lineAnchor";
import type { NameTarget } from "@/lib/coil/nameTarget";
import type { DrawnBox } from "@/lib/coil/pixelGrid";
import { startFill, type FillHooks, type FillStats } from "../fill/engine";
import { createName, type LinePlacement, type NamePlacement } from "../scene/name";

// The page's name, drawn in its own small canvas (hero rework, slice 4d) by the
// fill every numbered page's title wears (../fill/engine.ts). The Coil's stage
// belongs to page 2 after the deal, so the name cannot live on it. What is the
// name's own here is its lettering: the lockup ("Hi, I'm" over "Aaron", one
// mask) painted and placed by the scene's name layer (scene/name.ts), its fades
// and the loader's landing on it.
//
// Reduced motion mounts none of this: the page's CSS fallback is the name then.

// Where the lockup sits in the canvas: where the page's own h1 ([data-coil-name])
// paints its two lines, read off its layout (lib/coil/lineAnchor.ts), so the
// canvas draws the page's own glyphs on the page's own pixels: the loader's
// lockup lands there as the h1, and a jump back finds the h1 there.
function placeName(box: DrawnBox): NamePlacement | null {
  const heading = document.querySelector<HTMLElement>("[data-coil-name]");
  const lines = [heading?.querySelector<HTMLElement>("[data-lockup-name]"), heading?.querySelector<HTMLElement>(".name-lockup__greet")];
  const texts = lines.map((line) => (line ? firstText(line) : null));
  if (!heading || !texts[0] || !texts[1]) return null;
  const anchors = lineAnchors([texts[0], texts[1]]);
  const perPx = textPx(box.dpr);
  const place = (i: number): LinePlacement | null => {
    const at = anchors[i];
    const size = parseFloat(getComputedStyle(lines[i]!).fontSize);
    if (!at || !(size > 0)) return null;
    return { pen: at.x - box.left, baseline: paintedBaseline(at, window.scrollY, perPx) - box.top, size };
  };
  const name = place(0);
  const greeting = place(1);
  if (!name || !greeting) return null;
  return { name, greeting, corner: { left: box.left, top: box.top }, heading };
}

export type NameCanvasHooks = FillHooks;

export type NameCanvasRuntime = {
  // The lockup in viewport px for the loader to land on; null until laid out.
  nameRect: () => NameTarget | null;
  // Shows the lockup now, drawing this frame synchronously (the loader goes in the same task).
  landName: () => boolean;
  // Lays out again at the canvas's size now (the page reflowed).
  relayout: () => void;
  dispose: () => void;
  // QA: frames drawn, whether the loop is running, the surface's clock (s) and whether the pointer's wake is live.
  stats: () => FillStats & { landed: boolean };
};

// compileAsync: a name made away from the loader (the reader scrolled back up
// to page 1) compiles off the main thread; the loader's own landing compiles
// at once, as it always has, so its timing is the one it was tuned on.
export function startNameCanvas(canvas: HTMLCanvasElement, hooks: NameCanvasHooks, { compileAsync = false } = {}): NameCanvasRuntime {
  const fill = startFill(
    canvas,
    ({ ctx, gl, field, surface, glyphTargets, loop, box }) => {
      const { st } = ctx;
      const name = createName(ctx, gl, field.compMaterial, surface, glyphTargets, loop);
      return {
        name,
        ready: () =>
          Promise.race([
            document.fonts.load(`900 100px ${st.nameFamily}`).then(() => undefined),
            new Promise<void>((resolve) => window.setTimeout(resolve, 6000)),
          ]),
        layout: () => name.layoutName(placeName(box())),
        fade: (now: number) => name.entranceFade({ now, nameFromLoader: false }),
        step: (dt: number) => name.step({ dt, listProgress: 0 }),
        renderSurface: (dt: number) => name.renderSurface({ dt }),
        scenes: () => [name.reductionScene],
        observe: () => [document.querySelector("[data-coil-name]")].filter((el): el is Element => el !== null),
        dispose: () => name.dispose(),
      };
    },
    hooks,
    { compileAsync },
  );
  const { name } = fill.lettering;
  return {
    nameRect: name.nameRect,
    landName: name.landName,
    relayout: fill.relayout,
    dispose: fill.dispose,
    stats: () => ({ ...fill.stats(), landed: name.landed() }),
  };
}
