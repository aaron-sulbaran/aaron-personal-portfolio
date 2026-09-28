# Coil wireframe checklist (read, tick, change)

How to use: tick `[x]` what you accept, write `change:` under anything you want different. Frame ids point at the board: `docs/research/refresh-2026-09-27/prototypes/wireframe/board.html` (or the four PNGs beside it). Logo tiles point at `prototypes/logo5/sheet.png`. Current-site captures for comparison: `prototypes/site-now-2026-09-28/`. My recommendation is marked "rec". Nothing below gets built until this file is ticked.

## 0. Already decided (confirm or reopen)

- [ ] Desktop hero: the Coil, list as the scroll destination, no mid-walk, native scroll only.
- [ ] Display face: Profa Black, no accent word, Inter body. (License: class asset pack; closed.)
- [ ] Labels: sentence case in the body sans; numbers only where sequence is real.
- [ ] Recruiter list order: Talos, min/Max, Capital One, IEEE, Anthropic ambassador, hackathon builds, then photos; placeholders never.
- [ ] Mobile is a first-class version of the same object (spec revised 2026-09-28).

## 1. The transformation: pick a variant (board, `board-variants.png`)

- [ ] **V1 Spring** (`D-V1-01..06`): upright axis 0 to 4 degrees, "Aaron" scales up behind the coil and reads through the gaps, lands in one column right with greeting and contact left. Shows the transformation best.
- [ ] **V2 Strand** (`D-V2-01..06`): 8 degree lean, lands two-column (work rows left, photos 3x3 right). Best recruiter landing; fits every desktop height; needs a stacked layout in iPad portrait; lean makes drag-to-spin ambiguous on phones.
- [ ] **V3 Turntable** (`D-V3-01..06`): seen from 40 degrees above, camera lowers as it flattens. Weakest coil (photos at a steep angle, two motions at once, harder flight projection); gives the greeting the most room on phones.
- [ ] **rec: V1 geometry with V2's landing** (upright spring and name-behind, landing as work rows plus a photo strip). Takes the best of both; solves the 720px height problem.

Details inside the pick:
- [ ] Name behind the coil: keep (`D-V1-02`, `D-V1-03`) / drop. rec keep, judge weight on the specimen.
- [ ] At landing the name appears twice ("Hi, I'm Aaron." block and the "Aaron" list heading, callout 9). rec: the heading becomes the greeting; the small block goes.
- [ ] Photos at landing: single column (V1) / 3x3 grid (V2) / one horizontal strip row (fits 1280x720). rec strip.
- [ ] Pinned distance 1.3 viewports, opening 0 to 40 percent, straightening 40 to 100, release at the list (scroll rulers under each strip). rec as drawn.
- [ ] Entrance: 600ms riffle onto the band, then the greeting fades up, before scroll arms. rec as drawn.
- [ ] Aspect checks: band never clips the greeting at 1280x720 / 1024x768 / 1920x1080 (`L-*`, `U-*`); list fits 720 tall only with the strip.

## 2. Mobile (`P-*` rows)

- [ ] Band at load with a "drag the band to spin it" hint and a "View work" cue (`P-V1-01`).
- [ ] Opening is timed (about 900ms), not scroll: a vertical scroll during the hold starts it immediately and is never hijacked (`P-V1-02`, `P-V1-04`, timeline under the row).
- [ ] The list is the resting state under normal page scroll (`P-V1-05`).
- [ ] Easter egg: the "coil" pill returns to the coil, and on a phone the coil spins by dragging, releases and coasts, settles on a card; "list" returns (`P-V1-S`, callout 13). rec yes; lock the drag to horizontal.
- [ ] Reduced motion: DOM list only, no scene (`P-V1-RM`).
- [ ] Tablet: portrait uses the phone driver with the list stacked under the greeting (`TP-*`), landscape uses the desktop driver (`T-*`); test on a real iPad because Safari's collapsing toolbar is the phone pin problem at a smaller scale.
- [ ] Budget on phones: 256 to 384px textures, DPR capped 2; verify on a real iPhone and a mid-range Android before merging.

## 3. Nav and menu (`board-nav-menu.png`)

- [ ] During the hero: only the mark top-left and "Menu" top-right; no top nav (`NM-D-a`).
- [ ] The current left scroll-spy rail (HOME / WORK / ABOUT / CONNECT in tracked caps) duplicates the nav and breaks the label rule: retire / restyle in sentence case. rec retire.
- [ ] After the hero list leaves: sticky nav slides in, mark + Work About Connect (sentence case), headroom behavior, scroll-spy underline (`NM-D-b`).
- [ ] Menu: full-bleed panel in Profa Black, four links (Home Work About Connect, no numbers), hover keeps the hovered link at full ink and dims siblings to 0.75 with an accent underline, theme and soundtrack toggles bottom-left, contact links bottom-right, Close exactly where Menu was (`NM-D-c2` vs current `NM-D-c1`).
- [ ] Coil / list control: top center pill, hero-local so it scrolls away with the list and never fights the sticky nav (`NM-D-d1`, rec) / beside the list heading (`NM-D-d2`).
- [ ] Phone chrome mirrors desktop (`NM-P-a..d`); three nav links fit at 390, below 360 fall back to Menu only.

