# The waveform follows the reader

Status: design agreed with Aaron in chat, 2026-10-02. Not built. Conferred with an Opus 5.5 design agent before writing. This supersedes the line in decisions 2.10 that says "nothing animates behind body text"; the replacement rule is section 4 and is recorded as 2.11 in `docs/design-decisions-2026-09-28.md`.

## 1. Why

The soundtrack band under the book did what was asked too literally. The waveform sits in one spot, so a visitor only sees the music-synced motion if they park there, and the pill that takes over afterwards is small enough to be missed. Aaron's goals for this pass:

1. The waveform clearly follows the reader down the page in a fixed position that persists past the band, and it gets there with a visible handoff, not by simply staying put.
2. The pill is easy to see and click at the bottom, and its arrival tells the visitor that this is where the music lives.
3. None of it costs readability on "Who I am" or any other text.

Every section should read as a clean invitation to keep scrolling.

## 2. The experience

The band stays under the book and stays the place where the wave is introduced and the choice is made. The ask is not duplicated anywhere else.

**In the band.** The heading becomes the question: "Want some music while you scroll?" with one line under it, "I put together a short playlist for this site. The wave follows you down the page.", and two controls, **Play it** and **Not now**. The wave runs through the band as it does today.

**They say yes.** The music starts and the wave reacts to it. The band's note reads "Keep going, the music will follow." As they scroll away, the wave slides out of the band and arrives along the bottom of the viewport (section 3), and the pill condenses down out of the control they pressed and settles on the wave's line at the bottom left. It lands open, saying "Music and volume live here.", holds for about 2.6 seconds, then collapses to the capsule showing the track title.

**They say no.** The band's note reads "No problem. It'll be here if you change your mind." As they scroll away the same handoff plays: the wave follows as a calm background that moves with the scroll and does not react to any music, and the pill condenses down saying "Here if you change your mind.", then collapses to a quiet capsule that reads "Music". One click on it starts the soundtrack.

**They do not answer.** The handoff still plays; the pill arrives as a capsule that reads "Music?" and one click is a yes. Nothing is persisted.

**Scrolling back up.** Everything reverses: the wave climbs back into the band and the pill rises back into the band's controls.

**Returning visitors.** A stored yes restores as paused, as today: the band shows "Resume", and the pill arrives saying "Welcome back. Your music is here." once per session. A stored no gets the quiet capsule and no question. "Not now" keeps persisting; the promise is the capsule staying within reach, not a second ask.

**Arriving past the band** (a deep link to `#about`, an anchor jump, a reload down the page): the source of the condense is not on screen, so the pill rises 12px and fades in from the bottom instead. Same label rules.

## 3. The handoff: one train on two tracks

One wave engine steps one field. Two canvases paint it.

- The **band view** is today's canvas in the band, unchanged in place.
- The **horizon view** is a new fixed strip at the bottom of the viewport, 176px tall, behind all content (z 0, the slot the old waveform used; content is z 10). It Portals to body, takes no pointer events, and is offset by `--scrollbar-comp` on the right so a scroll lock never resizes it.

Think of the wave as a train of columns. A single number, `sweep`, runs from 0 (all of it in the band) to 1 (all of it on the horizon). The band view paints column `i` at `x_i - sweep * L`; the horizon view paints the same column at `x_i + (1 - sweep) * L`, where `L` is the train's length (columns times spacing, a few px under the view width), so the tail and head coincide exactly. The band's tail and the horizon's head always meet at the same x, so the wave visibly leaves the band to the left while the same ribbon fills in from the right, lower down. At the junction the last ten columns leaving the band curl downward and the first ten arriving rise from below, thinning toward the tip, so it reads as a snake and not a sliding slab. While the train is in transit its displacement swells by up to 60 percent, then calms once it lands.

`sweep` is driven by one ScrollTrigger on `#listen` (start `center 60%`, end `bottom 15%`) whose `onUpdate` writes a target and animates nothing; `onLeave` and `onLeaveBack` pin it to 1 and 0 for anchor jumps. The engine eases toward the target with one exponential stage (lambda 8 per second, capped at 1.5 sweeps per second), so a jump plays as a glide of about 0.7 seconds. It is a pure function of scroll position, so the reversal is free. A deep load past the band starts at 1 with no glide.

