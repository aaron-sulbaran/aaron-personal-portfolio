# Carousel visible-engagement spec (2026-07-03, amended 2026-07-05)

Status: approved design, pre-implementation. Amended for the v3 rotation model (`d84cdc2`): the single-spring integrator this spec originally targeted was replaced by a closed-form wheel chase plus discrete step tweens plus the rasterHold anti-pop mechanism.
Scope: desktop ring-arc carousel only (`TileRing.tsx` driver + `lib/carouselGeometry.ts`). Mobile (`MobileHome`) and the reduced-motion branch are untouched.

## Problem

The settled infinite carousel is only alive while the ScrollTrigger pin is engaged. The moment scroll passes the pin end (`PIN_SPACER_PERCENT`), `st.isActive` flips false and three things break the experience:

1. Wheel over the cards stops rotating the carousel; it scrolls the page instead. The only way back to browsing is to re-enter the pin, and overshooting upward triggers the reverse animation into the hero ring.
2. Auto-advance halts, so the cards freeze mid-frame while still largely visible.
3. Cards are hard-clipped at the hero section boundary (`overflow-hidden`), a visible slice line through any card crossing it.

The deck era solved the interaction half deliberately (commit `50b050f`: the hoverable flag was "Not gated on isActive, so the peek keeps working after the pin releases"). The carousel rewrite lost that property.

## Decisions (Aaron, 2026-07-03)

