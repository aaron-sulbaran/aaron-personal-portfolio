import { budgetFor, sameBudget } from "@/lib/coil/drivers";
import { emptySource, loadStrandSource, type CardSource } from "@/lib/coil/textures";
import type { Cards } from "./cards";
import type { LoopLink, SceneCtx } from "./state";

// The scene's start: the name's face and every card's source (each within
// a give-up time), then the theme, every card painted, the first layout and
// the first frame. And the budget's
// resync when the input driver changes.

const TEXTURE_TIMEOUT_MS = 6000; // the give-up time: a slow photo paints the plain pane

type BootParts = {
  applyTheme: () => void;
  layout: (width: number, height: number) => void;
  // fx-flight: the flown canvas made ahead of the first click.
  warm: () => void;
};

export function boot(ctx: SceneCtx, cards: Cards, parts: BootParts, loop: LoopLink) {
  const { st, host, live, tiles } = ctx;
  // ---- boot: the name's face and every card's sources, then the first frame
  const style = getComputedStyle(document.documentElement);
  st.nameFamily = style.getPropertyValue("--font-display").trim() || "sans-serif";
  const withTimeout = <T,>(promise: Promise<T>, fallback: T) =>
    Promise.race([promise, new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), TEXTURE_TIMEOUT_MS))]);
  Promise.all([
    withTimeout(
      document.fonts.load(`900 100px ${st.nameFamily}`).then(() => undefined),
      undefined,
    ),
    Promise.all(
      tiles.map((tile) =>
        withTimeout<CardSource>(loadStrandSource(tile, st.budget.textureSize), emptySource(tile)),
      ),
    ),
  ])
    .then(([, loaded]) => {
      if (st.disposed) return;
      cards.setSources(loaded);
      parts.applyTheme();
      tiles.forEach((_, i) => cards.paintTile(i));
      st.ready = true;
      const box = st.pendingSize ?? host.getBoundingClientRect();
      parts.layout(box.width, box.height);
      loop.wake();
      // The Coil sits below the intro, so the loop often cannot run yet (off
      // screen): draw the first frame anyway, so scrolling to it shows the
      // live scene and not the poster.
      if (!st.raf && !st.firstFrameSent) {
        loop.renderStill();
        st.firstFrameSent = true;
        live.current.onFirstFrame();
      }
      parts.warm(); // fx-flight
    })
    .catch((error) => {
      if (!st.disposed) live.current.onError(error);
    });
}

// Slice 7: an input change (a tablet gaining a trackpad, emulation) moves
// the budget: re-lay out at the new DPR cap and repaint every card at the
// new texture size, a few per frame as a theme change does.
export function resync(ctx: SceneCtx, cards: Cards, layout: (width: number, height: number) => void, loop: LoopLink) {
  const { st, live } = ctx;
  // fx-flight freeze: the props have caught up with the landing (or name a new modal).
  st.landedAhead = false;
  const next = budgetFor(live.current.input);
  if (!sameBudget(next, st.budget)) {
    st.budget = next;
    if (st.ready && !st.contextLost && !st.disposed) {
      layout(st.view.width, st.view.height);
      cards.repaintAll();
      if (!st.raf) loop.renderStill();
    }
  }
  loop.wake();
}
