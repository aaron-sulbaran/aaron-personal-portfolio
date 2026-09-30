# Coil input model and test strategy

Status: written 2026-09-29 after Aaron's first hands-on pass of the built `coil` branch. It replaces the capture rules in `docs/coil-build-scaffold.md` table 1.1 ("cards only, 400ms intent, top of page only"), which produced the defects below. Fix PRs: wheel capture and row hold, modal flight, chrome and book.

## 1. What went wrong, and why the gate missed it

| Symptom (Aaron) | Root cause in `components/coil/CoilScene.tsx` |
|---|---|
| Infinite scroll only works scrolling up | `onWheel` refuses capture when `window.scrollY > 2`. A downward wheel that reaches the page before capture engages moves the page, and capture is then refused until the page is back at the top. Upward wheels at the top cannot move the page. |
| A freeze of about a second before the coil responds | The 400ms hover intent, plus "cards only": a wheel that arrives early, or with a gap between cards under the pointer, goes to the page. |
| Random freezes mid-spin | `onPointerMove` releases capture whenever the pointer is over a gap. Cards move under a nearly still pointer, so ordinary hand tremor releases it. |
| Scrolling down moves off the coil while the chevron still shows | After release, page scroll feeds the conveyor and the nudge state is not tied to ownership. |
| Row hover does not hold the coil; changing rows is jarring | Idle drift and the page-scroll feed keep running while a row is hovered; each row change starts a new glide. |
| Modal return snaps | Under investigation (Fable agent). The corners match within 0.06px, so the mismatch is in what the corner test does not see: shading, lift, bend, handoff frame order. |

Why 206 tests and the gate passed: the unit tests cover pure geometry and motion, which were right. The gate drove the scene with single synthetic wheel events from a rested pointer at the top of the page, the one path the rules allow. No test replayed a real trackpad stream, a downward-first gesture, pointer jitter, or a frame-level pixel comparison at the flight handoff.

## 2. Requirements

Functional
- Pointer over the coil: the wheel spins the coil, both directions, without end. The page does not move.
- Pointer elsewhere: the wheel scrolls the page. Keyboard and scrollbar always scroll the page.
- The visitor must never feel trapped: leaving the coil with the pointer returns the wheel to the page at once; a chevron nudges after 2.6s of spinning.
- Hovering or focusing a book row brings its card to the front and holds the coil still.
- Opening and closing a card is one continuous object moving between the coil and the modal.
- Seen state is one store, shown the same way in the coil and the book.

Non-functional
- First motion on the same frame as the first captured wheel event. One smoothing stage, speed cap 12.5 cards per second.
- p99 frame time 16.8ms on a laptop GPU; no allocation per frame in the input path.
- Native scroll is never replaced: no virtual scroll, no scroll hijack outside the coil.

## 3. Design

```
wheel event ─┐
pointermove ─┼─> capture (pure)  ── owner: COIL ──> conveyor.addWheel ──> scene
hero rect  ──┘        │            owner: PAGE ──> browser scrolls ──> pageScroll feed (gentle)
                      └─> nudge (COIL held 2.6s)

row hover/focus ──> hold (pure) ──> idleWeight 0, pageScroll feed 0, glide to card, hold
card click ──> freeze scene ──> flight (pure handoff state machine) ──> modal ──> reverse ──> unfreeze next frame
modal close, row click ──> seen store ──> coil ring + book row dim
```

Gesture ownership (the core rule). A gesture is a run of wheel events less than 260ms apart. Ownership is decided on the first event and held for the whole gesture, inertia included.
- First event, hero interactive, hero at least half in view, pointer inside the helix silhouette (gaps included): COIL.
- Otherwise: PAGE.
- COIL releases to PAGE only when the pointer itself moves outside the silhouette.
- PAGE never converts to COIL mid-gesture, even if the hero scrolls under the pointer.
- No hover intent, no "top of page only", no "cards only".

Row hold. While a row is hovered or focused: idle 0, page-scroll feed 0, one glide to the card's visible copy, then still. Row to row: a 700ms glide from the held pose. Leaving the list: idle resumes after 400ms, eased in over 600ms. Hero less than a quarter in view: no effect.

