# Design review of hero lab 2 at Aaron's picks (design-review skill, Opus, 2026-09-29)

State reviewed: `#o2=duo&sul=0&nf=grad&pal=ut&ang=33&cap=cards&vmax=12.5&go=1` (book, tone work cards, stretch, cpt 8, tg 1.5, cs 24, cv 0.7, fit rep, nudge on, page scroll on are lab defaults). Screenshots and patched verification copies in `/private/tmp/dr-lab2/` (`v1-field.html`, `v2-duo.html`, `v3-recede.html`, `v4-noplaceholders.html`; `calc/field.py` reproduces the shader to measure the orange share). Verdict: strongest hero so far; light mode close to shippable; four fixes before the port, all numeric.

Spec gap: the lab has NO 400ms hover intent; "cards only" capture engages on the first wheel event over a card. Slice 3 builds hover intent from the spec.

## Findings, ranked

Critical
1. The book breaks at 390px: both columns stay side by side, `white-space: nowrap` meta runs through titles. Fix: one column under 720px, meta stacked under the title.

Important
2. Dark duotone backs are murky: duotone #0F1A24 to #5E88AC starts at the field's value; dark `recede 0.5` compresses rear cards to about L 10 to 40; plain work backs painted solid `duo[1]` glow as the brightest slabs. Verified fix, still in the accent family: endpoints #15293C to #A3BFD6, dark recede 0.38, dark plain work backs #40566A.
3. Too much orange: desktop light 40 percent tinted (32 percent clearly warm), dark 30 percent (reads as brown mud); phone light 52, dark 46 (Aaron's "50/50" is accurate on a phone). Fix: move the second lobe outward and shrink it, plus a portrait term; result desktop 21.7 light / 18.3 dark, phone 22.1 / 19.5.
4. Light-mode contrast fails on the greeting (3.1:1 on blue) and the List control (2.8:1 on the orange zone); both use #6B6B6B at a 0.92 mix. Dark greeting 4.2:1 (just under AA). Mark and pill pass in both themes (12 to 17:1).
5. Hard seam at the hero's bottom edge in both themes (field clipped against paper), visible mid-scroll.
6. The name gradient runs left to right and fades toward the "n" (contrast 1.55 on the A to 1.22 on the n, light; 1.59 to 1.18 dark). A vertical gradient against the field's vertical gradient keeps a floor of 1.36 to 1.43 everywhere, including over the orange, and echoes the loader's rising fill. Note: the lab mixes the gradient at `nk * 2.2`, so "12 percent" is 26.4 percent of the gradient color; keep it, write it down. Grain inside the letters must be static (locked to the name's UV), at most plus or minus 4/255, never animated, or it shimmers against the moving field.
7. Blank panes dominate: six "Photo soon" tiles plus plain work backs make about 7 of 16 visible cards blank in light mode. A strand of real tiles only (9 photos, 5 work, repeats fill) reads full and deliberate.

Minor
8. The List control is only moderately discoverable: 940px from the greeting, 15px, 27px hit area; "List" is Pacôme's vocabulary and the appended arrow is a template tell.
9. Book: hover dims every other row including meta to 0.75 (meta drops to 3.1:1); the seen-ring column plus gap leaves meta 24px short of the rule.
10. Loader URL showed a "photos" status word (decision: number only). Menu light dim is neutral 45 percent grey and turns the field to mud; menu links sit low with dead space above; hero pill has blur and no shadow while the menu-lab pill has a shadow.
11. Phone: the mark sits on top of a photo card at the top-left.
12. Watch items, no change: lean -12 makes placeholder Inter wordmarks look oblique (goes away with real logos); edge-on curved backs near the top read slightly like curled pages (not a chevron fold).
13. Detector: menu-lab `.hdot` animates `width` and `margin` (line 113); use `transform: scaleX`.

Template tells and lookalikes: clean on chevron folds, scrambled backs, floor reflection, top-center toggle, blur, italics, tracked caps, em dashes. Remaining tells: "Hi, I'm" above a giant first name (Aaron's pick, keep) and "List with an arrow" (rename). The coil, the duotone backs and the sea-plus-ember field resemble neither reference.

## For slice 3 (values the builder applies)

1. Field palette `ut`: add uniforms `secAt` (lobe center, uv) and `secScale` (x, y); shader `lobe2 = 1.0 - length((vUv - uSecAt) * vec2(uAspect * uSecScale.x, uSecScale.y * pow(max(1.0, 1.6 / uAspect), 0.3)))`. Light: top #C0D5E8, bottom #F1F3F3, glow #8AAFD1, second #DC9562, sec 0.68, secAt (1.00, 1.20), secScale (0.70, 1.45), fa 0.8. Dark: top #0A0F13, bottom #132436, glow #2E5475, second #7A3512, sec 0.50, same secAt and secScale, fa 0.8. Expected orange share about 20 percent on desktop and phone.
2. Dark duotone `["#15293C", "#A3BFD6"]`, dark recede 0.38. Light stays `["#2A4B6D", "#E2E9F0"]`, recede 0.3.
3. Plain work backs in duo mode: dark pane #40566A; light pane stays `duo[1]`.
4. Name gradient vertical: `t = smoothstep(0.0, 1.0, 1.0 - g.y)` (bottom of the letters is 1). Light top #3A6289, bottom #1B3A5C. Dark top #5C87AD, bottom #9AC0DD. Mix stays `nk * 2.2`, nk 12.
5. Grain inside the letters: static hash noise in the name rect's UV, amplitude plus or minus 0.016 (4/255), one device-pixel cell, off while the name is landing, never time-animated.
6. Greeting color: light #3E4B59, dark #A9B4BF, mix 1.0 (not 0.92). Contrast light 6.3:1 on blue, 4.8:1 on peach; dark 7.5:1 or better.
7. List control: same colors as the greeting; padding 14px 8px (about 43px hit area); label "Work and photos" (names the book's two heads; the arrow only if Aaron wants it); hover goes to ink.
8. Hero bottom seam: in the composite, `col = mix(uPaper, col, smoothstep(0.0, 0.14, huv.y))`, so the field fades to paper over the last 14 percent of the hero height, both themes.
9. Strand from real tiles only: 14 tiles, pattern `PWPPWPPWPWPPWP`, `fit: rep`; placeholders never enter the coil and return as real photos arrive.
10. Book under 720px: one column, Work then Photos; `.brow` `grid-template-columns: minmax(0,1fr) 10px`, meta on a second line (`grid-column: 1; white-space: normal`), `min-height: 60px`, head `clamp(34px, 9vw, 48px)`.
11. Book rows: seen ring inline after the title (`margin-left: 10px`), drop the third grid column so meta ends flush with the rule; hover dim on `.t` only at 0.55, meta stays full muted (5.1:1).
12. Menu (slice 6): light dim `rgba(14,20,25,0.30)`; links start at 33 percent of the panel height; pill is paper at 0.82 with a 1px line and `blur(8px)` (sanctioned), no shadow, identical in hero and menu; `.hdot` animates `transform: scaleX`.
13. Loader (slice 4): number only, no status word.
14. Phone header clearance (slice 7): keep the coil's top 64px clear of the mark (shift the coil center down 32px or clip slots whose projected top edge is above 64px).
15. Hover intent (slice 3): wheel capture starts only after the pointer has rested over a card for 400ms.

## Approved as is

Helix geometry (axis 33, 8 per turn, gap 1.5, card 24 percent, neighbor gap 0.05, lean -12, curvature 0.7, repeats fill); stretch; cards-only capture with the 2.6s nudge; page scroll turns the coil; spin cap 12.5; slow idle; light duotone backs; work cards as our pane with the logo, backs same material no logo; Sulbaran off; name weight and position; greeting placement; mark and pill on desktop; book hierarchy, heads, 54px rhythm, dark book colors; loader tone a on dark; menu M1 structure and link type; seen ring in the card's upper corner.

## Skill notes

The impeccable critique flow needs a snapshot write and a live overlay server, neither fits a read-only run; proposed SKILL.md edit: "In read-only runs, run detect.mjs only; skip critique persistence and the live overlay." Impeccable reports an update available (3.5.0 installed, 4.3.1 latest). `browser-policy.md` still says to end with `close --all`; our multi-agent rule is close only your own session.
