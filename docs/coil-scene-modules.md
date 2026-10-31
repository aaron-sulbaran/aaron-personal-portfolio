# Coil scene modules

The map of `components/coil/scene/`, the modules behind the Coil hero's WebGL scene. Why it is split this way: [ADR 0001](adr/0001-coil-scene-split.md). What the scene does: `docs/coil-build-scaffold.md` and `docs/coil-input-model.md`.

## The shape in one picture

```
CoilStage.tsx ──import() after first paint──> sceneChunk.ts ──> CoilScene.tsx (composition root, 227 lines)
NameCanvas.tsx ─import() after first paint──> sceneChunk.ts ──> nameCanvas/start.ts   (one entry, so one chunk and one copy of three)
TitleFill.tsx  ─import() once near the viewport──> sceneChunk.ts ──> fill/title.ts   (pages 2 to 4: the name's fill on each title)
                                                 │ creates, in the old closure's order:
   state.ts   SceneCtx { host, canvas, live, tiles, flags, debug, flightLog, st: SceneState }
   renderer.ts ─> nameSurface.ts ─> field.ts ─> name.ts ─> cards.ts ─> entrance.ts
   (fill/engine.ts makes its own renderer, nameSurface, field and glyphReduction for one heading:
    nameCanvas/start.ts adds name.ts for the page's name, fill/title.ts a lettering read off the DOM for a title)
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
| `scene/debug.ts` | Every `?coildebug` token (`ink=`, `name` included) and the `?drift` pick (`readDebugFlags`), `window.__coil` (create, hooks, remove), `pushStat` | types of the parts it reads |
| `scene/debugProbe.ts` | `window.__coilFlight.scene` (follow, slot, slots, hide, seam, flown, flight) and the state every probe mark carries | cards, loop |
| `scene/renderer.ts` | The scene canvas's `WebGLRenderer`, cameras, scenes, the field's and the name surface's targets, `uView`, the shared quad (`Gl`); the layout (host sized, DPR capped, rebuild trigger, the helix laid out for the cards section's `[data-coil-pane]` by `lib/coil/pane.ts` and centered on the canvas, the ribbon's slot `[data-coil-ribbon]` at page 1's foot measured against the stage's rail by `ribbonSlot.ts` and handed to `solveGeometry`, which forms the wheel there too); the resize observer (of the canvas, the slot, the button and the rail); the lost context | loop |
| `scene/ribbonSlot.ts` | Slice 4d: where page 1's foot put the ribbon (the slot's middle from the rail's top) and where "Deal me in" sits across (`st.ribbon`), read once per layout, never in a frame | none |
| `scene/nameSurface.ts` | The name's lit surface pass (half the lockup's device resolution, drawn only when its clock, the wake, the layout or the theme moved), its clock and light orbit, the pointer's wake (`lib/coil/wake.ts`) stepped and uploaded, `nameBench()` | none |
| `scene/field.ts` | The field pass (drift preset, its two clocks, only redrawn when a clock moved) and the composite pass (material, theme colors and the name's per-theme scalars, size uniforms, the deal's alpha mask `uOpen` from `st.open`); while the mask is closed both passes are skipped and only the cards draw, over the page. Takes the composite's fragment as an argument: the page's name canvas passes its own (`lib/coil/nameCanvas.glsl.ts`) | none |
| `scene/name.ts` | The lockup mask (greeting and name, one mask), its layout (from a placement, else centered), its fade (held at 0 for a loader that is to land it), the surface growing over the loader's name, the per-letter reduction pass (each letter's contrast, the lift), `nameRect` (which carries the greeting's ink too) and `landName`, which lands the whole lockup and returns false until a name waiting for the loader has reached a frame. Since slice 4d the scene's own instance is dormant (`nameShown` false: the page's name is drawn by `nameCanvas/start.ts`, which makes the same parts on a renderer of its own) | nameSurface, loop |
| `scene/glyphReduction.ts` | The per-letter reduction pass (each letter's mean contrast against the field, eased, held while the wake is live), shared by `name.ts` and a title's fill | renderer |
| `fill/engine.ts` | Outside `scene/`: the fill, one heading's own small canvas, set on whole CSS px in its host and drawn at the screen's resolution (to 2x), so its buffer's pixels are the screen's (`lib/coil/pixelGrid.ts`). A minimal renderer made from this folder's parts (`createField` with the name-only fragment, `createNameSurface`, `createGlyphTargets`) on a stub `SceneCtx`, and a lettering (where the letters are, how they come in); the pointer's wake from window pointer moves, the surface's clock, a loop that runs only while the canvas is on screen, the tab is showing and nothing paused it, theme and resize watching, `compileAsync` off the main thread when asked, and `dispose`, which loses the context too | scene/field, nameSurface, renderer, state |
| `nameCanvas/start.ts` | Slice 4d: the page's name on the fill, its lettering `createName` (the lockup, the loader's landing `nameRect`, `landName`), placed where the h1 paints its two lines (`lib/coil/lineAnchor.ts`: each line's pen and painted baseline read off the layout, the mask set in the heading's own type on the buffer's grid), so its first frame is the loader's last, pixel for pixel. QA `stats()` on `window.__nameCanvas` behind `?coildebug`. Mounted by `components/home/NameCanvas.tsx` with `import()` of `components/coil/sceneChunk.ts`, the same entry CoilStage uses (two separate entries into three made two 580 KB copies of it), when the fill's pool (`fill/pool.ts`) gives it a context, never under reduced motion | fill/engine, name |
| `fill/title.ts` | A numbered page's title on the fill: the glyphs read off the DOM (`lib/coil/titleLayout.ts`), the mask painted line by line in the heading's own type on the buffer's grid and each line's painted baseline (`lib/coil/lineAnchor.ts`), the title's own ink solid on the first frame (the page's text, pixel for pixel) and the surface grown over it on screen. Mounted by `components/sections/TitleFill.tsx`; at most two of the name and the titles hold a context (`lib/coil/fillPool.ts`) | fill/engine, glyphReduction |
| `scene/nameProbe.ts` | QA only: the composite without the cards read back, the per-letter readout (`lib/coil/letterContrast.ts`) and lightness snapshots (`window.__coil.nameProbe`) | name |
| `scene/cards.ts` | Slot meshes, shared card uniforms, painted faces and the repaint queue, seen levels, the helix frame, per slot poses (entrance, unwind, header band, rebuild, hidden, hover lift and the phone cue's, seen ring), the silhouette, the card pass (and `hull`, which also hides the name when the `nameShown` prop is false); `quadOf`, `flightQuadOf`, `facesOf`, `slotOfKey` | name (QA hide) |
| `scene/hover.ts` | Picking (`pickAt`, `cardAt`), the per frame hover and the cursor bridge (`lib/cursor/hover.ts`, which also carries the hovered card's key for the titles), page 2's phone cue (`COIL.phone.frontLift`, or `?coildebug=frontlift`: the card at the band's middle lifted as a hovered one), the flown card's lift target, the row hold and hover-jump (`focusCard`), `heroVisible` | cards, loop |
| `scene/input.ts` | Pointer and wheel handlers over `lib/coil/capture.ts` (plus the window scroll listener that disarms capture; a coarse pointer's wheel is its own sighting), click and tap opening, the drag and its coast (pointer events of any kind, axis-locked by `lib/coil/dragAxis.ts`: the coarse pointer's, and any pointer's in page 2's phone layout), the scroll step (which also arms capture the frame `interactive` turns true: the Coil is the reader's from the unfurl, `armCapture`), conveyor and nudge steps | cards, hover, loop |
| `scene/entrance.ts` | The deal on the scene's side (hero rework, slices 4a to 4d): the ribbon's drift at page 1's foot before the click (faster, and the gaps a little tighter, while the pointer is over "Deal me in": the eased `anticipation`, read from `lib/home/dealCue.ts`, frozen at the click so the speed curve starts from the pace the reader saw), the deal's one clock (`CoilEntrance.clockMs`, the director's master timeline, else the scene's own count; its zero is the end of the condense), the strand's offset from the integrated speed curve (`lib/coil/dealSpeed.ts`; this step is the one owner of `conveyor.offset` until the deal ends), the frame (`lib/coil/entrance.ts`: ribbon, wheel, band, helix; on the click only, the ribbon and wheel ride off their slot by `kneeLead` (`pinKnee` over the last `COIL.deal.wheel.pinKneePx` before the stage sticks, read from the rail's live rect, eased in over the condense and capped inside the room above the slot, `st.ribbon.roomAbove`); by hand the ribbon is on its slot), the field's mask (`st.open`, a circle from the canvas's middle whose feather widens as it opens), the bottom seam, `stepEntrance(ms)` behind `?coildebug`, the deal's lab tuning, the end reported once (the unfurl: the director dispatches `unfurl`, `interactive` follows), the rebuild fade | none |
| `scene/unwind.ts` | The double-click toggle and `api.unwind`, the latch held in the frame, rows measured onto the z = 0 plane, the dormant scene name's move into the list's lead (nothing shows of it) | name, hover, loop |
| `scene/flightOverlay.ts` | The flown card's own canvas and renderer on the scene canvas's pixel grid, its covers, its face copies, prewarm target, teardown | cards |
| `scene/flight.ts` | The handoff (`beginFlight`: draw, arrive, close, land, abort), `freeze`, `hideSlot`, the still frame redraw, the landed frame, prewarm | cards, hover, flightOverlay, debugProbe, loop |
| `scene/loop.ts` | The rAF chain, `shouldRun`, `wake` and `stop`, the clock hold after a stop, still frames, `update` and `render` over the sequencers, the visibility observers | the steps it is handed |
| `scene/api.ts` | `CoilSceneApi` assembled from its owners, in its original key order | cards, hover, unwind, flight |
| `scene/boot.ts` | Fonts and card sources (loader tally, 6s give-up), first paint, layout and wake; the budget resync on an input change | cards, loop |

## Shared state: who writes what

`ctx.st` is readable by every module. The objects in it that are created once and only mutated (`conveyor`, `envelope`, `pointer`, `view`, `poses`, `rendered`, `rowHold`, `unwind`) are bound to locals at a module's creation; the fields that are reassigned are always read through `st`. Writes stay with their owners:

| Field(s) | Written by |
|---|---|
| `view`, `geo`, `geoCamera`, `pendingSize`, `contextLost`, `phoneStage` | renderer.ts |
| `lastFieldTime` | field.ts, renderer.ts (layout), the root's `applyTheme` |
| `nameFamily` | boot.ts |
| `theme` | the root's theme watcher |
| `budget`, `landedAhead` (reset) | boot.ts (`resync`) |
| `poses`, `rendered`, `sil` | cards.ts |
| `hoveredSlot`, `frontSlot` | hover.ts |
| `pointer`, `capture`, `dragging`, `coast`, `pressCaughtCoil` | input.ts (`coast` also cleared by entrance.ts while the strand is held) |
| `conveyor` | input.ts (feeds), entrance.ts (owns the offset until the deal ends), unwind.ts (latched), hover.ts (glide) |
| `envelope` | input.ts |
| `rowHold` | hover.ts |
| `unwind` | unwind.ts (and loop.ts shifts its start after a stop) |
| `rebuildAt` | renderer.ts (layout), entrance.ts, loop.ts (clock hold) |
| `open` | entrance.ts (the field's mask), read by field.ts |
| `hiddenSlot`, `frozenByApi`, `landedAhead` (set) | flight.ts (and debugProbe.ts `hide`) |
| `raf`, `lastTime`, `visible`, `resuming`, `firstFrameSent` | loop.ts |
| `ready`, `disposed` | boot.ts, the root's dispose |

## The frame

`loop.ts` calls `runUpdate` then `runRender` from `lib/coil/frame.ts`, after the landed flight's first frame (`flight.flightFrame`). The root maps each step to its owner:

| Step | Part | Hands on |
|---|---|---|
| scroll | input | (places the pointer at the page's scroll) |
| conveyor | input | (moves `st.conveyor`, `st.envelope`) |
| helix | cards | `helix` |
| entrance | entrance (and name's fades) | `clock` (with `wheelDyPx`, the wheel's knee), `realElapsedMs`, `helix`, `st.open` |
| rebuild | entrance (and name's fade) | `rebuilt` |
| unwind | unwind | `listProgress` |
| name | name (nameSurface: the surface's clock, the pointer's stroke, the wake's step and upload) | |
| seen | cards | |
| slots | cards | (writes `st.poses`, `st.rendered`) |
| silhouette | cards (and name's flow) | (writes `st.sil`) |
| picking | hover | (writes `st.hoveredSlot`, `st.frontSlot`) |
| nudge | input | |
| repaint | cards | |
| field | field | |
| surface | name (the surface pass, then the per-letter reduction) | (reads the field target; the composite reads both) |
| composite | field | |
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
