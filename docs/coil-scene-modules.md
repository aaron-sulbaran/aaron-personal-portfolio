# Coil scene modules

The map of `components/coil/scene/`, the modules behind the Coil hero's WebGL scene. Why it is split this way: [ADR 0001](adr/0001-coil-scene-split.md). What the scene does: `docs/coil-build-scaffold.md` and `docs/coil-input-model.md`.

## The shape in one picture

```
CoilStage.tsx ──import() after first paint──> CoilScene.tsx (composition root, 220 lines)
                                                 │ creates, in the old closure's order:
   state.ts   SceneCtx { host, canvas, live, tiles, flags, debug, flightLog, st: SceneState }
   renderer.ts ─> field.ts ─> name.ts ─> cards.ts ─> entrance.ts
                  layout (renderer.ts) ─> hover.ts ─> input.ts ─> debugProbe.ts
                  flightOverlay.ts ─> flight.ts ─> unwind.ts ─> loop.ts
                                                 │ then listeners, api.ts, debug hooks, boot.ts
lib/coil/frame.ts   the frame's step order (pure; frame.test.ts holds it)
lib/coil/*.ts       the pure math every module calls (geometry, motion, capture, entrance, unwind, flight...)
```

Every module is a factory: `createX(ctx, ...parts it calls, loop)` returns the functions its neighbors call and keeps its own state in its closure. Nothing outside `components/coil/` imports a value from `scene/`; `CoilScene.tsx` re-exports the public types, and `CoilStage` imports only types from it until the dynamic `import()`.

## The files

| File | Owns | Calls (parts) |
|---|---|---|
| `CoilScene.tsx` | The React component (mount, sync, dispose), `startCoil()`: creates the parts, maps each frame step to its part, registers listeners, builds the api, installs QA hooks, boots | every module below |
| `scene/types.ts` | Public types: `CoilSceneProps`, `CoilSceneApi`, `CoilFlightApi`, `CoilFlownApi`, `CoilFlightHandle`, `CoilCardRef`, `CoilCardFaces`, `CoilEntrance`, `CoilRuntime` | none |
| `scene/state.ts` | `SceneState` (shared state), `SceneCtx` (handles), `SceneFrame` (one frame's record), `LoopLink` (the loop's late-bound entry points) | none |
| `scene/debug.ts` | Every `?coildebug` token and the `?name` / `?drift` picks (`readDebugFlags`), `window.__coil` (create, hooks, remove), `pushStat` | types of the parts it reads |
| `scene/debugProbe.ts` | `window.__coilFlight.scene` (follow, slot, slots, hide, seam, flown, flight) and the state every probe mark carries | cards, loop |
| `scene/renderer.ts` | The scene canvas's `WebGLRenderer`, cameras, scenes, field target, `uView`, the shared quad (`Gl`); the layout (host sized, DPR capped, rebuild trigger); the resize observer; the lost context | loop |
| `scene/field.ts` | The field pass (drift preset, its two clocks, only redrawn when a clock moved) and the composite pass (material, theme colors, size uniforms) | none |
| `scene/name.ts` | The lockup mask (greeting and name), its layout, the entrance, loader, rebuild and QA fades, the fill clock and the cursor repel buffer, the `?name`/`?drift` switcher event, `nameRect` and `landName` | loop |
| `scene/cards.ts` | Slot meshes, shared card uniforms, painted faces and the repaint queue, seen levels, the helix frame, per slot poses (entrance, unwind, header band, rebuild, hidden, hover lift, seen ring), the silhouette, the card pass; `quadOf`, `flightQuadOf`, `facesOf`, `slotOfKey` | name (flow direction, QA hide) |
| `scene/hover.ts` | Picking (`pickAt`, `cardAt`), the per frame hover and the cursor bridge (`lib/cursor/hover.ts`), the flown card's lift target, the row hold and hover-jump (`focusCard`), `heroVisible` | cards, loop |
| `scene/input.ts` | Pointer and wheel handlers over `lib/coil/capture.ts`, click and tap opening, the touch drag and its coast, the scroll, conveyor and nudge steps | cards, hover, loop |
| `scene/entrance.ts` | The entrance clock on the scene's time (a rebuild starts at rest), the strand held until the band opens, the end reported once, the rebuild fade | name |
| `scene/unwind.ts` | The double-click toggle and `api.unwind`, the latch held in the frame, rows measured onto the z = 0 plane, the name's move into the list's lead | name, hover, loop |
| `scene/flightOverlay.ts` | The flown card's own canvas and renderer on the scene canvas's pixel grid, its covers, its face copies, prewarm target, teardown | cards |
| `scene/flight.ts` | The handoff (`beginFlight`: draw, arrive, close, land, abort), `freeze`, `hideSlot`, the still frame redraw, the landed frame, prewarm | cards, hover, flightOverlay, debugProbe, loop |
| `scene/loop.ts` | The rAF chain, `shouldRun`, `wake` and `stop`, the clock hold after a stop, still frames, `update` and `render` over the sequencers, the visibility observers | the steps it is handed |
| `scene/api.ts` | `CoilSceneApi` assembled from its owners, in its original key order | cards, hover, unwind, flight, name |
| `scene/boot.ts` | Fonts and card sources (loader tally, 6s give-up), first paint, layout and wake; the budget resync on an input change | cards, loop |