## 4. Background (`board-backgrounds.png`)

- [ ] A fine grid (Pacôme's exact move; closest resemblance).
- [ ] B grain (static noise, a few KB; muddy in dark mode above about 3 percent).
- [ ] C single-hue light sweep following the coil's focus (one uniform in the Coil canvas; must stay one hue or it reads as a gradient).
- [ ] D shader field (a second full-screen shader; needs the Layer 1 rule "no gradients on section backgrounds" changed; highest GPU and taste risk).
- [ ] E the existing waveform behind everything (already on main; a moving sine behind a moving coil is two motions at once).
- [ ] F waveform plus grain.
- [ ] rec: B plus C in the hero; E stays where it already lives, from the Listen invite down. Say so if you want D and I will draft the Layer 1 change.

## 5. Labels and voice

- [ ] Meta lines in Inter, sentence case, muted: "Capital One, product intern, 2025", "IEEE UT Austin, president, 2025 to 2026", "Talos, open source soon", "Graduation, UT Austin".
- [ ] Nav casing: "Work About Connect" (sentence case, rec) / "work about connect" (lowercase, Pacôme's chrome). You said you do not text in lowercase; sentence case is the honest default.
- [ ] Counters only on the case rail ("01 Problem, 02 My role, 03 What shipped, 04 Outcome").
- [ ] Everything on the live site that uses tracked caps moves to this rule: work-row meta, "A note from me", the spine, the phone caption, the Menu numbers.

## 6. Logo (round 5, `prototypes/logo5/sheet.png` and `small.png`)

All straight edges, two bends, tapered ends, the tail as the A's right leg. Reads bolt first, S second; the lever for more S is a steeper middle kick (about 18 degrees instead of 12), not curves.
- [ ] **A3** cursive two-segment leg (rec lead: closest to your sketch, clearest A at 44px, most open counter).
- [ ] **S1** straight leg, flat bar (clean, typographic).
- [ ] **S2** strong taper (purest wide-top-to-point; thinnest tail).
- [ ] **A2** rising bar (more hand-drawn, fussier at 44).
- [ ] **C2** bolt alone at weight +1 as the favicon (rec; no A survives 16px).
- [ ] Rejected for you: S5 hook (snapped tip), S4 short kick (stock icon), S3 12 degree lean (drifts toward a 5), X1 mirror (Z).
- [ ] change: steeper kick (18 degrees) tile / I will sketch my own on top of A3 / other.
- [ ] Nav slot at 28px puts the A stroke at 1.2px (borderline); accept, or use the bolt alone below 32px.

## 7. Seen state and small behaviors

- [ ] Opened cards carry a subtle "seen" state in the coil (lower brightness, small edge dot) and in the list (muted title, same dot), session-scoped.
- [ ] Click on a card: flight to the existing modal (photos) or the case page (work); Esc returns focus.
- [ ] Failure: a rejected asset becomes a placeholder; a failed scene leaves native scroll and the DOM list working.

## 8. Layer 1 changes this implies (AGENTS.md, need your instruction)

- [ ] "Desktop and mobile are separate home experiences" becomes "one object, two drivers": the Coil on both, scroll-pinned on desktop, time/touch on phones; MobileHome retires.
- [ ] "No gradients on section backgrounds": unchanged unless you pick background D.
- [ ] Fonts row: Profa Black becomes the display face site-wide; Instrument Serif and Space Grotesk retire; the "italic accent allowed" clause goes.
- [ ] Typography section: sentence case for labels (already there for headings), no tracked caps.

## 9. Still yours

- [ ] Talos coming-soon copy (an in-depth description plus "open source soon").
- [ ] min/Max live link and custom domain.
- [ ] Which five placeholder photo slots get real photos, or get cut.
- [ ] "apply" for the AGENTS.md Layer 2 diff proposed on 2026-09-27.

## What happens after this is ticked

1. One composed specimen (hero band with the name behind, coil, list landing in the chosen layout, section head, case title, nav, Menu, the chosen background, light and dark, desktop and phone) built by one Opus agent, reviewed by the design-review skill and Codex, judged by you. This locks the visual system before code.
2. Slice 1 of `docs/coil-hero-spec.md`: controller extraction from TileRing, `lib/coilGeometry.ts` with tests, the DOM list server-rendered behind a flag. Opus builds in a worktree, Fable and Codex review, merged to main.
3. Slices 2 to 6 per the spec, one at a time, each merged.
