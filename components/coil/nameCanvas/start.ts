import type { NameTarget } from "@/lib/coil/nameTarget";
import { PROFA } from "@/lib/home/lockup";
import { startFill, type FillHooks, type FillStats } from "../fill/engine";
import { createName, type NamePlacement } from "../scene/name";

// The page's name, drawn in its own small canvas (hero rework, slice 4d) by the
// fill every numbered page's title wears (../fill/engine.ts). The Coil's stage
// belongs to page 2 after the deal, so the name cannot live on it. What is the
// name's own here is its lettering: the lockup ("Hi, I'm" over "Aaron", one
// mask) painted and placed by the scene's name layer (scene/name.ts), its fades
// and the loader's landing on it.
//
// Reduced motion mounts none of this: the page's CSS fallback is the name then.

// Where the lockup sits in the canvas: the page's own h1 ([data-coil-name], whose
// [data-lockup-name] line is "Aaron") said where, as in the loader's landing.
function placeName(canvas: HTMLElement): NamePlacement | null {
  const heading = document.querySelector<HTMLElement>("[data-coil-name]");
  const line = heading?.querySelector<HTMLElement>("[data-lockup-name]");
  if (!heading || !line) return null;
  const size = parseFloat(getComputedStyle(heading).fontSize);
  const stage = canvas.getBoundingClientRect();
  const rect = line.getBoundingClientRect();
  if (!(size > 0) || rect.width <= 0) return null;
  return { left: rect.left - stage.left, baseline: rect.top - stage.top + PROFA.base * size, size };
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
    ({ ctx, gl, field, surface, glyphTargets, loop }) => {
      const { st } = ctx;
      const name = createName(ctx, gl, field.compMaterial, surface, glyphTargets, loop);
      return {
        name,
        ready: () =>
          Promise.race([
            document.fonts.load(`900 100px ${st.nameFamily}`).then(() => undefined),
            new Promise<void>((resolve) => window.setTimeout(resolve, 6000)),
          ]),
        layout: () => name.layoutName(placeName(canvas)),
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
