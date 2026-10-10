# C3 Card System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Coil and the book off the legacy shapes and onto the fourteen launch cards, and give every card its modal: logo cards, photo cards, the jobs timeline and the Mentorship card's mentors, with the photo gallery Aaron picked in the gallery lab (rows on desktop, a pager on phones).

**Architecture:** One derived list, `strandCards` (`lib/content/strand.ts`), drives the Coil's faces, the unwound list, the book rows and the flight's landing kind. The scene keeps its module pattern: only `lib/coil/textures.ts` learns three new faces (a logo on a plain or anvil tile, the AS mark, the jobs circles) and `scene/boot.ts` loads them; no new frame step. One modal, `components/card/CardModal.tsx`, replaces `PhotoModal` and `WorkModal`: a pure plan (`lib/gallery/plan.ts`, the lab's round six rule) decides which photos sit beside which words, and two layouts render it (`CardRows` at 1024px and up, `CardPager` below), with the lab's mask-in and rotator on top. The flown card still lands on `[data-tile-slot]`: beside the rows, the card picture's 3:4 box for a photo card and the header's 3:4 tile for every other card; on a phone, the header's 3:4 tile for every card, because the phone header stays put while the pages turn.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind 3.4 with CSS custom properties, Framer Motion 12 (modal shell only), GSAP 3.15 (SplitText, CustomEase "site", from `@/lib/gsap`), vanilla three 0.186 (the scene chunk only), vitest (`lib/**/*.test.ts`, node), Playwright (Chromium channel, local production builds).

**Spec:** the untracked hand-off in the main checkout's `docs/content/` (`build-brief.md` GO section, `launch-content-plan.md`, `cards.md`, `modal-gallery.md`, `interactions-brief.md`, `logos.md`, `photos.md`), the gallery lab on branch `lab` at commit `ae9b6dd` (`app/lab/gallery/`, round six, Aaron's pick of 2026-10-09), the merged plans `docs/superpowers/plans/2026-10-08-c1-content-model.md`, `-c4-assets.md`, `-c2-inline-links.md`, and the hand-off notes in PRs 40, 41, 42 and 46. Builders work in worktrees that cannot see `docs/content/`: every string and number a task needs is quoted in that task. Read `docs/coil-input-model.md` and `docs/coil-scene-modules.md` before Tasks 6, 8 and 9.

## Global Constraints

- No em dashes anywhere: code, comments, strings, commit messages, the PR body. Use commas, semicolons or separate sentences.
- Tokens only. No hex in components; a new color is a token in `app/globals.css` (`:root` for light, `[data-theme="dark"]` for dark) read through `var()`. `bg-background/NN` and `bg-accent/NN` emit nothing under Tailwind 3 with `var()` colors: use `color-mix(in srgb, var(--token) NN%, transparent)` in a style or an arbitrary value.
- Copy only through `siteContent` from `@/lib/content` (accessible names included); first person; sentence case. Do not change any approved string in `lib/content/cards.ts` other than the mentors list (Task 1).
- External links: `target="_blank" rel="noopener noreferrer"`.
- Reduced motion, live in both directions: the modal panel fades only, no masks, no auto-advance, instant photo changes, no pager travel, no flight.
- Modal primitives only from `lib/modal.ts` (`useBodyScrollLock`, `useEscapeKey`, `useFocusTrap`, the backdrop variants). Fixed overlays through `components/Portal.tsx`. No new dependency.
- The Coil's invariants (AGENTS.md Layer 2, "LOAD-BEARING INVARIANTS") hold: three lives only in the CoilScene chunk; `lib/coil/cardFace.ts` stays import-free; the flown card is the rendered card; `components/coil/CoilScene.tsx` stays about 220 lines (227 today; this slice changes two lines there and adds none); a new per-frame concern would be a `components/coil/scene/` module plus a `lib/coil/frame.ts` step, and this slice needs none.
- Hero values live only in `lib/coil/constants.ts`; gallery values only in `lib/gallery/constants.ts`. Do not change any existing `COIL` value: the retune comes after Aaron's look (Task 18 lists what it would touch).
- Component files under 200 lines; scene modules and `lib/coil/textures.ts` under 400.
- Leave the legacy shapes for the C5 sweep: `strandTiles`, `homeTiles`, `photos`, `workItems`, `book.workRows`, `book.photoRows`, `strand.pattern|photos|work`, `work.*`, `photoBySrc`, `workItemBySlug`, `photoSlotSizes`, the case pages, the placeholder assets, `lib/content.test.ts`. C3 stops reading them. The one exception: `components/PhotoModal.tsx` and `components/WorkModal.tsx` are replaced here and deleted in Task 9.
- Do not edit `docs/`, `AGENTS.md`, the recruiting files, the holding page or the `lab` branch. Never commit anything from `docs/content/` (untracked, private, kept out through `.git/info/exclude`): never `git add -A` or `git add .`; add files by path.
- Branch `c3-card-system` from `origin/main`; worktree `/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c3-card-system`; one PR into `main`; small commits, never squashed.
- Ports: a local full production server on 3370; e2e always `CI=1 E2E_FULL_PORT=3246 E2E_HOLDING_PORT=3247` after `lsof -nP -iTCP:3246 -sTCP:LISTEN; lsof -nP -iTCP:3247 -sTCP:LISTEN; lsof -nP -iTCP:3370 -sTCP:LISTEN` prints nothing for the ports you are about to use.
- Never `pnpm dev` and `pnpm build` in one checkout. Stop only a server you started, by the PID you wrote to a file in your session scratchpad (`$TMPDIR` below; shell variables do not survive between Bash calls). Never `pkill`, `killall`, a pattern, or a port you did not open. Never `vercel deploy`, never push `main`.
- Every commit: `git commit -m "<subject>" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"` for a Sonnet builder, `Claude Opus 5.5` for an Opus builder.
- Never push a task's intermediate state: every commit leaves the app working (no commit where a Coil click does nothing or opens the wrong modal), and the branch is pushed only in Task 18.
- A server you start yourself is `./node_modules/.bin/next start -p 3370` in the background with its PID written to a file in `$TMPDIR`; wait for it with `curl --retry 60 --retry-delay 1 --retry-connrefused -sf -o /dev/null http://localhost:3370` (never a `sleep` loop) and stop it by that PID.
- Shorthand: `E2E` means `CI=1 E2E_FULL_PORT=3246 E2E_HOLDING_PORT=3247 pnpm test:e2e`; `E2E <file>` runs one spec (it builds both modes first; add `E2E_NO_BUILD=1` to rerun against the last build when no source changed).
- The lab is a reference, not a dependency: `git show ae9b6dd:app/lab/gallery/<file>` prints a lab file from any worktree of this repo. Where this plan and the lab disagree, this plan wins (the lab predates the label face and C2).

## Rulings taken in this plan (each also a line in "Decisions for Aaron" when it is his call)

1. **One card list.** `strandCards` (strand order) and `bookColumns` (book order) both derive from `siteContent.cards`; the Coil, the unwound list and the book never read a legacy shape again.
2. **Flight kinds stay `"photo" | "work"`.** Beside the rows (1024px and up) a photo card (`visual.kind === "photo"`) flies into the card picture's box (`[data-tile-slot="photo"]`, 320 by 427, the lead of the first gallery row) and every other card into the header tile (`[data-tile-slot="work"]`), now 3:4 (60 by 80) so the flown card fills it exactly. On a phone every card, photo cards included, flies into the phone header's 3:4 tile (42 by 56, Talos's 51 by 68), which shows the card's face (a photo card's picture in its pane) when nothing lands there. `lib/coil/flight.ts` (`fitAspect`) and `FlyingTile` are unchanged apart from the sharp copy's sizes.
3. **A mouse click flies at any width, as it does today.** Layer 1 assigns input by capability, never by width: a fine-pointer click on a Coil card (or a row of the unwound list) flies its card into the modal whenever motion is allowed and its slot is on screen, in a window of any width; a touch tap (`tap: true`, slot -1) and a book row open with no flight, the modal drawing its own media. The flight lands on the slot of the layout the modal opens in (Ruling 2). Below 1024px that is the phone header's tile, which stays put while the pages turn, so no pager page can carry a parked flown card off the panel. While a flown card is parked (`flight.phase === "out"`), the modal holds the layout it opened with (no switch between the rows and the pager under a parked card).
4. **Book rows open with no flight** (as photo rows do today); the unwound list's rows and Coil clicks fly.
5. **The gallery rule is the lab's round six** (`rotatingPlan` at ae9b6dd), ported as `galleryPlan`, with one guard: the card picture never takes turns (a parked flown card covers it), so a photo card with one paragraph keeps its picture still and turns the rest in a second row. The band and Travel, which the lab never showed Aaron, follow cards.md's pairings instead (`namedPlan`): the card picture stands alone in the first row (cards.md: the card picture is not paired), and every other photo sits beside the paragraph it names, photos naming one paragraph taking turns.
6. **The jobs timeline uses the same rows.** Its "words" are the three paragraphs then the five entries; its photos group by the entry they name (`groupedPlan`: the two MOD photos take turns beside the MOD entry), and entries without photos ride with the nearest row by the lab's `arrange` rule.
7. **Jobs insider tips are inline tips.** Task 1 registers `job-0` to `job-4` in the tip register from `cards.jobs.timeline[i].tip`, and each entry renders its employer as `[Employer](tip:job-N)` through `InlineCopy`: the shared label, keyboard focus and `aria-describedby` come from C2 with no change to `components/inline/` (this rules on PR 42's hand-off, which proposed a new tip kind).
8. **The mentors list is a section inside the Mentorship modal** (after the words, before the links), headed by `cards.mentorship.mentors.title`, not a second modal.
9. **Book metas render with `visibleText`** (PR 42 Decision 15): a link cannot sit inside a row's button. The modal header shows `modal.meta ?? book.meta` (PR 40) through `InlineCopy`, except that beside the rows a book meta holding a tip the row cannot show (IEEE's `[AO](tip:ieee-ao)`) shows whole, so the AO tip lives in the modal as cards.md asks ("keep the tip in the modal only"); a phone keeps IEEE's shorter `modal.meta`, which cards.md made for a 360px screen (`headerMeta`, `lib/gallery/card.ts`).
10. **Logos on the Coil and in the header tile.** A plain tile is `--card-work-pane`; Talos sits on `--card-anvil` in both themes; in the dark theme a logo with no dark file and not opaque sits on a light plate (`--card-logo-ground`); IEEE (an opaque navy square) is drawn as the tile's face. `srcDark` is used whenever it is set, so the `logo-dark` branch needs no C3 change. Raster logos load through the image optimizer (PR 41: the IEEE JPEG is 525,928 bytes). Talos's phone tile is 51 by 68 (`GALLERY.talosTileCompact`), so its mark, 40 percent of the tile, is 20.4px and never under its kit's 20px minimum (interactions-brief.md section 2); the 42 by 56 tile would draw it at 16.8px.
11. **The jobs card's circles**: five discs on the card's own diagonal, oldest (Popeyes, smallest) bottom left to newest (Aritzia, largest) top right, each a light disc (`--card-logo-ground`) with the light logo file, in both themes (PR 41: Aritzia has no usable dark file).
12. **Label face** (docs/label-face-spec.md): the modal meta and links are accent Profa Bold (`font-label text-label` and `text-label-lg`), captions and the close hint muted Profa Bold (`font-label text-label text-muted`). The lab drew captions and links in Inter because it predates the face.
13. **The backdrop dims for real:** the tint and the glass are `color-mix` at 70 and 85 percent, as the lab showed Aaron, instead of the `bg-background/70` that emits nothing.
14. **The Talos sting and the min/Max slide-out are not built here** (special builds, interactions-brief.md section 2); both cards show their static marks.
15. **Phone grouping:** A ("a page a paragraph, the group turning in the page's stage", the lab's round six default) ships behind `PHONE_GROUPING` in `lib/gallery/constants.ts`; B (`"photo"`) is a one-line switch; C (`"strip"`) is refused by the constant's type because its strip component is not built.
16. **The phone's shapes:** a card with photos is a sheet (the visible height less 24px top and bottom) holding the pager, and only a long page's words scroll; a card with no photos (min/Max, Talos, This site, the family business) is a short modal of its header, words, links and close hint that scrolls with the backdrop. The pager draws no close hint (the lab's pick): the X and a vertical flick close it.
17. **Holding the turns:** a desktop group holds while hovered by a mouse, while keyboard focus is inside it, while less than a third of its frame is on screen, and while paused; a phone page's group holds while a finger is down on the pager, while its page is not current, and while its stage has keyboard focus. Every rotator dot is its own tab stop, as in the lab.
18. **The fold:** the lab's numbers stand. The e2e holds the first row above the fold at 1440 by 900 on the four cards the spec tests (Capital One, Hackathons, Mentorship, IEEE); every card's first-row bottom at 1440 by 900 and 1024 by 768 is measured in Task 18 and reported. The jobs card opens on its three paragraphs and the Popeyes entry (Ruling 6), so its first photo row starts below the fold.
19. **The mask-in starts at once when nothing lands** (a book row, a touch tap) and at the landing, 520ms, after a flight (`maskStartMs`, `lib/gallery/steps.ts`), so a book open never shows empty glass for half a second. The rotator's clock is unchanged: it starts 1720ms after the body mounts.
20. **Focus never falls out of a modal** (`useFocusTrap`, `lib/modal.ts`, shared by every modal): when the focused control turns disabled or inert under the visitor (the pager's Next at the last page, a page turning away), focus moves to the nearest live control (the first live one in the closest enclosing element: the other arrow, a page dot, else the close button), and a Tab from the body while a modal is open comes back into it. The trap's own Tab wrap skips controls inside an inert subtree.

## Review Focus

1. **A resize across 1024px while a modal is open.** With a flown card parked, the layout must hold (the flown card stays on the slot it landed on); with no flight it follows the window. Test: Task 10, "the layout holds while a flown card is parked".
2. **A long page on a phone.** A vertical drag on words that overflow their area scrolls them; only a drag on the stage, the header or words that fit dismisses, and only past 96px. Test: Task 16, "long words scroll in their own area and never dismiss".
3. **Escape in the middle of the mask-in, then open again.** No split line, inline `clip-path` or `data-mask-armed` may survive a close, and the next open replays from the start. Test: Task 13, "Escape in the middle of the run leaves nothing behind, and the next open replays from the start".
4. **Dark theme logos with no dark file** (Capital One, FSDATALINK until `logo-dark` lands). They sit on a light plate on the Coil and in the header tile, IEEE never does, Talos stays on the anvil. Tests: Task 6 (`needsGround`), Task 7 (the header face's plate markup), Task 10 ("in the dark theme Capital One's logo sits on a light plate" on the Coil's pixels, and "in the dark theme a logo with no dark file sits on a light plate in the header tile").
5. **A keyboard-only visitor in a gallery modal.** Tab reaches the inline tips, the rotator's dots and pause button, the mentors' links and the card links; Escape hides a shown tip before it closes the modal; focus returns to the row that opened it. Test: Task 14, "the keyboard path through Mentorship and Misuki".
6. **Keyboard focus in the phone pager.** An arrow that disables under focus, a page that turns inert under focus, and a Tab from the body never leave focus outside the dialog. Test: Task 15, "keyboard focus never falls out of the dialog when its control disables or its page goes inert, and Tab from the body comes back in".
7. **A mouse click below 1024px.** It still flies, lands exactly on the phone header's tile, and that tile does not move while the pages turn. Tests: Task 10, "under 1024px a mouse click still flies the card, onto the phone header's tile"; Task 15, "a mouse click on the Coil flies a photo card onto the phone header's tile, which stays put while the pages turn".
8. **Every size read waits for the panel to rest.** The panel scales in from 0.97 over 280ms and Playwright measures through transforms, so `openCardFromBook` returns only once the panel's computed transform is none and its opacity 1 (`panelAtRest`), and the flight tests call `panelAtRest` before they measure. Tests: Tasks 10, 12, 15 and 18 read sizes only after it.

## File Structure

| Files | Responsibility |
|---|---|
| `lib/content/types.ts`, `cards.ts`, `media.ts`, `register.ts`, `lib/content.ts` (modify) | Mentors, `LogoRef.opaque`, the jobs tips, `book.ariaLabel`, `modals.gallery` strings, `bookColumns` and the strand exports |
| `lib/content/strand.ts` (create) | `StrandCard`, `strandCards`, `strandCardByKey`, `bookRow` |
| `lib/gallery/plan.ts`, `boxes.ts` (create) | Which photos sit beside which words; boxes, frames, panel width (pure) |
| `lib/gallery/constants.ts`, `card.ts`, `timeline.ts` (create) | The lab's values, `PHONE_GROUPING`; a card's gallery input, the header's tile and meta line; the timeline's employer markup (pure) |
| `lib/gallery/timing.ts`, `reveal.ts`, `pager.ts`, `rotator.ts` (create, Task 5); `steps.ts` (create, Task 13) | The mask table, the left to right reveals, the pager's state and gestures, the rotator's gate; a card's mask steps by layout and when they start (pure) |
| `lib/photoSizes.ts` (modify) | `CARD_PICTURE_SIZES`, `galleryRowSizes`, `PAGER_PHOTO_SIZES` |
| `app/globals.css`, `lib/coil/theme.ts`, `lib/coil/constants.ts`, `lib/coil/cardFace.ts`, `lib/coil/textures.ts` (modify); `lib/coil/textures.test.ts` (create) | Card tokens, theme fields, the `face` block, face layouts (pure), the three new painters and their loaders |
| `components/coil/CoilScene.tsx`, `scene/state.ts`, `scene/boot.ts`, `components/coil/HeroOverlay.tsx` (modify) | The scene and the unwound list on `strandCards` |
| `public/coil/hero-*`, `lib/coil/heroStill.rects.ts`, `scripts/hero-still-phases.json` (regenerated) | The hero stills with the fourteen cards |
| `components/card/CardModal.tsx`, `CardBody.tsx`, `useGalleryLayout.ts` (create) | The shell, the body by layout and its mask-in, the layout that holds under a parked flown card |
| `components/card/CardFace.tsx`, `CardHeader.tsx`, `StillPhoto.tsx`, `Words.tsx`, `TimelineEntry.tsx`, `MentorsList.tsx`, `CardLinks.tsx`, `CloseHint.tsx` (create) | The parts both layouts share |
| `components/card/CardRows.tsx`, `GroupParts.tsx`, `RotatingPhoto.tsx`, `useRotator.ts`, `useMaskIn.ts` (create) | The desktop rows, a group's layers and captions, a group taking turns, the turns' clock and change, the mask-in |
| `components/card/CardPager.tsx`, `PagerPage.tsx`, `PagerControls.tsx`, `usePagerDrag.ts`, `PhoneRotator.tsx`, `CardWords.tsx` (create); `CardStack.tsx` (created in Task 12, deleted in Task 15) | The phone: the pager, a page, its controls, its gestures, a page's turning stage, a card with no photos |
| `components/modal/useCloseHint.ts` (create); `components/inline/DefinitionModal.tsx`, `components/mark/MarkCard.tsx` (modify) | The close hint, moved out of the deleted `PhotoModal` |
| `lib/modal.ts` (modify, Task 15) | The focus trap: focus never falls out of a modal (Ruling 20) |
| `components/home/HomeController.tsx`, `components/book/Book.tsx`, `BookRow.tsx`, `components/FlyingTile.tsx` (modify); `components/PhotoModal.tsx`, `components/WorkModal.tsx` (delete) | Selection by card key, the book on cards, the sharp copy's sizes |
| `e2e/support/cards.ts`, `e2e/card-modal.spec.ts`, `e2e/coil-faces.spec.ts`, `e2e/card-gallery.spec.ts`, `e2e/card-masks.spec.ts`, `e2e/card-rotator.spec.ts`, `e2e/card-pager.spec.ts`, `e2e/card-look.spec.ts` (create); `e2e/modal.spec.ts`, `label-face.spec.ts`, `a11y.spec.ts`, `toggle.spec.ts`, `support/fallback.ts` (modify) | The suite (`card-look.spec.ts` is Aaron's captures, skipped unless `CARD_LOOK_DIR` is set) |

---

### Task 0: Worktree and baseline (Sonnet)

- [ ] **Step 1:** Create the worktree.
```bash
cd "/Users/asulbaran21/Personal Projects/aaron-portfolio-website" && git fetch origin
git worktree add -b c3-card-system "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c3-card-system" origin/main
cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c3-card-system" && pnpm install --frozen-lockfile
```
- [ ] **Step 2:** Baseline, recorded for the PR body: `pnpm test` (file and test counts), `pnpm tsc --noEmit` (silent), `pnpm lint` (0 errors, note the warning count), and `E2E` (pass, skip and fail counts). Every later task leaves all four at least as green.
- [ ] **Step 3:** Confirm the lab reference resolves: `git show ae9b6dd:app/lab/gallery/plan.ts | head -5` prints the file's first lines.

---

### Task 1: Content: the mentors, the jobs tips, the opaque logo and the gallery strings (Sonnet)

**Files:**
- Modify: `lib/content/types.ts`, `lib/content/cards.ts`, `lib/content/media.ts`, `lib/content/register.ts`, `lib/content.ts`
- Test: `lib/content/cards.test.ts`, `lib/content/register.test.ts`, `lib/content/gallery-copy.test.ts` (create)

**Interfaces:**
- Produces: `Mentor { name: string; href: string; line: string | null }`; `LogoRef.opaque?: true`; `jobTipKey(entry: number): string` from `lib/content/register.ts` (`"job-0"` to `"job-4"`); `siteContent.book.ariaLabel` `"Work and people"`; `siteContent.modals.gallery` (below).

The data, verbatim. Aaron, 2026-10-09: all six mentors agreed to be named; each gets "their names and then the one sentence about where they've helped me out or how they've helped me out, with a link to their LinkedIn". No sentence exists yet for any of the six (`aaron-site-assets/07-mentorship/mentors.txt` holds names and links only; one entry carries a private aside in brackets that is not site copy and stays out), so every `line` is `null` and nothing renders for it until Aaron writes them. The six names and their LinkedIn URLs, verbatim from that file, are in the `cards.ts` block in Step 3. That block is the only place this plan writes the URLs: the tests read them from the content, and they never go in prose, a commit message or the PR body.

- [ ] **Step 1: Failing tests.** In `lib/content/cards.test.ts`, replace the test "model the mentors list and hold it empty until each mentor agrees to be named" with:
```ts
  it("name the six mentors who agreed, each with their own LinkedIn link and no line until I write one", () => {
    const { title, people } = cards.mentorship.mentors;
    expect(title).toBe("the people who shaped me");
    expect(people.map((mentor) => mentor.name)).toEqual(["Andrew Chang", "Diego Jimenez", "Jared Alonzo", "JJ Gonzales", "Joaquin Escobar", "Mike Ditson"]);
    for (const mentor of people) {
      expect(mentor.href, mentor.name).toMatch(/^https:\/\/www\.linkedin\.com\/in\/[a-z0-9-]+\/$/);
      expect(mentor.line, mentor.name).toBeNull();
    }
    expect(new Set(people.map((mentor) => mentor.href)).size).toBe(people.length);
  });

  it("mark only the IEEE square as an opaque logo, its own ground", () => {
    const opaque = keys.filter((key) => { const visual = cards[key].visual; return visual.kind === "logo" && visual.logo?.opaque; });
    expect(opaque).toEqual(["ieee"]);
    expect(cards.jobs.timeline.some((entry) => entry.logo?.opaque)).toBe(false);
  });
```
In `lib/content/register.test.ts`, change the tip key list in "holds the approved keys and only those" to end with the five job keys, and add a test:
```ts
    expect(Object.keys(register.tip)).toEqual(["voltage", "two-as", "voltaage", "killer-drones", "evolving-isle", "music-note", "ieee-ao", "this-site-playground", "misuki-suk", "job-0", "job-1", "job-2", "job-3", "job-4"]);
```
```ts
  it("carries each jobs timeline tip, word for word, under its entry's key", () => {
    expect(siteContent.cards.jobs.timeline.map((entry, i) => register.tip[jobTipKey(i)]?.text)).toEqual(siteContent.cards.jobs.timeline.map((entry) => entry.tip));
    expect(jobTipKey(4)).toBe("job-4");
    expect(registerHas("tip", "job-2")).toBe(true);
  });
```
(add `jobTipKey` to the import from `@/lib/content/register`). Create `lib/content/gallery-copy.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";

describe("the card modal's own words", () => {
  const g = siteContent.modals.gallery;
  it("names the pager, its pages and its buttons", () => {
    expect(g.pagerLabel(3)).toBe("Photos and their stories, 3");
    expect(g.pageLabel(2, 3)).toBe("2 of 3");
    expect([g.previousPage, g.nextPage]).toEqual(["Previous page", "Next page"]);
    expect(g.pageNumber(2, 3)).toBe("Page 2 of 3");
  });
  it("names the rotator, its dots, its pause button and what it announces", () => {
    expect(g.rotatorLabel(3)).toBe("Photos taking turns, 3");
    expect(g.photoOf(1, 3)).toBe("Photo 1 of 3");
    expect(g.announce(2, 3, "Me with my section, the low reeds.")).toBe("Photo 2 of 3: Me with my section, the low reeds.");
    expect(g.announce(2, 3, "")).toBe("Photo 2 of 3");
    expect([g.pausePhotos, g.playPhotos]).toEqual(["Pause the photos", "Play the photos"]);
    expect(g.groupStep(1, 3)).toBe("Photo 1 of 3. Show the next photo");
  });
  it("describes the turning groups and the pager's pages to assistive tech", () => {
    expect([g.roleCarousel, g.roleSlide]).toEqual(["carousel", "slide"]);
  });
  it("labels the book for both of its columns", () => {
    expect(siteContent.book.ariaLabel).toBe("Work and people");
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/content`. Expected FAIL: the mentors list is empty, `opaque` is unknown, `jobTipKey` is not exported, `siteContent.modals.gallery` is undefined, the label reads "Work and photos".
- [ ] **Step 3: Implement.**

`lib/content/types.ts`: replace the `LogoRef` and `Mentor` declarations with
```ts
// opaque: the logo is its own ground (the IEEE square), drawn as the tile's face and never on a plate.
export interface LogoRef { src: string; srcDark: string | null; width: number; height: number; opaque?: true }
```
```ts
// line: one sentence on how they helped me, in my words; null until I write it, and nothing renders for it.
export interface Mentor { name: string; href: string; line: string | null }
```
`lib/content/media.ts`, the `ieee` logo:
```ts
  ieee: { src: "/work/logos/ieee/ieee-ut-logo.jpg", srcDark: null, width: 1382, height: 1383, opaque: true },
```
`lib/content/cards.ts`, Mentorship: replace the comment and the `mentors` line with
```ts
    // All six agreed to be named (2026-10-09). Each line is mine to write; until then a mentor shows a name and a link.
    mentors: { title: "the people who shaped me", people: [
      { name: "Andrew Chang", href: "https://www.linkedin.com/in/andrewlinchang/", line: null },
      { name: "Diego Jimenez", href: "https://www.linkedin.com/in/djmora/", line: null },
      { name: "Jared Alonzo", href: "https://www.linkedin.com/in/jared-alonzo/", line: null },
      { name: "JJ Gonzales", href: "https://www.linkedin.com/in/jjgonzalesiv/", line: null },
      { name: "Joaquin Escobar", href: "https://www.linkedin.com/in/jescobar25/", line: null },
      { name: "Mike Ditson", href: "https://www.linkedin.com/in/mikeditson/", line: null },
    ] },
```
`lib/content/register.ts`: add `import { cards } from "./cards";` and `import type { InlineRegister, TipEntry } from "./types";` (the type import exists), then above `export const register`:
```ts
// The jobs timeline's insider tips (cards.jobs.timeline[i].tip), one per entry, so each
// employer's name in the modal is an ordinary inline tip (components/card/TimelineEntry).
export const jobTipKey = (entry: number): string => `job-${entry}`;
const jobTips: Record<string, TipEntry> = Object.fromEntries(cards.jobs.timeline.map((entry, i) => [jobTipKey(i), { text: entry.tip }]));
```
and spread it last in `tip`: `"misuki-suk": { ... },` then `...jobTips,`. (`cards.ts` imports only `./media`, so this adds no cycle.)

`lib/content.ts`: in `book`, set `ariaLabel: "Work and people",`. In `modals`, after `workPreviewSuffix`, add:
```ts
    // The card modal's gallery (components/card): the pager on a phone and the photos
    // that take turns, the gallery lab's words (2026-10-09).
    gallery: {
      pagerLabel: (count: number) => `Photos and their stories, ${count}`,
      pageLabel: (page: number, count: number) => `${page} of ${count}`,
      previousPage: "Previous page",
      nextPage: "Next page",
      pageNumber: (page: number, count: number) => `Page ${page} of ${count}`,
      rotatorLabel: (count: number) => `Photos taking turns, ${count}`,
      photoOf: (photo: number, count: number) => `Photo ${photo} of ${count}`,
      announce: (photo: number, count: number, caption: string) => `Photo ${photo} of ${count}${caption ? `: ${caption}` : ""}`,
      pausePhotos: "Pause the photos",
      playPhotos: "Play the photos",
      groupStep: (photo: number, count: number) => `Photo ${photo} of ${count}. Show the next photo`,
      // aria-roledescription: a group of photos taking turns, and one page of the pager.
      roleCarousel: "carousel",
      roleSlide: "slide",
    },
```
- [ ] **Step 4:** `pnpm vitest run lib/content` passes; `pnpm test`, `pnpm tsc --noEmit` and `pnpm lint` stay green (the sweep test walks the new strings: no em dash, no unknown link).
- [ ] **Step 5: Commit.**
```bash
git add lib/content/types.ts lib/content/cards.ts lib/content/media.ts lib/content/register.ts lib/content.ts lib/content/cards.test.ts lib/content/register.test.ts lib/content/gallery-copy.test.ts
git commit -m "Content: the six mentors with their links, the jobs tips in the register, the opaque IEEE logo, the gallery's accessible names" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The strand and the book as cards (Sonnet)

**Files:**
- Create: `lib/content/strand.ts`, `lib/content/strand.test.ts`
- Modify: `lib/content.ts` (exports and `bookColumns`)

**Interfaces:**
- Consumes: `cards`, `strandOrder` (`lib/content/cards.ts`), `visibleText` (`lib/content/links.ts`), `CardKey`, `LogoRef`.
- Produces (all re-exported from `@/lib/content`):
```ts
export type StrandFace =
  | { kind: "photo"; src: string }
  | { kind: "logo"; logo: LogoRef; tile: "plain" | "anvil" }
  | { kind: "mark" }
  | { kind: "circles"; logos: readonly LogoRef[] };
export interface StrandCard { key: CardKey; kind: "photo" | "work"; face: StrandFace }
export const strandCards: readonly StrandCard[];
export const strandCardByKey: ReadonlyMap<string, StrandCard>;
export interface BookRowEntry { key: CardKey; title: string; meta: string }
export interface BookColumn { heading: string; rows: readonly BookRowEntry[] }
export function bookRow(key: CardKey): BookRowEntry;
export const bookColumns: readonly BookColumn[]; // defined in lib/content.ts (it reads siteContent's headings)
```
`StrandCard.kind` is the flight's kind and the name the scene's debug probe already reports (`e2e/support/hooks.ts` `SlotInfo.kind`), so no hook changes.

- [ ] **Step 1: Failing test** (`lib/content/strand.test.ts`):
```ts
import { describe, expect, it } from "vitest";
import { bookColumns, siteContent, strandCardByKey, strandCards } from "@/lib/content";

describe("the strand as cards", () => {
  it("is the fourteen cards in strand order, the lead card first", () => {
    expect(strandCards.map((card) => card.key)).toEqual(siteContent.strand.order);
    expect(strandCards[0].key).toBe("mentorship");
  });
  it("flies a photo card into the card picture and every other card into the header tile", () => {
    expect(Object.fromEntries(strandCards.map((card) => [card.key, card.kind === "photo" ? card.face.kind : `work:${card.face.kind}`]))).toEqual({
      mentorship: "photo", "min-max": "work:logo", band: "photo", talos: "work:logo", travel: "photo", "capital-one": "work:logo", hackathons: "photo",
      anthropic: "work:logo", misuki: "photo", ieee: "work:logo", jobs: "work:circles", "this-site": "work:mark", fsdatalink: "work:logo", "building-in-public": "photo",
    });
  });
  it("draws each face from the approved files", () => {
    expect(strandCardByKey.get("mentorship")?.face).toEqual({ kind: "photo", src: "/photos/cards/mentorship-picture.jpg" });
    const talos = strandCardByKey.get("talos")?.face;
    expect(talos?.kind === "logo" && talos.tile).toBe("anvil");
    const jobs = strandCardByKey.get("jobs")?.face;
    expect(jobs?.kind === "circles" && jobs.logos.map((logo) => logo.src)).toEqual([
      "/work/logos/jobs/popeyes-logo.svg", "/work/logos/jobs/mod-pizza-logo.svg", "/work/logos/jobs/ut-austin-logo.svg", "/work/logos/jobs/apple-logo-black.svg", "/work/logos/jobs/aritzia-logo.svg",
    ]);
    const ieee = strandCardByKey.get("ieee")?.face;
    expect(ieee?.kind === "logo" && ieee.logo.opaque).toBe(true);
  });
});

describe("the book as cards", () => {
  it("is Work then People, in Aaron's doc order, every row a card", () => {
    expect(bookColumns.map((column) => column.heading)).toEqual(["Work", "People"]);
    expect(bookColumns.map((column) => column.rows.map((row) => row.key))).toEqual([siteContent.book.workOrder, siteContent.book.peopleOrder]);
  });
  it("shows each meta as a visitor reads it, with no link inside a row", () => {
    const rows = Object.fromEntries(bookColumns.flatMap((column) => column.rows).map((row) => [row.key, [row.title, row.meta]]));
    expect(rows).toEqual({
      "min-max": ["min/Max", "Founder, 2025 to now"],
      talos: ["Talos", "Builder, 2026"],
      "capital-one": ["Capital One", "Intern, 2024 to 2026"],
      anthropic: ["Anthropic", "Claude Campus Ambassador, 2026"],
      ieee: ["IEEE UT Austin", "President, Corporate Director, and AO, 2023 to 2026"],
      hackathons: ["Hackathons", "Builder, 2026 to now"],
      "this-site": ["This site", "Portfolio (design playground), 2026"],
      mentorship: ["Mentorship", "Coach, tutor and speaker, ongoing"],
      band: ["Jordan High School band", "Section leader to drum major, 2021 to 2023"],
      jobs: ["\"unflattering\" jobs that paid for school", "Popeyes to Aritzia, 2021 to 2026"],
      fsdatalink: ["The family business", "Assistant Manager & SWE, 2022 to 2024"],
      misuki: ["Misuki", "2001 Mazda Miata, five-speed"],
      travel: ["Travel", "Yosemite, Mt. Fuji and more"],
      "building-in-public": ["Building in public", "LinkedIn and X, ongoing"],
    });
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/content/strand.test.ts`. Expected FAIL: `strandCards` is not exported.
- [ ] **Step 3: Implement** `lib/content/strand.ts`:
```ts
import { cards, strandOrder } from "./cards";
import { visibleText } from "./links";
import type { CardKey, LogoRef } from "./types";

// The fourteen cards as the Coil, the unwound list and the book use them,
// derived from cards.ts, so no surface reads the legacy shapes.

export type StrandFace =
  | { kind: "photo"; src: string }
  | { kind: "logo"; logo: LogoRef; tile: "plain" | "anvil" }
  | { kind: "mark" }
  | { kind: "circles"; logos: readonly LogoRef[] };

// kind is the flight's: a photo card lands in the gallery's card picture, every
// other card in the modal header's tile.
export interface StrandCard { key: CardKey; kind: "photo" | "work"; face: StrandFace }

// Null when the card's asset is missing (none at launch; cards.test.ts holds it).
export function strandCardOf(key: CardKey): StrandCard | null {
  const visual = cards[key].visual;
  switch (visual.kind) {
    case "photo":
      return visual.photo ? { key, kind: "photo", face: { kind: "photo", src: visual.photo.src } } : null;
    case "logo":
      return visual.logo ? { key, kind: "work", face: { kind: "logo", logo: visual.logo, tile: visual.tile } } : null;
    case "mark":
      return { key, kind: "work", face: { kind: "mark" } };
    case "circles": {
      const logos = cards.jobs.timeline.map((entry) => entry.logo);
      return logos.every((logo): logo is LogoRef => logo !== null) ? { key, kind: "work", face: { kind: "circles", logos } } : null;
    }
  }
}

export const strandCards: readonly StrandCard[] = strandOrder.flatMap((key) => {
  const card = strandCardOf(key);
  return card ? [card] : [];
});

export const strandCardByKey: ReadonlyMap<string, StrandCard> = new Map(strandCards.map((card) => [card.key, card]));

export interface BookRowEntry { key: CardKey; title: string; meta: string }
export interface BookColumn { heading: string; rows: readonly BookRowEntry[] }

// A row is a button, so no link may sit inside it (C2): the row shows the
// visible words, and the IEEE row's AO tip stays in the register.
export function bookRow(key: CardKey): BookRowEntry {
  const { title, meta } = cards[key].book;
  return { key, title: visibleText(title), meta: visibleText(meta) };
}
```
In `lib/content.ts`: add `import { bookRow, type BookColumn } from "./content/strand";` at the top; after the `export type { ... } from "./content/types";` block add
```ts
export { bookRow, strandCardByKey, strandCardOf, strandCards } from "./content/strand";
export type { BookColumn, BookRowEntry, StrandCard, StrandFace } from "./content/strand";

// The book's two columns of cards (components/book/Book.tsx and the unwound list).
export const bookColumns: readonly BookColumn[] = [
  { heading: siteContent.book.workHeading, rows: siteContent.book.workOrder.map(bookRow) },
  { heading: siteContent.book.peopleHeading, rows: siteContent.book.peopleOrder.map(bookRow) },
];
```
- [ ] **Step 4:** `pnpm vitest run lib/content` passes; `pnpm tsc --noEmit` silent.
- [ ] **Step 5: Commit.**
```bash
git add lib/content/strand.ts lib/content/strand.test.ts lib/content.ts
git commit -m "Content: the strand and the book as cards, derived from the fourteen" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The gallery plan and its boxes (Sonnet)

**Files:**
- Create: `lib/gallery/plan.ts`, `lib/gallery/boxes.ts`, `lib/gallery/plan.test.ts`, `lib/gallery/boxes.test.ts`

**Interfaces:**
- Produces (`lib/gallery/plan.ts`): `PlanPhoto { beside?: number }`; `Slide { photo: number; photos: number[]; own?: number; before: number[]; after: number[] }`; `Plan { intro: number[]; slides: Slide[]; closing: number[] }`; `Page extends Slide { links: boolean; wordless?: boolean }`; `type PhoneGrouping = "paragraph" | "photo" | "strip"`; `type StageKind = "still" | "turns" | "strip"`; `photoOrder(photos, wordCount, lead?)`; `galleryPlan(wordCount: number, photos: readonly PlanPhoto[], lead?: number): Plan`; `groupedPlan(wordCount: number, photos: readonly PlanPhoto[]): Plan`; `namedPlan(wordCount: number, photos: readonly PlanPhoto[], lead: number): Plan`; `pagesOf(plan: Plan): Page[]`; `photoPages(plan: Plan): Page[]`; `phonePages(plan: Plan, grouping: PhoneGrouping): Page[]`; `stageKind(page: Page, grouping: PhoneGrouping): StageKind`; `slideWords(slide: Slide): number[]`.
- Produces (`lib/gallery/boxes.ts`): `Box { width: number; height: number }`; `Boxes { vertical: Box; horizontal: Box }`; `isWide(aspect, wideFrom)`; `fitWhole(aspect, boxWidth, boxHeight): Box`; `uniformBoxes(verticalWidth, horizontalWidth): Boxes`; `boxFor(aspect, boxes, wideFrom): Box`; `groupFrame(boxes: readonly Box[]): Box`; `rowColumns(aspects, g: ColumnSettings): { slot: number; panel: number }`; `pageStage(photos: readonly number[], aspects: readonly number[], innerWidth: number, height: number): { frame: Box; boxes: Box[] }`; `stageHeight(capPx: number, roomPx: number, floorPx: number): number`.

"Words" are the units a photo sits beside: a card's paragraphs (`modal.blocks`), and on the jobs card the paragraphs followed by the timeline entries (Task 4). A photo's `beside` is the index of its unit.

The rule (Aaron, gallery lab rounds four to six, 2026-10-09), as `galleryPlan` implements it:
- N photos, P words. **N <= P** keeps one photo a row. The card picture (the `lead`) takes word 0; every other photo takes the word it names when no earlier photo took it; a photo whose word is taken takes the first free word between its neighbours' words; one with none free joins the row before it (or the row after, when the row before is the card picture's). Words no photo took ride with the nearest rows: a run between two rows splits, the first half after the earlier row and the rest before the later one; words before the first row open the card (`intro`), words after the last close it (`closing`).
- **N > P**: the card picture (or, on a card with no picture, the first photo in word order) stands still beside word 0, where the flight lands; every later word gets a group of the remaining photos in word order taking turns beside it, the extras going to the later rows.
- **Guard (this plan):** the card picture never takes turns, because a parked flown card covers it. With one word or none, a card with a picture keeps it still beside the word and turns the rest in a second row with no words.

`groupedPlan` (the jobs timeline): photos that name the same word form one group in that word's row; rows follow word order; photos naming no valid word join the last group; the remaining words ride with rows by the same rule.

`namedPlan` (the band and Travel, the photo cards the lab never showed Aaron; ruled on the plan's review, 2026-10-10): cards.md's pairing to the letter. The card picture stands alone in the first row, where the flight lands (cards.md: "The card picture sits beside the title; it is not paired"), taking only the opening words no photo names; every other photo is grouped as `groupedPlan` groups them, beside the word it names, photos naming one word taking turns. On the real data: the band's section photo sits beside paragraph 0, the practice-lot photo beside paragraph 1 ("the band kept growing") and the competition photo beside paragraph 2; Travel's Fuji, Dubai and Cartagena photos take turns beside paragraph 0 (Japan and Dubai), and paragraph 1 (Barbara) closes the card.

- [ ] **Step 1: Failing tests.** `lib/gallery/plan.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { galleryPlan, groupedPlan, namedPlan, pagesOf, phonePages, photoOrder, photoPages, slideWords, stageKind, type Plan } from "@/lib/gallery/plan";

// The rows as Aaron reads them: which photos, beside which words.
const rows = (plan: Plan) => plan.slides.map((slide) => ({ photos: slide.photos, words: slideWords(slide) }));
const beside = (...words: (number | undefined)[]) => words.map((word) => (word === undefined ? {} : { beside: word }));

describe("galleryPlan, words enough for every photo", () => {
  it("keeps a photo a row with the opening and closing words around them (Capital One)", () => {
    expect(galleryPlan(5, beside(1, 2, 3))).toEqual({
      intro: [0],
      slides: [
        { photo: 0, photos: [0], own: 1, before: [], after: [] },
        { photo: 1, photos: [1], own: 2, before: [], after: [] },
        { photo: 2, photos: [2], own: 3, before: [], after: [] },
      ],
      closing: [4],
    });
  });
  it("splits a run of free words between the rows around it (IEEE)", () => {
    const plan = galleryPlan(5, beside(0, 3, 4));
    expect(rows(plan)).toEqual([{ photos: [0], words: [0, 1] }, { photos: [1], words: [2, 3] }, { photos: [2], words: [4] }]);
    expect([plan.intro, plan.closing]).toEqual([[], []]);
  });
  it("gives the card picture the first word and closes with the word nobody took (Hackathons)", () => {
    const plan = galleryPlan(4, beside(undefined, 1, 2), 0);
    expect(rows(plan)).toEqual([{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }]);
    expect(plan.closing).toEqual([3]);
  });
  it("gives a photo whose word the card picture took the next free word (Building in public)", () => {
    expect(rows(galleryPlan(3, beside(undefined, 0, 0), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }]);
  });
  it("lets a photo with no free word join the row before it, or the row after when that is the card picture's", () => {
    expect(rows(galleryPlan(3, beside(undefined, 2, undefined), 0))).toEqual([{ photos: [0], words: [0, 1] }, { photos: [1, 2], words: [2] }]);
    expect(rows(galleryPlan(3, beside(undefined, 0, 1), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [2, 1], words: [1] }]);
  });
});

describe("galleryPlan, more photos than words", () => {
  it("stands the card picture still beside the first word and turns the rest beside the last (Mentorship, Misuki, Travel)", () => {
    expect(galleryPlan(2, beside(undefined, 0, 0, 1), 0)).toEqual({
      intro: [],
      slides: [{ photo: 0, photos: [0], own: 0, before: [], after: [] }, { photo: 1, photos: [1, 2, 3], own: 1, before: [], after: [] }],
      closing: [],
    });
  });
  it("gives every later word a group, the extras to the later rows (the band)", () => {
    expect(rows(galleryPlan(3, beside(undefined, 0, 1, 2), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2, 3], words: [2] }]);
    expect(rows(galleryPlan(3, Array.from({ length: 6 }, () => ({})), 0)).map((row) => row.photos)).toEqual([[0], [1, 2], [3, 4, 5]]);
  });
  it("stands a logo card's first photo still the same way (Anthropic)", () => {
    expect(rows(galleryPlan(2, beside(0, 1, 1)))).toEqual([{ photos: [0], words: [0] }, { photos: [1, 2], words: [1] }]);
  });
  it("never turns the card picture, even beside a lone word", () => {
    expect(rows(galleryPlan(1, beside(undefined, 0, 0), 0))).toEqual([{ photos: [0], words: [0] }, { photos: [1, 2], words: [] }]);
    expect(rows(galleryPlan(0, beside(undefined, undefined), 0))).toEqual([{ photos: [0], words: [] }, { photos: [1], words: [] }]);
    expect(rows(galleryPlan(0, beside(undefined, undefined)))).toEqual([{ photos: [0, 1], words: [] }]);
  });
  it("places every photo once and every word once, in order, for any card", () => {
    const cases: [number, (number | undefined)[], number | undefined][] = [
      [5, [1, 2, 3], undefined], [2, [0, 1, 1], undefined], [5, [0, 3, 4], undefined], [2, [undefined, 0, 0, 1], 0],
      [3, [undefined, 0, 1, 2], 0], [4, [undefined, 1, 2], 0], [3, [undefined, 0, 0], 0], [1, [], undefined], [2, [], undefined],
    ];
    for (const [words, named, lead] of cases) {
      const plan = galleryPlan(words, beside(...named), lead);
      expect(plan.slides.flatMap((slide) => slide.photos).sort()).toEqual(named.map((_, i) => i));
      expect([...plan.intro, ...plan.slides.flatMap(slideWords), ...plan.closing]).toEqual(Array.from({ length: words }, (_, i) => i));
      if (lead !== undefined) expect(plan.slides[0].photos).toEqual([lead]);
    }
  });
  it("orders photos by the word they name, photos naming none last, the lead first", () => {
    expect(photoOrder(beside(2, undefined, 0), 3)).toEqual([2, 0, 1]);
    expect(photoOrder(beside(undefined, 1, 0), 3, 0)).toEqual([0, 2, 1]);
  });
});

describe("groupedPlan (the jobs timeline)", () => {
  it("keeps photos naming one entry together, beside it, and lets the other words ride with the rows", () => {
    const plan = groupedPlan(8, beside(4, 4, 6, 7));
    expect(plan.intro).toEqual([0, 1, 2, 3]);
    expect(rows(plan)).toEqual([{ photos: [0, 1], words: [4, 5] }, { photos: [2], words: [6] }, { photos: [3], words: [7] }]);
    expect(plan.closing).toEqual([]);
  });
  it("puts a photo naming nothing in the last group, and survives no photos", () => {
    // Photo 0 names word 1 and photo 1 names none: both sit in word 1's row; word 0 opens the card, word 2 closes it.
    const plan = groupedPlan(3, beside(1, undefined));
    expect(rows(plan)).toEqual([{ photos: [0, 1], words: [1] }]);
    expect([plan.intro, plan.closing]).toEqual([[0], [2]]);
    expect(groupedPlan(2, [])).toEqual({ intro: [0, 1], slides: [], closing: [] });
  });
});

describe("namedPlan (the band and Travel, as cards.md pairs them)", () => {
  it("stands the card picture alone and puts every other photo beside the word it names, a shared word's photos taking turns", () => {
    expect(rows(namedPlan(3, beside(undefined, 0, 1, 2), 0))).toEqual([{ photos: [0], words: [] }, { photos: [1], words: [0] }, { photos: [2], words: [1] }, { photos: [3], words: [2] }]);
    const travel = namedPlan(2, beside(undefined, 0, 0, 0), 0);
    expect(rows(travel)).toEqual([{ photos: [0], words: [] }, { photos: [1, 2, 3], words: [0] }]);
    expect([travel.intro, travel.closing]).toEqual([[], [1]]);
  });
  it("gives the card picture the opening words no photo names, and places every photo and word once", () => {
    expect(rows(namedPlan(3, beside(undefined, 2), 0))).toEqual([{ photos: [0], words: [0, 1] }, { photos: [1], words: [2] }]);
    const cases: [number, (number | undefined)[]][] = [[3, [undefined, 0, 1, 2]], [2, [undefined, 0, 0, 0]], [3, [undefined, 2]], [2, [undefined]], [2, [undefined, 5]]];
    for (const [words, named] of cases) {
      const plan = namedPlan(words, beside(...named), 0);
      expect(plan.slides[0].photos).toEqual([0]);
      expect(plan.slides.flatMap((slide) => slide.photos).sort()).toEqual(named.map((_, i) => i));
      expect([...plan.intro, ...plan.slides.flatMap(slideWords), ...plan.closing]).toEqual(Array.from({ length: words }, (_, i) => i));
    }
  });
});

describe("pages on a phone", () => {
  const mentorship = galleryPlan(2, beside(undefined, 0, 0, 1), 0);
  it("A: a page a row, the opening words on the first page, the closing words and the links on the last", () => {
    const pages = pagesOf(galleryPlan(5, beside(1, 2, 3)));
    expect(pages.map((page) => [page.photos, slideWords(page), page.links])).toEqual([[[0], [0, 1], false], [[1], [2], false], [[2], [3, 4], true]]);
    expect(phonePages(mentorship, "paragraph").map((page) => stageKind(page, "paragraph"))).toEqual(["still", "turns"]);
  });
  it("B: a group's later photos become wordless pages, and the links stay on the last page with words", () => {
    const pages = photoPages(mentorship);
    expect(pages.map((page) => [page.photo, slideWords(page), !!page.wordless, page.links])).toEqual([[0, [0], false, false], [1, [1], false, true], [2, [], true, false], [3, [], true, false]]);
    expect(pages.every((page) => stageKind(page, "photo") === "still")).toBe(true);
  });
  it("C: a group is a strip under its page's words", () => {
    expect(phonePages(mentorship, "strip").map((page) => stageKind(page, "strip"))).toEqual(["still", "strip"]);
  });
  it("gives a card with no photos no pages", () => {
    expect(pagesOf(galleryPlan(2, []))).toEqual([]);
  });
});
```

`lib/gallery/boxes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { boxFor, fitWhole, groupFrame, pageStage, rowColumns, stageHeight, uniformBoxes } from "@/lib/gallery/boxes";

const boxes = uniformBoxes(320, 424);
const settings = { boxes, wideFrom: 1, columnGap: 56, textWidth: 460, padding: 40, border: 1 };

describe("the desktop boxes", () => {
  it("draws every vertical photo 320 by 427 (3:4) and every horizontal one 424 by 318 (4:3), about the same area", () => {
    expect(boxes.vertical.width).toBe(320);
    expect(boxes.vertical.height).toBeCloseTo(426.667, 2);
    expect(boxes.horizontal).toEqual({ width: 424, height: 318 });
    expect(Math.abs(boxes.horizontal.width * boxes.horizontal.height - boxes.vertical.width * boxes.vertical.height) / (320 * 426.667)).toBeLessThan(0.02);
  });
  it("takes the horizontal box from square up", () => {
    expect(boxFor(1, boxes, 1)).toBe(boxes.horizontal);
    expect(boxFor(1125 / 978, boxes, 1)).toBe(boxes.horizontal);
    expect(boxFor(0.75, boxes, 1)).toBe(boxes.vertical);
    expect(boxFor(998 / 1600, boxes, 1)).toBe(boxes.vertical);
  });
  it("sizes the photo column to the card's widest box and the panel around it", () => {
    expect(rowColumns([0.75, 0.75, 0.75], settings)).toEqual({ slot: 320, panel: 918 });
    expect(rowColumns([0.75, 1600 / 858], settings)).toEqual({ slot: 424, panel: 1022 });
    expect(rowColumns([], settings)).toEqual({ slot: 0, panel: 542 });
  });
  it("frames a group at its largest box in each direction", () => {
    expect(groupFrame([boxes.vertical, boxes.horizontal])).toEqual({ width: 424, height: boxes.vertical.height });
    expect(groupFrame([])).toEqual({ width: 0, height: 0 });
  });
});

describe("the phone stage", () => {
  it("fits every photo whole, the frame the largest of them", () => {
    expect(fitWhole(0.75, 316, 300)).toEqual({ width: 225, height: 300 });
    expect(fitWhole(4 / 3, 316, 300)).toEqual({ width: 316, height: 237 });
    const stage = pageStage([0, 1], [0.75, 4 / 3], 316, 300);
    expect(stage.frame).toEqual({ width: 316, height: 300 });
    expect(stage.boxes.map((box) => box.width / box.height)).toEqual([0.75, 4 / 3]);
  });
  it("caps the stage, leaves the words their room and keeps a floor", () => {
    expect(stageHeight(337.6, 500, 120)).toBe(337.6);
    expect(stageHeight(337.6, 200, 120)).toBe(200);
    expect(stageHeight(337.6, 40, 120)).toBe(120);
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/gallery`. Expected FAIL: the modules do not exist.
- [ ] **Step 3: Implement** `lib/gallery/plan.ts`:
```ts
// Which photos sit beside which words in a card's modal. Aaron's pick from the
// gallery lab (rounds four to six, 2026-10-09; branch lab, app/lab/gallery/plan.ts
// at ae9b6dd, rotatingPlan), with one guard: the card picture never takes turns,
// because a parked flown card covers it. Pure: both layouts and the tests read it.

export interface PlanPhoto {
  // The word unit (a paragraph, or on the jobs card a timeline entry) this photo
  // belongs beside; undefined, or a unit the card lacks, names none.
  beside?: number;
}

export interface Slide {
  photo: number; // the row's first photo: the one standing still, or the first to show
  photos: number[]; // the row's photos, photo first; two or more take turns
  own?: number; // the word unit this row's photo owns
  before: number[]; // free units shown before own
  after: number[]; // and after it
}

export interface Plan {
  intro: number[]; // units before the first row: full width on desktop, the first page on a phone
  slides: Slide[];
  closing: number[]; // units after the last row
}

export interface Page extends Slide {
  links: boolean; // the card's links (and the mentors) sit on this page
  wordless?: boolean; // grouping B: a group's later photo alone with its caption
}

// A: a page a paragraph, the group turning in the stage. B: a page a photo, a
// group's later pages wordless. C: a page a paragraph, the rest of the group in a strip.
export type PhoneGrouping = "paragraph" | "photo" | "strip";
export type StageKind = "still" | "turns" | "strip";

const validIn = (count: number) => (unit: number | undefined): unit is number => unit !== undefined && Number.isInteger(unit) && unit >= 0 && unit < count;

// The card picture first, then the others in the order of the unit they name,
// those naming none last.
export function photoOrder(photos: readonly PlanPhoto[], wordCount: number, lead?: number): number[] {
  const valid = validIn(wordCount);
  const rest = photos.map((photo, i) => ({ i, key: valid(photo.beside) ? photo.beside : Infinity })).filter(({ i }) => i !== lead);
  rest.sort((a, b) => a.key - b.key || a.i - b.i);
  const hasLead = lead !== undefined && lead >= 0 && lead < photos.length;
  return [...(hasLead ? [lead] : []), ...rest.map(({ i }) => i)];
}

type Placed = { slide: Slide; at: number };

function claimWords(wordCount: number, photos: readonly PlanPhoto[], lead?: number): Placed[] {
  const valid = validIn(wordCount);
  const claimed = new Set<number>();
  return photoOrder(photos, wordCount, lead).map((photo) => {
    const named = photo === lead && wordCount > 0 ? 0 : photos[photo].beside;
    const own = valid(named) && !claimed.has(named) ? named : undefined;
    if (own !== undefined) claimed.add(own);
    // A photo whose unit was taken follows the photo that took it.
    const at = own !== undefined ? own : valid(named) ? named + 0.5 : Infinity;
    return { slide: { photo, photos: [photo], own, before: [], after: [] }, at };
  });
}

function giveEveryPhotoWords(placed: Placed[], wordCount: number, lead?: number): Placed[] {
  const owns = (list: readonly Placed[]) => list.flatMap(({ slide }) => (slide.own === undefined ? [] : [slide.own]));
  const taken = new Set(owns(placed));
  placed.forEach((item, i) => {
    if (item.slide.own !== undefined) return;
    const below = Math.max(-1, ...owns(placed.slice(0, i)));
    const above = Math.min(wordCount, ...owns(placed.slice(i + 1)));
    for (let unit = below + 1; unit < above; unit++) {
      if (taken.has(unit)) continue;
      item.slide.own = unit;
      item.at = unit;
      taken.add(unit);
      return;
    }
  });
  const rows: Placed[] = [];
  let waiting: number[] = [];
  for (const { slide, at } of placed) {
    const previous = rows[rows.length - 1];
    if (slide.own !== undefined) {
      rows.push({ slide: { ...slide, photos: [slide.photo, ...waiting] }, at });
      waiting = [];
    } else if (previous && previous.slide.photo !== lead) previous.slide.photos.push(slide.photo);
    else waiting.push(slide.photo);
  }
  const last = rows[rows.length - 1];
  if (last && last.slide.photo !== lead) last.slide.photos.push(...waiting);
  else if (waiting.length) rows.push({ slide: { photo: waiting[0], photos: waiting, before: [], after: [] }, at: Infinity });
  return rows;
}

function arrange(wordCount: number, placed: readonly Placed[]): Plan {
  const claimed = new Set(placed.flatMap(({ slide }) => (slide.own === undefined ? [] : [slide.own])));
  type Item = { kind: "slide"; slide: Slide; at: number } | { kind: "text"; unit: number; at: number };
  const items: Item[] = placed.map(({ slide, at }) => ({ kind: "slide", slide, at }));
  for (let unit = 0; unit < wordCount; unit++) if (!claimed.has(unit)) items.push({ kind: "text", unit, at: unit });
  items.sort((x, y) => x.at - y.at || (x.kind === "slide" ? -1 : 1) - (y.kind === "slide" ? -1 : 1));
  const slides = items.flatMap((item) => (item.kind === "slide" ? [item.slide] : []));
  const intro: number[] = [];
  const closing: number[] = [];
  let previous: Slide | undefined;
  let run: number[] = [];
  for (const item of items) {
    if (item.kind === "text") {
      run.push(item.unit);
      continue;
    }
    if (!previous) intro.push(...run);
    else {
      const half = Math.ceil(run.length / 2);
      previous.after.push(...run.slice(0, half));
      item.slide.before.push(...run.slice(half));
    }
    run = [];
    previous = item.slide;
  }
  if (previous) closing.push(...run);
  else intro.push(...run);
  return { intro, slides, closing };
}

const group = (members: number[], own?: number): Slide => ({ photo: members[0], photos: members, own, before: [], after: [] });

export function galleryPlan(wordCount: number, photos: readonly PlanPhoto[], lead?: number): Plan {
  if (photos.length <= wordCount) return arrange(wordCount, giveEveryPhotoWords(claimWords(wordCount, photos, lead), wordCount, lead));
  const order = photoOrder(photos, wordCount, lead);
  const own = wordCount === 1 ? 0 : undefined;
  if (wordCount <= 1) {
    const hasLead = lead !== undefined && order[0] === lead;
    if (!hasLead || order.length < 2) return { intro: [], slides: [group(order, own)], closing: [] };
    return { intro: [], slides: [group([order[0]], own), group(order.slice(1))], closing: [] };
  }
  const [first, ...rest] = order;
  const rows = wordCount - 1;
  const base = Math.floor(rest.length / rows);
  const extra = rest.length % rows;
  const slides = [group([first], 0)];
  let taken = 0;
  for (let row = 0; row < rows; row++) {
    const size = base + (row >= rows - extra ? 1 : 0);
    slides.push(group(rest.slice(taken, taken + size), row + 1));
    taken += size;
  }
  return { intro: [], slides, closing: [] };
}

// Photos grouped by the unit each names, in unit order, those naming none in the
// last group; skip leaves one photo out (namedPlan's card picture).
function groupsOf(wordCount: number, photos: readonly PlanPhoto[], skip?: number): Placed[] {
  const valid = validIn(wordCount);
  const groups = new Map<number, number[]>();
  const strays: number[] = [];
  photos.forEach((photo, i) => {
    if (i === skip) return;
    if (valid(photo.beside)) groups.set(photo.beside, [...(groups.get(photo.beside) ?? []), i]);
    else strays.push(i);
  });
  const placed: Placed[] = [...groups.entries()].sort(([a], [b]) => a - b).map(([own, members]) => ({ slide: group(members, own), at: own }));
  const last = placed[placed.length - 1];
  if (last) last.slide.photos.push(...strays);
  else if (strays.length) placed.push({ slide: group(strays), at: Infinity });
  return placed;
}

export function groupedPlan(wordCount: number, photos: readonly PlanPhoto[]): Plan {
  return arrange(wordCount, groupsOf(wordCount, photos));
}

// cards.md's pairing to the letter, for the photo cards the lab never showed
// Aaron (the band and Travel): the card picture stands alone in the first row,
// where the flight lands (cards.md: it is not paired), taking only the opening
// units no photo names; every other photo sits beside the unit it names,
// photos naming one unit taking turns; the other units ride with the rows as
// they do in groupedPlan.
export function namedPlan(wordCount: number, photos: readonly PlanPhoto[], lead: number): Plan {
  const { intro, slides, closing } = arrange(wordCount, groupsOf(wordCount, photos, lead));
  return { intro: [], slides: [{ ...group([lead]), before: intro }, ...slides], closing };
}

// A page a row: the opening units on the first page, the closing units and the
// links on the last.
export function pagesOf(plan: Plan): Page[] {
  const last = plan.slides.length - 1;
  return plan.slides.map((slide, i) => ({
    ...slide,
    photos: [...slide.photos],
    before: i === 0 ? [...plan.intro, ...slide.before] : [...slide.before],
    after: i === last ? [...slide.after, ...plan.closing] : [...slide.after],
    links: i === last,
  }));
}

// B: a group's first photo keeps the words; each later photo is a page alone.
export function photoPages(plan: Plan): Page[] {
  return pagesOf(plan).flatMap((page) => {
    const [first, ...rest] = page.photos;
    const wordless = rest.map((photo): Page => ({ photo, photos: [photo], before: [], after: [], links: false, wordless: true }));
    return [{ ...page, photo: first, photos: [first] }, ...wordless];
  });
}

export function phonePages(plan: Plan, grouping: PhoneGrouping): Page[] {
  return grouping === "photo" ? photoPages(plan) : pagesOf(plan);
}

export function stageKind(page: Page, grouping: PhoneGrouping): StageKind {
  if (page.photos.length < 2) return "still";
  return grouping === "paragraph" ? "turns" : grouping === "strip" ? "strip" : "still";
}

export function slideWords(slide: Slide): number[] {
  return [...slide.before, ...(slide.own === undefined ? [] : [slide.own]), ...slide.after];
}
```
`lib/gallery/boxes.ts`:
```ts
// The gallery's boxes (the lab's round four, Aaron's pick): one vertical box
// (3:4) and one horizontal box (4:3) of about the same area, every photo drawn
// in the box of its orientation; and on a phone, every photo fitted whole.

export type Box = { width: number; height: number };
export interface Boxes { vertical: Box; horizontal: Box }

export const isWide = (aspect: number, wideFrom: number) => aspect >= wideFrom;

export function fitWhole(aspect: number, boxWidth: number, boxHeight: number): Box {
  if (!(aspect > 0) || boxWidth <= 0 || boxHeight <= 0) return { width: 0, height: 0 };
  const width = Math.min(boxWidth, boxHeight * aspect);
  return { width, height: width / aspect };
}

export function uniformBoxes(verticalWidth: number, horizontalWidth: number): Boxes {
  return { vertical: { width: verticalWidth, height: (verticalWidth * 4) / 3 }, horizontal: { width: horizontalWidth, height: (horizontalWidth * 3) / 4 } };
}

export const boxFor = (aspect: number, boxes: Boxes, wideFrom: number): Box => (isWide(aspect, wideFrom) ? boxes.horizontal : boxes.vertical);

export function groupFrame(boxes: readonly Box[]): Box {
  return boxes.reduce((frame, box) => ({ width: Math.max(frame.width, box.width), height: Math.max(frame.height, box.height) }), { width: 0, height: 0 });
}

export interface ColumnSettings { boxes: Boxes; wideFrom: number; columnGap: number; textWidth: number; padding: number; border: number }

// The photo column is as wide as the card's widest box, so its words sit in one
// place on every row; the panel is that column, the gap, the words, the padding
// and the border. A card with no photos is the words alone.
export function rowColumns(aspects: readonly number[], g: ColumnSettings) {
  const slot = aspects.reduce((widest, aspect) => Math.max(widest, boxFor(aspect, g.boxes, g.wideFrom).width), 0);
  const inner = slot > 0 ? slot + g.columnGap + g.textWidth : g.textWidth;
  return { slot, panel: inner + 2 * g.padding + 2 * g.border };
}

export function pageStage(photos: readonly number[], aspects: readonly number[], innerWidth: number, height: number) {
  const boxes = photos.map((photo) => fitWhole(aspects[photo], innerWidth, height));
  return { frame: groupFrame(boxes), boxes };
}

// The cap, or less when the page is too short to leave the words their room,
// never below the floor.
export const stageHeight = (capPx: number, roomPx: number, floorPx: number) => Math.max(floorPx, Math.min(capPx, roomPx));
```
- [ ] **Step 4:** `pnpm vitest run lib/gallery` passes; `pnpm tsc --noEmit`, `pnpm lint` green.
- [ ] **Step 5: Commit.**
```bash
git add lib/gallery/plan.ts lib/gallery/boxes.ts lib/gallery/plan.test.ts lib/gallery/boxes.test.ts
git commit -m "Gallery: the lab's round six plan (the card picture never turns), the timeline's grouped rows, cards.md's named pairing for the band and Travel, the boxes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Each card's gallery, the lab's values and the image sizes (Sonnet)

**Files:**
- Create: `lib/gallery/constants.ts`, `lib/gallery/card.ts`, `lib/gallery/timeline.ts`, `lib/gallery/card.test.ts`
- Modify: `lib/photoSizes.ts`, `lib/photoSizes.test.ts`

**Interfaces:**
- Consumes: Task 3's `galleryPlan`, `groupedPlan`, `namedPlan`, `Plan`, `rowColumns`, `uniformBoxes`, `Box`; Task 1's `jobTipKey`; `siteContent.cards`; `visibleText` (`lib/content/links.ts`).
- Produces:
```ts
// lib/gallery/constants.ts
export const GALLERY: { wideQuery; verticalWidth; horizontalWidth; wideFrom; textWidth; proseMaxWidth; rowGap; columnGap; panelPadding; panelBorder; headerTile; headerTileCompact; talosTileCompact; talosMarkMinPx; pager; rotate; mask; direction; ease }; // values below
export const BOXES: Boxes; // uniformBoxes(GALLERY.verticalWidth, GALLERY.horizontalWidth)
export const PHONE_GROUPING: Exclude<PhoneGrouping, "strip">;
// lib/gallery/card.ts
export interface GalleryPhoto { src: string; width: number; height: number; alt: string; caption: string | null; captionShort: string | null; beside?: number }
export type WordUnit = { kind: "block"; index: number } | { kind: "entry"; index: number };
export interface Gallery { key: CardKey; photos: readonly GalleryPhoto[]; lead: number | undefined; words: readonly WordUnit[]; plan: Plan; aspects: readonly number[]; panelWidth: number; slot: number }
export function galleryOf(key: CardKey): Gallery;
export function headerTileOf(key: CardKey, compact: boolean): Box; // 60 by 80; on a phone 42 by 56, Talos's 51 by 68
export function headerMeta(key: CardKey, compact: boolean): string; // the header's meta line (Ruling 9)
// lib/gallery/timeline.ts
export function employerSource(entry: number): string; // "[Popeyes](tip:job-0)"
// lib/photoSizes.ts
export const CARD_PICTURE_SIZES: string; // "320px"
export function galleryRowSizes(sourceAspect: number, box: { width: number; height: number }): string;
export const PAGER_PHOTO_SIZES: string; // "calc(100vw - 74px)"
```
A photo card's gallery starts with its card picture (index 0, the `lead`, captioned with `modal.picture.caption`), then its modal photos in `lib/content/media.ts` order. A logo card's gallery is its modal photos. Words are `modal.blocks`, and on the jobs card the five timeline entries after the three paragraphs (a jobs photo's `beside` is `3 + timeline`). The plan is `groupedPlan` for the jobs card, `namedPlan` for the band and Travel (Ruling 5), and `galleryPlan` for every other card. `headerTileOf` and `headerMeta` give Task 7's header its tile (Ruling 10's Talos tile) and its meta line (Ruling 9).

- [ ] **Step 1: Failing tests.** `lib/gallery/card.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { siteContent, type CardKey } from "@/lib/content";
import { parseInlineLinks, visibleText } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { galleryOf, headerMeta, headerTileOf } from "@/lib/gallery/card";
import { GALLERY, PHONE_GROUPING } from "@/lib/gallery/constants";
import { slideWords } from "@/lib/gallery/plan";
import { employerSource } from "@/lib/gallery/timeline";

const keys = Object.keys(siteContent.cards) as CardKey[];
const rows = (key: CardKey) => galleryOf(key).plan.slides.map((slide) => ({ photos: slide.photos, words: slideWords(slide) }));

describe("each card's gallery", () => {
  it("leads a photo card with its captioned card picture", () => {
    expect(keys.filter((key) => galleryOf(key).lead === 0)).toEqual(["mentorship", "band", "travel", "hackathons", "misuki", "building-in-public"]);
    const mentorship = galleryOf("mentorship");
    expect(mentorship.photos[0]).toMatchObject({ src: "/photos/cards/mentorship-picture.jpg", width: 1200, height: 1600, caption: "Me speaking at my first HSF STEM Summit." });
    expect(mentorship.photos.map((photo) => photo.caption)).toEqual([
      "Me speaking at my first HSF STEM Summit.",
      "Me at my second HSF, this time as a mentor.",
      "Me at HSF my first year, as a scholar.",
      "Me at my first SHPE national convention, 2023. I've been to every one since.",
    ]);
    expect(galleryOf("misuki").photos[3].captionShort).toBe("The real Mazda 787B that won Le Mans in 1991, at the Mazda Museum in Hiroshima.");
  });

  it("sits every photo beside the words Aaron's rule gives it, and the band's and Travel's beside the words cards.md names", () => {
    expect(Object.fromEntries(keys.map((key) => [key, rows(key)]))).toEqual({
      mentorship: [{ photos: [0], words: [0] }, { photos: [1, 2, 3], words: [1] }],
      "min-max": [],
      band: [{ photos: [0], words: [] }, { photos: [1], words: [0] }, { photos: [2], words: [1] }, { photos: [3], words: [2] }],
      talos: [],
      travel: [{ photos: [0], words: [] }, { photos: [1, 2, 3], words: [0] }],
      "capital-one": [{ photos: [0], words: [1] }, { photos: [1], words: [2] }, { photos: [2], words: [3] }],
      hackathons: [{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }],
      anthropic: [{ photos: [0], words: [0] }, { photos: [1, 2], words: [1] }],
      misuki: [{ photos: [0], words: [0] }, { photos: [1, 2, 3], words: [1] }],
      ieee: [{ photos: [0], words: [0, 1] }, { photos: [1], words: [2, 3] }, { photos: [2], words: [4] }],
      jobs: [{ photos: [0, 1], words: [4, 5] }, { photos: [2], words: [6] }, { photos: [3], words: [7] }],
      "this-site": [],
      fsdatalink: [],
      "building-in-public": [{ photos: [0], words: [0] }, { photos: [1], words: [1] }, { photos: [2], words: [2] }],
    });
    expect(Object.fromEntries(keys.map((key) => [key, [galleryOf(key).plan.intro, galleryOf(key).plan.closing]]))).toMatchObject({
      "capital-one": [[0], [4]], hackathons: [[], [3]], jobs: [[0, 1, 2, 3], []], "min-max": [[0], []], talos: [[0, 1], []], "this-site": [[0], []], fsdatalink: [[0, 1], []], band: [[], []], travel: [[], [1]],
    });
  });

  it("reads the jobs card's words as its three paragraphs, then its five entries", () => {
    expect(galleryOf("jobs").words).toEqual([
      { kind: "block", index: 0 }, { kind: "block", index: 1 }, { kind: "block", index: 2 },
      { kind: "entry", index: 0 }, { kind: "entry", index: 1 }, { kind: "entry", index: 2 }, { kind: "entry", index: 3 }, { kind: "entry", index: 4 },
    ]);
    expect(galleryOf("jobs").photos.map((photo) => photo.beside)).toEqual([4, 4, 6, 7]);
  });

  it("sizes each panel to its widest box: 918 all vertical, 1022 with a horizontal photo, 542 with none", () => {
    expect(Object.fromEntries(keys.map((key) => [key, galleryOf(key).panelWidth]))).toEqual({
      mentorship: 1022, "min-max": 542, band: 1022, talos: 542, travel: 918, "capital-one": 918, hackathons: 1022,
      anthropic: 1022, misuki: 1022, ieee: 1022, jobs: 918, "this-site": 542, fsdatalink: 542, "building-in-public": 1022,
    });
  });

  it("holds the lab's round six values", () => {
    expect(GALLERY).toMatchObject({ wideQuery: "(min-width: 1024px)", verticalWidth: 320, horizontalWidth: 424, wideFrom: 1, textWidth: 460, rowGap: 64, columnGap: 56 });
    expect(GALLERY.rotate).toMatchObject({ intervalMs: 3000, changeMs: 640, delayMs: 1200, captionOut: 0.5, captionInAt: 0.25, marksInsetPx: 8, tapPx: 10, holdMs: 500 });
    expect(GALLERY.mask).toEqual({ landingMs: 520, lengthMs: 480, staggerMs: 110, lineStaggerMs: 45, settle: 1.02 });
    expect(GALLERY.pager).toMatchObject({ stageMax: 0.4, slideMs: 360, flickPx: 96, sheetInsetPx: 48 });
    expect([GALLERY.direction, GALLERY.headerTile, GALLERY.headerTileCompact]).toEqual(["ltr", { width: 60, height: 80 }, { width: 42, height: 56 }]);
    expect([GALLERY.talosTileCompact, GALLERY.talosMarkMinPx]).toEqual([{ width: 51, height: 68 }, 20]);
    expect(PHONE_GROUPING).toBe("paragraph");
  });

  it("gives the header a 3:4 tile, and Talos's on a phone room for its kit's 20px mark", () => {
    for (const key of keys) for (const compact of [false, true]) expect(headerTileOf(key, compact).width / headerTileOf(key, compact).height, key).toBeCloseTo(0.75, 9);
    expect([headerTileOf("talos", false), headerTileOf("talos", true), headerTileOf("capital-one", true)]).toEqual([{ width: 60, height: 80 }, { width: 51, height: 68 }, { width: 42, height: 56 }]);
  });

  it("keeps IEEE's AO tip in the modal beside the rows, and the shorter meta on a phone", () => {
    expect(headerMeta("ieee", false)).toBe("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026");
    expect(headerMeta("ieee", true)).toBe("President, 2023 to 2026");
    expect(keys.filter((key) => headerMeta(key, false) !== headerMeta(key, true))).toEqual(["ieee"]);
    expect([headerMeta("band", false), headerMeta("this-site", false), headerMeta("anthropic", true)]).toEqual(["Drum major, 2021 to 2023", "Portfolio, 2026", "Claude Campus Ambassador, 2026"]);
  });
});

describe("the timeline's employers", () => {
  it("are inline tips on their own words", () => {
    expect(siteContent.cards.jobs.timeline.map((_, i) => employerSource(i))).toEqual([
      "[Popeyes](tip:job-0)", "[MOD Pizza](tip:job-1)", "[Student mentor, UT Austin](tip:job-2)", "[Apple](tip:job-3)", "[Aritzia](tip:job-4)",
    ]);
    for (let i = 0; i < 5; i++) {
      expect(parseInlineLinks(employerSource(i), registerHas).unknown).toEqual([]);
      expect(visibleText(employerSource(i))).toBe(siteContent.cards.jobs.timeline[i].employer);
    }
  });
});
```
Append to `lib/photoSizes.test.ts`:
```ts
describe("the card modal's image sizes", () => {
  it("asks for the card picture at its 320px box, and a pager photo at the panel's inner width", () => {
    expect(CARD_PICTURE_SIZES).toBe("320px");
    expect(PAGER_PHOTO_SIZES).toBe("calc(100vw - 74px)");
  });
  it("covers a box's drawn width when the photo is wider than the box", () => {
    const vertical = { width: 320, height: (320 * 4) / 3 };
    const horizontal = { width: 424, height: 318 };
    expect(galleryRowSizes(0.75, vertical)).toBe("320px");
    expect(galleryRowSizes(998 / 1600, vertical)).toBe("320px");
    expect(galleryRowSizes(1600 / 1205, horizontal)).toBe("424px");
    expect(galleryRowSizes(1600 / 858, horizontal)).toBe("594px");
  });
});
```
(add `CARD_PICTURE_SIZES, galleryRowSizes, PAGER_PHOTO_SIZES` to its import from `@/lib/photoSizes`, and `describe` if missing.)
- [ ] **Step 2:** `pnpm vitest run lib/gallery lib/photoSizes.test.ts`. Expected FAIL: the modules and exports do not exist.
- [ ] **Step 3: Implement.** `lib/gallery/constants.ts`:
```ts
import { uniformBoxes } from "./boxes";
import type { PhoneGrouping } from "./plan";

// The gallery lab's round six values, Aaron's pick of 2026-10-09 (branch lab,
// app/lab/gallery/settings.ts ROUND_SIX at ae9b6dd). Change a value here and
// nowhere else.
export const GALLERY = {
  wideQuery: "(min-width: 1024px)", // the rows from here up, the pager below
  verticalWidth: 320, // the vertical box, 3:4 (320 by 427)
  horizontalWidth: 424, // the horizontal box, 4:3 (424 by 318), about the same area
  wideFrom: 1, // width over height from which a photo takes the horizontal box
  textWidth: 460, // the words beside a photo
  proseMaxWidth: "62ch", // words with no photo beside them
  rowGap: 64,
  columnGap: 56, // photo to words
  panelPadding: 40,
  panelBorder: 1,
  headerTile: { width: 60, height: 80 }, // 3:4, so a flown logo card fills it
  headerTileCompact: { width: 42, height: 56 }, // the phone header's, clear of the close button
  talosTileCompact: { width: 51, height: 68 }, // Talos's phone tile: its mark at 40 percent is 20.4px
  talosMarkMinPx: 20, // the Talos kit's smallest mark (interactions-brief.md section 2)
  pager: {
    stageMax: 0.4, // of the visible height
    wordlessMax: 0.55, // grouping B's photo-only pages
    slideMs: 360,
    flickPx: 96,
    wordsRoomPx: 128, // under the stage: the caption and two lines of words
    captionRoomPx: 72, // under a wordless page's stage
    stageFloorPx: 120,
    insetPx: 74, // the backdrop's px-4, the panel's p-5 and its 1px border, both sides
    sheetInsetPx: 48, // the backdrop's py-6, top and bottom: the sheet is the visible height less this
  },
  rotate: {
    intervalMs: 3000, // a photo stays 3s (round six; round five was 4.5s)
    changeMs: 640,
    delayMs: 1200, // after the landing, before the clock starts
    visible: 1 / 3, // of the frame on screen, or the clock holds
    captionOut: 0.5, // the old caption's clip closes over the first half of the change
    captionInAt: 0.25, // the new one's opens over the last 75 percent
    marksInsetPx: 8, // a phone stage's marks, inside the current photo's bottom right corner
    tapPx: 10, // a phone tap that moves further is a swipe
    holdMs: 500, // a phone press held longer only holds the group
  },
  mask: { landingMs: 520, lengthMs: 480, staggerMs: 110, lineStaggerMs: 45, settle: 1.02 },
  direction: "ltr", // every reveal reads left to right (round six)
  ease: { gsap: "site", css: "cubic-bezier(0.22, 1, 0.36, 1)" },
} as const;

export const BOXES = uniformBoxes(GALLERY.verticalWidth, GALLERY.horizontalWidth);

// The phone's grouping. A ("paragraph") ships; B ("photo") is a one-line switch;
// C ("strip") needs the lab's PagerStrip, which this slice does not build, so the
// type refuses it.
export const PHONE_GROUPING: Exclude<PhoneGrouping, "strip"> = "paragraph";
```
`lib/gallery/card.ts`:
```ts
import { siteContent, type CardKey } from "@/lib/content";
import { visibleText } from "@/lib/content/links";
import { rowColumns, type Box } from "./boxes";
import { BOXES, GALLERY } from "./constants";
import { galleryPlan, groupedPlan, namedPlan, type Plan } from "./plan";

// One card's modal as the gallery reads it: its photos (the card picture first
// on a photo card), the word units they sit beside, Aaron's plan, and the
// desktop panel's width; and the header's tile and meta line by layout.

export interface GalleryPhoto { src: string; width: number; height: number; alt: string; caption: string | null; captionShort: string | null; beside?: number }
export type WordUnit = { kind: "block"; index: number } | { kind: "entry"; index: number };
export interface Gallery { key: CardKey; photos: readonly GalleryPhoto[]; lead: number | undefined; words: readonly WordUnit[]; plan: Plan; aspects: readonly number[]; panelWidth: number; slot: number }

// The photo cards the gallery lab never showed Aaron follow cards.md's pairings
// to the letter (ruled on the plan's review, 2026-10-10); every other photo card
// keeps the lab's round six rule, as Aaron picked it.
const NAMED: ReadonlySet<CardKey> = new Set<CardKey>(["band", "travel"]);

const cache = new Map<CardKey, Gallery>();

export function galleryOf(key: CardKey): Gallery {
  const hit = cache.get(key);
  if (hit) return hit;
  const { visual, modal } = siteContent.cards[key];
  const picture = visual.kind === "photo" ? visual.photo : null;
  const blocks = modal.blocks.map((_, index): WordUnit => ({ kind: "block", index }));
  const entries = key === "jobs" ? siteContent.cards.jobs.timeline.map((_, index): WordUnit => ({ kind: "entry", index })) : [];
  const photos: GalleryPhoto[] = [
    ...(picture ? [{ src: picture.src, width: picture.width, height: picture.height, alt: picture.alt, caption: modal.picture?.caption ?? null, captionShort: null }] : []),
    ...modal.photos.map((photo) => ({
      src: photo.src, width: photo.width, height: photo.height, alt: photo.alt, caption: photo.caption, captionShort: photo.captionShort ?? null,
      beside: photo.block !== undefined ? photo.block : blocks.length + photo.timeline,
    })),
  ];
  const lead = picture ? 0 : undefined;
  const words = [...blocks, ...entries];
  const plan =
    key === "jobs" ? groupedPlan(words.length, photos) : lead !== undefined && NAMED.has(key) ? namedPlan(words.length, photos, lead) : galleryPlan(words.length, photos, lead);
  const aspects = photos.map((photo) => photo.width / photo.height);
  const columns = rowColumns(aspects, { boxes: BOXES, wideFrom: GALLERY.wideFrom, columnGap: GALLERY.columnGap, textWidth: GALLERY.textWidth, padding: GALLERY.panelPadding, border: GALLERY.panelBorder });
  const gallery: Gallery = { key, photos, lead, words, plan, aspects, panelWidth: columns.panel, slot: columns.slot };
  cache.set(key, gallery);
  return gallery;
}

// The header's 3:4 tile, where a flown card lands unless it lands on the card
// picture: 60 by 80 beside the rows, 42 by 56 on a phone, and Talos's 51 by 68
// there, so its mark (40 percent of the tile) is never under its kit's 20px.
export function headerTileOf(key: CardKey, compact: boolean): Box {
  if (!compact) return GALLERY.headerTile;
  return key === "talos" ? GALLERY.talosTileCompact : GALLERY.headerTileCompact;
}

// The header's meta line: modal.meta where cards.md gave a shorter one, else the
// book's. A book meta holding a tip the book row cannot show (IEEE's AO) shows
// whole beside the rows, so the tip lives in the modal (cards.md, IEEE); a phone
// keeps the shorter line cards.md made for it.
export function headerMeta(key: CardKey, compact: boolean): string {
  const { book, modal } = siteContent.cards[key];
  return !compact && visibleText(book.meta) !== book.meta ? book.meta : (modal.meta ?? book.meta);
}
```
(If TypeScript does not narrow `photo.timeline` in the else branch, write `photo.timeline ?? 0`; the union in `lib/content/types.ts` guarantees one of the two.)

`lib/gallery/timeline.ts`:
```ts
import { siteContent } from "@/lib/content";
import { jobTipKey } from "@/lib/content/register";

// A timeline entry's employer as inline markup, so its insider tip is an
// ordinary tip (the register holds job-0 to job-4) and InlineCopy renders it.
export function employerSource(entry: number): string {
  return `[${siteContent.cards.jobs.timeline[entry].employer}](tip:${jobTipKey(entry)})`;
}
```
`lib/photoSizes.ts`, append (and `import { GALLERY } from "@/lib/gallery/constants";` at the top):
```ts
// The card picture in the gallery's first row, and the flight's sharp copy laid
// over it (components/FlyingTile): a 3:4 file in a 3:4 box, so no cover scale.
export const CARD_PICTURE_SIZES = `${GALLERY.verticalWidth}px`;

// A desktop gallery photo drawn with object-fit: cover in its box; the request
// covers the drawn width when the photo is wider than the box.
export function galleryRowSizes(sourceAspect: number, box: { width: number; height: number }): string {
  const drawn = box.width * coverScale(sourceAspect, box.width / box.height);
  return `${Math.ceil(Number(drawn.toFixed(3)))}px`;
}

// A pager photo, fitted whole inside the panel's inner width.
export const PAGER_PHOTO_SIZES = `calc(100vw - ${GALLERY.pager.insetPx}px)`;
```
- [ ] **Step 4:** `pnpm vitest run lib/gallery lib/photoSizes.test.ts` passes; `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green.
- [ ] **Step 5: Commit.**
```bash
git add lib/gallery/constants.ts lib/gallery/card.ts lib/gallery/timeline.ts lib/gallery/card.test.ts lib/photoSizes.ts lib/photoSizes.test.ts
git commit -m "Gallery: each card's photos, words and plan, the header's tile and meta, the lab's round six values, the modal's image sizes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The motion math: the mask table, the reveals, the pager and the rotator's gate (Sonnet)

**Files:**
- Create: `lib/gallery/timing.ts`, `lib/gallery/reveal.ts`, `lib/gallery/pager.ts`, `lib/gallery/rotator.ts`, `lib/gallery/motion.test.ts`

**Interfaces:**
- Consumes: Task 3's `Plan`, `Page`, `Slide`; Task 4's `GALLERY`.
- Produces:
```ts
// timing.ts
export interface MaskPart { id: string; lines?: number }
export type MaskStep = MaskPart[];
export interface MaskTiming { startMs: number; lengthMs: number; staggerMs: number; lineStaggerMs: number }
export interface MaskEntry { id: string; step: number; startMs: number; endMs: number; lineStartsMs: number[] }
export function maskTable(steps: readonly MaskStep[], t: MaskTiming): { entries: MaskEntry[]; endMs: number };
export const partId: { title: "title"; meta: "meta"; mentors: "mentors"; links: "links"; pager: "pager"; words(unit: number): string; photo(p: number): string; caption(p: number): string; rotator(p: number): string };
export interface StepOptions { flown?: number; hasCaption: (photo: number) => boolean; hasLinks: boolean; trailing?: readonly string[]; lines?: (id: string) => number }
export function planSteps(plan: Plan, o: StepOptions): MaskStep[];
export function pagerSteps(pages: readonly Page[], o: StepOptions): MaskStep[];
// reveal.ts
export type MaskDirection = "ltr" | "up";
export function photoWipeIn(d: MaskDirection): { from: string; to: string };
export function photoWipeOut(d: MaskDirection): { from: string; to: string };
export function textIn(d: MaskDirection): { from: { clipPath: string } | { yPercent: number }; to: { clipPath: string } | { yPercent: number } };
export function textOut(d: MaskDirection): same shape;
export type Span = { left: number; width: number };
export function sweepInsets(progress: number, frameWidth: number, incoming: Span, outgoing: Span): { incoming: string; outgoing: string };
// pager.ts
export interface PagerState { index: number; count: number }
export type PagerAction = { type: "next" } | { type: "prev" } | { type: "goto"; index: number };
export function pagerReducer(state: PagerState, action: PagerAction): PagerState;
export type Axis = "x" | "y";
export function axisOf(dx: number, dy: number, slopPx?: number): Axis | null;
export type Release = "next" | "prev" | "dismiss" | "stay";
export function releaseOf(axis: Axis | null, dx: number, dy: number, velocity: number, o: { swipePx?: number; flickPx: number; speed?: number; minFlickPx?: number }): Release;
export function rubberBand(dx: number, index: number, count: number): number;
// rotator.ts
export function wrap(index: number, count: number): number;
export interface RotatorGate { count: number; reduced: boolean; started: boolean; paused: boolean; held: boolean; visible: boolean }
export function rotatorRuns(g: RotatorGate): boolean;
export function remainingAfter(remainingMs: number, ranMs: number): number;
```

- [ ] **Step 1: Failing tests** (`lib/gallery/motion.test.ts`):
```ts
import { describe, expect, it } from "vitest";
import { galleryPlan, pagesOf } from "@/lib/gallery/plan";
import { axisOf, pagerReducer, releaseOf, rubberBand } from "@/lib/gallery/pager";
import { photoWipeIn, photoWipeOut, sweepInsets, textIn, textOut } from "@/lib/gallery/reveal";
import { remainingAfter, rotatorRuns, wrap } from "@/lib/gallery/rotator";
import { maskTable, pagerSteps, planSteps } from "@/lib/gallery/timing";

const ids = (steps: { id: string }[][]) => steps.map((step) => step.map((part) => part.id));
const beside = (...words: (number | undefined)[]) => words.map((word) => (word === undefined ? {} : { beside: word }));

describe("the mask table", () => {
  it("starts at the landing, staggers steps 110ms and lines 45ms, each mask 480ms", () => {
    const table = maskTable([[{ id: "title" }], [{ id: "meta" }], [{ id: "words-0", lines: 3 }]], { startMs: 520, lengthMs: 480, staggerMs: 110, lineStaggerMs: 45 });
    expect(table.entries.map((e) => [e.id, e.startMs, e.endMs, e.lineStartsMs])).toEqual([["title", 520, 1000, [520]], ["meta", 630, 1110, [630]], ["words-0", 740, 1310, [740, 785, 830]]]);
    expect(table.endMs).toBe(1310);
  });
  it("masks the header, the opening words, each row with its photo, caption and words, the closing words, the trailing parts, the links (Capital One)", () => {
    expect(ids(planSteps(galleryPlan(5, beside(1, 2, 3)), { hasCaption: () => true, hasLinks: false }))).toEqual([
      ["title"], ["meta"], ["words-0"], ["photo-0", "caption-0", "words-1"], ["photo-1", "caption-1", "words-2"], ["photo-2", "caption-2", "words-3"], ["words-4"],
    ]);
  });
  it("never masks the photo a parked flown card covers, adds a turning row's controls, and the mentors before the links (Mentorship)", () => {
    expect(ids(planSteps(galleryPlan(2, beside(undefined, 0, 0, 1), 0), { flown: 0, hasCaption: () => true, hasLinks: true, trailing: ["mentors"] }))).toEqual([
      ["title"], ["meta"], ["caption-0", "words-0"], ["photo-1", "caption-1", "words-1", "rotator-1"], ["mentors"], ["links"],
    ]);
  });
  it("masks a card with no photos as its words alone", () => {
    expect(ids(planSteps(galleryPlan(2, []), { hasCaption: () => false, hasLinks: true }))).toEqual([["title"], ["meta"], ["words-0"], ["words-1"], ["links"]]);
  });
  it("on a phone masks the header, the first page and the pager's controls", () => {
    const pages = pagesOf(galleryPlan(2, beside(undefined, 0, 0, 1), 0));
    expect(ids(pagerSteps(pages, { hasCaption: () => true, hasLinks: true, trailing: ["mentors"] }))).toEqual([["title"], ["meta"], ["photo-0", "caption-0"], ["words-0"], ["pager"]]);
    const one = pagesOf(galleryPlan(1, beside(0)));
    expect(ids(pagerSteps(one, { hasCaption: () => false, hasLinks: true }))).toEqual([["title"], ["meta"], ["photo-0"], ["words-0", "links"]]);
  });
});

describe("the reveals read left to right", () => {
  it("wipes a photo in from its left edge and out to its right", () => {
    expect(photoWipeIn("ltr")).toEqual({ from: "inset(0% 100% 0% 0% round 12px)", to: "inset(0% 0% 0% 0% round 12px)" });
    expect(photoWipeOut("ltr")).toEqual({ from: "inset(0% 0% 0% 0% round 12px)", to: "inset(0% 0% 0% 100% round 12px)" });
  });
  it("opens a line's clip in place, with room for the ink above and below", () => {
    expect(textIn("ltr")).toEqual({ from: { clipPath: "inset(-25% 102% -25% -2%)" }, to: { clipPath: "inset(-25% -2% -25% -2%)" } });
    expect(textOut("ltr")).toEqual({ from: { clipPath: "inset(-25% -2% -25% -2%)" }, to: { clipPath: "inset(-25% -2% -25% 102%)" } });
  });
  it("sweeps one edge across a turning frame, so photos of two shapes hand over on one line", () => {
    expect(sweepInsets(0.5, 424, { left: 52, width: 320 }, { left: 0, width: 424 })).toEqual({ incoming: "inset(0px 160px 0px 0px)", outgoing: "inset(0px 0px 0px 212px)" });
    expect(sweepInsets(1.2, 424, { left: 0, width: 424 }, { left: 52, width: 320 })).toEqual({ incoming: "inset(0px 0px 0px 0px)", outgoing: "inset(0px 0px 0px 320px)" });
  });
});

describe("the pager", () => {
  it("turns a page at a time and stops at either end", () => {
    expect(pagerReducer({ index: 0, count: 3 }, { type: "prev" })).toEqual({ index: 0, count: 3 });
    expect(pagerReducer({ index: 2, count: 3 }, { type: "next" })).toEqual({ index: 2, count: 3 });
    expect(pagerReducer({ index: 0, count: 3 }, { type: "goto", index: 9 })).toEqual({ index: 2, count: 3 });
  });
  it("picks a drag's axis once it moves past the slop", () => {
    expect(axisOf(3, 2)).toBeNull();
    expect(axisOf(10, 4)).toBe("x");
    expect(axisOf(4, 10)).toBe("y");
  });
  it("turns on a sideways drag, closes on a 96px vertical flick or a quick one, and never closes sideways", () => {
    const o = { flickPx: 96 };
    expect(releaseOf("x", -60, 0, 0, o)).toBe("next");
    expect(releaseOf("x", 60, 0, 0, o)).toBe("prev");
    expect(releaseOf("x", -30, 0, -0.7, o)).toBe("next");
    expect(releaseOf("x", 0, 200, 0, o)).toBe("stay");
    expect(releaseOf("y", 0, 100, 0, o)).toBe("dismiss");
    expect(releaseOf("y", 0, 50, 0, o)).toBe("stay");
    expect(releaseOf("y", 0, 30, 0.8, o)).toBe("dismiss");
    expect(releaseOf(null, 0, 0, 0, o)).toBe("stay");
  });
  it("follows the finger at a third of its travel past either end", () => {
    expect(rubberBand(30, 0, 3)).toBe(10);
    expect(rubberBand(-30, 2, 3)).toBe(-10);
    expect(rubberBand(30, 1, 3)).toBe(30);
  });
});

describe("the rotator's gate", () => {
  const go = { count: 3, reduced: false, started: true, paused: false, held: false, visible: true };
  it("turns only with two photos or more, after the start delay, unpaused, unheld, a third on screen, motion allowed", () => {
    expect(rotatorRuns(go)).toBe(true);
    for (const stop of [{ count: 1 }, { reduced: true }, { started: false }, { paused: true }, { held: true }, { visible: false }]) expect(rotatorRuns({ ...go, ...stop })).toBe(false);
  });
  it("wraps, and resumes with the time it had left", () => {
    expect([wrap(-1, 3), wrap(3, 3), wrap(0, 0)]).toEqual([2, 0, 0]);
    expect([remainingAfter(3000, 1200), remainingAfter(3000, 5000), remainingAfter(3000, -5)]).toEqual([1800, 0, 3000]);
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/gallery/motion.test.ts`. Expected FAIL: the modules do not exist.
- [ ] **Step 3: Implement.** `lib/gallery/timing.ts`:
```ts
import type { Page, Plan, Slide } from "./plan";

// The mask-in as a table: which parts start together, when each starts and when
// the last ends. Everything runs on a timer from the landing, on screen or not,
// so scrolling never waits (modal-gallery.md, "Masking in"). No DOM and no GSAP:
// components/card/useMaskIn turns the table into one timeline.

export interface MaskPart { id: string; lines?: number }
export type MaskStep = MaskPart[];
export interface MaskTiming { startMs: number; lengthMs: number; staggerMs: number; lineStaggerMs: number }
export interface MaskEntry { id: string; step: number; startMs: number; endMs: number; lineStartsMs: number[] }

export function maskTable(steps: readonly MaskStep[], t: MaskTiming): { entries: MaskEntry[]; endMs: number } {
  const entries: MaskEntry[] = [];
  steps.forEach((step, index) => {
    const startMs = t.startMs + index * t.staggerMs;
    for (const part of step) {
      const lines = Math.max(1, Math.floor(part.lines ?? 1));
      const lineStartsMs = Array.from({ length: lines }, (_, line) => startMs + line * t.lineStaggerMs);
      entries.push({ id: part.id, step: index, startMs, endMs: lineStartsMs[lines - 1] + t.lengthMs, lineStartsMs });
    }
  });
  return { entries, endMs: entries.reduce((latest, entry) => Math.max(latest, entry.endMs), t.startMs) };
}

// The ids the steps and the markup's data-mask attributes share.
export const partId = {
  title: "title",
  meta: "meta",
  mentors: "mentors",
  links: "links",
  pager: "pager",
  words: (unit: number) => `words-${unit}`,
  photo: (photo: number) => `photo-${photo}`,
  caption: (photo: number) => `caption-${photo}`,
  rotator: (photo: number) => `rotator-${photo}`,
} as const;

export interface StepOptions {
  flown?: number; // the photo a parked flown card covers: it never masks (its caption does)
  hasCaption: (photo: number) => boolean;
  hasLinks: boolean;
  trailing?: readonly string[]; // parts after the plan and before the links (the mentors)
  lines?: (id: string) => number;
}

const part = (id: string, o: StepOptions): MaskPart => ({ id, lines: o.lines?.(id) ?? 1 });

function photoParts(photo: number, o: StepOptions): MaskPart[] {
  const parts: MaskPart[] = photo === o.flown ? [] : [{ id: partId.photo(photo) }];
  if (o.hasCaption(photo)) parts.push(part(partId.caption(photo), o));
  return parts;
}

function slideParts(slide: Slide, o: StepOptions): MaskPart[] {
  const words = (unit: number) => part(partId.words(unit), o);
  return [...photoParts(slide.photo, o), ...slide.before.map(words), ...(slide.own === undefined ? [] : [words(slide.own)]), ...slide.after.map(words)];
}

const ends = (o: StepOptions): MaskStep[] => [...(o.trailing ?? []).map((id) => [part(id, o)]), ...(o.hasLinks ? [[part(partId.links, o)]] : [])];

// Desktop: the title, the meta line, the opening words one by one, each row's
// photo, caption and words together (a turning row adds its controls), the
// closing words, the trailing parts, the links.
export function planSteps(plan: Plan, o: StepOptions): MaskStep[] {
  const steps: MaskStep[] = [[part(partId.title, o)], [part(partId.meta, o)]];
  for (const unit of plan.intro) steps.push([part(partId.words(unit), o)]);
  for (const slide of plan.slides) steps.push([...slideParts(slide, o), ...(slide.photos.length > 1 ? [{ id: partId.rotator(slide.photo) }] : [])]);
  for (const unit of plan.closing) steps.push([part(partId.words(unit), o)]);
  return [...steps, ...ends(o)];
}

// Phone: the title, the meta line, the first page's photo and caption, its words
// (and the trailing parts and links when it is the last page), then the pager's
// controls. Later pages are off screen until turned to, long after the masks end.
export function pagerSteps(pages: readonly Page[], o: StepOptions): MaskStep[] {
  const steps: MaskStep[] = [[part(partId.title, o)], [part(partId.meta, o)]];
  const first = pages[0];
  if (first) {
    const photo = photoParts(first.photo, o);
    if (photo.length) steps.push(photo);
    const words = slideParts(first, o).slice(photo.length);
    if (first.links) words.push(...ends(o).flat());
    if (words.length) steps.push(words);
  }
  if (pages.length > 1) steps.push([{ id: partId.pager }]);
  return steps;
}
```
`lib/gallery/reveal.ts` (the lab's `reveal.ts` at ae9b6dd without the "rise" moves, which Aaron did not pick):
```ts
// Which way a reveal travels. Round six (Aaron, 2026-10-09: "we go from left to
// right, just in a readable direction"): a clip edge travels from the left edge
// to the right, and a line stays put while its clip opens. "up" is the earlier
// rounds' bottom-up reveal, kept for the constant's sake. Pure.

export type MaskDirection = "ltr" | "up";

const RADIUS = "round 12px";
const inset = (top: number, right: number, bottom: number, left: number) => `inset(${top}% ${right}% ${bottom}% ${left}% ${RADIUS})`;

export function photoWipeIn(direction: MaskDirection) {
  return direction === "ltr" ? { from: inset(0, 100, 0, 0), to: inset(0, 0, 0, 0) } : { from: inset(100, 0, 0, 0), to: inset(0, 0, 0, 0) };
}

export function photoWipeOut(direction: MaskDirection) {
  return direction === "ltr" ? { from: inset(0, 0, 0, 0), to: inset(0, 0, 0, 100) } : { from: inset(0, 0, 0, 0), to: inset(0, 0, 100, 0) };
}

// Room above, below and beside a line's box, so Profa's ink and a caption's
// descenders are never cut while the clip opens.
const INK = { block: 25, side: 2 };
const lineClip = (right: number, left: number) => `inset(-${INK.block}% ${right}% -${INK.block}% ${left}%)`;

export function textIn(direction: MaskDirection) {
  return direction === "ltr"
    ? { from: { clipPath: lineClip(100 + INK.side, -INK.side) }, to: { clipPath: lineClip(-INK.side, -INK.side) } }
    : { from: { yPercent: 110 }, to: { yPercent: 0 } };
}

export function textOut(direction: MaskDirection) {
  return direction === "ltr"
    ? { from: { clipPath: lineClip(-INK.side, -INK.side) }, to: { clipPath: lineClip(-INK.side, 100 + INK.side) } }
    : { from: { yPercent: 0 }, to: { yPercent: -110 } };
}

// A turning frame's left to right change in the frame's own coordinates: one
// edge crosses the frame, the incoming photo left of it and the outgoing right
// of it, so photos of two shapes hand over on one line. Lengths are px from each
// box's own left edge; no rounding, or the two clips would notch where they meet.
export type Span = { left: number; width: number };

export function sweepInsets(progress: number, frameWidth: number, incoming: Span, outgoing: Span) {
  const edge = Math.min(1, Math.max(0, progress)) * frameWidth;
  const within = (span: Span) => Math.min(span.width, Math.max(0, edge - span.left));
  const px = (n: number) => `${Number(n.toFixed(2))}px`;
  return { incoming: `inset(0px ${px(incoming.width - within(incoming))} 0px 0px)`, outgoing: `inset(0px 0px 0px ${px(within(outgoing))})` };
}
```
`lib/gallery/pager.ts`:
```ts
// The phone pager's state and gestures (the lab's stage.ts at ae9b6dd, round
// four). Pages never wrap; a sideways drag turns one, a vertical flick closes
// the modal, a sideways drag never does. Pure.

export interface PagerState { index: number; count: number }
export type PagerAction = { type: "next" } | { type: "prev" } | { type: "goto"; index: number };

const clampPage = (index: number, count: number) => (count <= 0 ? 0 : Math.min(count - 1, Math.max(0, index)));

export function pagerReducer(state: PagerState, action: PagerAction): PagerState {
  const index = action.type === "goto" ? action.index : state.index + (action.type === "next" ? 1 : -1);
  return { ...state, index: clampPage(index, state.count) };
}

export type Axis = "x" | "y";

// A drag picks its axis once it has moved past the slop, and keeps it.
export function axisOf(dx: number, dy: number, slopPx = 8): Axis | null {
  if (Math.abs(dx) < slopPx && Math.abs(dy) < slopPx) return null;
  return Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
}

export type Release = "next" | "prev" | "dismiss" | "stay";

export function releaseOf(axis: Axis | null, dx: number, dy: number, velocity: number, { swipePx = 48, flickPx, speed = 0.6, minFlickPx = 24 }: { swipePx?: number; flickPx: number; speed?: number; minFlickPx?: number }): Release {
  if (axis === "x") {
    const quick = Math.abs(velocity) >= speed && Math.abs(dx) >= minFlickPx;
    if (dx <= -swipePx || (quick && dx < 0)) return "next";
    if (dx >= swipePx || (quick && dx > 0)) return "prev";
    return "stay";
  }
  if (axis === "y") {
    const quick = Math.abs(velocity) >= speed && Math.abs(dy) >= minFlickPx;
    return Math.abs(dy) >= flickPx || quick ? "dismiss" : "stay";
  }
  return "stay";
}

// Past either end the track follows the finger at a third of its travel.
export function rubberBand(dx: number, index: number, count: number) {
  return (index === 0 && dx > 0) || (index >= count - 1 && dx < 0) ? dx / 3 : dx;
}
```
`lib/gallery/rotator.ts`:
```ts
// A turning frame's clock gate (the lab's stage.ts at ae9b6dd, round five): it
// runs only with two photos or more, motion allowed, the start delay past, not
// paused, not held (hovered, keyboard-focused or touched), and at least a third
// of the frame on screen. Pure.

export const wrap = (index: number, count: number) => (count <= 0 ? 0 : ((index % count) + count) % count);

export interface RotatorGate { count: number; reduced: boolean; started: boolean; paused: boolean; held: boolean; visible: boolean }

export const rotatorRuns = (g: RotatorGate) => g.count > 1 && !g.reduced && g.started && !g.paused && !g.held && g.visible;

// What ran is spent, so a pause resumes where it left off.
export const remainingAfter = (remainingMs: number, ranMs: number) => Math.max(0, remainingMs - Math.max(0, ranMs));
```
- [ ] **Step 4:** `pnpm vitest run lib/gallery` passes; `pnpm tsc --noEmit`, `pnpm lint` green.
- [ ] **Step 5: Commit.**
```bash
git add lib/gallery/timing.ts lib/gallery/reveal.ts lib/gallery/pager.ts lib/gallery/rotator.ts lib/gallery/motion.test.ts
git commit -m "Gallery: the mask table, the left to right reveals, the pager's gestures and the rotator's gate" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---


### Task 6: Card faces, the pure half: tokens, theme fields, the face block and the layouts (Opus)

**Files:**
- Modify: `app/globals.css` (two tokens), `lib/coil/theme.ts`, `lib/coil/theme.test.ts`, `lib/coil/constants.ts` (a new `face` block; no existing value changes), `lib/coil/cardFace.ts`
- Create: `lib/coil/cardFace.test.ts`

**Interfaces:**
- Consumes: `LogoRef` (with Task 1's `opaque`); Task 4's `GALLERY.talosTileCompact`, `GALLERY.headerTileCompact` and `GALLERY.talosMarkMinPx` (the Talos test only).
- Produces: `CoilTheme.card.anvil`, `.logoGround`, `.mark`; `COIL.face`; from `lib/coil/cardFace.ts` (still import-free): `logoBox(aspect, cardWidth, f: LogoFit): Fit`, `containBox(aspect, side): Fit`, `needsGround(logo: { srcDark: string | null; opaque?: boolean }, tile: "plain" | "anvil", dark: boolean): boolean`, `circlesLayout(count, aspect, o: { from; to; gap }): Circle[]` (card widths from the card's top left), `MARK_INK_BOX`, `type Fit = { w: number; h: number }`, `type LogoFit`, `type Circle = { x: number; y: number; r: number }`. Task 7's DOM face and Task 8's canvas painters both draw from these, so the header tile and the Coil card agree.

The faces (Rulings 10 and 11): a logo card is `--card-work-pane`, or `--card-anvil` for Talos in both themes, with its logo centred: a mark's longer side at 40 percent of the card's width, a wordmark (2:1 and wider) at 64 percent. In the dark theme a plain tile's logo with no dark file and not opaque sits on a rounded `--card-logo-ground` plate 7 percent of the card's width wider on each side. `srcDark` draws in the dark theme whenever it is set. The opaque IEEE square is drawn as the face: the square at the photo inset's width, centred, its corners rounded like a photo's. This site is the AS mark in the accent at 36 percent of the card's width. The jobs card is five discs on the card's diagonal, diameters 16, 20, 24, 28 and 32 percent of the card's width from Popeyes (bottom left) to Aritzia (top right), 2.5 percent apart, the group centred, each disc `--card-logo-ground` with a hairline and the light logo file at 62 percent of the disc. Backs: Talos's is the anvil; every other non-photo back is the existing plain work back.

- [ ] **Step 1: Failing unit tests.** `lib/coil/cardFace.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { cardDims, circlesLayout, containBox, logoBox, MARK_INK_BOX, needsGround } from "@/lib/coil/cardFace";
import { COIL } from "@/lib/coil/constants";
import { strandCardByKey } from "@/lib/content";
import { GALLERY } from "@/lib/gallery/constants";
import { BAR_PTS, BOLT_PTS, LEG_PTS } from "@/lib/mark/geometry";

describe("a logo on its tile", () => {
  it("draws a mark's longer side at 40 percent and a wordmark across 64 percent", () => {
    const minMax = logoBox(548 / 497, 384, COIL.face);
    expect([minMax.w, minMax.h].map((n) => +n.toFixed(3))).toEqual([153.6, 139.305]);
    const apple = logoBox(41.5 / 51, 384, COIL.face);
    expect([apple.w, apple.h].map((n) => +n.toFixed(3))).toEqual([124.988, 153.6]);
    expect(logoBox(578.9 / 65, 384, COIL.face).w).toBeCloseTo(245.76, 2);
    expect(logoBox(0, 384, COIL.face)).toEqual({ w: 0, h: 0 });
  });
  it("contains a logo in a square", () => {
    expect(containBox(2, 100)).toEqual({ w: 100, h: 50 });
    expect(containBox(0.5, 100)).toEqual({ w: 50, h: 100 });
  });
  it("puts a light plate only under a plain tile's logo with no dark file, in the dark theme, unless it is opaque", () => {
    expect(needsGround({ srcDark: null }, "plain", true)).toBe(true);
    expect(needsGround({ srcDark: null }, "plain", false)).toBe(false);
    expect(needsGround({ srcDark: "/x-on-dark.svg" }, "plain", true)).toBe(false);
    expect(needsGround({ srcDark: null, opaque: true }, "plain", true)).toBe(false);
    expect(needsGround({ srcDark: null }, "anvil", true)).toBe(false);
  });
});

describe("Talos's mark in the phone header's tile", () => {
  it("is never under its kit's 20px, where the plain phone tile would draw it smaller", () => {
    const face = strandCardByKey.get("talos")?.face;
    const aspect = face?.kind === "logo" ? face.logo.width / face.logo.height : 0;
    expect(logoBox(aspect, GALLERY.talosTileCompact.width, COIL.face).w).toBeGreaterThanOrEqual(GALLERY.talosMarkMinPx);
    expect(logoBox(aspect, GALLERY.headerTileCompact.width, COIL.face).w).toBeLessThan(GALLERY.talosMarkMinPx);
  });
});

describe("the jobs card's circles", () => {
  const aspect = COIL.cardAspect;
  const circles = circlesLayout(5, aspect, COIL.face.circles);
  const inset = cardDims(COIL.lab.textureSize).inset / COIL.lab.textureSize[0];
  it("grow from the oldest job to the newest, bottom left to top right", () => {
    expect(circles.map((c) => +(c.r * 2).toFixed(3))).toEqual([0.16, 0.2, 0.24, 0.28, 0.32]);
    for (let i = 1; i < 5; i++) {
      expect(circles[i].x).toBeGreaterThan(circles[i - 1].x);
      expect(circles[i].y).toBeLessThan(circles[i - 1].y);
    }
  });
  it("never touch, and stay inside the card's inset", () => {
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) expect(Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y)).toBeGreaterThanOrEqual(circles[i].r + circles[j].r + COIL.face.circles.gap - 1e-9);
      expect(circles[i].x - circles[i].r).toBeGreaterThanOrEqual(inset);
      expect(circles[i].x + circles[i].r).toBeLessThanOrEqual(1 - inset);
      expect(circles[i].y - circles[i].r).toBeGreaterThanOrEqual(inset);
      expect(circles[i].y + circles[i].r).toBeLessThanOrEqual(1 / aspect - inset);
    }
  });
  it("sit centred on the card", () => {
    const left = Math.min(...circles.map((c) => c.x - c.r));
    const right = Math.max(...circles.map((c) => c.x + c.r));
    const top = Math.min(...circles.map((c) => c.y - c.r));
    const bottom = Math.max(...circles.map((c) => c.y + c.r));
    expect((left + right) / 2).toBeCloseTo(0.5, 9);
    expect((top + bottom) / 2).toBeCloseTo(1 / aspect / 2, 9);
    expect(circlesLayout(0, aspect, COIL.face.circles)).toEqual([]);
  });
});

describe("the AS mark alone", () => {
  it("is drawn from its ink box, half a unit outside every point", () => {
    const points = [...BOLT_PTS, ...LEG_PTS, ...BAR_PTS];
    expect(MARK_INK_BOX.x).toBeCloseTo(Math.min(...points.map(([x]) => x)) - 0.5, 2);
    expect(MARK_INK_BOX.y).toBeCloseTo(Math.min(...points.map(([, y]) => y)) - 0.5, 2);
    expect(MARK_INK_BOX.x + MARK_INK_BOX.width).toBeCloseTo(Math.max(...points.map(([x]) => x)) + 0.5, 2);
    expect(MARK_INK_BOX.y + MARK_INK_BOX.height).toBeCloseTo(Math.max(...points.map(([, y]) => y)) + 0.5, 2);
  });
});
```
In `lib/coil/theme.test.ts`, add (beside the existing reader tests, reusing their token-reader helper shape):
```ts
  it("reads the anvil, the logo ground and the accent for the mark, per theme", () => {
    const tokens: Record<string, string> = { "--color-background": "#FAFAF7", "--color-foreground": "#0A0A0A", "--color-accent": "#1B3A5C", "--card-anvil": "#12141F", "--card-logo-ground": "#F5F2EC" };
    const theme = themeFromTokens((name) => tokens[name] ?? "", true);
    expect(toCanvasColor(theme.card.anvil)).toBe("rgba(18, 20, 31, 1)");
    expect(toCanvasColor(theme.card.logoGround)).toBe("rgba(245, 242, 236, 1)");
    expect(toCanvasColor(theme.card.mark)).toBe("rgba(27, 58, 92, 1)");
    const bare = themeFromTokens((name) => (name === "--color-foreground" ? "#0A0A0A" : ""), false);
    expect(toCanvasColor(bare.card.mark)).toBe("rgba(10, 10, 10, 1)");
  });
```
(import `toCanvasColor` and `themeFromTokens` from `@/lib/coil/theme` if the file does not already.)
- [ ] **Step 2:** `pnpm vitest run lib/coil/cardFace.test.ts lib/coil/theme.test.ts`. Expected FAIL: the functions and fields do not exist.
- [ ] **Step 3: Tokens, theme, constants, layouts.**

`app/globals.css`, in `:root` after `--card-sheen`:
```css
  /* C3: Talos's anvil tile (its kit's ground, the same in both themes), and the
     light ground under a logo with no dark file in the dark theme and in the
     jobs card's circles. */
  --card-anvil: #12141F;
  --card-logo-ground: #FAFAF7;
```
and in `[data-theme="dark"]` after `--card-sheen`:
```css
  --card-logo-ground: #F5F2EC;
```
`lib/coil/theme.ts`: add to `CoilTheme["card"]` `readonly anvil: Rgba; readonly logoGround: Rgba; readonly mark: Rgba; // the AS mark on This site's card: the accent` and in `themeFromTokens` hoist `const ink = color("--color-foreground", { r: 0.04, g: 0.04, b: 0.04, a: 1 });`, use `ink` for the `ink` field, and add to `card`:
```ts
      anvil: color("--card-anvil"),
      logoGround: color("--card-logo-ground"),
      mark: color("--color-accent", ink),
```
`lib/coil/constants.ts`, a new block after `markPx`/`lightPanelDim` (no existing value changes):
```ts
  // C3: the faces that are not photos (lib/coil/textures.ts, and the modal
  // header's DOM copy in components/card/CardFace.tsx), in fractions of the
  // card's width. Not tuned: Aaron looks at the fourteen first.
  face: {
    logoWidth: 0.4, // a mark's longer side
    wordmarkWidth: 0.64, // a wordmark across the card
    wordmarkFrom: 2, // width over height from which a logo is a wordmark
    plateInset: 0.07, // the light plate's margin around a logo in the dark theme
    markWidth: 0.36, // the AS mark on This site's card
    circles: { from: 0.16, to: 0.32, gap: 0.025, logo: 0.62 }, // the jobs card: diameters oldest to newest, the gap, a logo's share of its disc
  },
```
`lib/coil/cardFace.ts` (still import-free), append:
```ts
export type Fit = { w: number; h: number };
export interface LogoFit { logoWidth: number; wordmarkWidth: number; wordmarkFrom: number }

// A logo's drawn box on a card `cardWidth` wide: a mark's longer side at
// logoWidth, a wordmark across wordmarkWidth.
export function logoBox(aspect: number, cardWidth: number, f: LogoFit): Fit {
  if (!(aspect > 0)) return { w: 0, h: 0 };
  if (aspect >= f.wordmarkFrom) {
    const w = cardWidth * f.wordmarkWidth;
    return { w, h: w / aspect };
  }
  const size = cardWidth * f.logoWidth;
  return aspect >= 1 ? { w: size, h: size / aspect } : { w: size * aspect, h: size };
}

export function containBox(aspect: number, side: number): Fit {
  if (!(aspect > 0)) return { w: 0, h: 0 };
  return aspect >= 1 ? { w: side, h: side / aspect } : { w: side * aspect, h: side };
}

// A light plate under a plain tile's logo in the dark theme when the logo has no
// dark file and is not its own ground (the IEEE square).
export function needsGround(logo: { srcDark: string | null; opaque?: boolean }, tile: "plain" | "anvil", dark: boolean): boolean {
  return dark && tile === "plain" && logo.srcDark === null && !logo.opaque;
}

// The jobs card: count discs on the card's own diagonal, bottom left (the oldest)
// to top right (the newest), diameters from `from` to `to` card widths, `gap`
// apart, the group centred. In card widths from the card's top left; the card is
// 1 wide and 1 / aspect tall.
export type Circle = { x: number; y: number; r: number };
export function circlesLayout(count: number, aspect: number, o: { from: number; to: number; gap: number }): Circle[] {
  if (count <= 0) return [];
  const height = 1 / aspect;
  const length = Math.hypot(1, height);
  const ux = 1 / length;
  const uy = -height / length;
  const radii = Array.from({ length: count }, (_, k) => (count === 1 ? o.to : o.from + ((o.to - o.from) * k) / (count - 1)) / 2);
  const centers = [{ x: 0, y: 0 }];
  for (let k = 1; k < count; k++) {
    const step = radii[k - 1] + radii[k] + o.gap;
    centers.push({ x: centers[k - 1].x + ux * step, y: centers[k - 1].y + uy * step });
  }
  const left = Math.min(...centers.map((c, k) => c.x - radii[k]));
  const right = Math.max(...centers.map((c, k) => c.x + radii[k]));
  const top = Math.min(...centers.map((c, k) => c.y - radii[k]));
  const bottom = Math.max(...centers.map((c, k) => c.y + radii[k]));
  const dx = 0.5 - (left + right) / 2;
  const dy = height / 2 - (top + bottom) / 2;
  return centers.map((c, k) => ({ x: c.x + dx, y: c.y + dy, r: radii[k] }));
}

// The AS mark's ink box in its own coordinates (lib/mark/geometry's paths, half
// a unit of room), so the mark can be drawn alone and centred.
export const MARK_INK_BOX = { x: 51.69, y: 22.62, width: 144.92, height: 210.76 } as const;
```
- [ ] **Step 4:** `pnpm vitest run lib/coil` passes.
- [ ] **Step 5: Commit.**
```bash
git add app/globals.css lib/coil/theme.ts lib/coil/theme.test.ts lib/coil/constants.ts lib/coil/cardFace.ts lib/coil/cardFace.test.ts
git commit -m "Coil faces: the anvil and logo ground tokens, the accent for the mark, the face block, the logo, plate and circles layouts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The modal's parts: the header and its face, a still photo, the words, the timeline entry, the mentors, the links (Sonnet)

**Files:**
- Create: `components/modal/useCloseHint.ts`, `components/card/CardFace.tsx`, `components/card/CardHeader.tsx`, `components/card/StillPhoto.tsx`, `components/card/Words.tsx`, `components/card/TimelineEntry.tsx`, `components/card/MentorsList.tsx`, `components/card/CardLinks.tsx`, `components/card/CloseHint.tsx`, `lib/card/parts.test.ts`
- Modify: `components/PhotoModal.tsx`, `components/WorkModal.tsx`, `components/inline/DefinitionModal.tsx`, `components/mark/MarkCard.tsx` (the close hint's import only)

**Interfaces:**
- Consumes: Task 2's `strandCardByKey`, `StrandFace`; Task 4's `Gallery`, `GalleryPhoto`, `GALLERY`, `headerTileOf`, `headerMeta`, `employerSource`, `CARD_PICTURE_SIZES`, `galleryRowSizes`; Task 5's `partId`; Task 6's `logoBox`, `needsGround`, `circlesLayout`, `COIL.face`; `cardPhotoInset` (`lib/coil/cardFace.ts`); C2's `InlineCopy`.
- Produces (props are the contract Tasks 9 to 17 use):
```ts
useCloseHint(): string                                         // components/modal/useCloseHint.ts
CardFace({ face }: { face: StrandFace })                       // a photo face is the card picture in its pane (the phone header's tile)
CardHeader({ cardKey, renderMedia, compact }: { cardKey: CardKey; renderMedia: boolean; compact: boolean })  // the tile carries [data-tile-slot]: every card's on a phone, every card but a photo card's beside the rows
StillPhoto({ photo, index, box, slot?, renderMedia?, sizes?, caption? }: { photo: GalleryPhoto; index: number; box: Box; slot?: boolean; renderMedia?: boolean; sizes?: string; caption?: string | null })
Words({ gallery, unit, compact?, className? }: { gallery: Gallery; unit: number; compact?: boolean; className?: string })
TimelineEntry({ entry, unit, compact? }: { entry: number; unit: number; compact?: boolean })
MentorsList({ compact? }: { compact?: boolean })
CardLinks({ cardKey }: { cardKey: CardKey })
CloseHint()
```
Mask hooks used later (Task 13): every maskable part carries `data-mask=<partId>` and `data-mask-kind` (`"text"` or `"photo"`); a text part that splits by line carries `data-mask-split` on the same element (no wrapper, so a title's next sibling is still its meta line, as `e2e/label-face.spec.ts` measures); a photo part holds its image in `[data-mask-media]`.

- [ ] **Step 1: Failing test** (`lib/card/parts.test.ts`):
```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { strandCardByKey, type CardKey } from "@/lib/content";
import { CardFace } from "@/components/card/CardFace";
import { CardHeader } from "@/components/card/CardHeader";
import { CardLinks } from "@/components/card/CardLinks";
import { MentorsList } from "@/components/card/MentorsList";
import { TimelineEntry } from "@/components/card/TimelineEntry";

// next/image's optimizer needs a server; a plain img is enough to read the markup.
vi.mock("next/image", () => ({ default: (props: Record<string, unknown>) => createElement("img", { src: props.src, alt: props.alt, className: props.className, style: props.style }) }));

const face = (key: CardKey) => {
  const f = strandCardByKey.get(key)?.face;
  if (!f) throw new Error(`${key} is not on the strand`);
  return renderToStaticMarkup(createElement(CardFace, { face: f }));
};
const header = (cardKey: CardKey, compact: boolean) => renderToStaticMarkup(createElement(CardHeader, { cardKey, renderMedia: true, compact }));

describe("the header tile's face", () => {
  it("puts a logo with no dark file on a plate that shows only in the dark theme, never IEEE's square or Talos's anvil", () => {
    expect(face("capital-one")).toContain('data-plate=""');
    expect(face("capital-one")).toContain("dark:block");
    expect(face("ieee")).not.toContain("data-plate");
    expect(face("talos")).not.toContain("data-plate");
    expect(face("talos")).toContain("bg-[color:var(--card-anvil)]");
  });
  it("swaps to a logo's dark file in the dark theme", () => {
    expect(face("min-max")).toContain('src="/work/logos/min-max/mark-on-dark.svg"');
    expect(face("min-max")).toContain('src="/work/logos/min-max/mark.svg"');
  });
  it("draws the jobs card's five discs, This site's mark and a photo card's picture in its pane", () => {
    expect(face("jobs").match(/data-disc=/g)?.length).toBe(5);
    expect(face("this-site")).toContain("<svg");
    expect(face("mentorship")).toContain('data-face="photo"');
    expect(face("mentorship")).toContain('src="/photos/cards/mentorship-picture.jpg"');
  });
});

describe("the header", () => {
  it("carries the flight's slot: a photo card's only on a phone, every other card's in both layouts", () => {
    expect(header("mentorship", false)).not.toContain("data-tile-slot");
    expect(header("mentorship", true)).toContain('data-tile-slot="photo"');
    expect(header("talos", false)).toMatch(/data-tile-slot="work"[^>]*style="width:60px;height:80px"/);
    expect(header("talos", true)).toMatch(/data-tile-slot="work"[^>]*style="width:51px;height:68px"/);
    expect(header("capital-one", true)).toMatch(/data-tile-slot="work"[^>]*style="width:42px;height:56px"/);
  });
  it("shows IEEE's AO tip in the meta beside the rows, and the shorter meta on a phone", () => {
    expect(header("ieee", false)).toMatch(/<button [^>]*data-inline="tip" data-inline-key="ieee-ao"[^>]*>AO<\/button>/);
    expect(header("ieee", true)).toContain("President, 2023 to 2026");
    expect(header("ieee", true)).not.toContain("ieee-ao");
  });
});

describe("the timeline entry", () => {
  it("makes the employer's name its insider tip and shows the role and when", () => {
    const html = renderToStaticMarkup(createElement(TimelineEntry, { entry: 3, unit: 6 }));
    expect(html).toMatch(/<button [^>]*data-inline="tip" data-inline-key="job-3"[^>]*>Apple<\/button>/);
    expect(html).toContain("Specialist, then technical specialist");
    expect(html).toContain("2024 to 2025");
    expect(html).toContain('data-mask="words-6"');
  });
});

describe("the mentors and the links", () => {
  it("links each of the six mentors to LinkedIn in a new tab under my heading", () => {
    const html = renderToStaticMarkup(createElement(MentorsList, {}));
    expect(html).toContain("the people who shaped me");
    expect(html.match(/<a [^>]*href="https:\/\/www\.linkedin\.com\/in\/[^"]+" target="_blank" rel="noopener noreferrer"/g)?.length).toBe(6);
  });
  it("opens a card's links in a new tab, and renders nothing for a card with none", () => {
    expect(renderToStaticMarkup(createElement(CardLinks, { cardKey: "anthropic" }))).toMatch(/<a [^>]*href="https:\/\/txclaude.org" target="_blank" rel="noopener noreferrer"/);
    expect(renderToStaticMarkup(createElement(CardLinks, { cardKey: "min-max" }))).toBe("");
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/card`. Expected FAIL: the components do not exist.
- [ ] **Step 3: Implement.**

`components/modal/useCloseHint.ts` (moved verbatim from `components/PhotoModal.tsx`):
```ts
"use client";

import { useSyncExternalStore } from "react";
import { siteContent } from "@/lib/content";

// The close hint by pointer type: "Press Esc to close" for a mouse and a
// keyboard, "Tap outside to close" for a touch screen (a coarse primary pointer).
const COARSE_POINTER = "(pointer: coarse)";
function subscribePointer(onChange: () => void) {
  const list = window.matchMedia(COARSE_POINTER);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

export function useCloseHint() {
  const coarse = useSyncExternalStore(subscribePointer, () => window.matchMedia(COARSE_POINTER).matches, () => false);
  return coarse ? siteContent.modals.closeHintTouch : siteContent.modals.closeHintKeyboard;
}
```
Delete `COARSE_POINTER`, `subscribePointer` and `useCloseHint` from `components/PhotoModal.tsx` (and `useSyncExternalStore` from its React import, so lint gains no unused-import warning) and import the hook there; point `WorkModal.tsx`, `DefinitionModal.tsx` and `MarkCard.tsx` at `@/components/modal/useCloseHint`.

`components/card/CloseHint.tsx`:
```tsx
"use client";

import { useCloseHint } from "@/components/modal/useCloseHint";

export function CloseHint() {
  return <p className="font-label text-label text-muted">{useCloseHint()}</p>;
}
```
`components/card/CardFace.tsx`:
```tsx
import Image from "next/image";
import type { LogoRef, StrandFace } from "@/lib/content";
import { cardPhotoInset, circlesLayout, logoBox, needsGround } from "@/lib/coil/cardFace";
import { COIL } from "@/lib/coil/constants";
import { AsMark } from "@/components/menu/BrandMark";

// The Coil card's face as markup, for the modal header's tile when no flown card
// lands there: the same pane tokens, fits, plate rule and photo inset as
// lib/coil/textures.ts, so a tapped card's modal shows the card the Coil draws.
// A photo card's face shows only in the phone header (components/card/CardHeader).

const PANE = "absolute inset-0 overflow-hidden rounded-[5%/3.75%] border border-[color:var(--card-hair)]";
const WORK = "bg-[color:var(--card-work-pane)]";
const CENTRED = "absolute left-1/2 top-1/2 h-auto -translate-x-1/2 -translate-y-1/2";

export function CardFace({ face }: { face: StrandFace }) {
  if (face.kind === "photo") return <PhotoFace src={face.src} />;
  if (face.kind === "mark") {
    return (
      <div className={`${PANE} ${WORK} flex items-center justify-center`} data-face="mark">
        <AsMark fit="tight" className="h-auto w-[36%] text-accent" />
      </div>
    );
  }
  if (face.kind === "circles") return <Circles logos={face.logos} />;
  return <Logo logo={face.logo} tile={face.tile} />;
}

function Logo({ logo, tile }: { logo: LogoRef; tile: "plain" | "anvil" }) {
  const pane = tile === "anvil" ? "bg-[color:var(--card-anvil)]" : WORK;
  const size = { width: Math.round(logo.width), height: Math.round(logo.height) };
  if (logo.opaque) {
    return (
      <div className={`${PANE} ${pane} flex items-center justify-center`} data-face="logo">
        <div className="relative aspect-square w-[93%] overflow-hidden rounded-[6%]">
          <Image src={logo.src} alt="" fill sizes="80px" className="object-contain" />
        </div>
      </div>
    );
  }
  const box = logoBox(logo.width / logo.height, 100, COIL.face);
  const pad = COIL.face.plateInset * 100;
  return (
    <div className={`${PANE} ${pane}`} data-face="logo">
      {needsGround(logo, tile, true) && (
        <span
          aria-hidden="true"
          className={`${CENTRED} hidden rounded-[4px] bg-[color:var(--card-logo-ground)] dark:block`}
          style={{ width: `${box.w + 2 * pad}%`, height: `${(box.h + 2 * pad) * COIL.cardAspect}%` }}
          data-plate=""
        />
      )}
      <Image src={logo.src} alt="" {...size} className={`${CENTRED} ${logo.srcDark ? "dark:hidden" : ""}`} style={{ width: `${box.w}%` }} />
      {logo.srcDark && <Image src={logo.srcDark} alt="" {...size} className={`${CENTRED} hidden dark:block`} style={{ width: `${box.w}%` }} />}
    </div>
  );
}

// The card picture inset in its pane, cropped as the paint crops it.
const INSET = cardPhotoInset(COIL.lab.textureSize);
const insetBox = {
  left: `${INSET.x * 100}%`,
  right: `${INSET.x * 100}%`,
  top: `${INSET.y * 100}%`,
  bottom: `${INSET.y * 100}%`,
  borderRadius: `${(INSET.radius / (1 - 2 * INSET.x)) * 100}% / ${((INSET.radius * COIL.cardAspect) / (1 - 2 * INSET.y)) * 100}%`,
};

function PhotoFace({ src }: { src: string }) {
  return (
    <div className={`${PANE} bg-[color:var(--card-pane)]`} data-face="photo">
      <div className="absolute overflow-hidden" style={insetBox}>
        <Image src={src} alt="" fill sizes="80px" className="object-cover" style={{ objectPosition: INSET.objectPosition }} />
      </div>
    </div>
  );
}

// The light logo file in every disc, in both themes: the disc is its ground.
function Circles({ logos }: { logos: readonly LogoRef[] }) {
  const height = 1 / COIL.cardAspect;
  return (
    <div className={`${PANE} ${WORK}`} data-face="circles">
      {circlesLayout(logos.length, COIL.cardAspect, COIL.face.circles).map((c, i) => (
        <span
          key={logos[i].src}
          className="absolute flex items-center justify-center rounded-full border border-[color:var(--card-hair)] bg-[color:var(--card-logo-ground)]"
          style={{ left: `${(c.x - c.r) * 100}%`, top: `${((c.y - c.r) / height) * 100}%`, width: `${c.r * 200}%`, height: `${((c.r * 2) / height) * 100}%` }}
          data-disc={i}
        >
          <Image src={logos[i].src} alt="" width={Math.round(logos[i].width)} height={Math.round(logos[i].height)} className="h-auto max-h-[62%] w-auto max-w-[62%]" />
        </span>
      ))}
    </div>
  );
}
```
`components/card/CardHeader.tsx`:
```tsx
import { siteContent, strandCardByKey, type CardKey } from "@/lib/content";
import { headerMeta, headerTileOf } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { CardFace } from "./CardFace";

// The header at the top left: the card's face in a 3:4 tile (where its flown
// card lands; with no flight the modal draws the face), then the title and the
// meta line beside it (lib/gallery/card headerMeta). Beside the rows a photo
// card has no tile (its flown card lands on the card picture in the first row);
// on a phone every card has one, because the phone header stays put while the
// pages turn, so no page can carry a parked flown card off the panel. A phone's
// header is tighter, clear of the close button.
export function CardHeader({ cardKey, renderMedia, compact }: { cardKey: CardKey; renderMedia: boolean; compact: boolean }) {
  const card = strandCardByKey.get(cardKey);
  const tile = headerTileOf(cardKey, compact);
  return (
    <div className={`flex items-center pr-12 ${compact ? "gap-4" : "gap-5"}`}>
      {card && (compact || card.face.kind !== "photo") && (
        <div data-tile-slot={card.kind} aria-hidden="true" className="relative shrink-0" style={{ width: tile.width, height: tile.height }}>
          {renderMedia && <CardFace face={card.face} />}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 data-mask={partId.title} data-mask-kind="text" data-mask-split="" className={`font-display leading-tight text-foreground ${compact ? "text-[1.75rem]" : "text-4xl"}`}>
          {siteContent.cards[cardKey].modal.title}
        </h2>
        <p data-mask={partId.meta} data-mask-kind="text" data-mask-split="" className="font-label text-label text-accent">
          <InlineCopy source={headerMeta(cardKey, compact)} />
        </p>
      </div>
    </div>
  );
}
```
`components/card/StillPhoto.tsx`:
```tsx
import Image from "next/image";
import type { Box } from "@/lib/gallery/boxes";
import type { GalleryPhoto } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { CARD_PICTURE_SIZES, galleryRowSizes } from "@/lib/photoSizes";

// A photo in its box (object-fit: cover), its caption under it. The card picture
// carries the flight's landing slot; while a flown card is parked over it the
// image stays in the page at no opacity, so its alt text is still read. Not
// draggable: a mouse drag on an image would start the browser's own drag and
// cancel the phone pager's pointer stream.
type Props = { photo: GalleryPhoto; index: number; box: Box; slot?: boolean; renderMedia?: boolean; sizes?: string; caption?: string | null };

export function StillPhoto({ photo, index, box, slot = false, renderMedia = true, sizes, caption = photo.caption }: Props) {
  return (
    <figure className="m-0 flex shrink-0 flex-col gap-2.5" style={{ width: box.width, maxWidth: "100%" }} data-photo-frame={index}>
      <div className="relative w-full" style={{ aspectRatio: `${box.width} / ${box.height}` }}>
        <div data-mask={partId.photo(index)} data-mask-kind="photo" {...(slot ? { "data-tile-slot": "photo" } : {})} className="absolute inset-0 overflow-hidden rounded-xl">
          <div data-mask-media="" className="absolute inset-0">
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              quality={90}
              draggable={false}
              sizes={sizes ?? (slot ? CARD_PICTURE_SIZES : galleryRowSizes(photo.width / photo.height, box))}
              className="object-cover"
              style={{ opacity: renderMedia ? 1 : 0 }}
            />
          </div>
        </div>
      </div>
      {caption && (
        <figcaption data-mask={partId.caption(index)} data-mask-kind="text" data-mask-split="" className="font-label text-label text-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
```
`components/card/TimelineEntry.tsx`:
```tsx
import { siteContent } from "@/lib/content";
import { employerSource } from "@/lib/gallery/timeline";
import { partId } from "@/lib/gallery/timing";
import { InlineCopy } from "@/components/inline/InlineCopy";

// One job on the timeline: the employer, whose name carries its insider tip (an
// inline tip in the shared label), the role where there is one, and when.
export function TimelineEntry({ entry, unit, compact = false }: { entry: number; unit: number; compact?: boolean }) {
  const { role, when } = siteContent.cards.jobs.timeline[entry];
  return (
    <div data-mask={partId.words(unit)} data-mask-kind="text" className="flex flex-col gap-1" data-timeline-entry={entry}>
      <p className={`font-display leading-tight text-foreground ${compact ? "text-xl" : "text-2xl"}`}>
        <InlineCopy source={employerSource(entry)} />
      </p>
      {role && <p className="font-label text-label text-accent">{role}</p>}
      <p className="font-label text-label text-accent">{when}</p>
    </div>
  );
}
```
`components/card/Words.tsx`:
```tsx
import { siteContent } from "@/lib/content";
import type { Gallery } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { TimelineEntry } from "./TimelineEntry";

// One word unit: a paragraph through InlineCopy (bold, italic, tips, pops and
// links live through the one delegated layer), or a jobs timeline entry.
export function Words({ gallery, unit, compact = false, className = "" }: { gallery: Gallery; unit: number; compact?: boolean; className?: string }) {
  const word = gallery.words[unit];
  if (word.kind === "entry") return <TimelineEntry entry={word.index} unit={unit} compact={compact} />;
  return (
    <p data-mask={partId.words(unit)} data-mask-kind="text" data-mask-split="" className={`text-foreground ${compact ? "text-base leading-relaxed" : "text-lg leading-[1.55]"} ${className}`}>
      <InlineCopy source={siteContent.cards[gallery.key].modal.blocks[word.index]} />
    </p>
  );
}
```
`components/card/MentorsList.tsx`:
```tsx
import { siteContent } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";

// The Mentorship card's mentors, a section of its modal: each name a link to
// their LinkedIn, and the line I write for them once I have.
export function MentorsList({ compact = false }: { compact?: boolean }) {
  const { title, people } = siteContent.cards.mentorship.mentors;
  if (!people.length) return null;
  return (
    <section data-mask={partId.mentors} data-mask-kind="text" aria-label={title} className="flex flex-col gap-3" data-mentors="">
      <h3 className={`font-display leading-tight text-foreground ${compact ? "text-xl" : "text-2xl"}`}>{title}</h3>
      <ul className="flex flex-col gap-2">
        {people.map((mentor) => (
          <li key={mentor.href} className="flex flex-col gap-0.5">
            <a href={mentor.href} target="_blank" rel="noopener noreferrer" className="w-fit font-label text-label-lg text-accent transition-colors duration-200 hover:text-accent-hover">
              {mentor.name}
              <span className="sr-only">, {siteContent.book.externalLabel}</span>
            </a>
            {mentor.line && <p className="text-base leading-relaxed text-foreground">{mentor.line}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
```
`components/card/CardLinks.tsx`:
```tsx
import { siteContent, type CardKey } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";

// A card's links: external, a new tab, the label face in the accent.
export function CardLinks({ cardKey }: { cardKey: CardKey }) {
  const { links } = siteContent.cards[cardKey].modal;
  if (!links.length) return null;
  return (
    <ul data-mask={partId.links} data-mask-kind="text" className="flex flex-wrap gap-x-6 gap-y-2">
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-label text-label-lg text-accent underline-offset-4 transition-colors duration-200 hover:text-accent-hover hover:underline">
            {link.label}
            <span className="sr-only">, {siteContent.book.externalLabel}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
```
- [ ] **Step 4:** `pnpm vitest run lib/card` passes; `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green. Nothing renders these parts yet; `E2E e2e/mark.spec.ts e2e/inline-links.spec.ts` (the close hint moved) passes.
- [ ] **Step 5: Commit.**
```bash
git add components/modal/useCloseHint.ts components/card/CardFace.tsx components/card/CardHeader.tsx components/card/StillPhoto.tsx components/card/Words.tsx components/card/TimelineEntry.tsx components/card/MentorsList.tsx components/card/CardLinks.tsx components/card/CloseHint.tsx lib/card/parts.test.ts components/PhotoModal.tsx components/WorkModal.tsx components/inline/DefinitionModal.tsx components/mark/MarkCard.tsx
git commit -m "Card modal parts: the header with its tile and meta, every face, a still photo, the words, the timeline entry with its tips, the mentors, the links; the close hint in its own module" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The painters and their loaders, beside the legacy path (Opus)

**Files:**
- Modify: `lib/coil/textures.ts`
- Create: `lib/coil/textures.test.ts`

**Interfaces:**
- Consumes: Task 2's `StrandCard`, `StrandFace`, `strandCards`, `strandCardByKey`; Task 6's `logoBox`, `containBox`, `needsGround`, `circlesLayout`, `MARK_INK_BOX`, `COIL.face`, `CoilTheme.card.anvil`, `.logoGround`, `.mark`.
- Produces (`lib/coil/textures.ts`): `LogoImage`; `CardSource` gains `{ kind: "logo" }`, `{ kind: "mark" }` and `{ kind: "circles" }` beside the legacy `{ kind: "work" }`, which Task 9 deletes; `loadStrandSource(card: StrandCard, size?): Promise<CardSource>`; `emptySource(card: StrandCard): CardSource`; `paintCard(source, theme, size?)` paints every kind. The scene still loads the legacy tiles through `loadCardSource(tile, logoFor, size)` until Task 9, so this commit changes nothing on screen.

Read `docs/coil-scene-modules.md` first. Nothing here touches the scene; the painters wait beside the legacy path so the switch in Task 9 is one atomic commit.

- [ ] **Step 1: Failing unit test** (`lib/coil/textures.test.ts`; `emptySource` is pure, and the module imports cleanly in vitest's node environment):
```ts
import { describe, expect, it } from "vitest";
import { strandCardByKey, strandCards } from "@/lib/content";
import { emptySource } from "@/lib/coil/textures";

// What a card paints before its files arrive, or once the loader gives up on them.
describe("a card's empty source", () => {
  it("is each card's own face kind, with no image", () => {
    expect(Object.fromEntries(strandCards.map((card) => [card.key, emptySource(card).kind]))).toEqual({
      mentorship: "photo", "min-max": "logo", band: "photo", talos: "logo", travel: "photo", "capital-one": "logo", hackathons: "photo",
      anthropic: "logo", misuki: "photo", ieee: "logo", jobs: "circles", "this-site": "mark", fsdatalink: "logo", "building-in-public": "photo",
    });
  });
  it("keeps a logo's tile and file facts, and every job's disc with its logo's shape", () => {
    const talos = emptySource(strandCardByKey.get("talos")!);
    expect(talos.kind === "logo" && [talos.tile, talos.light, talos.dark]).toEqual(["anvil", null, null]);
    const ieee = emptySource(strandCardByKey.get("ieee")!);
    expect(ieee.kind === "logo" && ieee.logo.opaque).toBe(true);
    const jobs = emptySource(strandCardByKey.get("jobs")!);
    expect(jobs.kind === "circles" && jobs.logos.map((logo) => [logo.image, +logo.aspect.toFixed(3)])).toEqual([
      [null, 5.85], [null, 1.037], [null, 3.573], [null, 0.814], [null, 4.965],
    ]);
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/coil/textures.test.ts`. Expected FAIL: `emptySource` is not exported.
- [ ] **Step 3: Implement** (`lib/coil/textures.ts`). The imports become:
```ts
import { getImageProps } from "next/image";
import type { HomeTile, LogoRef, StrandCard } from "@/lib/content";
import { BAR_D, BOLT_D, LEG_D } from "@/lib/mark/geometry";
import { COIL } from "./constants";
import { toBytes, toCanvasColor, type CoilTheme, type Rgba } from "./theme";
import { cardDims, circlesLayout, containBox, logoBox, MARK_INK_BOX, needsGround, type CardDims, type TextureSize } from "./cardFace";
```
Replace the `CardSource` type (its comment and its two members) with:
```ts
export type LogoImage = { image: HTMLImageElement | null; aspect: number };

// A card's decoded sources, loaded once per scene and kept for repaints (a theme
// change picks a logo's dark file at paint time). A file that failed to load is
// null and paints the plain pane. "work" is the legacy tile's, until the scene
// moves to the fourteen (Task 9 deletes it with loadCardSource and paintWorkFront).
export type CardSource =
  | { kind: "photo"; key: string; image: HTMLImageElement | null }
  | { kind: "work"; key: string; logo: HTMLImageElement | null }
  | { kind: "logo"; key: string; light: HTMLImageElement | null; dark: HTMLImageElement | null; logo: LogoRef; tile: "plain" | "anvil" }
  | { kind: "mark"; key: string }
  | { kind: "circles"; key: string; logos: LogoImage[] };
```
After the legacy `loadCardSource` (keep it and `paintWorkFront` as they are), add:
```ts
// A raster logo goes through the image optimizer at the texture's width (the
// IEEE square is a 525KB JPEG); an SVG is served as it is.
function loadLogo(src: string, size: TextureSize): Promise<HTMLImageElement | null> {
  const url = src.endsWith(".svg") ? src : photoUrls(src, [size[0], size[0]]).base;
  return loadImage(url).catch(() => null);
}

export async function loadStrandSource(card: StrandCard, size: TextureSize = COIL.lab.textureSize): Promise<CardSource> {
  const { key, face } = card;
  switch (face.kind) {
    case "photo":
      return { kind: "photo", key, image: await loadPhoto(face.src, size) };
    case "logo": {
      const [light, dark] = await Promise.all([loadLogo(face.logo.src, size), face.logo.srcDark ? loadLogo(face.logo.srcDark, size) : Promise.resolve(null)]);
      return { kind: "logo", key, light, dark, logo: face.logo, tile: face.tile };
    }
    case "mark":
      return { kind: "mark", key };
    case "circles":
      return { kind: "circles", key, logos: await Promise.all(face.logos.map(async (logo) => ({ image: await loadLogo(logo.src, size), aspect: logo.width / logo.height }))) };
  }
}

// What a card paints when its files never arrive (the loader's give-up time).
export function emptySource(card: StrandCard): CardSource {
  const { key, face } = card;
  switch (face.kind) {
    case "photo":
      return { kind: "photo", key, image: null };
    case "logo":
      return { kind: "logo", key, light: null, dark: null, logo: face.logo, tile: face.tile };
    case "mark":
      return { kind: "mark", key };
    case "circles":
      return { kind: "circles", key, logos: face.logos.map((logo) => ({ image: null, aspect: logo.width / logo.height })) };
  }
}
```
After `paintWorkFront`, add the three new fronts:
```ts
// A logo on its pane (the anvil for Talos): the opaque IEEE square as the face, at
// the photo inset's width; any other logo centred at its fit, on a light plate
// where the dark theme needs one (cardFace.ts needsGround).
function paintLogoFront(g: CanvasRenderingContext2D, d: Dims, source: Extract<CardSource, { kind: "logo" }>, theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(source.tile === "anvil" ? theme.card.anvil : theme.card.workPane));
  const image = theme.dark && source.dark ? source.dark : source.light;
  const aspect = source.logo.width / source.logo.height;
  if (image && source.logo.opaque) {
    const box = containBox(aspect, d.w - d.inset * 2);
    const x = (d.w - box.w) / 2;
    const y = (d.h - box.h) / 2;
    g.save();
    g.beginPath();
    g.roundRect(x, y, box.w, box.h, d.innerRadius);
    g.clip();
    g.drawImage(image, x, y, box.w, box.h);
    g.restore();
  } else if (image) {
    const box = logoBox(aspect, d.w, COIL.face);
    const x = (d.w - box.w) / 2;
    const y = (d.h - box.h) / 2;
    if (needsGround(source.logo, source.tile, theme.dark)) {
      const pad = d.w * COIL.face.plateInset;
      g.fillStyle = toCanvasColor(theme.card.logoGround);
      g.beginPath();
      g.roundRect(x - pad, y - pad, box.w + pad * 2, box.h + pad * 2, d.innerRadius);
      g.fill();
    }
    g.drawImage(image, x, y, box.w, box.h);
  }
  finishCard(g, d, theme);
}

// This site: the AS mark in the accent, centred.
function paintMarkFront(g: CanvasRenderingContext2D, d: Dims, theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(theme.card.workPane));
  const width = d.w * COIL.face.markWidth;
  const scale = width / MARK_INK_BOX.width;
  g.save();
  g.translate((d.w - width) / 2 - MARK_INK_BOX.x * scale, (d.h - MARK_INK_BOX.height * scale) / 2 - MARK_INK_BOX.y * scale);
  g.scale(scale, scale);
  g.fillStyle = toCanvasColor(theme.card.mark);
  for (const path of [BOLT_D, LEG_D, BAR_D]) g.fill(new Path2D(path));
  g.restore();
  finishCard(g, d, theme);
}

// The jobs card: light discs growing up the diagonal, each with its employer's
// logo (the light file in both themes: the disc is its ground).
function paintCirclesFront(g: CanvasRenderingContext2D, d: Dims, logos: readonly LogoImage[], theme: CoilTheme) {
  shapeCard(g, d, toCanvasColor(theme.card.workPane));
  circlesLayout(logos.length, d.w / d.h, COIL.face.circles).forEach((circle, i) => {
    const cx = circle.x * d.w;
    const cy = circle.y * d.w;
    const r = circle.r * d.w;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fillStyle = toCanvasColor(theme.card.logoGround);
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = toCanvasColor(theme.card.hair);
    g.stroke();
    const { image, aspect } = logos[i];
    if (!image) return;
    const box = containBox(aspect, 2 * r * COIL.face.circles.logo);
    g.drawImage(image, cx - box.w / 2, cy - box.h / 2, box.w, box.h);
  });
  finishCard(g, d, theme);
}
```
Replace `paintCard` (and the comment above it) with:
```ts
// A file that failed or timed out (image null) paints the plain pane.
export function paintCard(source: CardSource, theme: CoilTheme, size: TextureSize = COIL.lab.textureSize): CardFaces {
  const d = size === COIL.lab.textureSize ? DESKTOP : dimsFor(size);
  const front = document.createElement("canvas");
  const back = document.createElement("canvas");
  const f = context(front, d);
  const plainBack = (fill: Rgba) => paintPlainBack(context(back, d), d, toCanvasColor(fill), theme);
  switch (source.kind) {
    case "photo":
      paintPhotoFront(f, d, source.image, theme);
      if (source.image) paintPhotoBack(context(back, d, true), d, source.image, theme);
      else plainBack(theme.card.pane);
      break;
    case "work":
      paintWorkFront(f, d, source.logo, theme);
      plainBack(theme.card.workBack);
      break;
    case "logo":
      paintLogoFront(f, d, source, theme);
      plainBack(source.tile === "anvil" ? theme.card.anvil : theme.card.workBack);
      break;
    case "mark":
      paintMarkFront(f, d, theme);
      plainBack(theme.card.workBack);
      break;
    case "circles":
      paintCirclesFront(f, d, source.logos, theme);
      plainBack(theme.card.workBack);
      break;
  }
  return { front, back };
}
```
The file stays under 400 lines (`wc -l lib/coil/textures.ts`, about 390).
- [ ] **Step 4:** `pnpm vitest run lib/coil` passes; `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green (the legacy `boot.ts` still calls `loadCardSource(tile, logoFor, size)` and paints `"work"` sources).
- [ ] **Step 5: Commit.**
```bash
git add lib/coil/textures.ts lib/coil/textures.test.ts
git commit -m "Coil: the logo, mark and circle painters and their loaders, beside the legacy work tile" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The switch: the Coil, the book and the card modal on the fourteen (Opus)

**Files:**
- Modify: `lib/coil/textures.ts` (the legacy path goes), `components/coil/scene/state.ts`, `components/coil/scene/boot.ts`, `components/coil/CoilScene.tsx` (two lines), `components/coil/HeroOverlay.tsx`, `components/home/HomeController.tsx`, `components/book/Book.tsx`, `components/book/BookRow.tsx`, `components/FlyingTile.tsx`
- Create: `components/card/CardModal.tsx`, `components/card/CardBody.tsx`, `components/card/useGalleryLayout.ts`, `e2e/support/cards.ts`
- Delete: `components/PhotoModal.tsx`, `components/WorkModal.tsx`
- Modify (e2e): `e2e/toggle.spec.ts`, `e2e/modal.spec.ts`, `e2e/label-face.spec.ts`, `e2e/a11y.spec.ts`, `e2e/support/fallback.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 6, 7 and 8.
- Produces: `HomeControllerValue.openCard(key: CardKey, origin: HTMLElement): void` (replaces `openPhoto` and `openWork`); `CardModal({ cardKey, onClose, renderMedia, flying })`; `useGalleryLayout(hold: boolean): GalleryLayout` with `type GalleryLayout = "rows" | "pager"`; `CardBody({ gallery, layout, renderMedia, flying, onClose })` (Tasks 12, 13 and 15 replace its insides; `flying` is read from Task 13, and `onClose` is passed to the pager from Task 15 and read by its drags from Task 16); e2e helpers `cardRow(page, key)`, `cardDialog(page, key)`, `panelAtRest(page, key)`, `openCardFromBook(page, key, { home? })` (it returns once the panel rests; Task 13 adds `settled?`), `flyCard(page, cdp, kind, { parked? })`.

Why one commit: the scene's keys, the book's keys and the controller's keys must change together. The row hold glides the Coil to a hovered row's card by key (`focusCard`), and a Coil click opens a modal by key; with the book on cards and the scene on the legacy tiles (or the reverse), the row hold breaks, most Coil clicks do nothing, and "capital-one" and "misuki" open the wrong legacy modals. So the scene, the controller, the modal, the book and the specs that read the old modals land in one commit, after the full suite.

Read `docs/coil-scene-modules.md` and `docs/coil-input-model.md` ("Flight handoff") first. The flight itself does not change: `FlyingTile` still finds `[data-tile-slot="photo"|"work"]`, fits the 3:4 card in it (`lib/coil/flight.ts` `fitAspect`) and tracks it live. What changes is which element carries the slot (Ruling 2); when a card flies does not change (Ruling 3: a mouse click at any width, never a tap).

- [ ] **Step 1: The scene and the unwound list.**
  - `lib/coil/textures.ts`: delete the legacy path: the `{ kind: "work" }` member of `CardSource` and the sentence naming it in the comment above (the comment then ends "null and paints the plain pane."), the legacy `loadCardSource`, `paintWorkFront`, the `case "work"` in `paintCard`, and `HomeTile` from the `@/lib/content` import. Replace the file's header comment (from "Card faces, painted" to the line before "Every paint takes the texture size") with:
```ts
// Card faces, painted on 2D canvases from the theme tokens, ported from hero
// lab 2 (391-516) at Aaron's picks: photo fronts in true color inside our
// pane; logo, mark and circle fronts on --card-work-pane (Talos on
// --card-anvil) from the layouts lib/coil/cardFace.ts shares with the modal's
// header tile; photo backs a duotone of the photo in the accent (--card-duo-dark
// to --card-duo-light); every other back the plain pane (the anvil for Talos),
// no logo (a mirrored mark reads as backwards text). Every paint returns fresh
// canvases, so a repaint uploads into a fresh texture and the old one is
// disposed, never rewritten in place.
//
```
  - `components/coil/scene/state.ts`: `import type { StrandCard } from "@/lib/content";` replaces the `HomeTile` import; `tiles: readonly StrandCard[];`.
  - `components/coil/scene/boot.ts`: drop the `siteContent` import and `logoFor`; import `{ emptySource, loadStrandSource, type CardSource }` from `@/lib/coil/textures`; the per-card load is `withTimeout<CardSource>(loadStrandSource(tile, st.budget.textureSize), emptySource(tile)).then(countTexture)`.
  - `components/coil/CoilScene.tsx`: `import { strandCards } from "@/lib/content";` and `const tiles = strandCards;` (the file's length does not change).
  - `components/coil/HeroOverlay.tsx`: import `bookColumns` (not `strandTiles`) from `@/lib/content`, delete `strandKeys`, and build the list from the book: `const LIST_GROUPS: { heading: string; rows: readonly ListRow[] }[] = bookColumns.map((column) => ({ heading: column.heading, rows: column.rows }));`. Every card is on the strand, so nothing is filtered; the list keeps 14 rows, Work then People.
  - `e2e/toggle.spec.ts`: import `strandCards` instead of `strandTiles` and rename its three uses.
- [ ] **Step 2: The layout hook** (`components/card/useGalleryLayout.ts`):
```ts
"use client";

import { useState, useSyncExternalStore } from "react";
import { GALLERY } from "@/lib/gallery/constants";

export type GalleryLayout = "rows" | "pager";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(GALLERY.wideQuery);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}
const read = (): GalleryLayout => (window.matchMedia(GALLERY.wideQuery).matches ? "rows" : "pager");
const server = (): GalleryLayout => "rows";

// The rows from 1024px up and the pager below, following the window. While a
// flown card is parked over its slot (hold), the layout keeps what it had, so
// the slot it landed on (the card picture or a header's tile) never jumps to
// the other layout's slot under it.
export function useGalleryLayout(hold: boolean): GalleryLayout {
  const live = useSyncExternalStore(subscribe, read, server);
  const [held, setHeld] = useState<GalleryLayout | null>(null);
  if (hold && held === null) setHeld(live);
  if (!hold && held !== null) setHeld(null);
  return hold ? (held ?? live) : live;
}
```
- [ ] **Step 3: The body until the gallery lands** (`components/card/CardBody.tsx`). On a phone the header's tile carries the flight's slot for every card (Task 7), so the card picture in the column carries none and always draws itself:
```tsx
"use client";

import type { Gallery } from "@/lib/gallery/card";
import { BOXES, GALLERY } from "@/lib/gallery/constants";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { MentorsList } from "./MentorsList";
import { StillPhoto } from "./StillPhoto";
import type { GalleryLayout } from "./useGalleryLayout";
import { Words } from "./Words";

// The modal's body: the header; on a photo card the card picture beside the
// first words (beside the rows it is the flight's landing; on a phone the
// header's tile is, so the picture draws itself); every other word unit in
// order; the mentors on Mentorship; the links and the close hint. Task 12
// gives the rows their gallery and Task 15 gives the phone its pager.
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia }: Props) {
  const compact = layout === "pager";
  const units = gallery.words.map((_, unit) => unit);
  const rest = gallery.lead === undefined ? units : units.slice(1);
  return (
    <div className={`flex flex-col ${compact ? "gap-6" : "gap-8"}`}>
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact={compact} />
      {gallery.lead !== undefined && (
        <div className={compact ? "flex flex-col gap-4" : "flex flex-row items-center"} style={compact ? undefined : { columnGap: GALLERY.columnGap }}>
          <div className="flex shrink-0 justify-start" style={compact ? undefined : { width: gallery.slot }}>
            <StillPhoto photo={gallery.photos[gallery.lead]} index={gallery.lead} box={BOXES.vertical} slot={!compact} renderMedia={compact || renderMedia} />
          </div>
          {units.length > 0 && (
            <div className="min-w-0 flex-1" style={compact ? undefined : { maxWidth: GALLERY.textWidth }}>
              <Words gallery={gallery} unit={0} compact={compact} />
            </div>
          )}
        </div>
      )}
      {rest.map((unit) => (
        <Words key={unit} gallery={gallery} unit={unit} compact={compact} />
      ))}
      {gallery.key === "mentorship" && <MentorsList compact={compact} />}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
```
- [ ] **Step 4: The shell** (`components/card/CardModal.tsx`):
```tsx
"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRef, type CSSProperties } from "react";
import { siteContent, type CardKey } from "@/lib/content";
import { galleryOf } from "@/lib/gallery/card";
import { modalBackdropBlurVariants, modalBackdropTintVariants, useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { Portal } from "@/components/Portal";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardBody } from "./CardBody";
import { useGalleryLayout } from "./useGalleryLayout";

// One modal for every card: the house shell (Portal, the lib/modal.ts
// primitives, the panel's rise, a fade alone under reduced motion) around the
// card's body, the tint and the glass as color-mix (bg-background/NN emits
// nothing with var() colors). renderMedia: no flown card lands here, so the
// modal draws its own card picture or header face. flying: a flown card is
// parked over its slot, so the layout holds what it opened with.

type Props = { cardKey: CardKey | null; onClose: () => void; renderMedia: boolean; flying: boolean };

const tint: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 70%, transparent)" };
const glass: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 85%, transparent)" };
const closeGlass: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 80%, transparent)" };

const PANEL = {
  reduced: { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.12 } } },
  full: {
    hidden: { opacity: 0, y: 16, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: "easeOut" as const } },
    exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" as const } },
  },
};

export function CardModal({ cardKey, onClose, renderMedia, flying }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Live in both directions (framer-motion's useReducedMotion reads the preference once).
  const reduced = useReducedMotionLive();
  const layout = useGalleryLayout(flying);
  const open = cardKey !== null;
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);
  const gallery = cardKey ? galleryOf(cardKey) : null;
  const rows = layout === "rows";

  return (
    <Portal>
      <AnimatePresence>
        {gallery && (
          <motion.div
            key="card-modal"
            role="dialog"
            aria-modal="true"
            aria-label={siteContent.cards[gallery.key].modal.title}
            data-card-modal={gallery.key}
            data-gallery-layout={layout}
            ref={dialogRef}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={modalBackdropBlurVariants(0, true)}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
            className={`fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain ${rows ? "px-10 py-14" : "px-4 py-6"}`}
          >
            <motion.div aria-hidden="true" variants={modalBackdropTintVariants(0, true)} className="pointer-events-none fixed inset-0" style={tint} />
            <motion.div
              variants={reduced ? PANEL.reduced : PANEL.full}
              data-gallery-panel=""
              onMouseDown={(e) => e.stopPropagation()}
              className={`relative my-auto flex w-full flex-col overflow-hidden rounded-2xl border border-border shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl ${rows ? "p-10" : "p-5"}`}
              style={{ ...glass, maxWidth: rows ? gallery.panelWidth : undefined }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label={siteContent.modals.closeAriaLabel}
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent"
                style={closeGlass}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
              <CardBody key={`${gallery.key}-${layout}`} gallery={gallery} layout={layout} renderMedia={renderMedia} flying={flying} onClose={onClose} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
```
(The close button stays the panel's first focusable, so the focus trap lands on it, as `e2e/a11y.spec.ts` expects. The body is keyed by card and layout: SplitText in Task 13 rebuilds a paragraph's nodes, and React must replace the body whole rather than patch inside one.)
- [ ] **Step 5: The controller** (`components/home/HomeController.tsx`):
  - Imports: drop `homeTileByKey, photoBySrc, workItemBySlug, type Photo, type WorkItem`, `PhotoModal` and `WorkModal`; add `import { strandCardByKey, type CardKey } from "@/lib/content";` and `import { CardModal } from "@/components/card/CardModal";`.
  - `type Selection = { key: CardKey; origin: OpenOrigin };`
  - In `HomeControllerValue`, replace `openPhoto` and `openWork` with `openCard: (key: CardKey, origin: HTMLElement) => void;` (a book row: no flight). Keep `markVisited`.
  - Replace `openPhoto` and `openWork` with `const openCard = useCallback((key: CardKey, origin: OpenOrigin) => setSelection((current) => current ?? { key, origin }), []);`
  - Replace the scene's `openCard` (and its comment) with the one below. The gate is today's: a slot on screen, motion allowed, a scene that can fly it; there is no width condition, and a touch tap already passes slot -1 (`handleCardClick`).
```ts
  // A card in the scene (or its row in the unwound list): freeze the scene so
  // the rendered pose is the flight pose, and open its modal with the card
  // flying in, at any window width (input by capability, Layer 1). A touch tap
  // (slot -1), reduced motion or a slot off screen opens it like a book row,
  // the modal drawing its own media. The flown card lands on the slot of the
  // layout the modal opens in (components/card/CardHeader, StillPhoto).
  const openFromScene = useCallback(
    (key: string, slot: number, origin: OpenOrigin) => {
      if (selection || flight) return;
      const card = strandCardByKey.get(key);
      if (!card) return;
      const api = sceneApiRef.current;
      if (api && slot >= 0 && !reducedMotion && api.flightQuadOf(slot)) {
        api.freeze(true);
        setFlight({ key: card.key, kind: card.kind, slot, photoSrc: card.face.kind === "photo" ? card.face.src : undefined, phase: "out", revealed: false });
      }
      setSelection({ key: card.key, origin });
    },
    [selection, flight, reducedMotion],
  );
```
  and point `handleCardClick` and `handleRowOpen` at `openFromScene`.
  - The value's memo lists `openCard` in place of `openPhoto` and `openWork` (object and dependency array).
  - Replace the two modal elements with `<CardModal cardKey={selection?.key ?? null} onClose={closeModal} renderMedia={renderMedia} flying={flight?.phase === "out"} />`. `flying` is true only while a flown card is out or parked: a book row opened while the last flown card is still flying home (`phase === "closing"`) gets its own layout and masks.
  - `closeModal` is unchanged (`markSeen(selection.key)` now marks a card key; focus returns to the origin).
- [ ] **Step 6: The book.** `components/book/Book.tsx`:
```tsx
import { bookColumns, siteContent } from "@/lib/content";
import { revealIndex } from "@/lib/motion";
import { Reveal } from "@/components/Reveal";
import { BookRow } from "./BookRow";

// The book: the accessible, text-first list of every card on the Coil, under the
// hero at #work. Two ordered columns, Work then People (one under 720px), with
// the Reveal pattern. A Server Component; only the rows are client leaves.
export function Book() {
  return (
    <section id="work" aria-label={siteContent.book.ariaLabel} className="relative flex min-h-screen w-full scroll-mt-24 items-center px-[6vw] py-[8vh]">
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-start gap-y-14 min-[720px]:grid-cols-2 min-[720px]:gap-x-[5vw]">
        {bookColumns.map((column) => (
          <div key={column.heading}>
            <h2 className={HEADING_CLASS}>{column.heading}</h2>
            <Reveal as="ol" aria-label={column.heading} className="book-list">
              {column.rows.map((row, i) => (
                <li key={row.key} className={ITEM_CLASS} style={revealIndex(i)}>
                  <BookRow row={row} />
                </li>
              ))}
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}
```
(keep `HEADING_CLASS` and `ITEM_CLASS` as they are). `components/book/BookRow.tsx`: the row is always a button that opens its card; keep `focusProps`, the seen marks and every class constant; replace the imports and the component with:
```tsx
import type { FocusEvent, PointerEvent } from "react";
import { siteContent, type BookRowEntry } from "@/lib/content";
import { useIsSeen } from "@/lib/home/seen";
import { isKeyboardFocus } from "@/lib/input/modality";
import { useHomeController } from "@/components/home/HomeController";

// One row of the book: a button that opens its card's modal through the home
// controller (no flight; the controller marks it seen at close and returns focus
// here). A seen row keeps its ring, dims its title, and dims its meta to 0.75.
// Hovering a list dims every other row's title (never the meta), and a row under
// the mouse or keyboard focus glides its card to the front of the visible helix.
export function BookRow({ row }: { row: BookRowEntry }) {
  const controller = useHomeController();
  const focusProps = {
    onPointerEnter: (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.pointerType === "pen") controller?.focusCard(row.key, "pointer");
    },
    onPointerLeave: () => controller?.focusCard(null, "pointer"),
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (isKeyboardFocus(event.currentTarget)) controller?.focusCard(row.key, "focus");
    },
    onBlur: () => controller?.focusCard(null, "focus"),
  };
  const seen = useIsSeen(row.key);
  return (
    <button type="button" className={ROW_CLASS} data-card={row.key} aria-haspopup="dialog" {...focusProps} onClick={(event) => controller?.openCard(row.key, event.currentTarget)}>
      <span className="flex max-w-full items-center">
        <span className={seen ? `${TITLE_CLASS} ${SEEN_TITLE_CLASS}` : TITLE_CLASS}>{row.title}</span>
        {seen && <span aria-hidden="true" className={SEEN_RING_CLASS} />}
      </span>
      <span className={seen ? `${META_CLASS} ${SEEN_META_CLASS}` : META_CLASS}>{row.meta}</span>
      {seen && <span className="sr-only">, {siteContent.book.seenLabel}</span>}
    </button>
  );
}
```
(keep `"use client"` at the top and delete the unused `Link` import and `BookEntry` type.)
- [ ] **Step 7: The flight's sharp copy and the old modals.** In `components/FlyingTile.tsx` replace `photoSlotSizes` with `CARD_PICTURE_SIZES` (`import { CARD_PICTURE_SIZES } from "@/lib/photoSizes";`, `sizes={CARD_PICTURE_SIZES}`), so the sharp copy requests the same file as the card picture's own image beside the rows (on a phone the slot is the 42px header tile, which the same file covers). Then `git rm components/PhotoModal.tsx components/WorkModal.tsx`.
- [ ] **Step 8: The card helpers for the e2e** (`e2e/support/cards.ts`). The panel scales in from 0.97 over 280ms and Playwright measures through transforms, so `openCardFromBook` returns only once the panel rests, and every test that measures after a flight calls `panelAtRest` first:
```ts
import type { CDPSession, Locator, Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { expect } from "./fixtures";
import { openHome } from "./coil";
import type { HookWindow } from "./hooks";
import { pointerTo } from "./input";

export const cardRow = (page: Page, key: CardKey) => page.locator(`#work button.book-row[data-card="${key}"]`);
export const cardDialog = (page: Page, key: CardKey) => page.locator(`[role="dialog"][data-card-modal="${key}"]`);

// The panel rises in (opacity 0 to 1, 16px up and 0.97 to full scale over
// 280ms; a fade alone under reduced motion), Playwright counts an opacity 0
// element as visible, and boundingBox measures through transforms. So every
// size read of a card's modal waits for its panel to rest: no transform, full
// opacity.
export async function panelAtRest(page: Page, key: CardKey) {
  await page.waitForFunction(
    (k) => {
      const panel = document.querySelector(`[data-card-modal="${k}"] [data-gallery-panel]`);
      if (!panel) return false;
      const { transform, opacity } = getComputedStyle(panel);
      return (transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)") && opacity === "1";
    },
    key,
    { polling: "raf", timeout: 5000 },
  );
}

// A card opened the way a reader of the book opens it: a click on its row (no
// flight). Returns once the panel rests, so every size read after it is final.
export async function openCardFromBook(page: Page, key: CardKey, { home = true } = {}): Promise<{ row: Locator; dialog: Locator }> {
  if (home) await openHome(page);
  const row = cardRow(page, key);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const dialog = page.getByRole("dialog", { name: siteContent.cards[key].modal.title, exact: true });
  await expect(dialog).toBeVisible();
  await panelAtRest(page, key);
  return { row, dialog };
}

// A card of one flight kind clicked on the Coil, as a visitor does (hover until
// the scene picks it, then a click), behind ?coildebug=flight. Resolves with its
// key once the flown card is parked (parked: false resolves at the click).
export async function flyCard(page: Page, cdp: CDPSession, kind: "photo" | "work", { parked = true } = {}): Promise<CardKey> {
  await openHome(page, { debug: "flight" });
  const find = () =>
    page.evaluate((k) => {
      const w = window as HookWindow;
      const slot = w.__coilFlight!.scene.slots().find(
        (s) => s.kind === k && s.depth > 0.3 && s.center.x > 80 && s.center.x < innerWidth - 80 && s.center.y > 80 && s.center.y < innerHeight * 0.75 && w.__coil!.api.cardAt(s.center.x, s.center.y)?.slot === s.slot,
      );
      return slot ? { slot: slot.slot, key: slot.key } : null;
    }, kind);
  await expect.poll(find, { timeout: 20_000, message: `a ${kind} card on screen` }).not.toBeNull();
  const { slot, key } = (await find())!;
  await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.follow(n), slot);
  const center = await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.slot(n)!.center, slot);
  await pointerTo(cdp, center);
  await page.waitForFunction((n) => (window as HookWindow).__coil!.hovered() === n, slot);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...center, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...center, button: "left", clickCount: 1 });
  if (parked) await page.waitForFunction(() => (window as HookWindow).__coilFlight!.log.some((m) => m.name === "clone-parked"));
  return key as CardKey;
}
```
- [ ] **Step 9: The specs that read the old book and modals.**
  - `e2e/modal.spec.ts`: rewrite the one test on cards. The focused row is `cardRow(page, "mentorship")`; the dialog is `page.getByRole("dialog", { name: "Mentorship", exact: true })`; the stored seen key is `"mentorship"`; the unseen row whose title stays at full ink is `cardRow(page, "band")`. Keep every other assertion (Enter opens, Close closes, focus returns, "opened", the 0.55 dim after blur and pointer move).
  - `e2e/support/fallback.ts`: the row is `page.locator('#work button.book-row[data-card="band"]')` and its comment says the book still opens a card.
  - `e2e/a11y.spec.ts`: the seeded seen key is `"capital-one"` (was `"capital-one-pm"`).
  - `e2e/label-face.spec.ts`: delete `openWorkModal` and its now unused imports; open cards with `openCardFromBook` from `./support/cards`:
    - "controls and links": `const { dialog } = await openCardFromBook(page, "anthropic");` then `expectLabel(dialog.getByRole("link", { name: /txclaude\.org/ }), "label-lg", "accent")` (replaces the work modal's "See more").
    - "meta beside a title": the book row is `siteContent.cards["capital-one"].book.meta` ("Intern, 2024 to 2026"); the modal check is `expectLabel(dialog.getByText("Claude Campus Ambassador, 2026", { exact: true }), "label", "accent")` on Anthropic's modal. The case page half stays.
    - "hints and the credit prose": open Anthropic from the book for the close hint; the photo row becomes `cardRow(page, "mentorship")`.
    - "role lines sit under their titles": the modal half opens Anthropic from the book; the 6px gap and the title block within `[data-tile-slot='work']`'s height still hold (the header keeps the title then the meta as siblings).
    - "a row's meta wraps": seed `["capital-one"]` and read `siteContent.cards["capital-one"].book.meta`.
    - Delete "at 1440 every work row's meta sits beside its title": the approved metas are longer (IEEE's, the band's and the jobs row's wrap at 1440, where each column is about 584px), and the test above already holds that a meta wraps only when it must. Record which rows wrap at 1440 for the PR body (Decisions for Aaron).
- [ ] **Step 10:** `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint`, then the full `E2E`. Every spec passes, including `flight.spec.ts` (pixel swaps at both ends), `row-hold.spec.ts` (book rows and the Coil share keys again), `touch.spec.ts` (a tap opens with no flight), `hero.spec.ts` and `a11y.spec.ts` (a card's modal focuses Close). `hero.spec.ts`, `flight.spec.ts` and `row-hold.spec.ts` click and hover the Coil's cards, so a Coil click that opened nothing, or a row that glided to no card, fails here; the modal is chosen by the clicked card's key, so it can only be that card's.
- [ ] **Step 11: Commit, once.**
```bash
git add lib/coil/textures.ts components/coil/scene/state.ts components/coil/scene/boot.ts components/coil/CoilScene.tsx components/coil/HeroOverlay.tsx components/card/useGalleryLayout.ts components/card/CardBody.tsx components/card/CardModal.tsx components/home/HomeController.tsx components/book/Book.tsx components/book/BookRow.tsx components/FlyingTile.tsx e2e/support/cards.ts e2e/toggle.spec.ts e2e/modal.spec.ts e2e/support/fallback.ts e2e/a11y.spec.ts e2e/label-face.spec.ts
git commit -m "The switch: the Coil, the unwound list, the book and one card modal on the fourteen, opened by key; the old photo and work modals go" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(`git rm` in Step 7 already staged the two deletions.)

---

### Task 10: The Coil's faces and the card modal, the new specs (Opus)

**Files:**
- Create: `e2e/coil-faces.spec.ts`, `e2e/card-modal.spec.ts`

**Interfaces:**
- Consumes: Task 9's `cardDialog`, `flyCard`, `openCardFromBook`, `panelAtRest`; Task 4's `headerTileOf`; `openHome` (`e2e/support/coil.ts`), `shoot` (`e2e/support/pixels.ts`), the `?coildebug=flight` hooks (`e2e/support/hooks.ts`).
- Produces: the two specs; no source change. If a test here fails, fix the source in the file that owns it and commit that fix on its own ("Fix: ...").

- [ ] **Step 1: The Coil's e2e** (`e2e/coil-faces.spec.ts`):
```ts
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import type { HookWindow } from "./support/hooks";
import { shoot } from "./support/pixels";

const order = siteContent.strand.order as readonly string[];
const PHOTO_CARDS = ["mentorship", "band", "travel", "hackathons", "misuki", "building-in-public"];

test("coil faces: the strand draws the fourteen cards in Aaron's order, the photo cards as photos", async ({ page }) => {
  await openHome(page, { debug: "flight" });
  const slots = await page.evaluate(() => (window as HookWindow).__coilFlight!.scene.slots());
  for (const slot of slots) {
    expect(order, slot.key).toContain(slot.key);
    expect(slot.kind, slot.key).toBe(PHOTO_CARDS.includes(slot.key) ? "photo" : "work");
  }
  const byU = [...slots].sort((a, b) => a.u - b.u);
  let neighbours = 0;
  for (let i = 1; i < byU.length; i++) {
    if (Math.round(byU[i].u - byU[i - 1].u) !== 1) continue;
    expect(order.indexOf(byU[i].key), `${byU[i - 1].key} then ${byU[i].key}`).toBe((order.indexOf(byU[i - 1].key) + 1) % order.length);
    neighbours += 1;
  }
  expect(neighbours).toBeGreaterThan(4);
});

// A card's lightness at one point of its face grid (s across, t down, in
// eighths), with the card held at the front by its row. The default point is
// an eighth of the way in from the top left corner, clear of its rim and its
// logo; size is the sample's side in px, centred on the point.
async function paneLightness(page: import("@playwright/test").Page, key: string, { s = 0.125, t = 0.125, size = 3 } = {}) {
  await page.evaluate((k) => (window as HookWindow).__coil!.api.focusCard(k), key);
  await page.waitForTimeout(900);
  const slot = await page.evaluate((k) => {
    const slots = (window as HookWindow).__coilFlight!.scene.slots().filter((s) => s.key === k && s.alpha > 0.9);
    return slots.sort((a, b) => b.depth - a.depth)[0] ?? null;
  }, key);
  expect(slot, `${key} on screen`).not.toBeNull();
  const point = slot!.grid.find((p) => p.s === s && p.t === t)!;
  const half = Math.floor(size / 2);
  const image = await shoot(page, { x: Math.round(point.x) - half, y: Math.round(point.y) - half, width: size, height: size });
  let sum = 0;
  for (let i = 0; i < image.rgba.length; i += 4) sum += 0.2126 * image.rgba[i] + 0.7152 * image.rgba[i + 1] + 0.0722 * image.rgba[i + 2];
  return sum / (image.rgba.length / 4) / 255;
}

test("coil faces: Talos sits on its dark anvil in the light theme, Capital One on the light pane", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await openHome(page, { debug: "flight" });
  expect(await paneLightness(page, "talos")).toBeLessThan(0.4);
  expect(await paneLightness(page, "capital-one")).toBeGreaterThan(0.6);
});

// Capital One's wordmark is 64 percent of the card wide (x 0.18 to 0.82) and
// its plate reaches 7 percent further (x 0.11 to 0.89), so the point an eighth
// in at mid height is plate, left of the logo's ink; one pixel keeps the
// sample off the plate's filtered edge.
test("coil faces: in the dark theme Capital One's logo sits on a light plate and Talos stays on its anvil", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await openHome(page, { debug: "flight" });
  expect(await paneLightness(page, "capital-one")).toBeLessThan(0.4);
  expect(await paneLightness(page, "capital-one", { s: 0.125, t: 0.5, size: 1 })).toBeGreaterThan(0.6);
  expect(await paneLightness(page, "talos")).toBeLessThan(0.4);
});
```
(If `shoot` hides the cursor or other overlays differently from what a 3 by 3 sample needs, move the pointer to `{ x: 4, y: 4 }` first with `page.mouse.move`; the custom cursor must not sit over the sample.)
- [ ] **Step 2: The card modal's e2e** (`e2e/card-modal.spec.ts`). Every size read happens after the panel rests; below 1024px a mouse click still flies, onto the phone header's tile (Ruling 3):
```ts
import { siteContent, strandCardByKey, type CardKey } from "@/lib/content";
import { headerTileOf } from "@/lib/gallery/card";
import { SEEN_STORAGE_KEY } from "@/lib/home/seen";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { cardDialog, flyCard, openCardFromBook, panelAtRest } from "./support/cards";
import type { HookWindow } from "./support/hooks";

const keys = Object.keys(siteContent.cards) as CardKey[];
const within = (actual: number, expected: number) => Math.abs(actual - expected) < 1;

// The flown card's four corners where it parked, against its slot's box.
async function landsOnSlot(page: import("@playwright/test").Page, slot: import("@playwright/test").Locator) {
  const quad = await page.evaluate(() => (window as HookWindow).__coilFlight!.log.findLast((m) => m.name === "clone-parked")!.data!.quad as { x: number; y: number }[]);
  const box = (await slot.boundingBox())!;
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  expect(Math.abs(Math.min(...xs) - box.x), "left").toBeLessThan(1);
  expect(Math.abs(Math.max(...xs) - (box.x + box.width)), "right").toBeLessThan(1);
  expect(Math.abs(Math.min(...ys) - box.y), "top").toBeLessThan(1);
  expect(Math.abs(Math.max(...ys) - (box.y + box.height)), "bottom").toBeLessThan(1);
  return box;
}

test("card modal: every card opens from its row as its own modal, Escape closes it, focus returns and the card reads as seen", async ({ page }) => {
  await openHome(page);
  for (const key of keys) {
    const { row, dialog } = await openCardFromBook(page, key, { home: false });
    await expect(dialog).toHaveAttribute("data-card-modal", key);
    const photoCard = strandCardByKey.get(key)!.face.kind === "photo";
    await expect(dialog.locator('[data-tile-slot="photo"]')).toHaveCount(photoCard ? 1 : 0);
    await expect(dialog.locator('[data-tile-slot="work"]')).toHaveCount(photoCard ? 0 : 1);
    await expect(dialog.locator("h2")).toHaveText(siteContent.cards[key].modal.title);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(row).toBeFocused();
  }
  const seen: string[] = await page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? "[]"), SEEN_STORAGE_KEY);
  expect([...seen].sort()).toEqual([...keys].sort());
});

test("card modal: a book row opens with no flight and draws its own card", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "talos");
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
  await expect(dialog.locator('[data-tile-slot="work"] [data-face="logo"]')).toBeVisible();
  await page.keyboard.press("Escape");
  const misuki = await openCardFromBook(page, "misuki", { home: false });
  const picture = misuki.dialog.locator('[data-tile-slot="photo"] img');
  await expect(picture).toHaveCSS("opacity", "1");
  await expect(picture).toHaveAttribute("alt", "Me standing behind Misuki, my 2001 Miata, on a parking deck at golden hour");
  await expect(misuki.dialog.getByText("Me and Misuki at a Longhorn Car Club photo shoot.", { exact: true })).toBeVisible();
});

test("card modal: in the dark theme a logo with no dark file sits on a light plate in the header tile, IEEE's square never does", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const { dialog } = await openCardFromBook(page, "capital-one");
  await expect(dialog.locator('[data-tile-slot="work"] [data-plate]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const ieee = await openCardFromBook(page, "ieee", { home: false });
  await expect(ieee.dialog.locator("[data-plate]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  // The theme is chosen before paint from the preference, so a fresh load reads the new one.
  await page.emulateMedia({ colorScheme: "light" });
  const light = await openCardFromBook(page, "capital-one");
  await expect(light.dialog.locator('[data-tile-slot="work"] [data-plate]')).toBeHidden();
});

test("card modal: IEEE's meta carries its AO tip beside the rows, and a card's links open in a new tab", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "ieee");
  const meta = dialog.locator('[data-mask="meta"]');
  await expect(meta).toHaveText("President, Corporate Director, and AO, 2023 to 2026");
  const ao = meta.getByRole("button", { name: "AO", exact: true });
  await ao.hover();
  const tip = page.locator("[data-inline-tip]");
  await expect(tip).toHaveAttribute("data-shown", "true");
  await expect(tip).toContainText("External Activities and Events Assistant Officer");
  const link = dialog.getByRole("link", { name: /ieee\.ece\.utexas\.edu/ });
  await expect(link).toHaveAttribute("href", "https://ieee.ece.utexas.edu/");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

test("card modal: the mentors are a section of Mentorship's modal, six names linking to LinkedIn", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship");
  const mentors = dialog.locator("[data-mentors]");
  const { title, people } = siteContent.cards.mentorship.mentors;
  await expect(mentors.getByRole("heading", { name: title })).toBeVisible();
  await expect(mentors.getByRole("link")).toHaveCount(people.length);
  await expect(mentors.getByRole("link", { name: new RegExp(people[0].name) })).toHaveAttribute("href", people[0].href);
});

test("card modal: the jobs timeline runs oldest to newest, each employer's name its insider tip", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "jobs");
  await expect(dialog.locator("[data-timeline-entry]")).toHaveCount(5);
  const apple = dialog.getByRole("button", { name: "Apple", exact: true });
  await apple.scrollIntoViewIfNeeded();
  await apple.hover();
  const tip = page.locator("[data-inline-tip]");
  await expect(tip).toHaveAttribute("data-shown", "true");
  await expect(tip).toContainText("Get AppleCare and some sort of cloud storage.");
});

for (const kind of ["photo", "work"] as const) {
  test(`card modal: a flown ${kind} card lands exactly on its slot`, async ({ page, cdp }) => {
    const key = await flyCard(page, cdp, kind);
    const dialog = cardDialog(page, key);
    await expect(dialog).toBeVisible();
    await panelAtRest(page, key);
    await landsOnSlot(page, dialog.locator(`[data-tile-slot="${kind}"]`));
    if (kind === "photo") await expect(dialog.locator('[data-tile-slot="photo"] img')).toHaveCSS("opacity", "0");
    else await expect(dialog.locator('[data-tile-slot="work"] [data-face]')).toHaveCount(0);
  });
}

test("card modal: the layout holds while a flown card is parked, and follows the window once none is", async ({ page, cdp }) => {
  const key = await flyCard(page, cdp, "photo");
  const dialog = cardDialog(page, key);
  await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForTimeout(400);
  await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
  const { dialog: again } = await openCardFromBook(page, key, { home: false });
  await expect(again).toHaveAttribute("data-gallery-layout", "pager");
});

test("card modal: under 1024px a mouse click still flies the card, onto the phone header's tile", async ({ page, cdp }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  for (const kind of ["photo", "work"] as const) {
    const key = await flyCard(page, cdp, kind);
    const dialog = cardDialog(page, key);
    await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
    await panelAtRest(page, key);
    const slot = dialog.locator(`[data-tile-slot="${kind}"]`);
    await expect(slot).toHaveCount(1);
    const box = await landsOnSlot(page, slot);
    const tile = headerTileOf(key, true);
    expect(within(box.width, tile.width) && within(box.height, tile.height), `${key}: ${box.width} by ${box.height}`).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("[data-flying-tile]")).toHaveCount(0);
  }
});
```
(`clone-parked`'s `quad` is the flown card's four corners in viewport px, as `components/FlyingTile.tsx` logs it; read its shape from `lib/coil/geometry.ts` `Quad` and adapt the cast if a point is not `{ x, y }`.)
- [ ] **Step 3:** `E2E e2e/coil-faces.spec.ts e2e/card-modal.spec.ts e2e/flight.spec.ts e2e/hero.spec.ts e2e/touch.spec.ts` pass.
- [ ] **Step 4: Commit.**
```bash
git add e2e/coil-faces.spec.ts e2e/card-modal.spec.ts
git commit -m "e2e: the fourteen on the Coil, every card's modal from the book, the flight's landing on its slot at any width, the layout held under a parked card" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The hero stills, re-rendered with the fourteen (Sonnet)

**Files:**
- Regenerate: `public/coil/hero-{light,dark}-{wide,square,narrow}.{avif,webp}`, `lib/coil/heroStill.rects.ts`, `scripts/hero-still-phases.json`

The hero still is a real picture of the scene at rest, shown under reduced motion, without WebGL 2 and while the scene loads. It still shows the legacy cards (with facts the sweep removes), so it is re-rendered from Task 9's scene. Nothing else changes; Aaron's retune will mean one more run of this script, and so does any merge that changes a logo file or `lib/content/media.ts`'s logos (Task 18, Step 1).

- [ ] **Step 1:** Build and serve the full site (no dev server in this worktree). Start `next start` itself, not `pnpm start`, so the PID you write is the server's own and the kill in Step 3 stops it; wait with curl's own retries, never a `sleep` loop:
```bash
cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c3-card-system"
lsof -nP -iTCP:3370 -sTCP:LISTEN   # must print nothing
NEXT_PUBLIC_SITE_MODE=full pnpm build
(NEXT_PUBLIC_SITE_MODE=full ./node_modules/.bin/next start -p 3370 > "$TMPDIR/c3-start.log" 2>&1 & echo $! > "$TMPDIR/c3-server.pid")
curl --retry 60 --retry-delay 1 --retry-connrefused -sf -o /dev/null http://localhost:3370
```
- [ ] **Step 2:** Re-measure the phases and render: `node scripts/render-posters.mjs http://localhost:3370 --sweep`. It writes nothing unless every theme and cut passes its name check; read its table and keep it for the PR body.
- [ ] **Step 3:** Stop your server by its PID: `kill "$(cat "$TMPDIR/c3-server.pid")"`, then `lsof -nP -iTCP:3370 -sTCP:LISTEN` prints nothing.
- [ ] **Step 4:** `pnpm test` (the still files and rects tests), then `E2E e2e/still-theme.spec.ts e2e/still-late.spec.ts e2e/still-notice.spec.ts e2e/fallbacks.spec.ts e2e/no-webgl.spec.ts e2e/loader.spec.ts`. Open two of the twelve images and look: the fourteen cards, the name behind them.
- [ ] **Step 5: Commit.**
```bash
git add public/coil/hero-light-wide.avif public/coil/hero-light-wide.webp public/coil/hero-light-square.avif public/coil/hero-light-square.webp public/coil/hero-light-narrow.avif public/coil/hero-light-narrow.webp public/coil/hero-dark-wide.avif public/coil/hero-dark-wide.webp public/coil/hero-dark-square.avif public/coil/hero-dark-square.webp public/coil/hero-dark-narrow.avif public/coil/hero-dark-narrow.webp lib/coil/heroStill.rects.ts scripts/hero-still-phases.json
git commit -m "Hero stills: re-rendered with the fourteen cards" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The desktop rows (Sonnet)

**Files:**
- Create: `components/card/CardRows.tsx`, `components/card/GroupParts.tsx`, `components/card/RotatingPhoto.tsx`, `components/card/CardStack.tsx`, `e2e/card-gallery.spec.ts`
- Modify: `components/card/CardBody.tsx` (a router by layout), `app/globals.css` (a group shows only its current photo and caption)

**Interfaces:**
- Consumes: Task 3's `slideWords`, `Slide`, `boxFor`, `groupFrame`, `Box`; Task 4's `Gallery`, `galleryOf`, `BOXES`, `GALLERY`, `galleryRowSizes`; Task 5's `partId`; Task 7's `CardHeader`, `StillPhoto`, `Words`, `MentorsList`, `CardLinks`, `CloseHint`; Task 9's `CardBody` props, `GalleryLayout`, `openCardFromBook` (it returns once the panel rests, so every size below is read at rest).
- Produces:
```ts
CardRows({ gallery, renderMedia }: { gallery: Gallery; renderMedia: boolean })                 // components/card/CardRows.tsx
GroupLayer({ gallery, photo, box, frame, layer, current, sizes }: { gallery: Gallery; photo: number; box: Box; frame: Box; layer: number; current: boolean; sizes: string })
GroupCaptions({ photos, index, caption }: { photos: readonly number[]; index: number; caption: (photo: number) => string | null })   // both components/card/GroupParts.tsx
RotatingPhoto({ gallery, photos, boxes }: { gallery: Gallery; photos: readonly number[]; boxes: readonly Box[] })   // Task 14 replaces its body, the props stay
CardStack({ gallery, renderMedia }: { gallery: Gallery; renderMedia: boolean })               // the phone's body until Task 15 deletes it
```
  Markup hooks later tasks and the e2e read: `[data-row="photo"]` with `data-side` (`left` or `right`) and `data-turns` (a group's size); `[data-text-column]`; `[data-rotator]` with `data-rotator-index`; `[data-rotator-frame]`; `[data-rotator-layer]` and `[data-rotator-caption]`, each with `data-current` on the shown one; `[data-rotator-dot]`; every group layer also carries `data-photo-frame=<photo>`.

The rows are the lab's round six desktop (`git show ae9b6dd:app/lab/gallery/UniformGallery.tsx`): the header at the top left, then the plan's opening words (each at most `GALLERY.proseMaxWidth`), then one row per slide, the photo column `gallery.slot` wide and the words column at most 460px, `GALLERY.columnGap` (56) apart and vertically centred, the first row's photo on the left and the sides alternating; a photo narrower than the column sits against the panel's edge (justify-start on the left, justify-end on the right, the lab's `photoAlign: "edge"`); rows `GALLERY.rowGap` (64) apart; then the closing words, the mentors on Mentorship, and the links beside the close hint. A slide of two photos or more is a group: one frame the size of its largest box, each photo drawn in its own box centred in it (the lab's `rotateAlign: "center"`), the captions in one grid cell under it and dots under the captions. A row may have no words (the band's and Travel's first row, the card picture alone: Ruling 5); its words column is then empty and keeps its place. This task draws the group still on its first photo with dots that step it at once; Task 14 gives it the clock and the change.

- [ ] **Step 1: Failing e2e** (`e2e/card-gallery.spec.ts`):
```ts
import { siteContent, type CardKey } from "@/lib/content";
import { boxFor, groupFrame } from "@/lib/gallery/boxes";
import { galleryOf } from "@/lib/gallery/card";
import { BOXES, GALLERY } from "@/lib/gallery/constants";
import { slideWords } from "@/lib/gallery/plan";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { openCardFromBook } from "./support/cards";

// The desktop gallery at the suite's 1440 by 900: every card's rows as its
// plan lays them out, measured from the drawn modal.

const keys = Object.keys(siteContent.cards) as CardKey[];
const within = (actual: number, expected: number) => Math.abs(actual - expected) <= 1;

test("gallery rows: every card's rows follow its plan, the sides alternate, each photo in its orientation's box", async ({ page }) => {
  test.setTimeout(120_000);
  await openHome(page);
  for (const key of keys) {
    const gallery = galleryOf(key);
    const { dialog } = await openCardFromBook(page, key, { home: false });
    await expect(dialog).toHaveAttribute("data-gallery-layout", "rows");
    const panel = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
    expect(within(panel.width, gallery.panelWidth), `${key}: panel ${panel.width}, plan ${gallery.panelWidth}`).toBe(true);
    const rows = dialog.locator('[data-row="photo"]');
    await expect(rows).toHaveCount(gallery.plan.slides.length);
    for (const [i, slide] of gallery.plan.slides.entries()) {
      const row = rows.nth(i);
      await expect(row).toHaveAttribute("data-side", i % 2 === 0 ? "left" : "right");
      const boxes = slide.photos.map((photo) => boxFor(gallery.aspects[photo], BOXES, GALLERY.wideFrom));
      const expected = slide.photos.length > 1 ? groupFrame(boxes) : boxes[0];
      const drawn = (await row.locator(slide.photos.length > 1 ? "[data-rotator-frame]" : `[data-photo-frame="${slide.photo}"] > div`).first().boundingBox())!;
      expect(within(drawn.width, expected.width) && within(drawn.height, expected.height), `${key} row ${i}: ${drawn.width} by ${drawn.height}`).toBe(true);
      const words = await row.locator('[data-text-column] [data-mask^="words-"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-mask")));
      expect(words, `${key} row ${i}`).toEqual(slideWords(slide).map((unit) => `words-${unit}`));
    }
    if (gallery.plan.slides.length) {
      const top = (await rows.first().boundingBox())!.y;
      for (const unit of gallery.plan.intro) {
        const opening = (await dialog.locator(`[data-mask="words-${unit}"]`).boundingBox())!;
        expect(opening.y + opening.height, `${key} opens with words ${unit}`).toBeLessThanOrEqual(top + 1);
      }
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("gallery rows: a photo card's picture leads its first row at 320 by 427 and carries the flight's slot", async ({ page }) => {
  await openHome(page);
  for (const key of keys.filter((k) => galleryOf(k).lead !== undefined)) {
    const { dialog } = await openCardFromBook(page, key, { home: false });
    const slot = (await dialog.locator('[data-row="photo"]').first().locator('[data-tile-slot="photo"]').boundingBox())!;
    expect(within(slot.width, GALLERY.verticalWidth) && within(slot.height, (GALLERY.verticalWidth * 4) / 3), `${key}: ${slot.width} by ${slot.height}`).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("gallery rows: the first row clears the fold at 1440 by 900 on the cards the spec tests", async ({ page }) => {
  await openHome(page);
  for (const key of ["capital-one", "hackathons", "mentorship", "ieee"] as const) {
    const { dialog } = await openCardFromBook(page, key, { home: false });
    const first = (await dialog.locator('[data-row="photo"]').first().boundingBox())!;
    expect(first.y + first.height, key).toBeLessThanOrEqual(900);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("gallery rows: a group's dots step its photo and its caption together, and its words stay", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship");
  const group = dialog.locator("[data-rotator]");
  await group.scrollIntoViewIfNeeded();
  const column = dialog.locator('[data-row="photo"][data-turns] [data-text-column] [data-mask]');
  const words = await column.evaluateAll((els) => els.map((el) => el.getAttribute("data-mask")));
  await group.getByRole("button", { name: siteContent.modals.gallery.photoOf(2, 3), exact: true }).click();
  await expect(group).toHaveAttribute("data-rotator-index", "1");
  await expect(group.locator('[data-rotator-layer="1"]')).toHaveCSS("visibility", "visible");
  await expect(group.locator('[data-rotator-layer="0"]')).toHaveCSS("visibility", "hidden");
  await expect(group.locator('[data-rotator-caption="1"]')).toHaveCSS("visibility", "visible");
  await expect(group.locator('[data-rotator-caption="0"]')).toHaveCSS("visibility", "hidden");
  expect(await column.evaluateAll((els) => els.map((el) => el.getAttribute("data-mask")))).toEqual(words);
});
```
- [ ] **Step 2:** `E2E e2e/card-gallery.spec.ts`. Expected FAIL: the dialog has no `[data-row="photo"]` (the Task 9 body has no rows).
- [ ] **Step 3: Implement.** `components/card/GroupParts.tsx`:
```tsx
import Image from "next/image";
import type { Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";

// The pieces of a group of photos taking turns (RotatingPhoto on desktop,
// PhoneRotator in a phone page's stage): one photo's layer in the group's
// frame, centred at its own box, and the captions, every one in the same grid
// cell so the caption block is the tallest caption's height. Only the current
// layer and caption show (app/globals.css); useRotator writes the change.

type LayerProps = { gallery: Gallery; photo: number; box: Box; frame: Box; layer: number; current: boolean; sizes: string };

export function GroupLayer({ gallery, photo, box, frame, layer, current, sizes }: LayerProps) {
  const { src, alt } = gallery.photos[photo];
  return (
    <div
      className="absolute"
      style={{ left: (frame.width - box.width) / 2, top: (frame.height - box.height) / 2, width: box.width, height: box.height }}
      aria-hidden={!current}
      data-rotator-layer={layer}
      data-photo-frame={photo}
      data-current={current ? "" : undefined}
    >
      <div data-mask={partId.photo(photo)} data-mask-kind="photo" className="absolute inset-0 overflow-hidden rounded-xl">
        <div data-mask-media="" className="absolute inset-0">
          <div data-rotator-media="" className="absolute inset-0">
            <Image src={src} alt={alt} fill quality={90} draggable={false} sizes={sizes} className="object-cover" />
          </div>
        </div>
      </div>
    </div>
  );
}

type CaptionProps = { photos: readonly number[]; index: number; caption: (photo: number) => string | null };

export function GroupCaptions({ photos, index, caption }: CaptionProps) {
  return (
    <div className="grid shrink-0" data-rotator-captions="">
      {photos.map((photo, i) => {
        const text = caption(photo);
        return (
          <div key={photo} className="[grid-area:1/1]" aria-hidden={i !== index} data-rotator-caption={i} data-current={i === index ? "" : undefined}>
            {text && (
              <p data-mask={partId.caption(photo)} data-mask-kind="text" data-mask-split="" className="font-label text-label text-muted">
                {text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```
`components/card/RotatingPhoto.tsx`:
```tsx
"use client";

import { useState } from "react";
import { siteContent } from "@/lib/content";
import { groupFrame, type Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { partId } from "@/lib/gallery/timing";
import { galleryRowSizes } from "@/lib/photoSizes";
import { GroupCaptions, GroupLayer } from "./GroupParts";

// A row's photos taking turns in one frame beside words that never change
// (the gallery lab, rounds five and six). The frame is the group's largest
// box and each photo is drawn in its own box centred in it, so nothing changes
// size; the caption under it changes with the photo, and the dots under the
// captions say which photo shows and step to one.

type Props = { gallery: Gallery; photos: readonly number[]; boxes: readonly Box[] };

const g = siteContent.modals.gallery;

export function RotatingPhoto({ gallery, photos, boxes }: Props) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const frame = groupFrame(boxes);
  const sizesOf = (photo: number, i: number) => galleryRowSizes(gallery.photos[photo].width / gallery.photos[photo].height, boxes[i]);
  const hasCaptions = photos.some((photo) => gallery.photos[photo].caption);
  return (
    <div role="group" aria-roledescription={g.roleCarousel} aria-label={g.rotatorLabel(count)} className="flex shrink-0 flex-col gap-2.5" style={{ width: frame.width }} data-rotator="" data-rotator-index={index}>
      <div className="relative shrink-0" style={{ width: frame.width, height: frame.height }} data-rotator-frame="">
        {photos.map((photo, i) => (
          <GroupLayer key={photo} gallery={gallery} photo={photo} box={boxes[i]} frame={frame} layer={i} current={i === index} sizes={sizesOf(photo, i)} />
        ))}
      </div>
      {hasCaptions && <GroupCaptions photos={photos} index={index} caption={(photo) => gallery.photos[photo].caption} />}
      <div data-mask={partId.rotator(photos[0])} data-mask-kind="text" className="-ml-1 flex items-center">
        {photos.map((photo, i) => (
          <button
            key={photo}
            type="button"
            aria-label={g.photoOf(i + 1, count)}
            aria-current={i === index ? "true" : undefined}
            onClick={() => setIndex(i)}
            className="group inline-flex h-8 items-center justify-center px-1"
            data-rotator-dot={i}
          >
            <span className={i === index ? "block h-1.5 w-5 rounded-full bg-accent" : "block h-1.5 w-1.5 rounded-full bg-muted transition-colors duration-200 group-hover:bg-foreground"} />
          </button>
        ))}
      </div>
    </div>
  );
}
```
`components/card/CardRows.tsx`:
```tsx
"use client";

import { boxFor } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { BOXES, GALLERY } from "@/lib/gallery/constants";
import { slideWords, type Slide } from "@/lib/gallery/plan";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { MentorsList } from "./MentorsList";
import { RotatingPhoto } from "./RotatingPhoto";
import { StillPhoto } from "./StillPhoto";
import { Words } from "./Words";

// The desktop gallery (1024px and up), Aaron's pick from the gallery lab
// (round six): the header at the top left; the opening words; then every
// photo, or every group of photos taking turns, its own row with its words
// beside it, vertically centred, the sides alternating from the left; then the
// closing words, the mentors on Mentorship, the links and the close hint. A
// vertical photo is drawn in one box and a horizontal one in another, and a
// photo narrower than the card's photo column sits against the panel's edge,
// so the words keep one place on each side. The card picture leads the first
// row and carries the flight's slot.

type Props = { gallery: Gallery; renderMedia: boolean };

const EDGE = { left: "justify-start", right: "justify-end" } as const;

export function CardRows({ gallery, renderMedia }: Props) {
  const { plan, photos, aspects, lead, slot } = gallery;
  const box = (photo: number) => boxFor(aspects[photo], BOXES, GALLERY.wideFrom);
  const prose = (unit: number) => (
    <div key={`words-${unit}`} style={{ maxWidth: GALLERY.proseMaxWidth }}>
      <Words gallery={gallery} unit={unit} />
    </div>
  );
  const row = (slide: Slide, i: number) => {
    const side = i % 2 === 0 ? "left" : "right";
    const turns = slide.photos.length > 1;
    return (
      <div
        key={`row-${slide.photo}`}
        className={`flex items-center ${side === "right" ? "flex-row-reverse" : "flex-row"}`}
        style={{ columnGap: GALLERY.columnGap }}
        data-row="photo"
        data-side={side}
        data-turns={turns ? slide.photos.length : undefined}
      >
        <div className={`flex shrink-0 ${EDGE[side]}`} style={{ width: slot }}>
          {turns ? (
            <RotatingPhoto gallery={gallery} photos={slide.photos} boxes={slide.photos.map((photo) => box(photo))} />
          ) : (
            <StillPhoto photo={photos[slide.photo]} index={slide.photo} box={box(slide.photo)} slot={slide.photo === lead} renderMedia={slide.photo === lead ? renderMedia : true} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4" style={{ maxWidth: GALLERY.textWidth }} data-text-column="">
          {slideWords(slide).map((unit) => (
            <Words key={unit} gallery={gallery} unit={unit} />
          ))}
        </div>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-8">
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact={false} />
      <div className="flex flex-col" style={{ rowGap: GALLERY.rowGap }}>
        {plan.intro.map(prose)}
        {plan.slides.map(row)}
        {plan.closing.map(prose)}
        {gallery.key === "mentorship" && <MentorsList />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
```
`components/card/CardStack.tsx` (Task 9's compact branch, moved whole; the header's tile carries the flight's slot, so the card picture carries none):
```tsx
"use client";

import type { Gallery } from "@/lib/gallery/card";
import { BOXES } from "@/lib/gallery/constants";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { MentorsList } from "./MentorsList";
import { StillPhoto } from "./StillPhoto";
import { Words } from "./Words";

// The phone's body until the pager lands: the header (its tile is the
// flight's landing), the card picture over the first words on a photo card,
// every other word unit, the mentors, the links and the close hint, in one
// column.
export function CardStack({ gallery, renderMedia }: { gallery: Gallery; renderMedia: boolean }) {
  const units = gallery.words.map((_, unit) => unit);
  const rest = gallery.lead === undefined ? units : units.slice(1);
  return (
    <div className="flex flex-col gap-6">
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact />
      {gallery.lead !== undefined && (
        <div className="flex flex-col gap-4">
          <StillPhoto photo={gallery.photos[gallery.lead]} index={gallery.lead} box={BOXES.vertical} />
          {units.length > 0 && <Words gallery={gallery} unit={0} compact />}
        </div>
      )}
      {rest.map((unit) => (
        <Words key={unit} gallery={gallery} unit={unit} compact />
      ))}
      {gallery.key === "mentorship" && <MentorsList compact />}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
```
Replace `components/card/CardBody.tsx` with:
```tsx
"use client";

import type { Gallery } from "@/lib/gallery/card";
import { CardRows } from "./CardRows";
import { CardStack } from "./CardStack";
import type { GalleryLayout } from "./useGalleryLayout";

// The modal's body by layout: the desktop rows from 1024px up, the phone's
// column below.
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia }: Props) {
  return layout === "rows" ? <CardRows gallery={gallery} renderMedia={renderMedia} /> : <CardStack gallery={gallery} renderMedia={renderMedia} />;
}
```
Append to the end of `app/globals.css`:
```css
/* The card modal's groups of photos taking turns (components/card/GroupParts):
   only the current photo and caption show; useRotator holds the old one
   visible while it clears, then lets go. */
[data-rotator-layer]:not([data-current]),
[data-rotator-caption]:not([data-current]) {
  visibility: hidden;
}
```
- [ ] **Step 4:** `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green; `E2E e2e/card-gallery.spec.ts e2e/card-modal.spec.ts e2e/label-face.spec.ts e2e/flight.spec.ts` pass (the card picture and the header tile still carry the slots the flight lands on).
- [ ] **Step 5: Commit.**
```bash
git add components/card/CardRows.tsx components/card/GroupParts.tsx components/card/RotatingPhoto.tsx components/card/CardStack.tsx components/card/CardBody.tsx app/globals.css e2e/card-gallery.spec.ts
git commit -m "Card modal: the desktop rows, every photo or group its own row beside its words, the sides alternating" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: The mask-in (Opus)

**Files:**
- Create: `lib/gallery/steps.ts`, `lib/gallery/steps.test.ts`, `components/card/useMaskIn.ts`, `e2e/card-masks.spec.ts`
- Modify: `components/card/CardBody.tsx` (the root and the hook), `components/card/CardModal.tsx` (a fresh body per open), `e2e/support/cards.ts` (`openCardFromBook` learns `settled`), `e2e/label-face.spec.ts` (opens its modals settled)

**Interfaces:**
- Consumes: Task 3's `phonePages`; Task 4's `Gallery`, `galleryOf`, `GALLERY`, `PHONE_GROUPING`; Task 5's `maskTable`, `planSteps`, `pagerSteps`, `partId`, `StepOptions`, `MaskStep`, `photoWipeIn`, `textIn`; Task 9's `openCardFromBook`, `panelAtRest`; Task 12's `CardRows`, `CardStack`; Task 7's markup (`data-mask`, `data-mask-kind`, `data-mask-split`, `data-mask-media`); `gsap` and `SplitText` from `@/lib/gsap`; `useReducedMotionLive` from `@/components/soundtrack/useReducedMotionLive`.
- Produces:
```ts
export function cardSteps(gallery: Gallery, layout: "rows" | "pager", flying: boolean, lines?: (id: string) => number): MaskStep[]; // lib/gallery/steps.ts
export const maskStartMs: (flying: boolean) => number; // lib/gallery/steps.ts: 520 after a flight, 0 otherwise (Ruling 19)
export function useMaskIn(rootRef: RefObject<HTMLElement | null>, o: { reduced: boolean; runKey: string; startMs: number; stepsFor: (lines: (id: string) => number) => MaskStep[] }): void; // components/card/useMaskIn.ts
export async function openCardFromBook(page: Page, key: CardKey, o?: { home?: boolean; settled?: boolean }): Promise<{ row: Locator; dialog: Locator }>; // still returns at the panel's rest; settled also waits for the run to end
```
  The body's root is `[data-card-body="rows" | "pager"]` and carries `data-mask-armed` while a run is live; a split line carries the class `card-line`.

How it runs (modal-gallery.md, "Masking in": "Starts when the flight has landed"; the lab's `useMaskIn.ts` at ae9b6dd with round six's directions): when the body mounts, one GSAP timeline is built from `maskTable(cardSteps(...))`, starting at `maskStartMs(flying)` (`GALLERY.mask.landingMs`, 520, when a flown card lands; 0 when nothing does, a book row or a tap, so the glass never sits empty), steps 110ms apart, each mask 480ms on the site ease, lines of a split part 45ms apart. A text part that carries `data-mask-split` is split into lines (`SplitText`, `aria: "none"` as the sections grammar does, no mask wrappers because a left to right clip opens in place), and each line's `clip-path` opens from `inset(-25% 102% -25% -2%)` to `inset(-25% -2% -25% -2%)`; any other text part (a timeline entry, the mentors, the links, the rotator's controls, the pager's controls) opens its own clip the same way. A photo part's clip edge crosses it from the left (`inset(0% 100% 0% 0% round 12px)` to `inset(0% 0% 0% 0% round 12px)`) while its `[data-mask-media]` settles from 1.02 to 1. Beside the rows the flown card's photo is never in the steps (a parked flown card covers it); its caption is. On a phone the flown card parks on the header's tile, which never masks, so the first page's picture masks like any photo. Everything runs on the timer, on screen or not. On completion, and in the cleanup on any close or replay, the splits revert, GSAP clears only the `clipPath` and `transform` it wrote, and `data-mask-armed` goes. Reduced motion builds nothing, and turning it on mid-run runs the cleanup at once (the hook's deps).

- [ ] **Step 1: Failing unit test** (`lib/gallery/steps.test.ts`):
```ts
import { describe, expect, it } from "vitest";
import { galleryOf } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { cardSteps, maskStartMs } from "@/lib/gallery/steps";

const ids = (steps: { id: string }[][]) => steps.map((step) => step.map((part) => part.id));

describe("a card's mask steps", () => {
  it("masks Mentorship's rows, its mentors and its link, and never the card picture a flown card covers", () => {
    expect(ids(cardSteps(galleryOf("mentorship"), "rows", true))).toEqual([
      ["title"], ["meta"], ["caption-0", "words-0"], ["photo-1", "caption-1", "words-1", "rotator-1"], ["mentors"], ["links"],
    ]);
    expect(ids(cardSteps(galleryOf("mentorship"), "rows", false))[2]).toEqual(["photo-0", "caption-0", "words-0"]);
  });
  it("masks the jobs card's opening words and entries one by one before its rows", () => {
    expect(ids(cardSteps(galleryOf("jobs"), "rows", false))).toEqual([
      ["title"], ["meta"], ["words-0"], ["words-1"], ["words-2"], ["words-3"],
      ["photo-0", "caption-0", "words-4", "words-5", "rotator-0"], ["photo-2", "caption-2", "words-6"], ["photo-3", "caption-3", "words-7"], ["links"],
    ]);
  });
  it("masks a phone's header, its first page and the pager's controls, the card picture too when a flown card parks on the header's tile", () => {
    expect(ids(cardSteps(galleryOf("capital-one"), "pager", false))).toEqual([["title"], ["meta"], ["photo-0", "caption-0"], ["words-0", "words-1"], ["pager"]]);
    expect(ids(cardSteps(galleryOf("mentorship"), "pager", true))[2]).toEqual(["photo-0", "caption-0"]);
  });
  it("masks a phone card with no photos as its words and its links", () => {
    expect(ids(cardSteps(galleryOf("this-site"), "pager", false))).toEqual([["title"], ["meta"], ["words-0"], ["links"]]);
  });
  it("counts a split part's lines", () => {
    const steps = cardSteps(galleryOf("talos"), "rows", false, (id) => (id === "words-0" ? 4 : 1));
    expect(steps[2]).toEqual([{ id: "words-0", lines: 4 }]);
  });
  it("starts at the landing after a flight, and at once when nothing lands", () => {
    expect([maskStartMs(true), maskStartMs(false)]).toEqual([GALLERY.mask.landingMs, 0]);
  });
});
```
```
- [ ] **Step 2:** `pnpm vitest run lib/gallery/steps.test.ts`. Expected FAIL: `@/lib/gallery/steps` does not exist.
- [ ] **Step 3: Implement** `lib/gallery/steps.ts`:
```ts
import { siteContent } from "@/lib/content";
import type { Gallery } from "./card";
import { GALLERY, PHONE_GROUPING } from "./constants";
import { phonePages } from "./plan";
import { pagerSteps, partId, planSteps, type MaskStep, type StepOptions } from "./timing";

// Which parts of a card's modal mask in, and in what order: the desktop rows
// (and a phone card with no photos, which is its words alone) through
// planSteps, the phone pager through pagerSteps. Beside the rows the flown
// card's photo never masks, because a parked flown card covers it; on a phone
// the flown card parks on the header's tile, which never masks, so the first
// page's picture masks like any photo. Mentorship's mentors mask after the rows
// and before the links. lines counts a split part's lines.
export function cardSteps(gallery: Gallery, layout: "rows" | "pager", flying: boolean, lines?: (id: string) => number): MaskStep[] {
  const o: StepOptions = {
    flown: flying && layout === "rows" ? gallery.lead : undefined,
    hasCaption: (photo) => gallery.photos[photo]?.caption != null,
    hasLinks: siteContent.cards[gallery.key].modal.links.length > 0,
    trailing: gallery.key === "mentorship" && siteContent.cards.mentorship.mentors.people.length > 0 ? [partId.mentors] : [],
    lines,
  };
  const pages = phonePages(gallery.plan, PHONE_GROUPING);
  return layout === "pager" && pages.length > 0 ? pagerSteps(pages, o) : planSteps(gallery.plan, o);
}

// When the mask-in starts: at the landing (520ms) when a flown card lands, at
// once when nothing does (a book row, a touch tap), so the panel never sits
// empty waiting for a flight that is not coming.
export const maskStartMs = (flying: boolean) => (flying ? GALLERY.mask.landingMs : 0);
```
- [ ] **Step 4:** `pnpm vitest run lib/gallery` passes. Commit the pure half:
```bash
git add lib/gallery/steps.ts lib/gallery/steps.test.ts
git commit -m "Gallery: a card's mask steps by layout and when they start, the photo a parked flown card covers never among them" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Step 5: Failing e2e.** In `e2e/support/cards.ts` replace `openCardFromBook` (and its comment) with:
```ts
// A card opened the way a reader of the book opens it: a click on its row (no
// flight). Returns once the panel rests, so every size read after it is final;
// settled also waits for the mask-in to end (no armed body is left).
export async function openCardFromBook(page: Page, key: CardKey, { home = true, settled = false } = {}): Promise<{ row: Locator; dialog: Locator }> {
  if (home) await openHome(page);
  const row = cardRow(page, key);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const dialog = page.getByRole("dialog", { name: siteContent.cards[key].modal.title, exact: true });
  await expect(dialog).toBeVisible();
  await panelAtRest(page, key);
  if (settled) await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  return { row, dialog };
}
```
Create `e2e/card-masks.spec.ts`:
```ts
import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { cardRow, flyCard, openCardFromBook } from "./support/cards";

// What a run may leave behind in the page: a split line, an armed body, or an
// inline clip-path or GSAP scale anywhere in a card's modal.
async function leftovers(page: Page) {
  return page.evaluate(() => ({
    lines: document.querySelectorAll(".card-line").length,
    armed: document.querySelectorAll("[data-mask-armed]").length,
    written: [...document.querySelectorAll<HTMLElement>("[data-card-modal] [style]")].filter((el) => el.style.clipPath !== "" || /scale\(/.test(el.style.transform)).length,
  }));
}
const CLEAN = { lines: 0, armed: 0, written: 0 };

test("masks: a card's modal masks in on a timer and leaves nothing behind", async ({ page }) => {
  await openHome(page);
  const opened = Date.now();
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false });
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await expect(dialog.locator('[data-mask="title"] .card-line').first()).toBeAttached();
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  expect(Date.now() - opened).toBeLessThan(3500);
  expect(await leftovers(page)).toEqual(CLEAN);
});

// A book open has no flight to wait for: by the time the panel rests (280ms),
// the title's first line (step one, 480ms long) is already opening.
test("masks: a book open starts its masks at once, with nothing landing to wait for", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one");
  const right = await dialog.locator('[data-mask="title"] .card-line').first().evaluate((el) => parseFloat((el as HTMLElement).style.clipPath.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/)[1] ?? "102"));
  expect(right).toBeLessThan(100);
});

test("masks: a photo's clip edge travels left to right, and each line's clip opens left to right in place", async ({ page }) => {
  await openCardFromBook(page, "capital-one");
  const photo = await page.waitForFunction(() => {
    const clip = document.querySelector<HTMLElement>('[data-card-modal="capital-one"] [data-mask="photo-0"]')?.style.clipPath ?? "";
    const inset = clip.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat);
    return inset && inset[1] > 1 && inset[1] < 99 ? inset : null;
  }, null, { polling: "raf", timeout: 5000 });
  const [top, right, bottom, left] = (await photo.jsonValue())!;
  expect([top, bottom, left]).toEqual([0, 0, 0]);
  expect(right).toBeGreaterThan(1);
  const line = await page.waitForFunction(() => {
    const clip = document.querySelector<HTMLElement>('[data-card-modal="capital-one"] [data-mask="words-0"] .card-line')?.style.clipPath ?? "";
    const inset = clip.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat);
    return inset && inset[1] > -2 && inset[1] < 102 ? inset : null;
  }, null, { polling: "raf", timeout: 5000 });
  const parts = (await line.jsonValue())!;
  expect([parts[0], parts[2], parts[3]]).toEqual([-25, -25, -2]);
});

test("masks: Escape in the middle of the run leaves nothing behind, and the next open replays from the start", async ({ page }) => {
  const { row, dialog } = await openCardFromBook(page, "capital-one");
  await page.waitForFunction(() => !!document.querySelector('[data-card-modal="capital-one"] [data-mask="words-0"] .card-line'), null, { polling: "raf" });
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await leftovers(page)).toEqual(CLEAN);
  await row.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await expect(dialog.locator('[data-mask="title"] .card-line').first()).toBeAttached();
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  expect(await leftovers(page)).toEqual(CLEAN);
});

test("masks: a flown card's photo never masks, while its caption does", async ({ page, cdp }) => {
  const key = await flyCard(page, cdp, "photo", { parked: false });
  const sample = await page.waitForFunction((k) => {
    const dialog = document.querySelector(`[data-card-modal="${k}"]`);
    const slot = dialog?.querySelector<HTMLElement>('[data-tile-slot="photo"]');
    const caption = dialog?.querySelector<HTMLElement>('[data-mask="caption-0"] .card-line');
    return slot && caption?.style.clipPath ? { slot: slot.style.clipPath, caption: caption.style.clipPath } : null;
  }, key, { polling: "raf", timeout: 5000 });
  const { slot, caption } = (await sample.jsonValue())!;
  expect(slot).toBe("");
  expect(caption).toMatch(/^inset\(/);
});

test("masks: under reduced motion nothing masks, and turning it on mid-run shows every part at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false });
  expect(await leftovers(page)).toEqual(CLEAN);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await cardRow(page, "capital-one").click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-card-body]")).toHaveAttribute("data-mask-armed", "");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 1000 });
  expect(await leftovers(page)).toEqual(CLEAN);
});
```
- [ ] **Step 6:** `E2E e2e/card-masks.spec.ts`. Expected FAIL: the body has no `data-card-body` and nothing is ever armed.
- [ ] **Step 7: Implement.** `components/card/useMaskIn.ts`:
```ts
"use client";

import { useLayoutEffect, type RefObject } from "react";
import { gsap, SplitText } from "@/lib/gsap";
import { GALLERY } from "@/lib/gallery/constants";
import { photoWipeIn, textIn } from "@/lib/gallery/reveal";
import { maskTable, type MaskStep } from "@/lib/gallery/timing";

// The card modal's mask-in (modal-gallery.md, "Masking in"; the gallery lab's
// round six): one GSAP timeline from lib/gallery/timing's table, built when
// the body mounts and run on a timer from startMs (the landing after a flight,
// at once otherwise; lib/gallery/steps maskStartMs), on screen or not. A
// text part with data-mask-split is split into lines (no mask wrappers: a left
// to right clip opens in place) and each line's clip opens; any other text
// part opens its own clip. A photo part's clip edge crosses it from the left
// while its media settles. Every tween is a fromTo on an element React gives
// no inline style, and the end of the run (or a close, a replay or reduced
// motion turning on) reverts the splits and clears only what GSAP wrote, so
// nothing outlives the run. The root carries data-mask-armed while it is live.

type Options = { reduced: boolean; runKey: string; startMs: number; stepsFor: (lines: (id: string) => number) => MaskStep[] };

const WRITTEN = "clipPath,transform";

export function useMaskIn(rootRef: RefObject<HTMLElement | null>, { reduced, runKey, startMs, stepsFor }: Options) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reduced) return;
    const parts = new Map([...root.querySelectorAll<HTMLElement>("[data-mask]")].map((el) => [el.dataset.mask ?? "", el] as const));
    const splits = new Map<string, SplitText>();
    for (const [id, el] of parts) {
      if (el.dataset.maskKind === "text" && el.hasAttribute("data-mask-split")) splits.set(id, SplitText.create(el, { type: "lines", linesClass: "card-line", aria: "none" }));
    }
    const { mask, ease, direction } = GALLERY;
    const table = maskTable(stepsFor((id) => splits.get(id)?.lines.length ?? 1), { startMs, lengthMs: mask.lengthMs, staggerMs: mask.staggerMs, lineStaggerMs: mask.lineStaggerMs });
    const duration = mask.lengthMs / 1000;
    const touched: Element[] = [];
    root.dataset.maskArmed = "";
    const finish = () => {
      for (const split of splits.values()) split.revert();
      splits.clear();
      gsap.set(touched, { clearProps: WRITTEN });
      delete root.dataset.maskArmed;
    };
    const tl = gsap.timeline({ onComplete: finish });
    for (const entry of table.entries) {
      const el = parts.get(entry.id);
      if (!el) continue;
      const at = entry.startMs / 1000;
      if (el.dataset.maskKind === "text") {
        const lines = splits.get(entry.id)?.lines;
        const targets = lines?.length ? lines : [el];
        touched.push(...targets);
        const reveal = textIn(direction);
        tl.fromTo(targets, reveal.from, { ...reveal.to, duration, ease: ease.gsap, stagger: mask.lineStaggerMs / 1000 }, at);
        continue;
      }
      const wipe = photoWipeIn(direction);
      touched.push(el);
      tl.fromTo(el, { clipPath: wipe.from }, { clipPath: wipe.to, duration, ease: ease.gsap }, at);
      const media = el.querySelector<HTMLElement>("[data-mask-media]");
      if (media) {
        touched.push(media);
        tl.fromTo(media, { scale: mask.settle }, { scale: 1, duration, ease: ease.gsap }, at);
      }
    }
    return () => {
      tl.kill();
      finish();
    };
    // stepsFor and startMs are read once per run; runKey names every input that replays the masks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, runKey]);
}
```
Replace `components/card/CardBody.tsx` with:
```tsx
"use client";

import { useRef } from "react";
import type { Gallery } from "@/lib/gallery/card";
import { cardSteps, maskStartMs } from "@/lib/gallery/steps";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardRows } from "./CardRows";
import { CardStack } from "./CardStack";
import { useMaskIn } from "./useMaskIn";
import type { GalleryLayout } from "./useGalleryLayout";

// The modal's body by layout (the desktop rows from 1024px up, the phone's
// column below) and its mask-in, which starts at the landing after a flight
// and at once otherwise, and never touches the photo a parked flown card covers.
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia, flying }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotionLive();
  useMaskIn(rootRef, { reduced, runKey: `${gallery.key}|${layout}`, startMs: maskStartMs(flying), stepsFor: (lines) => cardSteps(gallery, layout, flying, lines) });
  return (
    <div ref={rootRef} data-card-body={layout}>
      {layout === "rows" ? <CardRows gallery={gallery} renderMedia={renderMedia} /> : <CardStack gallery={gallery} renderMedia={renderMedia} />}
    </div>
  );
}
```
In `components/card/CardModal.tsx`: change `import { useRef, type CSSProperties } from "react";` to `import { useRef, useState, type CSSProperties } from "react";`; after `const rows = layout === "rows";` add
```ts
  // Every open is a fresh body, even of the card still leaving, so its masks
  // replay from the start rather than revive the exiting run.
  const [opens, setOpens] = useState(0);
  const [openKey, setOpenKey] = useState<CardKey | null>(null);
  if (cardKey !== openKey) {
    setOpenKey(cardKey);
    if (cardKey !== null) setOpens((n) => n + 1);
  }
```
and change the dialog's `key="card-modal"` to ``key={`card-modal-${opens}`}``.
- [ ] **Step 8:** In `e2e/label-face.spec.ts`, pass `settled: true` to every `openCardFromBook` call (its checks read the computed face and the geometry of whole lines, which a split line in the middle of a run would muddle). Then `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green (warnings no more than the baseline), and `E2E e2e/card-masks.spec.ts e2e/card-modal.spec.ts e2e/card-gallery.spec.ts e2e/flight.spec.ts e2e/label-face.spec.ts e2e/a11y.spec.ts e2e/modal.spec.ts e2e/inline-links.spec.ts` pass. The flight spec hides every dialog while it diffs and a flown open's masks start at the landing, so its swaps are unchanged.
- [ ] **Step 9: Commit.**
```bash
git add components/card/useMaskIn.ts components/card/CardBody.tsx components/card/CardModal.tsx e2e/support/cards.ts e2e/card-masks.spec.ts e2e/label-face.spec.ts
git commit -m "Card modal: every part masks in left to right on a timer, from the landing after a flight and at once otherwise, and nothing outlives the run" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: The turns: a group's clock, its left to right change, its controls (Opus)

**Files:**
- Create: `components/card/useRotator.ts`, `e2e/card-rotator.spec.ts`
- Modify: `components/card/RotatingPhoto.tsx` (replaced whole), `app/globals.css` (the current dot's fill)

**Interfaces:**
- Consumes: Task 4's `GALLERY` (`rotate`, `mask.landingMs`, `mask.settle`, `ease`, `direction`); Task 5's `wrap`, `rotatorRuns`, `remainingAfter`, `RotatorGate`, `sweepInsets`, `Span`, `textIn`, `textOut`; Task 12's `GroupLayer`, `GroupCaptions` and the group markup; `isKeyboardFocus` from `@/lib/input/modality`; `useReducedMotionLive`; `gsap` from `@/lib/gsap`; Task 13's `openCardFromBook(..., { settled })`.
- Produces:
```ts
export function useRotator(rootRef: RefObject<HTMLElement | null>, frameRef: RefObject<HTMLElement | null>, o: { count: number; reduced: boolean; paused?: boolean; held?: boolean; active?: boolean }): { index: number; step: (next: number) => number; runs: boolean }; // components/card/useRotator.ts
export const rotatorTrack: CSSProperties; // components/card/RotatingPhoto.tsx, the current dot's faint accent track (Task 17 reads it)
```
  `[data-rotator]` gains `data-rotator-runs` while its clock runs; the pause button carries `data-rotator-pause` (`"playing"` or `"paused"`); the current dot's fill carries `data-rotator-fill` (`"timed"` or `"still"`).

The rules (the lab's `useRotator.ts` and `RotatingPhoto.tsx` at ae9b6dd, round six): the clock starts `GALLERY.mask.landingMs + GALLERY.rotate.delayMs` (520 + 1200ms) after the body mounts, then a photo stays 3000ms and the group loops. It runs only with two photos or more, motion allowed, not paused, not held (hovered by a mouse, or keyboard focus inside it), at least a third of its frame on screen, and (on a phone) on the current page; it resumes with the time it had left. A change is 640ms on the site ease: one clip edge crosses the frame from its left edge to its right in the frame's own coordinates (`sweepInsets`), the new photo left of the edge and the old one right of it, so photos of two shapes hand over on one line, and the new photo settles from 1.02 to 1; the caption changes in two moves, the old caption's clip closing left to right over the first half of the change while the new one's opens left to right over the last 75 percent, so half of one is never read glued to half of the other. Under reduced motion it never turns on its own, has no pause button, and a step is instant. The words never change. Dots under the caption (the current one fills over the interval and freezes while the clock waits), clickable; the arrow keys step it when focus is inside it (and keep focus on the dots); a pause and play button; a polite live announcement of the photo and its caption whenever the clock is not running.

- [ ] **Step 1: Failing e2e** (`e2e/card-rotator.spec.ts`):
```ts
import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { GALLERY } from "@/lib/gallery/constants";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { cardDialog, cardRow, openCardFromBook } from "./support/cards";

const g = siteContent.modals.gallery;
const START_MS = GALLERY.mask.landingMs + GALLERY.rotate.delayMs;

// Mentorship's second row: photos 2, 3 and 4 taking turns beside its last
// paragraph, scrolled fully into view, the mouse parked on the backdrop.
async function openGroup(page: Page, { home = true } = {}) {
  const { dialog } = await openCardFromBook(page, "mentorship", { home });
  await page.mouse.move(5, 5);
  const group = dialog.locator("[data-rotator]");
  await group.scrollIntoViewIfNeeded();
  return { dialog, group };
}

const wordsOf = (dialog: import("@playwright/test").Locator) =>
  dialog.locator('[data-row="photo"][data-turns] [data-text-column] [data-mask]').evaluateAll((els) => els.map((el) => el.getAttribute("data-mask")));

test("rotator: a group turns every 3s once the start delay has passed, and its words never change", async ({ page }) => {
  const { dialog, group } = await openGroup(page);
  await expect(group).toHaveAttribute("data-rotator-runs", "", { timeout: START_MS + 3000 });
  const words = await wordsOf(dialog);
  const started = Date.now();
  await expect(group).toHaveAttribute("data-rotator-index", "1", { timeout: GALLERY.rotate.intervalMs + 2000 });
  const waited = Date.now() - started;
  expect(waited).toBeGreaterThan(GALLERY.rotate.intervalMs - 600);
  expect(waited).toBeLessThan(GALLERY.rotate.intervalMs + 900);
  expect(await wordsOf(dialog)).toEqual(words);
});

test("rotator: one edge sweeps the frame left to right, and the old caption clears before the new one writes in", async ({ page }) => {
  await openGroup(page);
  const sweep = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>('[data-card-modal="mentorship"] [data-rotator]');
    if (!root) return null;
    const layers = [...root.querySelectorAll<HTMLElement>("[data-rotator-layer]")];
    const index = Number(root.dataset.rotatorIndex);
    const incoming = layers[index];
    const outgoing = layers.find((el, i) => i !== index && el.style.clipPath !== "");
    const px = (el: HTMLElement) => el.style.clipPath.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat) ?? null;
    const a = incoming ? px(incoming) : null;
    const b = outgoing ? px(outgoing) : null;
    if (!a || !b || !outgoing) return null;
    if (a[1] < 2 || a[1] > incoming.offsetWidth - 2 || b[3] < 2 || b[3] > outgoing.offsetWidth - 2) return null;
    return { incomingEdge: incoming.offsetLeft + incoming.offsetWidth - a[1], outgoingEdge: outgoing.offsetLeft + b[3] };
  }, null, { polling: "raf", timeout: START_MS + 2 * GALLERY.rotate.intervalMs + 2000 });
  const { incomingEdge, outgoingEdge } = (await sweep.jsonValue())!;
  expect(Math.abs(incomingEdge - outgoingEdge)).toBeLessThan(1);
  const captions = await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>('[data-card-modal="mentorship"] [data-rotator]');
    if (!root) return null;
    const cells = [...root.querySelectorAll<HTMLElement>("[data-rotator-caption]")];
    const index = Number(root.dataset.rotatorIndex);
    const pct = (el: HTMLElement) => el.style.clipPath.match(/inset\(([^)]*)\)/)?.[1].split(/\s+/).map(parseFloat) ?? null;
    const entering = cells[index] ? pct(cells[index]) : null;
    const leaving = cells.find((el, i) => i !== index && el.style.clipPath !== "");
    const out = leaving ? pct(leaving) : null;
    if (!entering || !out) return null;
    // The old caption part way closed from the left while the new one has not begun.
    return out[3] > 2 && out[3] < 100 && entering[1] >= 101 ? { leavingLeft: out[3], enteringRight: entering[1] } : null;
  }, null, { polling: "raf", timeout: START_MS + 3 * GALLERY.rotate.intervalMs + 2000 });
  expect((await captions.jsonValue())!.enteringRight).toBeGreaterThanOrEqual(101);
});

test("rotator: a mouse over the frame or the pause button holds it, and play lets it go", async ({ page }) => {
  const { group } = await openGroup(page);
  await expect(group).toHaveAttribute("data-rotator-runs", "", { timeout: START_MS + 3000 });
  await group.locator("[data-rotator-frame]").hover();
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await page.mouse.move(5, 5);
  await expect(group).toHaveAttribute("data-rotator-runs", "");
  await group.getByRole("button", { name: g.pausePhotos }).click();
  await page.mouse.move(5, 5);
  await expect(group.locator("[data-rotator-pause]")).toHaveAttribute("data-rotator-pause", "paused");
  await expect(group.getByRole("button", { name: g.playPhotos })).toBeVisible();
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await expect(group.locator('[data-rotator-fill="timed"]')).toHaveCSS("animation-play-state", "paused");
  await group.getByRole("button", { name: g.playPhotos }).click();
  await page.mouse.move(5, 5);
  await expect(group).toHaveAttribute("data-rotator-runs", "");
});

test("rotator: a dot steps to its photo, and the arrow keys step and wrap with focus kept on the dots", async ({ page }) => {
  const { group } = await openGroup(page);
  const dot = (n: number) => group.getByRole("button", { name: g.photoOf(n, 3), exact: true });
  await dot(3).click();
  await expect(group).toHaveAttribute("data-rotator-index", "2");
  await dot(3).focus();
  await page.keyboard.press("ArrowRight");
  await expect(group).toHaveAttribute("data-rotator-index", "0");
  await expect(dot(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(group).toHaveAttribute("data-rotator-index", "2");
  await expect(dot(3)).toBeFocused();
});

test("rotator: under reduced motion it never turns on its own, has no pause button, and a dot steps it with no transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { group } = await openGroup(page, { home: false });
  await page.waitForTimeout(START_MS + 400);
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await expect(group.locator("[data-rotator-pause]")).toHaveCount(0);
  await expect(group.locator('[data-rotator-fill="still"]')).toHaveCount(1);
  await group.getByRole("button", { name: g.photoOf(2, 3), exact: true }).click();
  await expect(group).toHaveAttribute("data-rotator-index", "1");
  expect(await group.locator("[data-rotator-layer]").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.clipPath))).toEqual(["", "", ""]);
});

test("rotator: the keyboard path through Mentorship and Misuki reaches the dots, the pause button, the mentors, the links and a tip, and Escape hides the tip before it closes", async ({ page }) => {
  await openHome(page);
  const row = cardRow(page, "mentorship");
  await row.scrollIntoViewIfNeeded();
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = cardDialog(page, "mentorship");
  await expect(dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel })).toBeFocused();
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  const external = siteContent.book.externalLabel;
  const expected = [
    g.photoOf(1, 3), g.photoOf(2, 3), g.photoOf(3, 3), g.pausePhotos,
    ...siteContent.cards.mentorship.mentors.people.map((mentor) => `${mentor.name}, ${external}`),
    `${siteContent.cards.mentorship.modal.links[0].label}, ${external}`,
    siteContent.modals.closeAriaLabel,
  ];
  const reached: string[] = [];
  while (reached.length < expected.length) {
    await page.keyboard.press("Tab");
    reached.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return el.getAttribute("aria-label") ?? (el.textContent ?? "").replace(/\s+/g, " ").trim();
    }));
    if (reached.length === 1) await expect(dialog.locator("[data-rotator]")).not.toHaveAttribute("data-rotator-runs", "");
  }
  expect(reached).toEqual(expected);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();

  const misukiRow = cardRow(page, "misuki");
  await misukiRow.scrollIntoViewIfNeeded();
  await misukiRow.focus();
  await page.keyboard.press("Enter");
  const misuki = cardDialog(page, "misuki");
  await expect(misuki.getByRole("button", { name: siteContent.modals.closeAriaLabel })).toBeFocused();
  await expect(misuki.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  const tip = misuki.getByRole("button", { name: "Fast and Furious", exact: true });
  for (let i = 0; i < 8 && !(await tip.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(tip).toBeFocused();
  const bubble = page.locator("[data-inline-tip]");
  await expect(bubble).toHaveAttribute("data-shown", "true");
  await page.keyboard.press("Escape");
  await expect(bubble).not.toHaveAttribute("data-shown", "true");
  await expect(misuki).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(misuki).toHaveCount(0);
  await expect(misukiRow).toBeFocused();
});
```
- [ ] **Step 2:** `E2E e2e/card-rotator.spec.ts`. Expected FAIL: `data-rotator-runs` never appears and there is no pause button.
- [ ] **Step 3: Implement.** `components/card/useRotator.ts`:
```ts
"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { gsap } from "@/lib/gsap";
import { GALLERY } from "@/lib/gallery/constants";
import { sweepInsets, textIn, textOut, type Span } from "@/lib/gallery/reveal";
import { remainingAfter, rotatorRuns, wrap } from "@/lib/gallery/rotator";

// A group of photos taking turns in one frame: the desktop row and a phone
// page's stage share this clock and this change (the gallery lab's round six).
// The clock starts after the landing and the start delay, loops, holds while
// the group is held, paused, mostly off screen or (on a phone) on a page that
// is not current, and resumes with the time it had left; under reduced motion
// it never turns on its own and a step is instant. The change: one clip edge
// crosses the frame from the left in the frame's coordinates, the new photo
// left of it and the old one right of it, the new photo settling as it comes;
// the old caption's clip closes left to right first and the new one's opens
// after it. React says which photo is current; GSAP writes the change and
// clears what it wrote. The markup under rootRef: [data-rotator-layer] per
// photo, [data-rotator-media] inside each, [data-rotator-caption] per photo.

type Options = { count: number; reduced: boolean; paused?: boolean; held?: boolean; active?: boolean };

const WRITTEN = "clipPath,visibility,transform,zIndex";

export function useRotator(rootRef: RefObject<HTMLElement | null>, frameRef: RefObject<HTMLElement | null>, { count, reduced, paused = false, held = false, active = true }: Options) {
  const { intervalMs, changeMs, delayMs, visible: share, captionOut, captionInAt } = GALLERY.rotate;
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const remaining = useRef<number>(intervalMs);
  const shown = useRef(0);
  const change = useRef<gsap.core.Timeline | null>(null);
  const runs = rotatorRuns({ count, reduced, started, paused, held, visible: visible && active });

  useEffect(() => {
    const id = window.setTimeout(() => setStarted(true), GALLERY.mask.landingMs + delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.intersectionRatio >= share - 0.01), { threshold: [0, share, 0.66, 1] });
    observer.observe(el);
    return () => observer.disconnect();
  }, [frameRef, share]);

  // A new photo gets the whole interval; this runs before the timer below, so
  // a change starts it full.
  useEffect(() => {
    remaining.current = intervalMs;
  }, [index, intervalMs]);

  useEffect(() => {
    if (!runs) return;
    const startedAt = performance.now();
    const id = window.setTimeout(() => setIndex((i) => wrap(i + 1, count)), remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current = remainingAfter(remaining.current, performance.now() - startedAt);
    };
  }, [runs, index, count]);

  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = index;
    const root = rootRef.current;
    if (from === index || !root) return;
    const pick = (attr: string) => [...root.querySelectorAll<HTMLElement>(`[${attr}]`)];
    const layers = pick("data-rotator-layer");
    const media = pick("data-rotator-media");
    const captions = pick("data-rotator-caption");
    const written = [...layers, ...media, ...captions];
    change.current?.kill();
    gsap.set(written, { clearProps: WRITTEN });
    const [incoming, outgoing] = [layers[index], layers[from]];
    if (reduced || !incoming || !outgoing) return;
    const duration = changeMs / 1000;
    const ease = GALLERY.ease.gsap;
    const [captionIn, captionLeaving] = [captions[index], captions[from]];
    // The old photo and caption stay drawn under the new ones until the change
    // is done; the stylesheet hides every one that is not current.
    gsap.set(outgoing, { visibility: "visible", zIndex: 1 });
    gsap.set(incoming, { zIndex: 2 });
    if (captionLeaving) gsap.set(captionLeaving, { visibility: "visible" });
    const tl = gsap.timeline({ onComplete: () => gsap.set(written, { clearProps: WRITTEN }) });
    change.current = tl;
    const frameWidth = frameRef.current?.offsetWidth ?? incoming.offsetWidth;
    const span = (el: HTMLElement): Span => ({ left: el.offsetLeft, width: el.offsetWidth });
    const sweep = { progress: 0 };
    const draw = () => {
      const insets = sweepInsets(sweep.progress, frameWidth, span(incoming), span(outgoing));
      incoming.style.clipPath = insets.incoming;
      outgoing.style.clipPath = insets.outgoing;
    };
    draw();
    tl.to(sweep, { progress: 1, duration, ease, onUpdate: draw }, 0);
    if (media[index]) tl.fromTo(media[index], { scale: GALLERY.mask.settle }, { scale: 1, duration, ease }, 0);
    if (captionIn && captionLeaving) {
      const [enter, leave] = [textIn(GALLERY.direction), textOut(GALLERY.direction)];
      tl.fromTo(captionLeaving, leave.from, { ...leave.to, duration: duration * captionOut, ease }, 0);
      tl.fromTo(captionIn, enter.from, { ...enter.to, duration: duration * (1 - captionInAt), ease }, duration * captionInAt);
    }
    // Only a new index starts a change; the rest is read as it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => () => void change.current?.kill(), []);

  // Steps to a photo (wrapping) and says which it landed on.
  const step = (next: number) => {
    const target = wrap(next, count);
    setIndex(target);
    return target;
  };

  return { index, step, runs };
}
```
Replace `components/card/RotatingPhoto.tsx` with:
```tsx
"use client";

import { Pause, Play } from "lucide-react";
import { useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { siteContent } from "@/lib/content";
import { groupFrame, type Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { partId } from "@/lib/gallery/timing";
import { isKeyboardFocus } from "@/lib/input/modality";
import { galleryRowSizes } from "@/lib/photoSizes";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { GroupCaptions, GroupLayer } from "./GroupParts";
import { useRotator } from "./useRotator";

// A row's photos taking turns in one frame beside words that never change
// (the gallery lab, rounds five and six). The frame is the group's largest
// box and each photo is drawn in its own box centred in it, so nothing changes
// size; the caption under it changes with the photo. The dots under the
// captions say where it is (the current one fills over the interval) and step
// it, as do the arrow keys; the clock and the change are useRotator's, held
// while a mouse is over it, keyboard focus is inside it, or it is paused.

type Props = { gallery: Gallery; photos: readonly number[]; boxes: readonly Box[] };

const g = siteContent.modals.gallery;

// The current dot's track: the accent, faint, so it reads as the current one
// before its fill starts (bg-accent/NN emits nothing with var() colors).
export const rotatorTrack: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-accent) 28%, transparent)" };

export function RotatingPhoto({ gallery, photos, boxes }: Props) {
  const count = photos.length;
  const frame = groupFrame(boxes);
  const reduced = useReducedMotionLive();
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const { index, step, runs } = useRotator(rootRef, frameRef, { count, reduced, paused, held: hovered || focused });

  const go = (next: number, focusDot: boolean) => {
    const target = step(next);
    if (focusDot) rootRef.current?.querySelector<HTMLElement>(`[data-rotator-dot="${target}"]`)?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    go(index + (e.key === "ArrowRight" ? 1 : -1), (e.target as HTMLElement).hasAttribute("data-rotator-dot"));
  };
  // A mouse click focuses a dot with no ring; only keyboard focus holds the photos.
  const onFocus = (e: FocusEvent<HTMLDivElement>) => setFocused(isKeyboardFocus(e.target));
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };
  const onHover = (over: boolean) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setHovered(over);
  };
  const sizesOf = (photo: number, i: number) => galleryRowSizes(gallery.photos[photo].width / gallery.photos[photo].height, boxes[i]);
  const hasCaptions = photos.some((photo) => gallery.photos[photo].caption);

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription={g.roleCarousel}
      aria-label={g.rotatorLabel(count)}
      className="flex shrink-0 flex-col gap-2.5"
      style={{ width: frame.width }}
      onPointerEnter={onHover(true)}
      onPointerLeave={onHover(false)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-rotator=""
      data-rotator-index={index}
      data-rotator-runs={runs ? "" : undefined}
    >
      <div ref={frameRef} className="relative shrink-0" style={{ width: frame.width, height: frame.height }} data-rotator-frame="">
        {photos.map((photo, i) => (
          <GroupLayer key={photo} gallery={gallery} photo={photo} box={boxes[i]} frame={frame} layer={i} current={i === index} sizes={sizesOf(photo, i)} />
        ))}
      </div>
      {hasCaptions && <GroupCaptions photos={photos} index={index} caption={(photo) => gallery.photos[photo].caption} />}
      <div data-mask={partId.rotator(photos[0])} data-mask-kind="text" className="flex items-center justify-between gap-3">
        <div className="-ml-1 flex items-center">
          {photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              aria-label={g.photoOf(i + 1, count)}
              aria-current={i === index ? "true" : undefined}
              onClick={() => go(i, false)}
              className="group inline-flex h-8 items-center justify-center px-1"
              data-rotator-dot={i}
            >
              {i === index ? (
                <span className="relative block h-1.5 w-5 overflow-hidden rounded-full" style={rotatorTrack}>
                  <span
                    key={index}
                    className="absolute inset-0 rounded-full bg-accent"
                    style={reduced ? undefined : { animationDuration: `${GALLERY.rotate.intervalMs}ms`, animationPlayState: runs ? "running" : "paused" }}
                    data-rotator-fill={reduced ? "still" : "timed"}
                  />
                </span>
              ) : (
                <span className="block h-1.5 w-1.5 rounded-full bg-muted transition-colors duration-200 group-hover:bg-foreground" />
              )}
            </button>
          ))}
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? g.playPhotos : g.pausePhotos}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent"
            data-rotator-pause={paused ? "paused" : "playing"}
          >
            {paused ? <Play aria-hidden="true" className="h-3.5 w-3.5" /> : <Pause aria-hidden="true" className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
      <p className="sr-only" aria-live={runs ? "off" : "polite"}>
        {g.announce(index + 1, count, gallery.photos[photos[index]].caption ?? "")}
      </p>
    </div>
  );
}
```
Append to the end of `app/globals.css`:
```css
/* A group's current dot fills over the interval and freezes while its clock
   waits (components/card/RotatingPhoto, PhoneRotator). Under reduced motion
   the fill is still and full. */
[data-rotator-fill="timed"] {
  transform-origin: left center;
  animation-name: card-rotator-fill;
  animation-timing-function: linear;
  animation-fill-mode: both;
}
@keyframes card-rotator-fill {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
```
- [ ] **Step 4:** `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green; `E2E e2e/card-rotator.spec.ts e2e/card-gallery.spec.ts e2e/card-masks.spec.ts e2e/card-modal.spec.ts e2e/a11y.spec.ts` pass. Both files stay under 200 lines (`wc -l components/card/useRotator.ts components/card/RotatingPhoto.tsx`).
- [ ] **Step 5: Commit.**
```bash
git add components/card/useRotator.ts components/card/RotatingPhoto.tsx app/globals.css e2e/card-rotator.spec.ts
git commit -m "Card modal: a group's photos take turns every 3s, one edge sweeping left to right, the caption clearing then writing, held by hover, keyboard focus or pause" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: The phone pager's shell, and a focus trap that never lets focus fall out (Opus)

**Files:**
- Create: `components/card/PagerControls.tsx`, `components/card/PagerPage.tsx`, `components/card/CardPager.tsx`, `components/card/CardWords.tsx`, `e2e/card-pager.spec.ts`
- Modify: `lib/modal.ts` (`useFocusTrap`), `components/card/CardBody.tsx` (replaced whole), `components/card/CardModal.tsx` (the sheet)
- Delete: `components/card/CardStack.tsx`

**Interfaces:**
- Consumes: Task 3's `phonePages`, `stageKind`, `slideWords`, `Page`, `StageKind`, `pageStage`, `stageHeight`, `Box`; Task 4's `Gallery`, `GALLERY` (`pager`, `ease`, `talosTileCompact`, `talosMarkMinPx`), `PHONE_GROUPING`, `PAGER_PHOTO_SIZES`, `headerTileOf`; Task 5's `pagerReducer`, `PagerAction`; Task 7's `CardHeader`, `StillPhoto`, `Words`, `MentorsList`, `CardLinks`, `CloseHint`; Task 9's `CardBody` props, `cardDialog`, `flyCard`, `panelAtRest`; Task 13's `useMaskIn`, `cardSteps`, `maskStartMs`, `openCardFromBook(..., { settled })`.
- Produces:
```ts
useFocusTrap(containerRef, active): void // lib/modal.ts, the same signature; focus never falls out (Ruling 20)
PagerControls({ index, count, dispatch }: { index: number; count: number; dispatch: (action: PagerAction) => void })
PagerPage({ gallery, page, index, count, kind, stage, current }: { gallery: Gallery; page: Page; index: number; count: number; kind: StageKind; stage: { photos: readonly number[]; frame: Box; boxes: readonly Box[] }; current: boolean }) // Task 17 adds pressing
CardPager({ gallery, pages, renderMedia, onClose }: { gallery: Gallery; pages: readonly Page[]; renderMedia: boolean; onClose: () => void }) // onClose is read from Task 16
CardWords({ gallery, renderMedia }: { gallery: Gallery; renderMedia: boolean })
```
  Markup hooks: `[data-pager]` with `data-page`; `[data-pager-viewport]`; `[data-pager-track]`; `[data-pager-page]` with `data-stage-kind` (and `aria-hidden`, `inert` off the current page); `[data-pager-stage]`; `[data-pager-text]` with `data-scrolls` when its words overflow; `[data-pager-controls]` (also `data-mask="pager"`); `[data-pager-dot]`; `[data-pager-arrow]`.

The phone (the lab's `PhonePager.tsx` and `PagerPage.tsx` at ae9b6dd, grouping A, without the strip and with no auto-advance, which round four turned off): a card with photos is a sheet, the visible height less `GALLERY.pager.sheetInsetPx` (48), the backdrop no longer scrolling. The header (the compact tile, the title, the meta) is fixed above the pages, and its tile carries the flight's slot for every card (Ruling 2), so a parked flown card never moves when a page turns and no page carries a slot: every page photo draws itself. Each page is the stage (its photo, or on a turning page its group's frame, fitted whole, at most 40 percent of the visible height and never under 120px, leaving the caption and two lines of words their room), the caption (`captionShort` where there is one), then the words in their own area, which scroll only when they are longer than the room; the last page carries the mentors (Mentorship) and the links. Previous and next buttons and the page dots sit in one row under the pages, the ends disabled; the left and right arrow keys anywhere in the dialog turn the page. Travel is 360ms on the site ease, none under reduced motion. A card with no photos is `CardWords`, a short modal (Ruling 16). This task draws every stage still on its page's first photo (Task 17 turns a group) and has no drags (Task 16).

The pager is the first modal whose controls turn disabled (an arrow at its end) and whose content turns inert (a page turned away) under keyboard focus. Today's trap listens on the dialog only, so the browser's focus fixup drops focus to the body and the next Tab leaves the dialog. Ruling 20 fixes the trap itself, for every modal: a `MutationObserver` on the dialog's `disabled` and `inert` attributes moves focus from a control that went dead to the nearest live one (the first live control in the closest enclosing element that still holds one: Next disabling hands focus to Previous, a link on a page that turns away hands it to the next live control, else the close button), a document-level Tab from outside the topmost trap comes back in, and the Tab wrap skips controls inside an inert subtree. The hook's signature does not change, so every modal that uses it (the definition modal, the mark card, the Menu pill, the recruiting popover and dialog) gains the same behaviour with no change of its own.

- [ ] **Step 1: Failing e2e** (`e2e/card-pager.spec.ts`; Task 16 appends the drags and Task 17 the turns):
```ts
import { siteContent, type CardKey } from "@/lib/content";
import { galleryOf, headerTileOf } from "@/lib/gallery/card";
import { GALLERY, PHONE_GROUPING } from "@/lib/gallery/constants";
import { phonePages } from "@/lib/gallery/plan";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import { cardDialog, flyCard, openCardFromBook, panelAtRest } from "./support/cards";

// The phone gallery at 390 by 844 (a fine pointer: the pager follows the
// width, a Coil click flies as it does on a desktop, and a mouse drag is a
// pointer drag like a finger's).
test.use({ viewport: { width: 390, height: 844 } });

const g = siteContent.modals.gallery;
const keys = Object.keys(siteContent.cards) as CardKey[];
const PAGED = keys.filter((key) => galleryOf(key).plan.slides.length > 0);

test("pager: a phone opens one page a paragraph, the header above the pages and the controls under them", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one");
  await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
  const count = phonePages(galleryOf("capital-one").plan, PHONE_GROUPING).length;
  await expect(dialog.locator("[data-pager-page]")).toHaveCount(count);
  const header = (await dialog.locator("[data-pager] h2").boundingBox())!;
  const viewport = (await dialog.locator("[data-pager-viewport]").boundingBox())!;
  expect(header.y + header.height).toBeLessThanOrEqual(viewport.y);
  const panel = (await dialog.locator("[data-gallery-panel]").boundingBox())!;
  expect(Math.abs(panel.height - (844 - GALLERY.pager.sheetInsetPx))).toBeLessThan(2);
  await expect(dialog.getByRole("button", { name: g.previousPage })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: g.pageNumber(1, count) })).toHaveAttribute("aria-current", "true");
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  await expect(dialog.locator('[data-pager-page="0"]')).toHaveAttribute("aria-hidden", "true");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "2");
  await expect(dialog.getByRole("button", { name: g.nextPage })).toBeDisabled();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
});

test("pager: Mentorship's mentors and its link ride on its last page", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship");
  await expect(dialog.locator('[data-pager-page="1"] [data-mentors]')).toHaveCount(1);
  await expect(dialog.locator('[data-pager-page="1"] a', { hasText: siteContent.cards.mentorship.modal.links[0].label })).toHaveCount(1);
  await expect(dialog.locator('[data-pager-page="0"] [data-mentors]')).toHaveCount(0);
});

test("pager: every photo is whole in its stage, and no stage is taller than 40 percent of the height", async ({ page }) => {
  test.setTimeout(120_000);
  await openHome(page);
  for (const key of PAGED) {
    const { dialog } = await openCardFromBook(page, key, { home: false });
    const problems = await dialog.evaluate((root, cap) => {
      const out: string[] = [];
      root.querySelectorAll("[data-pager-page]").forEach((pageEl) => {
        const stage = pageEl.querySelector("[data-pager-stage]");
        if (!stage) return;
        const box = stage.getBoundingClientRect();
        const at = pageEl.getAttribute("data-pager-page");
        if (box.height > cap + 0.5) out.push(`page ${at}: stage ${box.height}px`);
        stage.querySelectorAll("[data-photo-frame]").forEach((photo) => {
          const r = photo.getBoundingClientRect();
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5 || r.left < box.left - 0.5 || r.right > box.right + 0.5) out.push(`page ${at}: photo ${photo.getAttribute("data-photo-frame")} cropped`);
        });
      });
      return out;
    }, 844 * GALLERY.pager.stageMax);
    expect(problems, key).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("pager: the header, the first page and the controls mask in, and nothing is left behind", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one");
  const controls = await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-card-modal="capital-one"] [data-pager-controls]')?.style.clipPath || null, null, { polling: "raf", timeout: 5000 });
  expect(await controls.jsonValue()).toMatch(/^inset\(/);
  await expect(dialog.locator("[data-mask-armed]")).toHaveCount(0, { timeout: 5000 });
  expect(await dialog.locator(".card-line").count()).toBe(0);
});

test("pager: a card with no photos is its words and its links in a short modal", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "this-site");
  await expect(dialog.locator("[data-pager]")).toHaveCount(0);
  await expect(dialog.locator('[data-mask="words-0"]')).toBeVisible();
  await expect(dialog.getByRole("link", { name: new RegExp(siteContent.cards["this-site"].modal.links[0].label) })).toBeVisible();
});

test("pager: the phone header keeps a card's shorter meta, so IEEE's reads President, 2023 to 2026", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "ieee");
  await expect(dialog.locator('[data-mask="meta"]')).toHaveText("President, 2023 to 2026");
  await expect(dialog.locator('[data-inline-key="ieee-ao"]')).toHaveCount(0);
});

test("pager: Talos's mark in the phone header's tile is never under its kit's 20px", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "talos");
  const tile = (await dialog.locator('[data-tile-slot="work"]').boundingBox())!;
  expect([Math.round(tile.width), Math.round(tile.height)]).toEqual([GALLERY.talosTileCompact.width, GALLERY.talosTileCompact.height]);
  const mark = (await dialog.locator('[data-tile-slot="work"] [data-face="logo"] img').first().boundingBox())!;
  expect(Math.max(mark.width, mark.height)).toBeGreaterThanOrEqual(GALLERY.talosMarkMinPx);
});

test("pager: a mouse click on the Coil flies a photo card onto the phone header's tile, which stays put while the pages turn", async ({ page, cdp }) => {
  const key = await flyCard(page, cdp, "photo");
  const dialog = cardDialog(page, key);
  await expect(dialog).toHaveAttribute("data-gallery-layout", "pager");
  await panelAtRest(page, key);
  const slot = dialog.locator('[data-tile-slot="photo"]');
  await expect(slot).toHaveCount(1);
  await expect(dialog.locator("[data-pager-page] [data-tile-slot]")).toHaveCount(0);
  const before = (await slot.boundingBox())!;
  const tile = headerTileOf(key, true);
  expect(Math.abs(before.width - tile.width) < 1 && Math.abs(before.height - tile.height) < 1, `${before.width} by ${before.height}`).toBe(true);
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  expect(await slot.boundingBox()).toEqual(before);
  await expect(dialog.locator('[data-pager-page="0"] [data-photo-frame] img').first()).toHaveCSS("opacity", "1");
});

test("pager: keyboard focus never falls out of the dialog when its control disables or its page goes inert, and Tab from the body comes back in", async ({ page }) => {
  const capital = await openCardFromBook(page, "capital-one", { settled: true });
  const next = capital.dialog.getByRole("button", { name: g.nextPage });
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(capital.dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  await page.keyboard.press("Enter");
  await expect(capital.dialog.locator("[data-pager]")).toHaveAttribute("data-page", "2");
  await expect(next).toBeDisabled();
  await expect(capital.dialog.getByRole("button", { name: g.previousPage })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(capital.dialog).toHaveCount(0);

  const { dialog } = await openCardFromBook(page, "misuki", { home: false, settled: true });
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  const tip = dialog.getByRole("button", { name: "Fast and Furious", exact: true });
  await tip.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "0");
  await expect(dialog.getByRole("button", { name: g.pageNumber(1, 2) })).toBeFocused();

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel })).toBeFocused();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: g.nextPage })).toBeFocused();
});

test("pager: under reduced motion a page changes with no travel", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { dialog } = await openCardFromBook(page, "capital-one", { home: false });
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(dialog.locator("[data-pager]")).toHaveAttribute("data-page", "1");
  expect(await dialog.locator("[data-pager-track]").evaluate((el) => (el as HTMLElement).style.transition)).toMatch(/^transform 0(ms|s)\b/);
});
```
- [ ] **Step 2:** `E2E e2e/card-pager.spec.ts`. Expected FAIL: there is no `[data-pager]` (the phone draws Task 12's column).
- [ ] **Step 3: The focus trap** (`lib/modal.ts`). Replace `useFocusTrap` and the comment above it with:
```ts
// The active traps, innermost last: only the top one pulls a stray Tab back in.
const trapStack: HTMLElement[] = [];

// Traps Tab/Shift+Tab inside the referenced container while active, among live
// controls only (not disabled, not inside an inert subtree, rendered). Focus
// never falls out: a Tab with focus outside the container (the body, once a
// focused control went away) comes back in, and a focused control that turns
// inert or disabled under the visitor (a pager page turning away, an arrow at
// its end) hands focus to the nearest live control, the first one in the
// closest enclosing element that still holds one. Restores focus to the element
// that was focused before the modal opened.
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const live = (el: HTMLElement) => !el.hasAttribute("disabled") && !el.closest("[inert]") && el.offsetParent !== null;
    const liveIn = (scope: Element) => Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(live);
    const focusables = () => liveIn(container);

    // Move focus into the container on open.
    const first = focusables()[0];
    // Delay by a frame so the entrance animation can start before focus jumps.
    // Tracked so cleanup can cancel it; otherwise a trap that unmounts within
    // the same frame would still steal focus after it is gone.
    let initialFocusRaf = 0;
    if (first) {
      initialFocusRaf = requestAnimationFrame(() => first.focus());
    }

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    const onDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || trapStack[trapStack.length - 1] !== container) return;
      const current = document.activeElement;
      if (current && current !== document.body && container.contains(current)) return;
      const items = focusables();
      if (items.length === 0) return;
      e.preventDefault();
      (e.shiftKey ? items[items.length - 1] : items[0]).focus();
    };

    let held: HTMLElement | null = null;
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement) held = e.target;
    };
    const rescue = () => {
      if (!held || live(held)) return;
      const current = document.activeElement;
      if (current && current !== held && current !== document.body) return;
      let next: HTMLElement | undefined;
      for (let scope = held.parentElement; scope && !next; scope = scope === container ? null : scope.parentElement) next = liveIn(scope)[0];
      held = null;
      next?.focus({ preventScroll: true });
    };
    const observer = new MutationObserver(rescue);
    observer.observe(container, { subtree: true, attributes: true, attributeFilter: ["disabled", "inert"] });

    trapStack.push(container);
    container.addEventListener("keydown", handler);
    container.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      if (initialFocusRaf) cancelAnimationFrame(initialFocusRaf);
      observer.disconnect();
      const at = trapStack.lastIndexOf(container);
      if (at !== -1) trapStack.splice(at, 1);
      container.removeEventListener("keydown", handler);
      container.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onDocumentKeyDown);
      returnFocusRef.current?.focus?.();
    };
  }, [active, containerRef]);
}
```
`useBodyScrollLock`, `useEscapeKey` and the backdrop variants do not change. Then `pnpm tsc --noEmit`, `pnpm lint` green, and `E2E e2e/a11y.spec.ts e2e/modal.spec.ts e2e/mark.spec.ts e2e/inline-links.spec.ts e2e/chrome.spec.ts e2e/controls.spec.ts e2e/label-face.spec.ts e2e/card-modal.spec.ts` pass: every modal (the card modal, the definition modal, the mark card, the Menu panel) opens with its first control focused, wraps Tab, closes on Escape and returns focus as before. Commit the trap on its own:
```bash
git add lib/modal.ts
git commit -m "Modal: the focus trap never lets focus fall out, a dead control hands focus to the nearest live one and a Tab from the body comes back in" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Step 4: Implement the shell.** `components/card/PagerControls.tsx`:
```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { siteContent } from "@/lib/content";
import { PHONE_GROUPING } from "@/lib/gallery/constants";
import type { PagerAction } from "@/lib/gallery/pager";
import { partId } from "@/lib/gallery/timing";

// The pager's one row of controls: previous, the page dots, next. Real
// buttons, the ends disabled; they only ever change pages.

type Props = { index: number; count: number; dispatch: (action: PagerAction) => void };

const g = siteContent.modals.gallery;

export function PagerControls({ index, count, dispatch }: Props) {
  const dotLabel = (i: number) => (PHONE_GROUPING === "photo" ? g.photoOf(i + 1, count) : g.pageNumber(i + 1, count));
  return (
    <div data-mask={partId.pager} data-mask-kind="text" className="flex shrink-0 items-center justify-between gap-2" data-pager-controls="">
      <Arrow label={g.previousPage} disabled={index === 0} onClick={() => dispatch({ type: "prev" })} next={false} />
      <div className="flex items-center justify-center">
        {Array.from({ length: count }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={dotLabel(i)}
            aria-current={i === index ? "true" : undefined}
            onClick={() => dispatch({ type: "goto", index: i })}
            className="group inline-flex h-8 w-7 items-center justify-center"
            data-pager-dot={i}
          >
            <span className={`block h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-200 ${i === index ? "w-4 bg-accent" : "w-1.5 bg-border group-hover:bg-muted"}`} />
          </button>
        ))}
      </div>
      <Arrow label={g.nextPage} disabled={index >= count - 1} onClick={() => dispatch({ type: "next" })} next />
    </div>
  );
}

function Arrow({ label, disabled, onClick, next }: { label: string; disabled: boolean; onClick: () => void; next: boolean }) {
  const Icon = next ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors duration-200 hover:text-accent disabled:cursor-default disabled:opacity-35 disabled:hover:text-foreground"
      data-pager-arrow={next ? "next" : "prev"}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}
```
`components/card/PagerPage.tsx`:
```tsx
"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import type { Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { slideWords, type Page, type StageKind } from "@/lib/gallery/plan";
import { partId } from "@/lib/gallery/timing";
import { PAGER_PHOTO_SIZES } from "@/lib/photoSizes";
import { CardLinks } from "./CardLinks";
import { MentorsList } from "./MentorsList";
import { StillPhoto } from "./StillPhoto";
import { Words } from "./Words";

// One page of the phone pager (the gallery lab's round six): the stage,
// exactly as tall as what it draws fitted whole; the caption; then the words
// in their own area, which scrolls only when they are longer than the room (a
// soft fade at its foot says so), with the mentors and the links on the last
// page. A page that is not current is inert and hidden from assistive tech.
// No page carries the flight's slot (a flown card parks on the header's tile,
// which stays put while the pages turn), so every photo draws itself.

type Stage = { photos: readonly number[]; frame: Box; boxes: readonly Box[] };
type Props = { gallery: Gallery; page: Page; index: number; count: number; kind: StageKind; stage: Stage; current: boolean };

const g = siteContent.modals.gallery;

export function PagerPage({ gallery, page, index, count, kind, stage, current }: Props) {
  const textRef = useRef<HTMLDivElement | null>(null);
  const [scrolls, setScrolls] = useState(false);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    const read = () => setScrolls(text.scrollHeight > text.clientHeight + 1);
    read();
    const observer = new ResizeObserver(read);
    observer.observe(text);
    if (text.firstElementChild) observer.observe(text.firstElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      role="group"
      aria-roledescription={g.roleSlide}
      aria-label={g.pageLabel(index + 1, count)}
      aria-hidden={!current}
      inert={!current}
      className="flex h-full w-full shrink-0 flex-col gap-3"
      data-pager-page={index}
      data-stage-kind={kind}
      data-wordless={page.wordless ? "" : undefined}
    >
      <StillStage gallery={gallery} photo={page.photo} box={stage.boxes[0]} height={stage.frame.height} />
      {!page.wordless && (
        <div
          ref={textRef}
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${scrolls ? "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]" : ""}`}
          style={{ touchAction: scrolls ? "pan-y" : "none" }}
          data-pager-text=""
          data-scrolls={scrolls ? "" : undefined}
        >
          <div className="flex flex-col gap-4 pb-6">
            {slideWords(page).map((unit) => (
              <Words key={unit} gallery={gallery} unit={unit} compact />
            ))}
            {page.links && gallery.key === "mentorship" && <MentorsList compact />}
            {page.links && <CardLinks cardKey={gallery.key} />}
          </div>
        </div>
      )}
    </div>
  );
}

// One photo standing on its stage's floor, whole, its caption under the stage.
function StillStage({ gallery, photo, box, height }: { gallery: Gallery; photo: number; box: Box; height: number }) {
  const picture = gallery.photos[photo];
  const caption = picture.captionShort ?? picture.caption;
  return (
    <>
      <div className="relative flex w-full shrink-0 items-end justify-center" style={{ height }} data-pager-stage="">
        <StillPhoto photo={picture} index={photo} box={box} sizes={PAGER_PHOTO_SIZES} caption={null} />
      </div>
      {caption && (
        <p data-mask={partId.caption(photo)} data-mask-kind="text" data-mask-split="" className="shrink-0 font-label text-label text-muted">
          {caption}
        </p>
      )}
    </>
  );
}
```
`components/card/CardPager.tsx`:
```tsx
"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import { pageStage, stageHeight } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY, PHONE_GROUPING } from "@/lib/gallery/constants";
import { pagerReducer } from "@/lib/gallery/pager";
import { stageKind, type Page } from "@/lib/gallery/plan";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardHeader } from "./CardHeader";
import { PagerControls } from "./PagerControls";
import { PagerPage } from "./PagerPage";

// The phone's gallery (under 1024px), the lab's round six pager: the header
// fixed above (a flown card parks on its tile, so no page carries it), one
// page a paragraph (PHONE_GROUPING), each page's photo or group whole in a
// stage at most 40 percent of the visible height with the words under it.
// The arrows and dots under the pages and the arrow keys anywhere in the
// dialog change pages. Under reduced motion pages change with no travel.

type Props = { gallery: Gallery; pages: readonly Page[]; renderMedia: boolean; onClose: () => void };
type Room = { width: number; height: number; visible: number };

const g = siteContent.modals.gallery;

export function CardPager({ gallery, pages, renderMedia }: Props) {
  const count = pages.length;
  const reduced = useReducedMotionLive();
  const [state, dispatch] = useReducer(pagerReducer, { index: 0, count });
  const [room, setRoom] = useState<Room | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { pager } = GALLERY;
  // The stage's cap, or less when the page is too short to leave the words their room.
  const heightFor = (share: number, below: number) => stageHeight((room?.visible ?? 0) * share, (room?.height ?? 0) - below, pager.stageFloorPx);
  const layouts = pages.map((page) => {
    const kind = stageKind(page, PHONE_GROUPING);
    const photos = kind === "turns" ? page.photos : [page.photo];
    const height = page.wordless ? heightFor(pager.wordlessMax, pager.captionRoomPx) : heightFor(pager.stageMax, pager.wordsRoomPx);
    return { kind, stage: { photos, ...pageStage(photos, gallery.aspects, room?.width ?? 0, height) } };
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const read = () => setRoom({ width: viewport.clientWidth, height: viewport.clientHeight, visible: window.innerHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const dialog = rootRef.current?.closest('[role="dialog"]');
      const target = e.target as Node | null;
      if (!dialog || !(target === document.body || (target !== null && dialog.contains(target)))) return;
      e.preventDefault();
      dispatch({ type: e.key === "ArrowRight" ? "next" : "prev" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const travel = reduced ? 0 : pager.slideMs;
  const shown = gallery.photos[pages[state.index].photo];
  const live = PHONE_GROUPING === "photo" ? g.announce(state.index + 1, count, shown.captionShort ?? shown.caption ?? "") : g.pageNumber(state.index + 1, count);
  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription={g.roleCarousel}
      aria-label={g.pagerLabel(count)}
      className="flex min-h-0 flex-1 flex-col gap-4"
      data-pager=""
      data-page={state.index}
    >
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact />
      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden" data-pager-viewport="">
        <div
          className="flex h-full"
          style={{ transform: `translate3d(${-state.index * 100}%, 0, 0)`, transition: `transform ${travel}ms ${GALLERY.ease.css}` }}
          data-pager-track=""
        >
          {pages.map((page, i) => (
            <PagerPage key={page.photo} gallery={gallery} page={page} index={i} count={count} kind={layouts[i].kind} stage={layouts[i].stage} current={i === state.index} />
          ))}
        </div>
      </div>
      {count > 1 && <PagerControls index={state.index} count={count} dispatch={dispatch} />}
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
    </div>
  );
}
```
`components/card/CardWords.tsx`:
```tsx
import type { Gallery } from "@/lib/gallery/card";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { Words } from "./Words";

// A phone modal for a card with no photos (min/Max, Talos, This site, the
// family business): the header, every paragraph, the links and the close
// hint, a short modal that scrolls with the backdrop.
export function CardWords({ gallery, renderMedia }: { gallery: Gallery; renderMedia: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact />
      <div className="flex flex-col gap-4">
        {gallery.words.map((_, unit) => (
          <Words key={unit} gallery={gallery} unit={unit} compact />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
```
Replace `components/card/CardBody.tsx` with:
```tsx
"use client";

import { useRef } from "react";
import type { Gallery } from "@/lib/gallery/card";
import { PHONE_GROUPING } from "@/lib/gallery/constants";
import { phonePages } from "@/lib/gallery/plan";
import { cardSteps, maskStartMs } from "@/lib/gallery/steps";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { CardPager } from "./CardPager";
import { CardRows } from "./CardRows";
import { CardWords } from "./CardWords";
import { useMaskIn } from "./useMaskIn";
import type { GalleryLayout } from "./useGalleryLayout";

// The modal's body by layout (the desktop rows from 1024px up; below, the
// pager for a card with photos and its words alone for a card without) and
// its mask-in, which starts at the landing after a flight and at once otherwise,
// and never touches the photo a parked flown card covers.
type Props = { gallery: Gallery; layout: GalleryLayout; renderMedia: boolean; flying: boolean; onClose: () => void };

export function CardBody({ gallery, layout, renderMedia, flying, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotionLive();
  const pages = phonePages(gallery.plan, PHONE_GROUPING);
  const paged = layout === "pager" && pages.length > 0;
  useMaskIn(rootRef, { reduced, runKey: `${gallery.key}|${layout}`, startMs: maskStartMs(flying), stepsFor: (lines) => cardSteps(gallery, layout, flying, lines) });
  return (
    <div ref={rootRef} data-card-body={layout} className={paged ? "flex min-h-0 flex-1 flex-col" : undefined}>
      {layout === "rows" ? (
        <CardRows gallery={gallery} renderMedia={renderMedia} />
      ) : paged ? (
        <CardPager gallery={gallery} pages={pages} renderMedia={renderMedia} onClose={onClose} />
      ) : (
        <CardWords gallery={gallery} renderMedia={renderMedia} />
      )}
    </div>
  );
}
```
In `components/card/CardModal.tsx`:
  - after `const rows = layout === "rows";` add `const sheet = gallery !== null && !rows && gallery.plan.slides.length > 0;` and import `GALLERY` from `@/lib/gallery/constants`;
  - in the dialog's `className`, replace `overflow-y-auto` with `${sheet ? "overflow-hidden" : "overflow-y-auto"}`;
  - change the panel's `style` to ``{ ...glass, maxWidth: rows ? gallery.panelWidth : undefined, height: sheet ? `calc(100dvh - ${GALLERY.pager.sheetInsetPx}px)` : undefined }``.

Then `git rm components/card/CardStack.tsx`.
- [ ] **Step 5:** `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green; `E2E e2e/card-pager.spec.ts e2e/card-modal.spec.ts e2e/card-masks.spec.ts e2e/card-gallery.spec.ts e2e/touch.spec.ts e2e/a11y.spec.ts` pass (`card-modal`'s "under 1024px a mouse click still flies the card, onto the phone header's tile" now lands on the pager's header, and "the layout holds while a flown card is parked" reopens the card as a pager). Every new file stays under 200 lines.
- [ ] **Step 6: Commit.**
```bash
git add components/card/PagerControls.tsx components/card/PagerPage.tsx components/card/CardPager.tsx components/card/CardWords.tsx components/card/CardBody.tsx components/card/CardModal.tsx e2e/card-pager.spec.ts
git commit -m "Card modal: the phone pager in a sheet, one page a paragraph under a header that holds the flight's slot, arrows, dots and keys" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(`git rm` in Step 4 already staged `CardStack.tsx`'s deletion.)

---

### Task 16: The pager's drags: a sideways drag turns a page, a vertical flick closes (Opus)

**Files:**
- Create: `components/card/usePagerDrag.ts`
- Modify: `components/card/CardPager.tsx` (the drags), `e2e/card-pager.spec.ts` (three tests appended)

**Interfaces:**
- Consumes: Task 4's `GALLERY` (`pager.flickPx`, `ease`); Task 5's `axisOf`, `releaseOf`, `rubberBand`, `Axis`, `PagerAction`; Task 15's `CardPager` and its `[data-pager-text]` markup (`data-scrolls`); Task 13's `openCardFromBook(..., { settled })`.
- Produces:
```ts
usePagerDrag(rootRef: RefObject<HTMLElement | null>, o: { index: number; count: number; reduced: boolean; dispatch: (action: PagerAction) => void; onDismiss: () => void }): { dragPx: number | null; pressing: boolean; handlers: { onPointerDown; onPointerMove; onPointerUp; onPointerCancel } } // Task 17 reads pressing
```

The drags (the lab's `PhonePager.tsx` at ae9b6dd): a sideways drag past 48px (or a quick one past 24px) turns one page, and past either end the track follows the finger at a third and springs back; a vertical drag on the stage, the header or words that fit moves the panel and closes the modal past 96px (or quick past 24px), a shorter one springs back, a sideways one never closes; a vertical drag on words that scroll is theirs. No travel while dragging.

- [ ] **Step 1: Failing e2e.** Add `import type { Locator, Page } from "@playwright/test";` as the first line of `e2e/card-pager.spec.ts`, and append:
```ts
async function centerOf(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// A drag slow enough never to count as a quick flick (under 0.6px a ms).
async function slowDrag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }, steps = 14) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + (by.x * i) / steps, from.y + (by.y * i) / steps);
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
}

test("pager: a sideways drag turns one page, a short one springs back, and past the start it stays", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one", { settled: true });
  const pager = dialog.locator("[data-pager]");
  const stage = (i: number) => dialog.locator(`[data-pager-page="${i}"] [data-pager-stage]`);
  await slowDrag(page, await centerOf(stage(0)), { x: 120, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "0");
  await slowDrag(page, await centerOf(stage(0)), { x: -30, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "0");
  await slowDrag(page, await centerOf(stage(0)), { x: -120, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "1");
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  await slowDrag(page, await centerOf(stage(1)), { x: 120, y: 0 });
  await expect(pager).toHaveAttribute("data-page", "0");
  await expect(dialog).toBeVisible();
});

test("pager: a vertical drag on the stage springs back short of 96px and closes the modal past it", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "capital-one", { settled: true });
  const panel = dialog.locator("[data-gallery-panel]");
  const before = (await panel.boundingBox())!.y;
  const stage = dialog.locator('[data-pager-page="0"] [data-pager-stage]');
  await slowDrag(page, await centerOf(stage), { x: 0, y: 60 });
  await expect(dialog).toBeVisible();
  await expect.poll(async () => Math.round((await panel.boundingBox())!.y)).toBe(Math.round(before));
  await slowDrag(page, await centerOf(stage), { x: 0, y: 130 });
  await expect(dialog).toHaveCount(0);
});

test("pager: long words scroll in their own area and never dismiss, while a drag on the stage still does", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "jobs", { settled: true });
  const first = dialog.locator('[data-pager-page="0"]');
  const words = first.locator("[data-pager-text]");
  await expect(words).toHaveAttribute("data-scrolls", "");
  await slowDrag(page, await centerOf(words), { x: 0, y: -150 });
  await slowDrag(page, await centerOf(words), { x: 0, y: 150 });
  await expect(dialog).toBeVisible();
  const middle = await centerOf(words);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => words.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(dialog).toBeVisible();
  await slowDrag(page, await centerOf(first.locator("[data-pager-stage]")), { x: 0, y: 130 });
  await expect(dialog).toHaveCount(0);
});
```
- [ ] **Step 2:** `E2E e2e/card-pager.spec.ts`. Expected FAIL: the three new tests, since a drag does nothing yet.
- [ ] **Step 3: Implement** `components/card/usePagerDrag.ts`:
```ts
"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { GALLERY } from "@/lib/gallery/constants";
import { axisOf, releaseOf, rubberBand, type Axis, type PagerAction } from "@/lib/gallery/pager";

// The pager's pointer (the lab's PhonePager at ae9b6dd): a drag picks its axis
// past the slop. Sideways it follows the finger (a third of the travel past
// either end) and turns one page on release; vertically it moves the panel
// and closes the modal past the flick, else springs back; a vertical drag on
// words that scroll is theirs. A press anywhere on the pager holds a turning
// group until the pointer comes up (pressing). A press on a button or a link
// is theirs.

type Drag = { id: number; x: number; y: number; axis: Axis | null; lastX: number; lastY: number; lastT: number; velocity: number; scrolls: boolean };
type Options = { index: number; count: number; reduced: boolean; dispatch: (action: PagerAction) => void; onDismiss: () => void };

export function usePagerDrag(rootRef: RefObject<HTMLElement | null>, { index, count, reduced, dispatch, onDismiss }: Options) {
  const [dragPx, setDragPx] = useState<number | null>(null);
  const [pressing, setPressing] = useState(false);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    if (!pressing) return;
    const release = () => setPressing(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [pressing]);

  const movePanel = (dy: number, ms: number) => {
    const panel = rootRef.current?.closest<HTMLElement>("[data-gallery-panel]");
    if (!panel) return;
    panel.style.transition = ms ? `translate ${ms}ms ${GALLERY.ease.css}` : "none";
    panel.style.translate = `0 ${dy}px`;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    setPressing(true);
    const target = e.target as HTMLElement;
    if (target.closest("button, a")) return;
    const text = target.closest<HTMLElement>("[data-pager-text]");
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, velocity: 0, scrolls: !!text && text.scrollHeight > text.clientHeight + 1 };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      d.axis = axisOf(dx, dy);
      if (d.axis === "y" && d.scrolls) {
        drag.current = null;
        return;
      }
      if (d.axis) rootRef.current?.setPointerCapture(e.pointerId);
    }
    const dt = e.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (d.axis === "y" ? e.clientY - d.lastY : e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    if (d.axis === "x") setDragPx(rubberBand(dx, index, count));
    else if (d.axis === "y" && !reduced) movePanel(dy, 0);
  };

  const end = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragPx(null);
    const dy = e.clientY - d.y;
    const release = cancelled ? "stay" : releaseOf(d.axis, e.clientX - d.x, dy, d.velocity, { flickPx: GALLERY.pager.flickPx });
    if (release === "next" || release === "prev") dispatch({ type: release });
    else if (release === "dismiss") {
      if (!reduced) movePanel(Math.sign(dy) * (rootRef.current?.clientHeight ?? 600), 240);
      onDismiss();
    } else if (d.axis === "y") movePanel(0, reduced ? 0 : 260);
  };

  return {
    dragPx,
    pressing,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => end(e, false),
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => end(e, true),
    },
  };
}
```
In `components/card/CardPager.tsx`:
  - add `import { usePagerDrag } from "./usePagerDrag";` after the `PagerPage` import;
  - the comment above `type Props` becomes:
```ts
// The phone's gallery (under 1024px), the lab's round six pager: the header
// fixed above (a flown card parks on its tile, so no page carries it), one
// page a paragraph (PHONE_GROUPING), each page's photo or group whole in a
// stage at most 40 percent of the visible height with the words under it.
// The arrows and dots under the pages, the arrow keys anywhere in the dialog
// and a sideways drag change pages; a vertical flick on the stage, the header
// or words that fit closes the modal. Under reduced motion pages change with
// no travel.
```
  - destructure `onClose` too: `export function CardPager({ gallery, pages, renderMedia, onClose }: Props) {`;
  - after `const viewportRef = useRef<HTMLDivElement | null>(null);` add `const { dragPx, handlers } = usePagerDrag(rootRef, { index: state.index, count, reduced, dispatch, onDismiss: onClose });`;
  - `const travel = reduced || dragPx !== null ? 0 : pager.slideMs;`;
  - the root's class becomes `"flex min-h-0 flex-1 select-none flex-col gap-4 [touch-action:none]"`, with `{...handlers}` on the next line;
  - the track's transform becomes ``translate3d(calc(${-state.index * 100}% + ${dragPx ?? 0}px), 0, 0)``.
- [ ] **Step 4:** `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green; `E2E e2e/card-pager.spec.ts e2e/touch.spec.ts e2e/card-modal.spec.ts` pass. Both files stay under 200 lines.
- [ ] **Step 5: Commit.**
```bash
git add components/card/usePagerDrag.ts components/card/CardPager.tsx e2e/card-pager.spec.ts
git commit -m "Card modal: the pager's drags, a sideways drag turning a page and a vertical flick closing, long words scrolling in their own area" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: A phone page's group turning in its stage (Opus)

**Files:**
- Create: `components/card/PhoneRotator.tsx`
- Modify: `components/card/PagerPage.tsx` (a turning stage and the `pressing` prop), `components/card/CardPager.tsx` (passes `pressing`), `e2e/card-pager.spec.ts` (three tests appended)

**Interfaces:**
- Consumes: Task 14's `useRotator` and `rotatorTrack`; Task 12's `GroupLayer` and `GroupCaptions`; Task 15's `PagerPage` and `CardPager`; Task 16's `usePagerDrag(...).pressing` and the spec's `centerOf`; Task 4's `GALLERY.rotate` (`intervalMs`, `changeMs`, `marksInsetPx`, `tapPx`, `holdMs`), `GALLERY.ease`, `PAGER_PHOTO_SIZES`; `isKeyboardFocus`; `useReducedMotionLive`.
- Produces: `PhoneRotator({ gallery, photos, frame, boxes, active, pressing }: { gallery: Gallery; photos: readonly number[]; frame: Box; boxes: readonly Box[]; active: boolean; pressing: boolean })`; `PagerPage` gains `pressing: boolean`. Markup: the stage's frame is `[data-rotator-frame]` (a `role="button"` named `groupStep`), the marks pill `[data-rotator-marks]` with one `[data-rotator-mark]` per photo.

Grouping A's turning page (the lab's `PhoneRotator.tsx` at ae9b6dd): the page's group turns inside its stage on the desktop's clock and change (`useRotator`), the frame being the group's largest photo fitted whole (Task 15 already sizes the stage from the whole group) and each photo drawn at its own fit centred in it, so the stage never changes size and nothing is cropped. Small marks in a pill sit inside the current photo's bottom right corner, `GALLERY.rotate.marksInsetPx` in, and glide to the next photo's corner over the change; the current mark fills over the interval. A tap on the stage steps the group (Enter or Space when it has focus); a pointer that moved further than 10px is the pager's swipe and one held longer than 500ms only held it, so neither steps. It holds while a finger is down anywhere on the pager, while its page is not current, and while the stage has keyboard focus; under reduced motion it never turns on its own and a tap steps it at once.

- [ ] **Step 1: Failing e2e.** Append to `e2e/card-pager.spec.ts`:
```ts
test("pager turns: a page's group turns in its stage only while its page is current, its marks inside the current photo's corner", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship");
  const group = dialog.locator('[data-pager-page="1"] [data-rotator]');
  await page.waitForTimeout(GALLERY.mask.landingMs + GALLERY.rotate.delayMs + 400);
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await expect(group).toHaveAttribute("data-rotator-runs", "");
  await expect(group).toHaveAttribute("data-rotator-index", "1", { timeout: GALLERY.rotate.intervalMs + 2000 });
  await page.waitForTimeout(GALLERY.rotate.changeMs + 150);
  const marks = (await group.locator("[data-rotator-marks]").boundingBox())!;
  const photo = (await group.locator('[data-rotator-layer="1"]').boundingBox())!;
  const inset = GALLERY.rotate.marksInsetPx;
  expect(Math.abs(photo.x + photo.width - inset - (marks.x + marks.width))).toBeLessThan(1.5);
  expect(Math.abs(photo.y + photo.height - inset - (marks.y + marks.height))).toBeLessThan(1.5);
});

test("pager turns: a tap on the stage steps the group at once, Enter steps it, and a press held over 500ms only holds it", async ({ page }) => {
  const { dialog } = await openCardFromBook(page, "mentorship");
  await dialog.getByRole("button", { name: g.nextPage }).click();
  await page.waitForTimeout(GALLERY.pager.slideMs + 100);
  const group = dialog.locator('[data-pager-page="1"] [data-rotator]');
  const frame = group.locator("[data-rotator-frame]");
  await frame.click();
  await expect(group).toHaveAttribute("data-rotator-index", "1");
  await frame.focus();
  await page.keyboard.press("Enter");
  await expect(group).toHaveAttribute("data-rotator-index", "2");
  const center = await centerOf(frame);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await page.waitForTimeout(GALLERY.rotate.holdMs + 200);
  await page.mouse.up();
  await expect(group).toHaveAttribute("data-rotator-index", "2");
});

test("pager turns: under reduced motion the group never turns on its own, and a tap steps it with no transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await settled(page);
  const { dialog } = await openCardFromBook(page, "mentorship", { home: false });
  await dialog.getByRole("button", { name: g.nextPage }).click();
  const group = dialog.locator('[data-pager-page="1"] [data-rotator]');
  await page.waitForTimeout(GALLERY.mask.landingMs + GALLERY.rotate.delayMs + 400);
  await expect(group).not.toHaveAttribute("data-rotator-runs", "");
  await group.locator("[data-rotator-frame]").click();
  await expect(group).toHaveAttribute("data-rotator-index", "1");
  expect(await group.locator("[data-rotator-layer]").evaluateAll((els) => els.map((el) => (el as HTMLElement).style.clipPath))).toEqual(["", "", ""]);
});
```
- [ ] **Step 2:** `E2E e2e/card-pager.spec.ts`. Expected FAIL: the three new tests find no `[data-rotator]` on Mentorship's second page (Task 15 draws its stage still).
- [ ] **Step 3: Implement** `components/card/PhoneRotator.tsx`:
```tsx
"use client";

import { useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { siteContent } from "@/lib/content";
import type { Box } from "@/lib/gallery/boxes";
import type { Gallery } from "@/lib/gallery/card";
import { GALLERY } from "@/lib/gallery/constants";
import { isKeyboardFocus } from "@/lib/input/modality";
import { PAGER_PHOTO_SIZES } from "@/lib/photoSizes";
import { useReducedMotionLive } from "@/components/soundtrack/useReducedMotionLive";
import { GroupCaptions, GroupLayer } from "./GroupParts";
import { rotatorTrack } from "./RotatingPhoto";
import { useRotator } from "./useRotator";

// Round six on a phone, grouping A: a page holds one paragraph, and when it
// has a group of photos they take turns inside the page's stage on the
// desktop's rules (useRotator). The frame is the group's largest photo fitted
// whole and each photo is drawn at its own fit centred in it, so the stage
// never changes size and nothing is cropped. Small marks in a pill inside the
// current photo's bottom right corner say where the group is (in a group of
// two shapes the pill glides to the next photo's corner with the change),
// well away from the page dots. A tap on the stage steps the group (Enter or
// Space when it has focus) and a swipe still turns the page. It holds while a
// finger is down on the pager, while its page is not current and while the
// stage has keyboard focus; under reduced motion it never turns on its own.

type Props = { gallery: Gallery; photos: readonly number[]; frame: Box; boxes: readonly Box[]; active: boolean; pressing: boolean };

const g = siteContent.modals.gallery;
const pill: CSSProperties = { backgroundColor: "color-mix(in srgb, var(--color-background) 78%, transparent)" };

export function PhoneRotator({ gallery, photos, frame, boxes, active, pressing }: Props) {
  const count = photos.length;
  const reduced = useReducedMotionLive();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const [focused, setFocused] = useState(false);
  const { index, step, runs } = useRotator(rootRef, frameRef, { count, reduced, held: pressing || focused, active });
  const { rotate, ease } = GALLERY;
  const captionOf = (photo: number) => gallery.photos[photo].captionShort ?? gallery.photos[photo].caption;
  const shown = boxes[index];
  const marksAt: CSSProperties = {
    right: (frame.width - shown.width) / 2 + rotate.marksInsetPx,
    bottom: (frame.height - shown.height) / 2 + rotate.marksInsetPx,
    transition: reduced ? "none" : `right ${rotate.changeMs}ms ${ease.css}, bottom ${rotate.changeMs}ms ${ease.css}`,
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
  };
  // A pointer that moved further than a tap was the pager's swipe, and one
  // held longer only held the group; neither steps it.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const start = down.current;
    down.current = null;
    if (start && (Math.hypot(e.clientX - start.x, e.clientY - start.y) > rotate.tapPx || e.timeStamp - start.t > rotate.holdMs)) return;
    step(index + 1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    step(index + 1);
  };
  const hasCaptions = photos.some((photo) => captionOf(photo));

  return (
    <div ref={rootRef} className="flex shrink-0 flex-col gap-3" data-rotator="" data-rotator-index={index} data-rotator-runs={runs ? "" : undefined}>
      <div className="relative w-full shrink-0" style={{ height: frame.height }} data-pager-stage="">
        <div
          ref={frameRef}
          role="button"
          tabIndex={active ? 0 : -1}
          aria-label={g.groupStep(index + 1, count)}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 cursor-pointer rounded-xl"
          style={{ width: frame.width, height: frame.height }}
          onPointerDown={onPointerDown}
          onClick={onClick}
          onKeyDown={onKeyDown}
          onFocus={(e) => setFocused(isKeyboardFocus(e.currentTarget))}
          onBlur={() => setFocused(false)}
          data-rotator-frame=""
        >
          {photos.map((photo, i) => (
            <GroupLayer key={photo} gallery={gallery} photo={photo} box={boxes[i]} frame={frame} layer={i} current={i === index} sizes={PAGER_PHOTO_SIZES} />
          ))}
          <div aria-hidden="true" className="pointer-events-none absolute z-[3] flex items-center gap-1 rounded-full px-1.5 py-1" style={{ ...pill, ...marksAt }} data-rotator-marks="">
            {photos.map((photo, i) =>
              i === index ? (
                <span key={photo} className="relative block h-1 w-3 overflow-hidden rounded-full" style={rotatorTrack} data-rotator-mark={i}>
                  <span
                    key={index}
                    className="absolute inset-0 rounded-full bg-accent"
                    style={reduced ? undefined : { animationDuration: `${rotate.intervalMs}ms`, animationPlayState: runs ? "running" : "paused" }}
                    data-rotator-fill={reduced ? "still" : "timed"}
                  />
                </span>
              ) : (
                <span key={photo} className="block h-1 w-1 rounded-full bg-muted" data-rotator-mark={i} />
              ),
            )}
          </div>
        </div>
      </div>
      {hasCaptions && <GroupCaptions photos={photos} index={index} caption={captionOf} />}
      <p className="sr-only" aria-live={runs ? "off" : "polite"}>
        {g.announce(index + 1, count, captionOf(photos[index]) ?? "")}
      </p>
    </div>
  );
}
```
In `components/card/PagerPage.tsx`: add `import { PhoneRotator } from "./PhoneRotator";`; add `pressing: boolean` to `Props` and to the destructured props; replace the line
```tsx
      <StillStage gallery={gallery} photo={page.photo} box={stage.boxes[0]} height={stage.frame.height} />
```
with
```tsx
      {kind === "turns" ? (
        <PhoneRotator gallery={gallery} photos={stage.photos} frame={stage.frame} boxes={stage.boxes} active={current} pressing={pressing} />
      ) : (
        <StillStage gallery={gallery} photo={page.photo} box={stage.boxes[0]} height={stage.frame.height} />
      )}
```
In `components/card/CardPager.tsx`: change `const { dragPx, handlers } = usePagerDrag(` to `const { dragPx, pressing, handlers } = usePagerDrag(`, and add `pressing={pressing}` to the `<PagerPage ... />` element (after `current={i === state.index}`).
- [ ] **Step 4:** `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint` green; `E2E e2e/card-pager.spec.ts e2e/card-rotator.spec.ts e2e/card-masks.spec.ts` pass (the stage test of Task 15 now also measures every photo of a turning stage against its stage).
- [ ] **Step 5: Commit.**
```bash
git add components/card/PhoneRotator.tsx components/card/PagerPage.tsx components/card/CardPager.tsx e2e/card-pager.spec.ts
git commit -m "Card modal: a phone page's group takes turns in its stage, its marks in the photo's corner, a tap stepping it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Aaron's look, the full suite and the PR (Opus)

**Files:**
- Create: `e2e/card-look.spec.ts` (Aaron's captures and the measures; every test skips unless `CARD_LOOK_DIR` is set)
- No source change: `lib/coil/constants.ts` keeps every value (the retune waits for Aaron's look)

**Interfaces:**
- Consumes: every earlier task; `openHome`, `waitForCoilSettled` (`e2e/support/coil.ts`); Task 13's `openCardFromBook(..., { settled })`, which returns at the panel's rest (Task 9), so every bottom measured here is the panel's true layout; Task 4's `galleryOf`; Task 11's stills procedure.
- Produces: the captures folder `/Users/asulbaran21/Personal Projects/.worktrees/c3-look/` (outside every checkout, so nothing in it can be committed): `coil-<size>-<theme>.png`, `modal-<card>-<size>-<theme>.png`, `measures.json`; the pushed branch `c3-card-system` and its PR into `main`, never merged.

- [ ] **Step 1: Catch up with main.** `git fetch origin` then `git log --oneline HEAD..origin/main`. If it prints anything, run `git merge --no-edit origin/main`, keep both sides of any conflict, and commit the merge. Never rebase, never squash. PR 49 (branch `logo-dark`, the dark Aritzia and FSDATALINK logos) may have merged by now: it adds `srcDark` for both in `lib/content/media.ts` and files under `public/work/logos/`, and Task 1 edited the `ieee` line of the same file. If `git log --oneline HEAD..origin/main` listed PR 49's merge, or `git diff HEAD~1 --stat` after your merge touches `lib/content/media.ts` or `public/work/logos/`, the merge gave FSDATALINK a dark file, so its dark Coil face drops the light plate and the dark hero stills from Task 11 are stale: re-run Task 11 whole (Steps 1 to 5: build, `next start` on 3370, `render-posters.mjs --sweep`, stop by the PID, the still specs, the commit) before Step 3 here, and say in the PR body that the stills were re-rendered after the merge.
- [ ] **Step 2: The capture spec** (`e2e/card-look.spec.ts`):
```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { siteContent, type CardKey } from "@/lib/content";
import { galleryOf } from "@/lib/gallery/card";
import { test, expect } from "./support/fixtures";
import { openHome, waitForCoilSettled } from "./support/coil";
import { openCardFromBook } from "./support/cards";

// Aaron's look at the fourteen, by hand and never in a normal run: the Coil
// and two modals at a desktop and a phone size in both themes, where each
// card's first gallery row ends against the fold, and which book metas wrap.
// CARD_LOOK_DIR names the folder; without it every test here skips.
const DIR = process.env.CARD_LOOK_DIR ?? "";
const SIZES = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "390x844", width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;
const MODALS: CardKey[] = ["mentorship", "capital-one"];
const keys = Object.keys(siteContent.cards) as CardKey[];

test.skip(!DIR, "manual capture for Aaron's look at the fourteen");

// The custom cursor draws itself where the pointer is; a capture hides it.
async function hideCursor(page: Page) {
  await page.addStyleTag({ content: ".z-\\[100\\]{visibility:hidden!important}" });
}

for (const size of SIZES) {
  for (const theme of THEMES) {
    test(`look: the Coil and two modals at ${size.name} in ${theme}`, async ({ page }) => {
      test.setTimeout(90_000);
      mkdirSync(DIR, { recursive: true });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: theme });
      await openHome(page);
      await hideCursor(page);
      await waitForCoilSettled(page);
      await page.screenshot({ path: join(DIR, `coil-${size.name}-${theme}.png`) });
      for (const key of MODALS) {
        const { dialog } = await openCardFromBook(page, key, { home: false, settled: true });
        await page.screenshot({ path: join(DIR, `modal-${key}-${size.name}-${theme}.png`) });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
    });
  }
}

test("look: where each card's first row ends against the fold, and which book metas wrap at 1440", async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(DIR, { recursive: true });
  const measures: Record<string, unknown> = {};
  for (const size of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    await openHome(page);
    const bottoms: Record<string, number | null> = {};
    for (const key of keys) {
      if (!galleryOf(key).plan.slides.length) {
        bottoms[key] = null;
        continue;
      }
      const { dialog } = await openCardFromBook(page, key, { home: false });
      const first = (await dialog.locator('[data-row="photo"]').first().boundingBox())!;
      bottoms[key] = Math.round(first.y + first.height);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
    measures[`first row bottom at ${size.width} by ${size.height}, fold ${size.height}`] = bottoms;
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page);
  measures["book metas that wrap under their titles at 1440"] = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#work button.book-row")]
      .filter((row) => {
        const [title, meta] = [row.children[0], row.children[1]].map((el) => el.getBoundingClientRect());
        return meta.top >= title.bottom - 1;
      })
      .map((row) => row.dataset.card),
  );
  writeFileSync(join(DIR, "measures.json"), `${JSON.stringify(measures, null, 2)}\n`);
});
```
Commit it:
```bash
git add e2e/card-look.spec.ts
git commit -m "e2e: Aaron's look at the fourteen, the Coil and two modals in both themes, the fold and the wrapping metas measured (manual, CARD_LOOK_DIR)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Step 3: One build.**
```bash
cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c3-card-system"
lsof -nP -iTCP:3246 -sTCP:LISTEN; lsof -nP -iTCP:3247 -sTCP:LISTEN   # both must print nothing
NEXT_PUBLIC_SITE_MODE=full GITHUB_CONTRIB_TOKEN= E2E_FIXTURES=1 pnpm build
```
- [ ] **Step 4: The full suite, against that build.**
```bash
pnpm vitest run lib 2>&1 | tee "$TMPDIR/c3-vitest.log"
pnpm tsc --noEmit
pnpm lint 2>&1 | tee "$TMPDIR/c3-lint.log"
CI=1 E2E_NO_BUILD=1 E2E_FULL_PORT=3246 E2E_HOLDING_PORT=3247 pnpm test:e2e 2>&1 | tee "$TMPDIR/c3-e2e.log"
```
Expected: vitest all pass; tsc silent; lint 0 errors and no more warnings than Task 0's baseline; e2e 0 failed (the skipped count grows by the five `card-look` tests). A failure is fixed in the file that owns it, committed on its own (subject "Fix: ..."), then `pnpm build` again with the same variables and Step 4 rerun whole.
- [ ] **Step 5: Aaron's captures, against the same build.**
```bash
CARD_LOOK_DIR="/Users/asulbaran21/Personal Projects/.worktrees/c3-look" CI=1 E2E_NO_BUILD=1 E2E_FULL_PORT=3246 E2E_HOLDING_PORT=3247 pnpm test:e2e e2e/card-look.spec.ts
ls "/Users/asulbaran21/Personal Projects/.worktrees/c3-look"
```
Expected: 4 `coil-*.png`, 8 `modal-*.png` and `measures.json`. Open `coil-1440x900-light.png`, `coil-1440x900-dark.png` and `coil-390x844-dark.png` with the Read tool and look before writing anything: fourteen cards in the strand order, the photos as photos, the logos centred (Talos on its dark anvil, Capital One on a light plate in the dark theme), the jobs circles growing up the diagonal, the AS mark in the accent, the name behind the cards. Describe what you see in the PR body; never claim more than the images show.
- [ ] **Step 6: The retune, listed and untouched.** `git diff origin/main -- lib/coil/constants.ts` must show only the added `face` block. Read the file and copy each value below, as it stands, into the PR body's "The retune, after your look" section: `cardsPerTurn` (8), `turnGap` (1.5), `cardHeightFrac` (0.24), `neighborGap` (0.05), `curvature` (0.7), `strandFit` ("repeat"), `narrow.axisFactor` (0.3), `narrow.maxCardsPerTurn` (6.2), `narrow.strandFit` ("repeat"), `idleCardsPerSecond` (0.09), `lab.endFadeSlots` (0.8), `lab.recedeLight` (0.3), `lab.recedeDark` (0.38), and the new `face` block (`logoWidth` 0.4, `wordmarkWidth` 0.64, `wordmarkFrom` 2, `plateInset` 0.07, `markWidth` 0.36, `circles` from 0.16 to 0.32, gap 0.025, logo 0.62). Name one lever outside the file too: `strandOrder` in `lib/content/cards.ts`, which sets which cards sit side by side. If a value differs from the one in brackets, copy the file's.
- [ ] **Step 7: The PR.** Push the branch, write the body, check it, open the PR, never merge:
```bash
git push -u origin c3-card-system
cat > "$TMPDIR/c3-pr-body.md" <<'BODY'
## What changed

- The Coil, the unwound list and the book run on the fourteen launch cards (`strandCards`, `bookColumns` from `lib/content/strand.ts`), in Aaron's strand and book orders; nothing reads the legacy shapes any more (the C5 sweep deletes them).
- The Coil paints logo, mark and circle faces from layouts it shares with the modal's header tile (`lib/coil/cardFace.ts`): Talos on its anvil, a light plate under a dark-theme logo with no dark file, IEEE's square as its own face, the jobs card's five discs, the AS mark in the accent. New tokens: `--card-anvil`, `--card-logo-ground`.
- One card modal (`components/card/`) replaces the photo and work modals: every card opens it, from the Coil (a mouse click flies the card in at any width, as before: onto the card picture or the header's tile beside the rows, onto the phone header's tile below 1024px; a tap opens it with no flight) or from the book (no flight). The jobs timeline makes each employer's name its insider tip; Mentorship lists the six mentors with their LinkedIn links; IEEE's desktop meta carries its AO tip.
- The gallery is the lab's round six: on desktop every photo, or every group of photos, its own row beside its words, the sides alternating; a group takes turns every 3s, one edge sweeping left to right, the caption clearing then writing, held by hover, keyboard focus or pause; every part masks in left to right on a timer, from the landing after a flight and at once otherwise. The band and Travel, which the lab never showed, follow cards.md's pairings. On a phone, a pager in a sheet, one page a paragraph (grouping A), a group turning in its page's stage, arrows, dots, keys and drags, a vertical flick to close.
- The shared focus trap (`lib/modal.ts`) never lets focus fall out of a modal: a control that turns disabled or inert under focus hands it to the nearest live one, and a Tab from the body comes back in.
- The card modal's backdrop dims (color-mix), as the lab showed.
- The hero stills are re-rendered with the fourteen{if Step 1 merged PR 49: ", and again after that merge"; else nothing}.
- What the captures show: {two or three sentences from Step 5}

## Decisions for Aaron

{the plan's "Decisions for Aaron" list, verbatim, one line each}
- Book metas that now wrap under their titles at 1440: {measures.json, "book metas that wrap under their titles at 1440"}
- First rows that end below the fold: {measures.json, every card whose first row bottom is over 900 at 1440 by 900 or over 768 at 1024 by 768, with its bottom}

## The retune, after your look

{Step 6's list, one value a line}

## Captures

`/Users/asulbaran21/Personal Projects/.worktrees/c3-look/`: the Coil, the Mentorship modal and the Capital One modal at 1440 by 900 and 390 by 844 in both themes, and `measures.json`.

## Tests

- `pnpm vitest run lib`: {files} files, {tests} tests, all passing (baseline {Task 0 files} files, {Task 0 tests} tests).
- `pnpm tsc --noEmit`: clean.
- `pnpm lint`: 0 errors, {warnings} warnings (baseline {Task 0 warnings}).
- e2e, a local full production build on ports 3246 and 3247, Chromium with the GPU: {passed} passed, {skipped} skipped, {failed} failed (baseline {Task 0 passed} passed, {Task 0 skipped} skipped, {Task 0 failed} failed).

## Not in this PR

- The C5 placeholder sweep: the legacy shapes, the case pages and their sitemap rows, the placeholder assets.
- The Talos sting and the min/Max slide-out; both cards show their static marks.
- The mentors' one sentences: each mentor shows a name and a link until Aaron writes them.
- The dark Aritzia and FSDATALINK logos (PR 49): {merged in Step 1, with the stills re-rendered; or still open, and the Coil and the modal draw `srcDark` as soon as it merges, with no change here}.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
```
Replace every `{...}` slot with its value (the logs in `$TMPDIR`, Task 0's baseline, `measures.json`, Step 5's look, Step 6's list, Step 1's merge, and this plan's "Decisions for Aaron" section copied word for word), then check the body. The body names the mentors' section and never pastes their LinkedIn links:
```bash
! grep -n '[{}]' "$TMPDIR/c3-pr-body.md"          # no slot left
! grep -n $'\xe2\x80\x94' "$TMPDIR/c3-pr-body.md"  # no em dash (its UTF-8 bytes)
! grep -n 'linkedin.com/in/' "$TMPDIR/c3-pr-body.md"  # no mentor's link
tail -n 1 "$TMPDIR/c3-pr-body.md"                  # the Claude Code line
gh pr create --base main --head c3-card-system --title "C3: the card system, the fourteen on the Coil and the book, every card's modal and gallery" --body-file "$TMPDIR/c3-pr-body.md"
```
Never merge, never push `main`, never `vercel deploy`.
- [ ] **Step 8: Report** the PR's URL, the captures folder, the four test counts against the baseline, and any value in Step 6 that differed from this plan.

---

## Decisions for Aaron

Every ruling in this plan that is Aaron's call, one line each (the PR body carries them, with the measured ones filled in):

1. The modal header's tile is the card's own 3:4 face (60 by 80 beside the rows; 42 by 56 on a phone, and 51 by 68 for Talos so its mark is never under its kit's 20px), so a flown card fills it exactly; the lab showed an 80px square with the work tint (Rulings 2 and 10).
2. Flights work as they do today: a mouse or trackpad click on a Coil card (or a row of the unwound list) flies the card into its modal at any window width whenever motion is allowed; a touch tap and a book row open it with no flight. At 1024px and up a photo card lands on its card picture in the first row and every other card on the header's 60 by 80 tile; below 1024px every card lands on the phone header's tile (42 by 56, Talos's 51 by 68), which stays put while the pages turn. A parked flown card holds the layout it opened with until it flies home (Ruling 3).
3. So on a phone a photo card's header shows its card picture in that small tile (where a flown card lands, and where the modal draws the picture when nothing lands), and the first page shows the same picture large with its caption: the picture appears twice. The alternative is to land a photo card on the first page's picture, which a page turn would slide off the panel with the flown card riding over the backdrop (Ruling 2).
4. The card picture never takes turns, even where the lab's rule would turn it beside a lone paragraph; no launch card hits this today (Ruling 5).
5. Travel and the band were not in the gallery lab. They follow cards.md's pairings: the card picture stands alone in the first row (its caption under it, no words beside it); then the band's section photo sits beside its first paragraph, the practice-lot photo beside "The band kept growing" and the competition photo beside the last paragraph, and Travel's Fuji, Dubai and Cartagena photos take turns beside the Japan and Dubai paragraph, with the paragraph about Barbara closing the card. The lab's rule would have put Travel's three beside Barbara's paragraph and the practice lot beside the last paragraph (Ruling 5).
6. The jobs modal keeps the same rows, its photos beside the entries they name and the two MOD photos taking turns beside the MOD entry; it opens on its three paragraphs and the Popeyes entry, so its first photo row starts below the fold at 1440 by 900 (Rulings 6 and 18).
7. Each job's insider tip is a dotted-underline tip on the employer's name, the same label the copy's other tips use (Ruling 7).
8. The mentors are a section of the Mentorship modal under "the people who shaped me" rather than a second modal, each a name linking to LinkedIn until you write the one sentence for them (Ruling 8, Task 1).
9. The IEEE "AO" tip lives in the modal, as cards.md asks: beside the rows the header's meta is the book's full line ("President, Corporate Director, and AO, 2023 to 2026", AO a dotted tip); a phone keeps the shorter "President, 2023 to 2026" that cards.md made for it, so a phone shows no AO; the book row shows the words with no tip (Ruling 9).
10. Book metas that now wrap under their titles at 1440 (the approved metas are longer, so the old "every work row's meta beside its title" test is gone): the PR lists them from Task 18's measures (Task 9, Step 9).
11. Logo tiles: the plain tiles on the work pane, Talos on its anvil in both themes, Capital One and FSDATALINK on a light plate in the dark theme until PR 49's dark files land (they then swap in with no C3 change), and IEEE's navy square drawn as the face itself (Ruling 10).
12. The jobs card's face is five light discs growing up the card's diagonal, Popeyes smallest at the bottom left to Aritzia largest at the top right, with the light logo files in both themes (Ruling 11).
13. Captions, metas, links and the close hint are in Profa Bold (the label face), where the lab drew captions and links in Inter (Ruling 12).
14. The card modal's backdrop now dims for real (a 70 percent tint and an 85 percent glass), as the lab showed; the definition modal and the mark card still blur with no dim, the known Tailwind issue (Ruling 13).
15. A book open (or a tap) masks in at once rather than after the flight's 520ms landing, since nothing lands; after a flight the masks still start at the landing (Ruling 19).
16. The Talos sting and the min/Max slide-out are not in this slice; both cards show their static marks until their own builds (Ruling 14).
17. The phone ships grouping A (one page a paragraph, a group turning inside its page); B is a one-line switch in `lib/gallery/constants.ts`, and C needs its strip built first (Ruling 15).
18. On a phone the pager draws no close hint (the X and a vertical flick close it, as in the lab), and a card with no photos is a short scrolling modal rather than a pager (Ruling 16).
19. Which first rows end below the fold at 1440 by 900 and 1024 by 768: the lab's numbers stand and nothing was tuned to clear it; the PR lists them from Task 18's measures (Ruling 18).
20. The Coil's retune waits for your look at the fourteen: the PR lists the values in `lib/coil/constants.ts` a retune would touch, unchanged, with the captures (Task 18).
