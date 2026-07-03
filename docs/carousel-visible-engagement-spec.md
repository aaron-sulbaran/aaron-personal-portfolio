# Carousel visible-engagement spec (2026-07-03)

Status: approved design, pre-implementation.
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
- **Debug instrumentation stays.** The `#region agent log` blocks (dbgPost fetches, frame buffers, the on-screen overlay) in the driver are an active investigation surface; edits weave around them, never delete or relocate them.

## Design

### 1. Pure span geometry (`lib/carouselGeometry.ts`)

New pure function, unit-tested in `carouselGeometry.test.ts`:

```
visibleSpan(p, rotation, vp) -> { top, bottom, anyVisible }
```

Derived from the same `cardState` loop the driver renders with: for each card whose opacity is at or above `HIT_OPACITY_MIN`, accumulate the vertical extent (`state.y` plus/minus half the projected card height, i.e. `TILE_H_VMIN/100 * vmin * scale * kTz`). Coordinates are stage space (identical to viewport space while pinned).

### 2. Driver wiring (`TileRing.tsx`)

- `renderFrame` caches the span in a ref each frame it renders (it already iterates every card; no second loop).
- Section offset without DOM reads: `offY = min(0, st.end - window.scrollY)`. Zero while pinned, negative as the section rides up. Same quantity `computeHomeRect` derives from `getBoundingClientRect`, but cheap enough for the ticker.
- **Wheel gate** (replaces the `st.isActive` check): settled AND `atDwell()` AND `e.clientX > vw * WHEEL_ZONE_X_FRAC` AND `e.clientY` within `[span.top + offY, span.bottom + offY]` AND span visible. Modal/flight guards unchanged.
- **Spring block gate** (replaces `st.isActive` at the integrator): settled AND `atDwell()` AND `span.bottom + offY > 0`. This is load-bearing: the 2026-07-03 spring rewrite routes ALL rotation motion (wheel impulses, keyboard steps, auto-advance, settling) through this one block. Un-gating the wheel handler without un-gating the integrator would accumulate `rotV` with nothing integrating it, then lurch on pin re-entry. One gate now controls all rotation life, in both places, from the same span ref.
- `atDwell()` (`st.progress >= ARRIVE_PORTION`) and `isSettled()` both hold naturally post-pin (progress parks at 1, `clock.p` at 1), so no other gates change.

### 3. Paint (`TileRing.tsx` section element)

- The hero section drops `overflow-hidden` for horizontal-clip-only (`overflow-x: clip`, vertical visible). `main` already carries `overflow-x-clip` for the entrance fan.
- `#hero-pin` (or the section) gains a z-index so overflowing cards paint over the later sibling sections; value chosen below SiteNav / PlaybackPill (z-31) / ScrollProgress, verified live at implementation time.

## Invariants that must survive (see AGENTS.md LOAD-BEARING INVARIANTS)

- GSAP writes BOTH the DOM wrapper transform and `collapseRef` every frame; the span capture adds reads, never a second writer.
- The scoped `will-change` policy (set while engaged, cleared in `resetCollapse`) is a DPR-2 raster fix; do not disturb.
- Wheel listener stays on `window`. The AGENTS.md follow-up suggesting scoping it to `#hero-pin` is now incompatible: wheel events over cards floating past the section boundary target the next section's DOM and would never reach a `#hero-pin`-scoped listener. Record this in AGENTS.md at session end.
- Flight math already re-anchors post-release (`offY` in `computeHomeRect` / `computeFlightSource`); clicks while partially scrolled must keep working.
- Fixed overlays keep Portaling to body; the pinned `#hero-pin` transform still traps `position: fixed` descendants.
- Framer never regains a transform GSAP owns mid-carousel.

## Testing

- Vitest: `visibleSpan` cases: p=1 spans expected extent at rotation 0; span shrinks/holds under rotation; empty below `HIT_OPACITY_MIN`; span at p=0 reports not visible (hero state).
- Live QA (headless browse per project convention): wheel over a partially scrolled carousel rotates it; wheel below the span scrolls the page; auto-advance continues while partially visible and stops when fully off; no clip line at the section boundary; cards paint over ListenInvite but under SiteNav/pill; card click -> modal flight from a partially scrolled state lands correctly; reverse scroll into the pin and back to the hero still snaps and normalizes rotation.

## Out of scope

- Widening the arc fade window (`FADE_START_DEG`/`FADE_END_DEG`).
- Arrow-key behavior post-pin.
- Mobile coverflow, reduced-motion branch.
- Removing the debug instrumentation.