**Moving with the reader.** The Coil does not use GSAP for scroll; its conveyor reads scroll deltas in its own frame loop (`lib/coil/motion.ts`). The wave gets the same thing in a new pure module, `lib/waveform/conveyor.ts`: 1px of page scroll travels the wave about half a pixel (down travels it left, up travels it right), an idle drift of 0.4 columns per second, a lead clamp of 12 columns, lambda 11, and a speed cap of 40 columns per second so a flick never aliases. The field takes a `phase` input for this; the audio bands stay bound to their columns, so the spectrum stays put while the shape travels.

**Engine split.** `waveEngine.ts` becomes a conductor (field, loop, audio sample, regime, clock, conveyor, sweep) and a view (layout, weights, avoid rects, paint). Weights and the carve move from field time to paint time so two views with different weights can share one field; for the band at constant weights this is a visual no-op, and `e2e/pixels.spec.ts` is the guard.

**Regimes on the horizon.** On: reactive to the music. Paused: the thin waiting line. Declined or unanswered: the calm idle drift, travelling with the scroll, no audio. This replaces "Maybe later leaves a still line".

The rejected alternatives: one viewport-sized canvas with a literal S-curve (the drawn band trails the real band by a frame during a flick, so dots cross the band copy, and the curve cuts through the About heading mid-transition), and moving or pinning the band's own canvas (the page pins nothing, and a 300px canvas squeezed into a 176px strip squashes the dots).

## 4. Readability: the wave ducks under text

This is the rule that replaces "nothing animates behind body text". Think of a sidechain compressor: text is the kick, and the wave ducks under it.

- The text blocks of About, Who I am, Up to now, Connect and the footer carry `data-wave-avoid`. The horizon view measures their document rects once per layout (ScrollTrigger refresh, `document.fonts.ready`, a ResizeObserver on `main`), pads them 20px, and each frame subtracts `scrollY` with no layout read.
- Any column under a text box ducks to a still centreline with no fuzz. Attack about 60ms, release about 450ms. Text about to enter from below ducks its columns early, by a look-ahead that scales with the downward scroll speed: zero at rest, 160px at 1500px per second and above. (A fixed 160px hid about 70 percent of the strip while the wave was arriving at 1440 by 900.) The speed is tracked by a small pure helper that takes no sample across a pause in painting and resets when the wave returns to the band.
- Ducked dots have an alpha ceiling of 0.07 in light and 0.11 in dark (measured 2026-10-03 against the tokens: the spec first said 0.09 and 0.15, which left muted text over an accent dot at 4.36 and 4.22 to 1). Those values keep muted body text at 4.5 to 1 or better against the darkest dot pixel. A pure test, `lib/waveform/contrast.test.ts`, computes this from the token hexes, so a palette change fails a test before it fails a reader.
- In open air (gutters, the gaps between sections) the dots paint at muted 0.40 and accent 0.55 in light (raised from 0.30 and 0.50 after the design review found the ribbon too faint to follow), muted 0.40 and accent 0.70 in dark, lower than the band's values. The strip's top edge fades out with a CSS mask.
- The horizon caps column thickness at 6, so the loudest passage is a dense column, never a wall.
- The strip's baseline sits 72px above the bottom of the viewport. The pill sits on that line; its glass blur softens the dots behind it, and there is no carve (a notch under a 36px capsule would read as a gap in the line; decided at the whole-branch review, 2026-10-04).

## 5. The pill