- **Overflow, not wider fade.** Cards keep drawing along the full arc circle past the section boundary, floating over ListenInvite/Work as the section rides up. The fade window (`FADE_START_DEG` / `FADE_END_DEG`) is unchanged.
- **Wheel zone = right zone bounded by the visible card span.** Cursor right of `WHEEL_ZONE_X_FRAC` AND vertically within the visible cards' extent routes wheel to rotation. Below the last visible card the page scrolls normally. Concretely: cards occupying only the top 25% of the screen leave the right side below them free for page scrolling; with roughly half the carousel on screen and the cursor over the card region, wheel rotates the carousel and leaving requires moving the cursor off the cards.
- **Auto-advance runs while any card is visible**, and halts entirely once the last card scrolls off (no background work in About/Connect).
- **Arrow keys stay gated on the pin being active.** Post-pin they scroll the page natively.
- **Debug instrumentation stays.** (Resolved 2026-07-05: the `#region agent log` blocks were removed by Aaron's own debugging commit `d84cdc2`; nothing left to preserve.)

## Design

### 1. Pure span geometry (`lib/carouselGeometry.ts`)

New pure function, unit-tested in `carouselGeometry.test.ts`:

```
visibleSpan(p, rotation, vp) -> { top, bottom, anyVisible }
```

Derived from the same `cardState` loop the driver renders with: for each card whose opacity is at or above `HIT_OPACITY_MIN`, accumulate the vertical extent (`state.y` plus/minus half the projected card height, i.e. `TILE_H_VMIN/100 * vmin * scale * kTz`). Coordinates are stage space (identical to viewport space while pinned).

### 2. Driver wiring (`TileRing.tsx`)

- `renderFrame(p, rotation, rasterHold)` caches the span in a ref each frame it renders (it already iterates every card; no second loop). The rasterHold parameter is untouched.
- Section offset without DOM reads: `offY = min(0, st.end - window.scrollY)`. Zero while pinned, negative as the section rides up. Same quantity `computeHomeRect` derives from `getBoundingClientRect`, but cheap enough for the ticker.
- One shared predicate, `carouselReach()`: settled AND `atDwell()` AND `span.bottom + offY > 0` (some card still on screen). It replaces `st.isActive` at exactly THREE of the four sites in the interactive branch; the v3 rotation model split what was one spring block into separate mechanisms, and every mechanism that can move or hold rotation must live or die by the same visibility rule:
  1. **Wheel handler** (`onWheel`): `carouselReach()` AND `e.clientX > vw * WHEEL_ZONE_X_FRAC` AND `e.clientY` within `[span.top + offY, span.bottom + offY]`. Modal/flight guards unchanged.
  2. **Wheel chase block** (the closed-form critically damped scrub toward `scrubTarget`): un-gating the handler without the chase would move `scrubTarget` with nothing chasing it, then lurch on pin re-entry.
  3. **Auto-advance block** (`requestStep(1, STEP_AUTO_S)` from full rest): runs while any card is visible, halts when the last card leaves.
  4. NOT the keyboard handler (`onKey`): arrows stay pin-gated by decision; post-pin they scroll the page natively.
- **`parkedAtRest` (rasterHold) swaps `st.isActive` for the same `carouselReach()`**: if rotation can animate post-pin but the anti-pop breathing hold stops at the pin boundary, the stop-of-motion re-raster (the arrival pop killed on 2026-07-03/04) returns exactly in the partially-scrolled state. The visibility gate also bounds its cost: the every-frame dirty flag stops once the carousel is fully off screen.
- `atDwell()` (`st.progress >= ARRIVE_PORTION`) and `isSettled()` both hold naturally post-pin (progress parks at 1, `clock.p` at 1), so no other gates change. The leave-dwell reset (killing tweens, clearing `scrubTarget`/`chaseV`, rotation rounding) only fires when scrubbing back below the dwell and is unchanged.

### 3. Paint (`TileRing.tsx` section element)

- The hero section drops `overflow-hidden` for horizontal-clip-only (`overflow-x: clip`, vertical visible). `main` already carries `overflow-x-clip` for the entrance fan.
- `#hero-pin` (or the section) gains a z-index so overflowing cards paint over the later sibling sections; value chosen below SiteNav / PlaybackPill (z-31) / ScrollProgress, verified live at implementation time.

## Invariants that must survive (see AGENTS.md LOAD-BEARING INVARIANTS)

- GSAP writes BOTH the DOM wrapper transform and `collapseRef` every frame; the span capture adds reads, never a second writer.
- The scoped `will-change` policy (set while engaged, cleared in `resetCollapse`) and the rasterHold breathing scale are DPR-2 raster fixes; do not disturb either, and keep them alive wherever rotation can animate.
- Wheel deltas never touch rotation or velocity directly (v3 model); the extension only changes WHEN the existing scrub applies, never HOW.
- Wheel listener stays on `window`. The AGENTS.md follow-up suggesting scoping it to `#hero-pin` is now incompatible: wheel events over cards floating past the section boundary target the next section's DOM and would never reach a `#hero-pin`-scoped listener. Record this in AGENTS.md at session end.
- Flight math already re-anchors post-release (`offY` in `computeHomeRect` / `computeFlightSource`); clicks while partially scrolled must keep working.
- Fixed overlays keep Portaling to body; the pinned `#hero-pin` transform still traps `position: fixed` descendants.
- Framer never regains a transform GSAP owns mid-carousel.

## Testing

- Vitest: `visibleSpan` cases: p=1 agrees with a direct union over integer arc slots (fade rule included); span reaches across the viewport at arbitrary rotations; `cardSpan` centers the focused card at vh/2 with the projected arc height. Note: at p=0 the span is non-null (hero-seat opacity is 1); the gates never consult it there because `isSettled()` is false and `renderFrame` early-returns before caching at p <= 0.
- Live QA (headless browse per project convention): wheel over a partially scrolled carousel rotates it; wheel below the span scrolls the page; auto-advance continues while partially visible and stops when fully off; no clip line at the section boundary; cards paint over ListenInvite but under SiteNav/pill; card click -> modal flight from a partially scrolled state lands correctly; reverse scroll into the pin and back to the hero still snaps and normalizes rotation.

## Out of scope

- Widening the arc fade window (`FADE_START_DEG`/`FADE_END_DEG`).
- Arrow-key behavior post-pin.
- Mobile coverflow, reduced-motion branch.
- Any change to the v3 rotation mechanics (chase constants, step queue, modal freeze).