Flight handoff. The flying object renders exactly what the mesh renders (same shader, bend, shading, lift), and releases bend, shading and lift over the flight. The mesh reappears only on the frame every value equals its rest value; the scene unfreezes on the next frame with `dt` clamped to one frame.

## 4. Trade-offs

| Decision | Gain | Cost |
|---|---|---|
| Silhouette capture with no intent delay | The coil answers at once, in both directions, anywhere over it | A visitor whose pointer rests on the coil must move it to scroll the page. Mitigated by the nudge, the pointer-leave release, keyboard and scrollbar. Aaron accepted this on 2026-09-29. |
| Ownership held per gesture | No mid-gesture surprises in either direction; inertia never leaks to the page | A visitor who starts a page scroll and wants the coil must pause 260ms |
| Pure capture and hold modules | Every rule is unit-testable with recorded streams | Two more small modules |
| The flying card rendered by the scene's own shader | No tone, bend or lift mismatch at either end | An overlay canvas or a second render target; more care at teardown |

Revisit when: a second pointer-driven object joins the page; touch gets hover-equivalent input; the strand grows past about 40 cards.

## 5. Test strategy

| Layer | What it covers | Where | Status |
|---|---|---|---|
| Unit (vitest, node) | Geometry, motion, entrance, unwind, drivers, content, loader progress, flight math | `lib/**/*.test.ts` | 206 tests, keep |
| Unit, new | `lib/coil/capture.ts`: ownership from recorded event streams (downward first, gap under pointer, jitter, release on real leave, PAGE never converts, hero half in view). `hold` state in `lib/coil/motion.ts`. Flight handoff state machine with explicit frame order. | same | added by the fix PRs |
| End to end, Playwright | Real-shaped input and pixels in a real browser against a local production build: recorded trackpad streams and mouse notches replayed through DevTools input (both directions, from a card and a gap, at scrollY 0 and 200, with 2px jitter), the nudge, the row hold, the flight swaps held through `?coildebug=flight`, the loader, fallbacks, touch, chrome, the band, the hero hints and fills, the holding build, an accessibility smoke | `e2e/` (`pnpm test:e2e`) | replaces the planned `scripts/qa/` replay; see below |
| Visual handoff | Pixel difference of the card region at each flight swap (mesh to flown card at the open, flown card to mesh at the landing): mean under 2/255, edge under 0.5px, both steps of each swap in one frame | `e2e/flight.spec.ts`, through the `?coildebug=flight` hold | in `e2e/` |
| Real hardware (Aaron) | Trackpad and mouse wheel feel, GPU frame times, iPhone and Android touch | PR 8 checklist | owed |

Decided 2026-09-29: Aaron approved Playwright as a dev dependency. The recorded trackpad streams (`lib/coil/capture.fixtures.ts`) and the flight pixel checks move into a Playwright suite under `e2e/`, run with one command against a local production build. It never runs against Vercel.

The `e2e/` suite (Playwright, 2026-09-29). `pnpm test:e2e` builds the full site and serves it on port 3140, builds the holding page in a copy outside the repo on 3141 (the two modes cannot share one `.next`), and runs Chromium through its full browser channel so the scene gets the GPU; any request to a non-local host is blocked. It is where the capture, nudge, row hold, flight, loader, fallback, touch, chrome, soundtrack band, hero and accessibility behaviors are held, each test waiting on the scene's own `?coildebug` hooks rather than on time. Run against the builds before the fixes, the capture, nudge and row hold tests fail on 3f6d129 and every flight case on 5dc72cb. It never runs against Vercel; the real hardware row above still stands.

Example cases for `capture`
1. Pointer on a card at scrollY 0, wheel down stream of 40 events: owner COIL from event 1, page delta 0.
2. Pointer in a gap inside the silhouette, wheel down: COIL.
3. Pointer outside, wheel down until the hero scrolls under the pointer: PAGE for the whole gesture; after 300ms of silence, a new wheel with the pointer inside and the hero 60 percent in view: COIL.
4. COIL gesture with 2px pointer jitter inside the silhouette: stays COIL.
5. COIL gesture, pointer moves 300px outside: PAGE on the next event, nudge hidden.
6. Hero 30 percent in view, pointer inside the silhouette: PAGE.
7. Unwound list open, modal open, reduced motion, coarse pointer: PAGE.
