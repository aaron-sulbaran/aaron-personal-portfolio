import { PROFA } from "@/lib/home/lockup";

// Where the page's first screen put the things the scene draws for it (slice
// 4c): the name, the ribbon's row and the patches of text the field fades away
// behind. The page owns the layout (components/home/FirstScreen.tsx, CSS and
// knobs); the scene reads three kinds of marker once per layout and on a
// resize, never in a frame:
//
//   [data-coil-name]    the h1's lockup: its font size and its name line, the
//                       canvas draws the same lockup on the same ink
//   [data-coil-ribbon]  the ribbon's slot: the row's center
//   [data-hush]         a block of body text: the field fades behind it
//
// Everything is in the canvas's CSS px and measured against the rail the stage
// sticks in, not the stage: the stage is stuck at the top of the screen from the
// page's first pixel, so the rail's top is where the stage would sit were the
// page not scrolled, and a layout done while the page is scrolled still puts
// the name where the first screen has it. The same page with none of the
// markers (a page that has no first screen) measures as nothing.

export type Rect = { x0: number; y0: number; x1: number; y1: number };

export type FirstScreenBox = {
  // The name's pen start, its baseline and its font size.
  name: { left: number; baseline: number; size: number } | null;
  // The ribbon's center, from the canvas's top.
  ribbonCy: number | null;
  hush: Rect[];
  // The Coil's own region in a stage taller than it (a phone's), from the canvas's top.
  regionHeight: number | null;
};

// The hush reaches this far past the text's box, px, before its edge softens.
export const HUSH_PAD_PX = 14;
// At most this many patches (the composite's uniforms).
export const HUSH_MAX = 2;

export const NO_FIRST_SCREEN: FirstScreenBox = { name: null, ribbonCy: null, hush: [], regionHeight: null };

export function measureFirstScreen(host: HTMLElement): FirstScreenBox {
  const rail = host.closest("[data-coil-rail]")?.getBoundingClientRect();
  const stage = host.getBoundingClientRect();
  if (!rail) return NO_FIRST_SCREEN;
  const nameEl = document.querySelector<HTMLElement>("[data-coil-name]");
  const lineEl = nameEl?.querySelector<HTMLElement>("[data-lockup-name]");
  const nameRect = nameEl?.getBoundingClientRect();
  const lineRect = lineEl?.getBoundingClientRect();
  const size = nameEl ? parseFloat(getComputedStyle(nameEl).fontSize) : 0;
  const name =
    nameEl && nameRect && lineRect && nameRect.width > 0 && size > 0
      ? { left: lineRect.left - stage.left, baseline: lineRect.top - rail.top + PROFA.base * size, size }
      : null;
  const slot = document.querySelector("[data-coil-ribbon]")?.getBoundingClientRect();
  const ribbonCy = slot && slot.height > 0 ? slot.top + slot.height / 2 - rail.top : null;
  const hush: Rect[] = [];
  document.querySelectorAll("[data-hush]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || hush.length >= HUSH_MAX) return;
    hush.push({
      x0: r.left - stage.left - HUSH_PAD_PX,
      y0: r.top - rail.top - HUSH_PAD_PX,
      x1: r.right - stage.left + HUSH_PAD_PX,
      y1: r.bottom - rail.top + HUSH_PAD_PX,
    });
  });
  const frame = host.closest("[data-coil-frame]")?.getBoundingClientRect();
  return { name, ribbonCy, hush, regionHeight: frame && frame.height > 0 ? frame.height : null };
}
