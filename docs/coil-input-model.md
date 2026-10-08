# Coil input model and test strategy

Status: written 2026-09-29 after Aaron's first hands-on pass of the built `coil` branch. It replaces the capture rules in `docs/coil-build-scaffold.md` table 1.1 ("cards only, 400ms intent, top of page only"), which produced the defects below. Fix PRs: wheel capture and row hold, modal flight, chrome and book.

Revised 2026-10-05 after Aaron's hardware pass (section 3, "Gesture ownership"): the silhouette captured too much, and a page scroll could slide a card under a still pointer and trap the next gesture. A gesture now starts only where the cursor shows a card (or the seam between two), only after a real pointer move, and a coil gesture holds the next one. Release is unchanged.

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
- Pointer on a card, or in the seam between two, after a real pointer move: the wheel spins the coil, both directions, without end. The page does not move.
- Pointer elsewhere, empty background inside the helix included, or still since the page last scrolled: the wheel scrolls the page. Keyboard and scrollbar always scroll the page.
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
hero rect  ──┘        │            owner: PAGE ──> browser scrolls (the coil keeps its idle pace)
                      └─> nudge (COIL held 2.6s)

row hover/focus ──> hold (pure) ──> idleWeight 0, glide to card, hold
card click ──> freeze scene ──> flight (pure handoff state machine) ──> modal ──> reverse ──> unfreeze next frame
modal close, row click ──> seen store ──> coil ring + book row dim
```

Gesture ownership (the core rule). A gesture is a run of wheel events less than 260ms apart. Ownership is decided on the first event and held for the whole gesture, inertia included.
- First event, hero interactive, hero at least half in view, capture armed, and either (rule A) the pointer on a card picking could pick, or in a seam: within the seam margin (`COIL.capture.seamCards`, 0.12 of the card height, 26.7px at 1485 by 927) of two pickable cards; or (continuation) capture held and the pointer inside the helix silhouette: COIL.
- Otherwise: PAGE. Empty background inside the silhouette, and the rim beside a free card edge, are the page's.
- Armed: not at load; armed by a real pointer move of `COIL.capture.rearmPx` (6px) from where the pointer was when capture was disarmed or first seen; disarmed whenever the page scrolls outside a coil gesture (page gesture, keyboard, scrollbar, anchor jump). The page sliding a card under a still pointer never arms the coil, as cards passing under a still pointer never release it. A coil gesture does not disarm, and a keyboard, scrollbar or anchor scroll whose events all land while a coil gesture is live (within 260ms of its last wheel event) keeps capture armed and held; accepted as too narrow to matter. A pointer move during a scroll's tail never arms (the next scroll event re-marks it); one more nudge does.
- Held (continuation, the same symmetry): a coil gesture that ends without passing to the page holds capture, with a mark that follows the pointer while the gesture is live. While held, the next gesture is the coil's anywhere inside the silhouette. Rule A is a rest-pose rule: a spin's stretch (the envelope, up to 0.84) opens seams past the margin, and without the hold a still pointer would lose the next gesture to the page. A real move of `rearmPx` from the mark, a page scroll, a release or a page gesture ends the hold; then rule A decides again. It cannot rebuild the trap, because the trap always scrolls the page. The hold has no timeout.
- COIL releases to PAGE only when the pointer itself moves outside the silhouette. Release stays loose on purpose: releasing over a gap broke capture on 2026-09-29.
- PAGE never converts to COIL mid-gesture, even if the hero scrolls under the pointer.
- No hover intent, no "top of page only".
- Why the seam margin exists: picking tests each card as a flat plane while the cards are drawn bent, so the picked gap between a front card and its angled neighbour is a wedge about a tenth of a card height to its middle, wider than the drawn gap. `lib/coil/geometry.test.ts` derives the margin across six panes; a point counts as a seam only between two cards, so a lone card has no capturing rim.
- `?coildebug` installs `__coil.captureAt(x, y)`: rule A, the two nearest cards, the arming and the hold for a viewport point.

Row hold. While a row is hovered or focused: idle 0, one glide to the card's visible copy, then still. Row to row: a 700ms glide from the held pose. Leaving the list: idle resumes after 400ms, eased in over 600ms. Hero less than a quarter in view: no effect.

Flight handoff. The flying object renders exactly what the mesh renders (same shader, bend, shading, lift), and releases bend, shading and lift over the flight. The mesh reappears only on the frame every value equals its rest value; the scene unfreezes on the next frame with `dt` clamped to one frame.

Shape switch (the Coil and Band toggle, PR 39, 2026-10-08). While the helix is between coil and band the strand holds where the switch began, as it does in the entrance and the unwind: the seam's two ends sit apart mid-pull, so a card crossing it would jump (123px at pull 0.2, 878px at 0.8 on 1440x900). The band spins on the coil's feeds once the switch has landed; a held book row aims again on the landing frame (`hover.rejump()`); the touch drag's cards per pixel and the row's hover-jump follow the band's own card size and turn (`shapeCardPx`, `shapeJump`). Rule A is card-based, so capture holds for either shape; release is more lenient around the band (the hull is a strip along the axis), accepted.

## 4. Trade-offs

| Decision | Gain | Cost |
|---|---|---|
| Capture on a card or seam, armed by a real pointer move, no intent delay (2026-10-05; was the whole silhouette) | The coil answers at once over what the cursor marks as clickable; background and page-driven slides stay the page's | A visitor whose pointer rests on a card must move it to scroll the page (the nudge, the pointer-leave release, keyboard and scrollbar remain). A visitor who scrolled the page must nudge the pointer before the coil takes the wheel. |
| A coil gesture holds the next one until the pointer moves | The stretch after a spin never hands a still pointer's next gesture to the page | Inside the silhouette, a still pointer over a gap keeps the coil after a spin, with no timeout |
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
2. Pointer in the seam between two adjacent cards: COIL; on background between turns inside the silhouette, or on the rim beside a lone card edge: PAGE.
3. Pointer outside, wheel down until a card scrolls under the still pointer: PAGE for the whole gesture, and PAGE for the next gesture too; a real move of 6px or more onto a card, then a new gesture: COIL.
4. COIL gesture with 2px pointer jitter inside the silhouette: stays COIL.
5. COIL gesture, pointer moves 300px outside: PAGE on the next event, nudge hidden.
6. Hero 30 percent in view, pointer inside the silhouette: PAGE.
7. Unwound list open, modal open, reduced motion, coarse pointer: PAGE.
8. Fresh load, no pointer move, wheel over a card: PAGE.
9. Coil gesture on a card, a pause over 260ms with the pointer still, a new gesture with an opened seam under it: COIL; after a 6px move over a gap, or after a page scroll: PAGE.
