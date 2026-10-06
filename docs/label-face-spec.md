# The label face

Status: design settled in the type lab on 2026-10-05 (preset "Aaron's final, reviewed", after an independent design review, a builder and reviewer exchange, and Aaron's rulings on the four open points). Not built. Lab record: `docs/lab-log-2026-10-05.md`, "Type lab". This spec is the source for the implementation plan; the lab's copied JSON for that preset is reproduced in the values below.

## 1. Why

The site pairs Profa Black (display) with Inter (body). The small text in between, in Inter, read as default UI chrome beside the headlines: the back link and role line on a case page, "Pause" and "Resume" in the band, kickers, nav, the pill. Aaron wanted that text to carry the same voice as the display face. He chose Profa Bold.

The review found one thing his first pick lost: with every small text bold and in the accent, color no longer said what could be clicked, and in light mode the page drifted toward the navy-fintech look on the anti-reference list. The settled design restricts the accent to interactive text and to meta attached to a title.

## 2. The rule in one paragraph

Small, non-body text is Profa Bold at 1.06 times its old size with 0.01em tracking and the line height it has today. It is the accent color when it can be clicked, or when it is a line attached to a Profa Black title (a role line, a book row's meta). Every other small text (hints, kickers, credit prose, the pill's secondary lines, the footer copyright) is the muted color in the same face. Body paragraphs stay Inter; display stays Profa Black.

## 3. Values

| Setting | Value |
|---|---|
| Face | Profa Bold, weight 700, from `app/fonts/ProfaTrial-Bold.ttf` until the full cut lands; the same unicode-range carve-out as Black for the stamped `*`, `;` and `@` |
| Fallback | Inter, then system sans. The arrow and the `@` in the email fall back to it |
| Size steps | three: `label-sm` 12.72px (0.795rem), `label` 14.84px (0.9275rem), `label-lg` 19.08px (1.1925rem). Everything that was 10 to 13px lands on `label-sm`; 14 to 16px on `label`; the calls to action on `label-lg` |
| Line height | as today for each element (`label` keeps text-sm's 20px line) |
| Tracking | 0.01em on every step |
| Weight | 700 everywhere; today's `font-medium` on label elements becomes redundant and goes |
| Interactive color | `text-accent`, `hover:text-accent-hover` |
| Beside-a-title color | `text-accent` (role lines, book meta) |
| Non-interactive color | `text-muted` (hints, kickers, credit prose, the pill's artist, "Paused", "Music?", the pill tip, the footer copyright) |
| "Not now" | muted, with a 1px underline 4px below the baseline like "Play it", in muted at 40 percent in light and 55 percent in dark |
| Icons beside labels | lifted 1px (Profa sits about 0.07em higher in its line box than Inter) |
| Back link | a drawn lucide `ArrowLeft`, 14px, stroke 2.5, lifted 1px, followed by "Work"; the "←" character goes |
| Band row | controls on the heading's baseline (`items-baseline`); 36px after the question, 16px between "Play it" and "Not now" |
| Role line, case page | below the title: `label-lg`, 700, accent, 14px gap |
| Role line, modal | below the title: `label`, 700, accent, 6px gap |
| Seen book row | title at 0.55 as today; meta at 0.75 (0.55 fails AA for small text); both full on hover and focus |
| Book row wrap | the meta drops under its title only when the two do not fit side by side (a wrapping flex row); if mixed rows in one column read worse than an occasional wrapped title, the fallback is whole-column wrapping below about 360px of column width |
| Copy | `book.workRows` `claude-ambassador` meta becomes "Claude ambassador, 2025" |

Contrast at these values: accent on the page about 11 to 1 in light and 8 to 1 in dark; muted about 5 to 1 in both; the seen meta at 0.75 at least 4.6 to 1 in both.

## 4. Tokens

- `lib/fonts.ts`: a `profaBold` loader (`next/font/local`, weight 700, `--font-label`, the unicode-range declaration), on `<html>` beside the other two.
- `tailwind.config.ts`: `fontFamily.label: ["var(--font-label)", "var(--font-sans)", "system-ui", "sans-serif"]`; `fontSize["label-sm" | "label" | "label-lg"]` with the sizes above, `letterSpacing: "0.01em"`, and `lineHeight: "1.25rem"` on `label`.
- `.gitignore`: allowlist `app/fonts/ProfaTrial-Bold.ttf` beside Black.
- No new color tokens. Muted and accent are the existing ones.
- A Layer 1 edit for Aaron: the Stack row "the only tracked font file" and the Typography paragraph in AGENTS.md.

## 5. The elements, by role

Every element below takes `font-label` and the step named; its color per section 2. Line references are from the rollout map taken on 2026-10-05 and will drift; the builder re-greps.

Controls and links (accent): the case page back link (`app/work/[slug]/page.tsx`) and its calls to action (`label-lg`); the band's "Not now", "Pause", "Resume" and the phone-only "Play it" (`components/soundtrack/BandInvite.tsx`); the freeze toggle (`BandStage.tsx`); "See more" in `WorkModal.tsx` (`label-lg`); `FreezeRow` in `PillParts.tsx`; "Open in Spotify" in `PlayerCard.tsx` (`label-sm`); the links in `app/not-found.tsx` and `app/error.tsx`; the credit's links (`BandStage.tsx`, `label-sm`).

Meta beside a title (accent): the role lines in `page.tsx` and `WorkModal.tsx`; `META_CLASS` in `components/book/BookRow.tsx`.

Hints and secondary (muted): "Press Esc to close" in `WorkModal.tsx`, `PhotoModal.tsx` and `DefinitionModal.tsx` (whose hard-coded hint moves into `siteContent` while there); the credit prose in `BandStage.tsx` (`label-sm`); in `PlaybackPill.tsx` the tip (`label-sm`), the preview artist (`label-sm`) and the capsule text when paused or unanswered; `PillLabel.tsx`; in `PlayerCard.tsx` the artist, the status and the times (`label-sm`, tabular figures kept).

Kickers and labels (muted): `AboutIntro.tsx`, `WhoIAm.tsx`, `UpToNow.tsx`, `Connect.tsx` kickers and the Connect link labels.

Nav (accent, all links): `SiteNav.tsx` bar links; `MenuPill.tsx` text; `MenuPanel.tsx` chips, email and socials (`label`).

Credit and footer: `Footer.tsx` copyright (`label-sm`, muted; its `tracking-wide` goes).

Untouched: body copy; display text; `components/coil/HeroOverlay.tsx` (its text sits on the shader field with its own token and the scene sets the control's size; decide separately); the custom cursor's "Open me"; `components/recruiting/*` and `app/recruiting/*`; the holding page; the lab.

## 6. More than a class swap

1. **The playback pill and player card** set family, sizes and colors inline (`PlaybackPill.tsx`, `PillParts.tsx`, `PillLabel.tsx`, `PlayerCard.tsx`). They move to classes or one shared style object reading `var(--font-label)`; the capsule's inline padding change during preview stays.
2. **The back link**: `siteContent.work.backLabel` becomes "Work"; the page renders the icon before it.
3. **The band row**: `items-baseline` on the controls grid; the two gap changes; the "Not now" underline with its per-theme opacity (`color-mix` on the muted token, or two utilities under `[data-theme="dark"]`).
4. **The modal role line** moves after the `<h2>` as a `<p>`. The dialog's accessible name is unchanged. The title block stays under the 80px logo slot, so `[data-tile-slot="work"]` does not move; `e2e/flight.spec.ts` confirms.
5. **Book rows**: the grid becomes a wrapping flex row; the seen state dims the meta too.
6. **Tests**: `e2e/soundtrack.spec.ts` `band-still` snapshot regenerated (the band's text widths change); the footer and docked-capsule overlap test rerun (Profa Bold is wider than Inter Medium); the a11y contrast pass rerun; `lib/content.test.ts` for the copy change; a unit test that the three steps are the only label sizes in `tailwind.config.ts`.

## 7. Scope limits

- Phones follow the same rules; no phone-specific values. The lab checked 390 wide.
- No metric overrides on the font loader this pass (the 1px lift on icons is the chosen fix). If the full Profa cut ships with different vertical metrics, revisit.
- No change to what is interactive. The label face changes how things look, never what they do.
- Aaron rewrites copy himself later; only the one meta string changes here.

## 8. Build order

One PR into `main` from a branch `label-face`, small commits, an Opus 5.5 builder, a fresh reviewer, Fable's final look on a local production build in both themes at 1440, 1024 and 390:

1. Tokens and the font loader; the three steps; the gitignore line.
2. Class swaps by role, one commit per role, with the color rule.
3. The pill and player card off inline styles.
4. The band row, the back link, the modal reorder, the book rows and the seen state, the copy change.
5. Tests and snapshots.

Merging is Aaron's call (merges are on hold while the labs iterate).