## Shared state: who writes what

`ctx.st` is readable by every module. Writes stay with their owners:

| Field(s) | Written by |
|---|---|
| `view`, `geo`, `geoCamera`, `pendingSize`, `contextLost` | renderer.ts |
| `lastFieldTime` | field.ts, renderer.ts (layout), the root's `applyTheme` |
| `nameFamily` | boot.ts |
| `theme` | the root's theme watcher |
| `budget`, `landedAhead` (reset) | boot.ts (`resync`) |
| `poses`, `rendered`, `sil` | cards.ts |
| `hoveredSlot` | hover.ts |
| `pointer`, `capture`, `lastScrollY` (per frame), `dragging`, `coast`, `pressCaughtCoil` | input.ts (`coast` also cleared by entrance.ts while the strand is held) |
| `conveyor` | input.ts (feeds), entrance.ts (held at 0), unwind.ts (latched), hover.ts (glide) |
| `envelope` | input.ts |
| `rowHold` | hover.ts |
| `unwind` | unwind.ts (and loop.ts shifts its start after a stop) |
| `rebuildAt` | renderer.ts (layout), entrance.ts, loop.ts (clock hold) |
| `hiddenSlot`, `frozenByApi`, `landedAhead` (set) | flight.ts (and debugProbe.ts `hide`) |
| `raf`, `lastTime`, `lastScrollY` (on wake), `visible`, `resuming`, `firstFrameSent` | loop.ts |
| `ready`, `disposed` | boot.ts, the root's dispose |

## The frame

`loop.ts` calls `runUpdate` then `runRender` from `lib/coil/frame.ts`, after the landed flight's first frame (`flight.flightFrame`). The root maps each step to its owner:

| Step | Part | Hands on |
|---|---|---|
| scroll | input | `scrollDelta` |
| conveyor | input | (moves `st.conveyor`, `st.envelope`) |
| helix | cards | `helix` |
| entrance | entrance (and name's fades) | `clock`, `realElapsedMs`, `helix` |
| rebuild | entrance (and name's fade) | `rebuilt` |
| unwind | unwind | `listProgress` |
| name | name | |
| seen | cards | |
| slots | cards | (writes `st.poses`, `st.rendered`) |
| silhouette | cards (and name's flow) | (writes `st.sil`) |
| picking | hover | (writes `st.hoveredSlot`) |
| nudge | input | |
| repaint | cards | |
| field, composite | field | |
| cards | cards | |

`lib/coil/frame.test.ts` fails if a step moves, is added out of place, or runs twice. It checks order, not data flow: a new step that reads what a later step writes still passes, so read the table's right column before placing one.

## Adding a feature without growing the root

1. **Find its owner.** A new uniform on the name belongs in `name.ts`; a new gesture in `input.ts`; a new card modifier in `cards.ts` (pure math in `lib/coil/`, with a test).
2. **New concern, new module.** Write `scene/<concern>.ts` as `createX(ctx, ...parts, loop)`. Keep its state in its closure; put state in `SceneState` only when another module must read it, and add it to the table above.
3. **Needs a frame?** Add the step to `UpdateSteps` or `RenderSteps` in `lib/coil/frame.ts`, add it to the expected order in `frame.test.ts` (watch it fail first), and map it in the root's step table. One line in the root.
4. **Needs a listener?** Return a detach function from a `listen()` in the module; register it with the other listeners in the root and call the detach in `dispose()`.
5. **Needs the api?** Add the type to `scene/types.ts` and the entry to `scene/api.ts`.
6. **Needs a QA hook?** Add a typed field to `DebugStats` and set it in `installSceneHooks` (or `debugProbe.ts` for flight hooks). Tokens are parsed only in `readDebugFlags`.
7. **Keep the budget.** Modules stay under 400 lines and the root under 250; split by concern before either grows past it.
