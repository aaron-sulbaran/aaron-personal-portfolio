# Hero lab 2: builder notes and defaults (Opus motion agent, 2026-09-29)

Lab: `prototypes/labs/hero-lab-2.html` (source and `build.py` in `labs/hero-build-2/`; shots in `labs/hero-shots-2/`, film `hero-lab-2.webm`). Presets via `#p=<key>`, `&t=dark`, `&go=1` skips the play frame; `f` hides the panel. Keys: `rest`, `dark`; O1 `book`, `bookopen`, `unwind`; O2 `slide`, `duo`, `print`; work cards `wktone`, `wkbrand`, `wbmotif`; O3 `stretch`, `stlight`, `pitch`, `curl`, `light`, `flare`; palette `sea`, `ut`, `dusk`; name `nosul`, `ngrad`, `nfield`. Measured: 60fps (p99 16.8ms over 785 frames, headless), zero backward frames on a trackpad flick, top speed 0.215 cards/frame (strobe threshold 0.5), page scrolled 0px while the wheel was over the helix.

## Recommendations (Aaron picks; these are the defaults until he does)

- O1: a2 Book (one-screen two-column text-first table, "List" control near the greeting jumps to it) plus (b) Unwind as a double-click Easter egg (about 730ms; Coil or Esc returns). Straighten-on-scroll dropped: it recreates the "same items twice" and costs 1.3 viewports of pin.
- O2: (a) slide held to light (mirrored veiled copy of the photo behind a translucent pane; nothing invented). Downsides: text in photos reads backwards on the back; dark-mode backs go murky. Duotone is runner-up (louder).
- Work cards: our paper or night pane with the logo in its brand color (reversed to paper in dark); brand-color panes read as ads and break the one-accent rule. Backs: same material, no logo (a mirrored wordmark reads as backwards text; the "This site" mark would mirror, which is ruled out).
- O3: Stretch (builds over about 1.2s, relaxes over about 2s, critically damped). Stretch plus light is the fallback. Later non-Pacôme chevron idea: bend the whole helix axis into one shallow arc in the travel direction (sagitta at most about 4 percent of the pane), never a per-card fold.
- "Sulbaran": yes, small, 1px halo for legibility over passing cards.
- Palette: Dusk (sea-blue sky, burnt-orange horizon lower left). "Sea plus burnt orange" is the brighter alternative; in dark the rust is heavy. No grain; sub-1/255 dither only.

## Defaults

Axis 32 degrees (runs off top-left and bottom-right); 8 cards per turn; turn gap 1.5 card heights; card height 24 percent of the viewport (about 2.5 turns visible); curvature 0.7 (1 reads as tubes, 0 steps); idle 0.09 cards/s (one turn every ~89s); entrance 1800ms = stack, shutter (22ms stagger), a clear ~160ms beat as a closed band, a 750ms two-phase pull (seam parts along the axis like a split ring, then the band winds into the coil; this order stops the ends passing through each other) on an in-out curve. Camera FOV 26 (longer lens so near cards do not balloon), lean -12 degrees, spin speed cap 14 cards/s, wheel smoothing one exponential stage with a ~90ms time constant, the six placeholders spaced 3 to 4 cards apart.

## Where the lab says the locked list is wrong

1. Twenty cards cannot fill the pane at 24 to 30 percent card height without repeats (no-repeat fits looked sparse: about 1.5 turns of big loose cards, `fit=20`). Default uses 28 slots with 8 repeats, mostly in the clipped corners. Better: fill the six placeholder slots and grow the strand to about 28 to 30 real cards. The blank placeholders are the biggest visual liability in every frame.
2. Wheel capture over the silhouette: the silhouette covers the center diagonal where most cursors land. Now: ends when the cursor leaves, engages only at the top of the page, caret nudge after 2.6s. Add hover intent: capture engages only after the pointer has rested on the helix about 400ms, so a visitor already scrolling is never trapped.
3. "No AS mark on backs" vs "work backs consistent with photo backs" conflict for the "This site" card; resolved as plain work backs. Aaron to confirm.

## What builders need that the lab does not settle

- Endless strand: a window of M slot meshes over an infinite strand; each slot's card is its absolute position mod N; textures swap at the wrap, off screen. To morph into the list, latch each card's nearest copy and fly a dedicated mesh from its live pose. Scissor-clip the coil to the hero rect; flying cards render unclipped.
- Wheel vs page scroll: capture is a per-event test (page at top, list not open, pointer inside the silhouette). Everything else native scroll. Page scroll also feeds the conveyor gently, 1 card per 150px (toggle). One smoothing stage plus a hard speed cap is the "never jagged" guarantee.
- Shader cost: field at one third CSS resolution (about 144k px at 1440x900), 3-octave noise, two-step domain warp, Dusk's ping-pong drift ported from min/Max; roughly 2M noise samples per frame, under 0.2ms estimated on an integrated GPU. One full-resolution composite (field, name masks, dither); cards sample the field to recede by brightness. Pauses under reduced motion; skips rendering off screen.
- Text and color: the name lives in the canvas (between field and helix) and needs a real DOM h1 for accessibility plus a DOM hand-off when it lands in a heading. Mask textures sampled with explicit LOD (derivative sampling drew seams). Color management off so hex tokens map 1:1.
- Rendering: cards bend in the vertex shader (exact wrap onto a cylinder coaxial with the helix); picking raycasts the flat plane (off by about 5 percent of a card at 0.7, fine for hover). A fixed canvas lags scrolled DOM by up to one frame, so hero DOM overlays must move in the same rAF.
- Headless Chrome relaunched several times during long runs around in-place back-texture repaints; the lab never threw. Soak-test runtime texture repaints on real hardware.
- Not settled: real logos, the six missing photos, click-to-modal flight from a curved card, touch input on mobile. Phone reads as a near-vertical helix with 20 cards and no repeats (`phone-light.png`, `phone-dark.png`).
