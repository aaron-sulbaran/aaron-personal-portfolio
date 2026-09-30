# ADR 0001: Split the Coil scene into modules by concern, with no behavior change

**Status:** Proposed (accepted when the `coil-split` pull request merges into `coil`)
**Date:** 2026-09-29
**Deciders:** Aaron (approved the split on 2026-09-29 for repo hygiene), Fable (review)

## Context

`components/coil/CoilScene.tsx` is the dynamic chunk `CoilStage` imports after first paint. By 2026-09-29 it had grown to 2,526 lines, one React component around a single 2,100 line closure, `startCoil()`, that owns everything the hero does in WebGL: the renderer and its three passes, the name lockup and its fills, the card slots and their textures, wheel and touch input, hover picking, the entrance, the unwind egg, the flown card, the loop, and every `?coildebug` hook. Six slices and three fix PRs each added a fenced block (`// ---- fx-flight ...`, `// ---- slice 7 ...`) to the same closure.

Forces at play:

- **Layer 1 says component files aim under 200 lines.** The closure is ten times that, and every new feature grows it, because there is nowhere else for scene code to go.
- **Every block reads and writes the same locals.** `raf`, `frozenByApi`, `hoveredSlot`, `coast`, `rebuildAt` and about thirty others are shared across blocks by closure capture. The coupling is real, not accidental: the loop, input, hover and flight genuinely share this state.
- **The behavior is tuned and held by tests.** 324 unit tests on the pure `lib/coil` modules and 55 Playwright tests (capture streams, flight pixel swaps held through `?coildebug=flight`, loader, fallbacks, touch) pin what the scene does. Any change in what a visitor sees is a regression, not a refactor.
- **Frame order is load bearing.** The flight handoff, the entrance hold on the conveyor and the unwind latch each depend on running before or after a neighbor within one frame. The order is documented only as a comment at the top of the file.
- **The chunk boundary is a contract.** Everything under the scene must stay out of the initial JS; outside `components/coil/` only types are imported from `CoilScene`.

## Decision

Split `startCoil()` into modules under `components/coil/scene/`, one per concern, each a factory that takes an explicit context and returns the functions its neighbors call. `CoilScene.tsx` becomes a composition root: the React component, and a `startCoil()` that creates the modules in the original order, registers listeners in the original order, assembles the api, and disposes in the original order. The per-frame work becomes a named sequence of steps in `lib/coil/frame.ts`, a pure sequencer with a unit test that records the order of every step for one frame.

No renames outside `components/coil/`: the public props, the `api` ref surface, the `?coildebug` tokens, `window.__coil`, `window.__coilFlight`, every uniform name and the frame order are identical. The split commits change no behavior; the one behavior change (a WebGL 2 probe in `CoilStage` before the chunk import) is its own final commit.

## Options considered

### Option A: modules over a shared state record (chosen)

The cross-cutting locals move into one `SceneState` record (`scene/state.ts`); handles that never change (host, canvas, props ref, debug flags, the three objects) sit beside it in a `SceneCtx`. Each module owns its private state in its own closure and reads or writes shared state through `ctx.st`.

| Dimension | Assessment |
|---|---|
| Complexity | Medium: a mechanical `x` to `st.x` rewrite, one concern at a time |
| Risk of behavior change | Low: the same statements in the same order; no new abstractions in the frame path |
| Frame cost | Unchanged: a property read in place of a closure read, and one small record per frame |
| Familiarity | Same factory-and-closure style the file already uses |

**Pros:** each move is small and reviewable; the sharing that exists becomes visible (a field on `SceneState` is shared, a closure variable is private); modules can be read alone.
**Cons:** `SceneState` is a wide record any module can write; discipline, not the compiler, keeps writes with their owners (the module map names each owner).

### Option B: classes with private fields and events

A `CoilScene` class tree (Renderer, Input, Flight...) that talk through an event bus or method calls.

| Dimension | Assessment |
|---|---|
| Complexity | High: every cross-block read becomes an accessor or an event |
| Risk of behavior change | High: event dispatch reorders work inside a frame; the flight handoff is order sensitive |
| Frame cost | Slightly higher (dispatch), probably within noise |
| Familiarity | New style for this codebase |

**Pros:** stronger encapsulation. **Cons:** a rewrite, not a split; it cannot be proven identical one step at a time.

### Option C: leave the file, add section indexes