The existing `PlaybackPill` stays the component; it sits at the bottom left on the wave's baseline, 24px in so it shares the header mark's left edge, and grows a label layer. (Aaron's ruling of 2026-10-05, from mockups of four placements on the real build: at bottom centre the fixed capsule sat on the reading column in every section; at bottom left it is clear at 1440 in every state. Below about 1280 wide it can still cross text while scrolling; a fade under text was offered and not taken.) The player card and the tooltip anchor to the capsule's left edge.

- Capsule height goes from 26px to 36px with a 44px hit area. It uses the menu's `NoteIcon` so the two controls match.
- Hidden through the hero and the book (the Menu's note covers audible music there). Present from the band down in every state, including declined. The rule in `lib/waveform/pill.ts` becomes a pure `dockMode()` with tests.
- **Arrival.** When the sweep target passes 0.35 and the band's controls are still on screen, the pill is born at the pressed control's viewport rect and travels to the dock in one GSAP tween of about 600ms on the site's ease, while the band's control fades over 150ms. It is timed, not scrubbed: a fixed element chasing a scrolling one frame by frame is the lag problem from section 3. Scrolling back above the threshold plays it in reverse. When the source is off screen it uses the rise from the bottom.
- **Label.** The pill lands open with its one line (section 2), holds 2.6 seconds (hover or focus pauses the hold), then collapses in 360ms. The label is shown once per page load per state.
- **Audio failure.** If the player does not report playing, the label reads "I couldn't start the music. Press here to try again." and the state is paused. Nothing ever claims music that is not audible.
- "Freeze the wave" is in the player card, since the wave is now everywhere. The band keeps the toggle on desktop while the state is unanswered or declined (those visitors have no card), and always on phones. The band keeps the CC BY credit.

All copy lives in `siteContent.listen` and `siteContent.soundtrack`; the keys that no longer have a reader are deleted, not stranded.

## 6. Scope limits

- **Phones are unchanged this pass.** No horizon view and no pill below the phone breakpoint; the band stays the ask and the control, with the new copy. A 375px reading column would keep the wave ducked almost permanently, and bottom toolbars move fixed elements. Revisit after the desktop version has been used on real hardware.
- **Reduced motion.** No conveyor, no sweep travel, no swell. The horizon draws the still line once and cross-fades in when the band is passed. The pill uses fades only. A live toggle rebuilds the conductor, as today.
- **Not in this pass:** the wave reshaping itself into other forms once it is background (Aaron's helix idea). The conductor and view split is what makes that possible later, since a view only decides where a column is painted.

## 7. Cost and failure

- The horizon strip is about 570k backing pixels and at most about 1,430 dots; under 1ms a frame on an integrated GPU, under 3ms while both views paint during the sweep. The Coil is never live at the same time; its observer stops it a full screen earlier.
- 30fps when the regime is idle, paused or still and the conveyor is at rest; 60fps when music is on or anything is moving. The loop stops when the tab is hidden, the reader is above the band, the wave is frozen, or everything has settled. The ScrollTrigger update and the soundtrack store wake it.
- No 2D context leaves the pill fully working.

## 8. Tests

Unit (vitest, pure): the conveyor, the sweep easing and train positions, `dockMode()`, the duck envelope, and the contrast ceiling from the tokens.

End to end (Playwright), through a `window.__waveProbe` hook in the style of `flightProbe`:

- `e2e/soundtrack.spec.ts` test 1 asserts today that no canvas is fixed and no text sits over one. It is rewritten to the duck rule in the same PR.
- Sweep follows scroll: 0 at the band, strictly increasing through the range, 1 past it, back to 0 on the way up, with a quiet second of no horizon repaints at rest.
- Readability, light and dark, for each text block crossing the strip: every column under it paints at or below the ceiling.
- Layering: the horizon is z 0 with no pointer events, and `elementFromPoint` over a text block returns the text.
- The yes path, the no path, the unanswered path, the returning-yes greeting once per session, the deep load at `#about`, the audio failure copy, reduced motion, and a 375px phone with no horizon element.
- `e2e/pixels.spec.ts` on the band before and after the engine split.

## 9. Build order

1. Engine split and conveyor, band visually unchanged (pixel guard).
2. The horizon view, the sweep and the duck rule, with the rewritten e2e rule.
3. The pill: dock position, capsule size, arrival, labels, copy; the band's new copy.
4. `/design-review` on a local production build, then Aaron's look.

Each is one PR into an integration branch `wave` cut from `main`, small commits never squashed, an Opus 5.5 builder per slice, Fable review. Merging `wave` into `main` and pushing is Aaron's call, as with `coil`.