**Pros:** zero risk. **Cons:** does not meet the goal; the file keeps growing.

## Trade-off analysis

A is the only option that can be done one extraction per commit with the full suite green after each, which is what makes "no behavior change" provable rather than asserted. B buys encapsulation the scene does not need today (one scene, one author at a time) at the price of a rewrite of the flight handoff, the one area where frame order already caused a shipped defect. The cost of A, a wide shared record, is paid down by the module map listing which module writes which field, and by keeping private state private.

## Module boundaries and contracts

```
CoilScene.tsx (root)      React component + startCoil(): creates, wires, disposes
  scene/types.ts          public types (re-exported by CoilScene.tsx)
  scene/debug.ts          ?coildebug tokens, window.__coil, the flight probe hooks
  scene/state.ts          SceneState (shared) and SceneCtx (handles)
  scene/renderer.ts       WebGLRenderer, cameras, scenes, field target, layout, resize
  scene/field.ts          field pass and composite pass, drift preset, field clocks
  scene/name.ts           name lockup mask, fills, repel buffer, the loader handoff
  scene/cards.ts          slots, textures, theme repaint, per slot poses, the card pass
  scene/input.ts          pointer, wheel ownership, taps, touch drag, conveyor feed, nudge
  scene/hover.ts          picking, cursor bridge, row hold, hover-jump
  scene/entrance.ts       entrance clock wiring and the rebuild fade
  scene/unwind.ts         unwind latch wiring, column, name move, double-click
  scene/flightOverlay.ts  the flown card's canvas, renderer, covers, pixel grid
  scene/flight.ts         the handoff: freeze, draw, land, abort, prewarm
  scene/loop.ts           frame, wake and sleep, visibility, still frames, clock hold
  scene/api.ts            assembles CoilSceneApi in its original key order
  scene/boot.ts           fonts and card sources, first layout, first wake
lib/coil/frame.ts         the frame's step order (pure, unit tested)
```

Contracts:

- **Creation order.** The root creates modules in the order their code ran in the old closure, so every three.js object gets the same id and every listener is registered in the same order.
- **Late binding.** Modules that call the loop (`wake`, `renderStill`, `stop`) receive a `LoopLink` whose functions are bound when the loop is created; nothing calls through it before `startCoil()` returns.
- **Shared state.** A field on `SceneState` may be read by any module; it is written only by the modules the module map lists for it.
- **Frame order.** `frame()` runs the landed flight's first frame, then `runUpdate` and `runRender` from `lib/coil/frame.ts`: scroll, conveyor, helix, entrance, rebuild, unwind, name, seen, slots, silhouette, picking, nudge, repaint; then field, composite, cards.
- **Chunk boundary.** Nothing outside `components/coil/` imports a value from `scene/`; `CoilScene.tsx` re-exports the public types.

## Consequences

- Easier: adding a feature means a new module (or a step) and one line in the root, not another fenced block in a 2,500 line closure; each concern can be read and reviewed alone; the frame order is a tested contract rather than a comment.
- Harder: following one interaction end to end now crosses files (a wheel event goes input, then loop, then cards). The module map and the frame order test are the guide.
- Unchanged: frame cost (p99 CPU work per frame within 0.1ms, at rest and under wheel input), pixels (deterministic frames identical to the pre-split build), the public api, every debug hook.
- Slightly larger: the scene chunk grows 1.4% raw and 2.1% gzip (593,294 B against 585,049 B; 152,794 B against 149,609 B gzip), because shared state is now read as object properties the minifier cannot rename and the parts call each other through named functions. Initial JS is unchanged (within 30 B).

## What we would revisit

- `SceneState` is wide. If a second scene or a second author arrives, narrow it: give each module an accessor surface and make the record private to the root.
- `flight.ts` and `flightOverlay.ts` still share the most state with the loop (freeze, landedAhead, resuming). If the flight grows again, give it an explicit state machine owner in `lib/coil/flight.ts`.
- If the scene chunk's size matters more than the split's readability, the shared record's hottest scalars (`raf`, `ready`, `theme`, `geoCamera`) could move behind module-local variables with accessors; that is where most of the 2% went.
- The debug hooks are installed by one function that reaches into several modules. If QA hooks keep growing, let each module register its own hook through a small registry.
- The frame sequencer asserts order, not data flow. A future step that reads a value a later step writes would pass the order test; the module map documents each step's inputs to guard that.
