# Label face implementation plan (revised with the coordinator's six edits)

> **For agentic workers:** carry this out with superpowers:subagent-driven-development, one task at a time. Every step is a checkbox.

**Goal:** Small non-body text across the site moves to Profa Bold at three size steps (`label-sm`, `label`, `label-lg`) with 0.01em tracking and weight 700. Text you can click, and text attached to a Profa Black title, takes the accent colour. Everything else takes muted. Body text stays Inter and display text stays Profa Black.

**Architecture:** One `next/font/local` loader (`profaBold`, `--font-label`) goes on `<html>`. One Tailwind family (`font-label`) and three Tailwind sizes (`text-label-sm`, `text-label`, `text-label-lg`) carry the face. Components swap classes by role. The playback pill and player card move off inline font styles onto the same classes. Four structural changes follow: the band row, the back link, role lines moved below their titles, and book rows that wrap. Tests go first. Each role has a computed-style e2e check in a new `e2e/label-face.spec.ts`, plus source and config scans in `lib/labelFace.test.ts`.

**Tech stack:** Next 16.2, React 19.2, TypeScript strict, Tailwind 3.4, lucide-react, vitest (`pnpm test`), Playwright (Chromium, muted).

**Spec:** `docs/label-face-spec.md`. The lab record is `docs/lab-log-2026-10-05.md`, "Type lab". The lab's reviewed preset is `AARON_REVIEWED` in the lab worktree's `app/lab/type/settings.ts`.

**Base:** branch `label-face`, cut from `main` after `wave-band-only` (tier 1) merges, as the master plan says.

**Produces, for other slices (exact class names):**
- `controls` consumes `font-label`, `text-label-sm`, `text-label` and `text-label-lg`. Each size step already sets weight 700 and 0.01em tracking, so no `font-bold` and no `tracking-*` go beside them.
- `sections` consumes the kicker text classes `font-label text-label text-muted`. They sit on the kicker wrapper `reveal-item flex items-center gap-3 font-label text-label text-muted` in `AboutIntro`, `WhoIAm`, `UpToNow` and `Connect`.

**Deliberately untouched:** `components/coil/HeroOverlay.tsx`, lines 210, 239 and 366. Its text sits on the shader field with its own `--hero-greeting` token, and the scene sets the control's size; it gets a separate decision. Also untouched: body copy, display text, the custom cursor's "Open me", `components/recruiting/*`, `app/recruiting/*`, the holding page, the lab, the band's note paragraph (it is body prose), and the player card's track title (it is display).

## Global constraints (copied verbatim)

From AGENTS.md Layer 1:
- **No em dashes anywhere.** Body copy, comments, docs, commit messages. Use commas, semicolons, or separate sentences.
- **No hardcoded hex values in component files.** Tokens only.
- **All site copy lives in `lib/content.ts`.** Components import `siteContent` (and the typed exports `WorkItem`, `Photo`, `HomeTile`, `WorkBodySection`); they never embed strings.
- **First person voice in all copy.** No third-person "Aaron is..." framing. This includes image `alt` text: describe photos in first person ("Me speaking on stage...", not "Aaron speaking on stage..."). This is a deliberate ruling; do not "correct" alts to a third-person descriptive style.
- Sentence case for headings and labels, never title case; labels read company, role, year joined with commas; document titles keep the middle dot.
- One PR per slice into the integration branch (`coil` during the rebuild, `main` now they are equal), small commits, never squashed. Opus builders credit themselves (`Co-Authored-By: Claude Opus 5.5`).
- `pnpm dev` and `pnpm build` share `.next`; never both in one checkout. Audit and recon agents are read-only: no builds, no servers, never kill processes.

From the master plan, section 4:
- Every PR: small commits, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, the Claude Code line in the body, tests written first and shown failing, `pnpm test`, `pnpm tsc --noEmit`, `pnpm lint`, the affected e2e specs from a checkout with no dev server. Builders stop only the processes they started, never `pkill`, `killall` or a pattern match, never a port they did not open.

From the spec, section 7:
- No change to what is interactive. The label face changes how things look, never what they do.

## How to run things in this plan

- **Where:** every command runs from the worktree root, `/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-label-face`.
- **Serving this slice's build:** every intermediate e2e run uses this slice's own build on port 3260. Port 3250 belongs to tier 1. Run `NEXT_PUBLIC_SITE_MODE=full pnpm build && NEXT_PUBLIC_SITE_MODE=full pnpm start -p 3260` in the background and record its PID. Before each run that needs new code, stop only that PID, rebuild, and restart.
- **Running an intermediate spec:** `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/<spec>.ts --project=chromium -g "<title>"`. Flags go without `--`, as the repo's docs do (pnpm 10 forwards them).
- **The full run (Task 14 only):** stop the 3260 server first, because the full run rebuilds the same `.next`. Confirm `lsof -iTCP:3140 -iTCP:3141 -sTCP:LISTEN` prints nothing, then run `CI=1 pnpm test:e2e`. Tier 1 adds `E2E_FULL_PORT`, `E2E_HOLDING_PORT` and a holding temp directory per port; `CI=1` turns off server reuse.
- **Line numbers:** line numbers in the soundtrack files are from `main` before tier 1 and will drift. Find each change by its old string.

## Review focus: five failure modes no test covers

1. **Line-height drift.** `text-label-sm` and `text-label-lg` set no line height, so an element inherits 1.5 unless it sets its own. `text-xs` used to give 1rem and `text-base` 1.5rem. Every swap row below names the `leading-*` that keeps today's line. The e2e checks read size, weight, tracking and colour, not leading. Check each row against its old class.
2. **Inline styles beat classes, especially on hover.** `iconButton()` returns an inline `color`. Any inline `color` left in the pill silently cancels `text-accent` and `hover:text-accent-hover`. The e2e reads resting colour only.
3. **Contrast on glass.** The contrast pass (Task 14) measures `main` and `footer` against `--color-background`. The pill's tip, the card and the Menu chips sit on glass over moving content and are not measured. Check them by eye in both themes.
4. **Inter's features leaking into Profa.** `body` sets `font-feature-settings: "cv11", "ss01", "ss03"` for Inter. `font-label` resets it to `normal`, matching the lab's Profa (`faces.ts`, `features: "normal"`). The unit test pins the config, but nothing checks glyph shapes. If the reset is dropped, Profa may swap in alternates.
5. **Tier 1 and the rebase.** `wave-band-only` rewrites `PlaybackPill`, `BandStage` and `BandInvite` before this branch is cut. Any tier 1 follow-up, or a rebase of this branch, conflicts in exactly the swap rows of Tasks 2, 8 and 9. A careless resolution can bring back inline font styles or drop `items-baseline`. After any rebase, rerun `pnpm test` (the source scan) and the band and pill e2e checks.

---

### Task 1: Worktree, font file, allowlist, loader and tokens

**Files:**
- Create: `app/fonts/ProfaTrial-Bold.ttf` (copied), `lib/labelFace.test.ts`
- Modify: `.gitignore` (last 4 lines), `lib/fonts.ts` (1 to 19), `app/layout.tsx` (7, 54), `tailwind.config.ts` (35 to 59)
- Test: `lib/labelFace.test.ts`

**Interfaces.** Consumes the lab's font file. Produces `profaBold` (`--font-label`), `font-label`, `text-label-sm`, `text-label` and `text-label-lg`.

- [ ] **Step 1: Create the worktree once tier 1 is in, and copy the font.**
```bash
git -C "/Users/asulbaran21/Personal Projects/aaron-portfolio-website" fetch origin
git -C "/Users/asulbaran21/Personal Projects/aaron-portfolio-website" branch -r --merged origin/main | grep wave-band-only
git -C "/Users/asulbaran21/Personal Projects/aaron-portfolio-website" worktree add -b label-face "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-label-face" origin/main
cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-label-face" && pnpm install
cp "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-lab/app/fonts/ProfaTrial-Bold.ttf" app/fonts/
```
If the `grep` prints nothing, tier 1 has not merged yet. Stop and report back.
- [ ] **Step 2: Write the failing test** in `lib/labelFace.test.ts`.
```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "@/tailwind.config";

type Size = [string, Record<string, string>];
const extend = config.theme!.extend! as unknown as { fontSize: Record<string, Size>; fontFamily: Record<string, unknown> };

describe("the label face tokens", () => {
  it("has exactly three label sizes in the Tailwind config", () => {
    expect(Object.keys(extend.fontSize).filter((key) => key.startsWith("label")).sort()).toEqual(["label", "label-lg", "label-sm"]);
  });

  it("sets size, tracking and weight on every step; only label carries a line height", () => {
    expect(extend.fontSize["label-sm"]).toEqual(["0.795rem", { letterSpacing: "0.01em", fontWeight: "700" }]);
    expect(extend.fontSize.label).toEqual(["0.9275rem", { lineHeight: "1.25rem", letterSpacing: "0.01em", fontWeight: "700" }]);
    expect(extend.fontSize["label-lg"]).toEqual(["1.1925rem", { letterSpacing: "0.01em", fontWeight: "700" }]);
  });

  it("puts Profa Bold first in font-label, then Inter, with Inter's features reset", () => {
    expect(extend.fontFamily.label).toEqual([
      ["var(--font-label)", "var(--font-sans)", "system-ui", "sans-serif"],
      { fontFeatureSettings: "normal" },
    ]);
  });

  it("loads the tracked Bold cut onto --font-label on <html>", () => {
    const fonts = readFileSync("lib/fonts.ts", "utf8");
    expect(fonts).toContain('src: "../app/fonts/ProfaTrial-Bold.ttf"');
    expect(fonts).toContain('variable: "--font-label"');
    expect(readFileSync(".gitignore", "utf8").split("\n")).toContain("!app/fonts/ProfaTrial-Bold.ttf");
    expect(existsSync("app/fonts/ProfaTrial-Bold.ttf")).toBe(true);
    expect(readFileSync("app/layout.tsx", "utf8")).toContain("profaBold.variable");
  });
});
```
- [ ] **Step 3: Run it and confirm it fails.** Run `pnpm test lib/labelFace.test.ts`. Expected: FAIL. The label keys are `[]`, and `lib/fonts.ts` has no `ProfaTrial-Bold`.
- [ ] **Step 4: Minimal implementation.**

In `.gitignore`, replace the last three lines:
```
# Font files stay out by default; only faces the shipped site uses are
# allowlisted below (Profa Black, the headline face; Profa Bold, the label face).
app/fonts/*
!app/fonts/ProfaTrial-Black.ttf
!app/fonts/ProfaTrial-Bold.ttf
```

In `lib/fonts.ts`, change the Black comment's "the one allowlisted entry in app/fonts/" to "one of the two allowlisted entries in app/fonts/", then append:
```ts
// Profa Bold, the label face: small non-body text (controls, meta beside a
// title, kickers, nav, the pill, the credit). A trial cut until the full
// license lands, so it takes the same unicode-range carve-out as Black.
export const profaBold = localFont({
  src: "../app/fonts/ProfaTrial-Bold.ttf",
  weight: "700",
  display: "swap",
  variable: "--font-label",
  declarations: [
    { prop: "unicode-range", value: "U+0000-0029, U+002B-003A, U+003C-003F, U+0041-10FFFF" },
  ],
});
```

In `app/layout.tsx`, change line 7 to `import { profaBlack, profaBold } from "@/lib/fonts";`. On line 54 the className becomes `` `${inter.variable} ${profaBlack.variable} ${profaBold.variable}` ``.

In `tailwind.config.ts`, add this after `sans` in `fontFamily`:
```ts
        // The label face (docs/label-face-spec.md). Inter's cv11/ss01/ss03 on
        // body are Inter's alternates; Profa takes its defaults, as in the lab.
        label: [["var(--font-label)", "var(--font-sans)", "system-ui", "sans-serif"], { fontFeatureSettings: "normal" }],
```
Then add this after `body-lg` in `fontSize`:
```ts
        // The label face's three steps, the only label sizes. Weight lives
        // here so the Inter fallback is bold too; only label sets a line.
        "label-sm": ["0.795rem", { letterSpacing: "0.01em", fontWeight: "700" }],
        "label": ["0.9275rem", { lineHeight: "1.25rem", letterSpacing: "0.01em", fontWeight: "700" }],
        "label-lg": ["1.1925rem", { letterSpacing: "0.01em", fontWeight: "700" }],
```
- [ ] **Step 5: Run it and confirm it passes.** Run `pnpm test lib/labelFace.test.ts && pnpm tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 6: Commit.**
```bash
git add .gitignore app/fonts/ProfaTrial-Bold.ttf lib/fonts.ts app/layout.tsx tailwind.config.ts lib/labelFace.test.ts
git commit -m "Label face: Profa Bold loader, font-label and the three label steps" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Controls and links (accent)

**Files:**
- Create: `e2e/label-face.spec.ts`
- Modify: `app/work/[slug]/page.tsx` (49, 88, 91, 117, 120), `components/soundtrack/BandInvite.tsx` (SMALL), `components/soundtrack/BandStage.tsx` (credit wrapper, freeze button, LINK), `components/WorkModal.tsx` (145, 149), `app/not-found.tsx` (18), `app/error.tsx` (24)
- Test: `e2e/label-face.spec.ts`

**Interfaces.** Consumes the Task 1 tokens. Produces the helpers `expectLabel(locator, step, tone)` and `openWorkModal(page, cdp)`, which later tasks reuse.

- [ ] **Step 1: Write the failing test.** Create `e2e/label-face.spec.ts`:
```ts
import type { CDPSession, Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { settled } from "./support/fallback";
import type { HookWindow } from "./support/hooks";
import { pointerTo } from "./support/input";

// The label face (docs/label-face-spec.md): every small non-body text is
// Profa Bold at one of three steps, 0.01em, weight 700, in the accent when
// clickable or beside a title and muted otherwise. Computed styles only.

const STEP = { "label-sm": 12.72, label: 14.84, "label-lg": 19.08 } as const;
type Step = keyof typeof STEP;
type Tone = "accent" | "muted" | "foreground";

async function expectLabel(locator: Locator, step: Step, tone: Tone) {
  const read = await locator.evaluate((el) => {
    const first = (list: string) => list.split(",")[0].trim().replace(/^["']|["']$/g, "");
    const tone = (name: string) => {
      const probe = document.createElement("span");
      probe.style.color = `var(--color-${name})`;
      el.parentElement!.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const s = getComputedStyle(el);
    return {
      text: (el.textContent ?? "").trim().slice(0, 40),
      family: first(s.fontFamily),
      label: first(getComputedStyle(document.documentElement).getPropertyValue("--font-label")),
      weight: s.fontWeight,
      size: parseFloat(s.fontSize),
      tracking: parseFloat(s.letterSpacing),
      color: s.color,
      tones: { accent: tone("accent"), muted: tone("muted"), foreground: tone("foreground") },
    };
  });
  expect(read.label, "--font-label is set on <html>").not.toBe("");
  expect(read.family, `${read.text}: family`).toBe(read.label);
  expect(read.weight, `${read.text}: weight`).toBe("700");
  expect(read.size, `${read.text}: size`).toBeCloseTo(STEP[step], 1);
  expect(read.tracking, `${read.text}: tracking`).toBeCloseTo(STEP[step] * 0.01, 2);
  expect(read.color, `${read.text}: color`).toBe(read.tones[tone]);
}

// Opens a work card's modal the way a visitor does: hover the card until the
// scene picks it, then click (as flight.spec.ts does).
async function openWorkModal(page: Page, cdp: CDPSession) {
  await openHome(page, { debug: "flight" });
  const find = () =>
    page.evaluate(() => {
      const w = window as HookWindow;
      const slot = w.__coilFlight!.scene.slots().find(
        (s) =>
          s.kind === "work" && s.depth > 0.3 &&
          s.center.x > 80 && s.center.x < innerWidth - 80 && s.center.y > 80 && s.center.y < innerHeight * 0.75 &&
          w.__coil!.api.cardAt(s.center.x, s.center.y)?.slot === s.slot,
      );
      return slot?.slot ?? null;
    });
  await expect.poll(find, { timeout: 20_000, message: "a work card on screen" }).not.toBeNull();
  const slot = (await find())!;
  await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.follow(n), slot);
  const center = await page.evaluate((n) => (window as HookWindow).__coilFlight!.scene.slot(n)!.center, slot);
  await pointerTo(cdp, center);
  await page.waitForFunction((n) => (window as HookWindow).__coil!.hovered() === n, slot);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...center, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...center, button: "left", clickCount: 1 });
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("label face: controls and links are Profa Bold in the accent", async ({ page, cdp }) => {
  await page.goto("/work/capital-one-pm");
  await expectLabel(page.locator("article a[href='/#work']"), "label", "accent");
  await expectLabel(page.getByRole("link", { name: siteContent.work.placeholderCta }), "label-lg", "accent");

  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator('#listen [data-control="on"]'), "label", "accent");
  await expectLabel(page.locator('#listen [data-control="paused"]'), "label", "accent");
  await expectLabel(page.locator("#listen button", { hasText: siteContent.listen.freeze }), "label-sm", "accent");
  await expectLabel(page.locator("#listen a", { hasText: siteContent.soundtrack.creditArtist }), "label-sm", "accent");

  await page.goto("/label-face-missing");
  await expectLabel(page.getByRole("link", { name: siteContent.notFound.cta }), "label", "accent");

  const dialog = await openWorkModal(page, cdp);
  await expectLabel(dialog.getByRole("link", { name: siteContent.work.cta }), "label-lg", "accent");
});
```
- [ ] **Step 2: Run it and confirm it fails.** Serve this slice's build on 3260, then run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: controls"`. Expected: FAIL. On a pre-Task 1 build it fails with `--font-label is set on <html>` (empty); on the Task 1 build it fails on `family` for the back link.
- [ ] **Step 3: Minimal implementation.** Swap each string exactly:

| File:line | Old | New |
|---|---|---|
| `page.tsx:49` | `gap-2 text-sm text-muted transition-colors duration-200 hover:text-accent md:mb-16` | `gap-2 font-label text-label text-accent transition-colors duration-200 hover:text-accent-hover md:mb-16` |
| `page.tsx:88` | `gap-2 text-base font-medium text-accent` | `gap-2 font-label text-label-lg leading-6 text-accent` |
| `page.tsx:91` | `className="h-4 w-4"` | `className="relative -top-px h-4 w-4"` |
| `page.tsx:117` | `gap-2 text-base font-medium text-accent` | `gap-2 font-label text-label-lg leading-6 text-accent` |
| `page.tsx:120` | `className="h-4 w-4 transition-transform` | `className="relative -top-px h-4 w-4 transition-transform` |
| `BandInvite.tsx` SMALL | `` `text-sm text-accent underline `` | `` `font-label text-label text-accent underline `` |
| `BandStage.tsx` credit wrapper | `gap-y-2 text-xs leading-[1.5] text-muted` | `gap-y-2 font-label text-label-sm leading-[1.5] text-muted` |
| `BandStage.tsx` freeze button | `underline-offset-[3px] transition-[color,opacity] duration-200 hover:text-foreground` | `underline-offset-[3px] text-accent transition-[color,opacity] duration-200 hover:text-accent-hover` |
| `BandStage.tsx` LINK | `"rounded-sm underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-foreground` | `"rounded-sm text-accent underline decoration-1 underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover` |
| `WorkModal.tsx:145` | `gap-2 text-lg font-medium text-accent` | `gap-2 font-label text-label-lg leading-7 text-accent` |
| `WorkModal.tsx:149` | `className="h-4 w-4 transition-transform` | `className="relative -top-px h-4 w-4 transition-transform` |
| `not-found.tsx:18` | `mt-10 text-base font-medium text-accent` | `mt-10 font-label text-label leading-6 text-accent` |
| `error.tsx:24` | `mt-10 text-base font-medium text-accent` | `mt-10 font-label text-label leading-6 text-accent` |

`error.tsx` has no e2e route; it mirrors `not-found.tsx` and is checked in review. The credit wrapper also sets the credit prose; that prose stays muted, as Task 4 checks.
- [ ] **Step 4: Run it and confirm it passes.** Rebuild, restart on 3260, run `-g "label face: controls"`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add e2e/label-face.spec.ts "app/work/[slug]/page.tsx" components/soundtrack/BandInvite.tsx components/soundtrack/BandStage.tsx components/WorkModal.tsx app/not-found.tsx app/error.tsx
git commit -m "Label face: controls and links in Profa Bold, accent" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Meta beside a title (accent)

**Files:**
- Modify: `app/work/[slug]/page.tsx` (65), `components/WorkModal.tsx` (129), `components/book/BookRow.tsx` (105)
- Test: `e2e/label-face.spec.ts` (append)

**Interfaces.** Consumes `expectLabel` and `openWorkModal`. Produces accent role lines and accent book meta. The order is unchanged until Task 11 and the layout until Task 12.

- [ ] **Step 1: Write the failing test.** Append:
```ts
test("label face: meta beside a title is Profa Bold in the accent", async ({ page, cdp }) => {
  const item = siteContent.workItems.find((i) => i.slug === "capital-one-pm")!;
  await page.goto(`/work/${item.slug}`);
  await expectLabel(page.locator("article").getByText(`${item.role}, ${item.year}`, { exact: true }), "label-lg", "accent");

  const row = siteContent.book.workRows.find((r) => r.key === "capital-one-pm")!;
  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator("#work .book-row").getByText(row.meta, { exact: true }), "label", "accent");

  const dialog = await openWorkModal(page, cdp);
  const shown = siteContent.workItems.find((i) => i.title === (await dialog.locator("h2").textContent())?.trim())!;
  await expectLabel(dialog.getByText(`${shown.role}, ${shown.year}`, { exact: true }), "label", "accent");
});
```
- [ ] **Step 2: Run it and confirm it fails.** Run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: meta"`. Expected: FAIL on `family` for the case-page role line.
- [ ] **Step 3: Minimal implementation.**

| File:line | Old | New |
|---|---|---|
| `page.tsx:65` | `<span className="text-sm text-muted">` | `<span className="font-label text-label-lg leading-5 text-accent">` |
| `WorkModal.tsx:129` | `<span className="text-sm text-muted">` | `<span className="font-label text-label text-accent">` |
| `BookRow.tsx:105` | `"text-sm text-muted min-[720px]:whitespace-nowrap"` | `"font-label text-label text-accent min-[720px]:whitespace-nowrap"` |
- [ ] **Step 4: Run it and confirm it passes.** Rebuild, restart on 3260, run `-g "label face: meta"`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add "app/work/[slug]/page.tsx" components/WorkModal.tsx components/book/BookRow.tsx e2e/label-face.spec.ts
git commit -m "Label face: role lines and book meta in Profa Bold, accent" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Hints and secondary text (muted)

**Files:**
- Modify: `components/WorkModal.tsx` (151), `components/PhotoModal.tsx` (142), `components/DefinitionModal.tsx` (112 to 114)
- Test: `e2e/label-face.spec.ts` and `lib/labelFace.test.ts` (append)

**Interfaces.** Consumes `siteContent.modals.closeHintKeyboard`, which already exists. Produces muted hints. `DefinitionModal` is imported nowhere today; it changes for the copy rule only.

- [ ] **Step 1: Write the failing tests.** Append to `e2e/label-face.spec.ts`:
```ts
test("label face: hints and the credit prose are Profa Bold, muted", async ({ page, cdp }) => {
  await openHome(page);
  await expectLabel(page.locator("#listen p", { hasText: siteContent.soundtrack.creditLead }), "label-sm", "muted");
  const row = page.locator("#work button.book-row", { hasText: "Public speaking" });
  await row.scrollIntoViewIfNeeded();
  await row.focus();
  await page.keyboard.press("Enter");
  const photo = page.getByRole("dialog");
  await expectLabel(photo.getByText(siteContent.modals.closeHintKeyboard, { exact: true }), "label", "muted");
  await photo.getByRole("button", { name: siteContent.modals.closeAriaLabel }).click();

  const dialog = await openWorkModal(page, cdp);
  await expectLabel(dialog.getByText(siteContent.modals.closeHintKeyboard, { exact: true }), "label", "muted");
});
```
Append to `lib/labelFace.test.ts`:
```ts
describe("copy stays in lib/content.ts", () => {
  it("leaves no hard-coded close hint in the definition modal", () => {
    expect(readFileSync("components/DefinitionModal.tsx", "utf8")).not.toContain("Press Esc to close");
  });
});
```
- [ ] **Step 2: Run them and confirm they fail.** `pnpm test lib/labelFace.test.ts` fails on the hint string. `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: hints"` fails on `family` for the photo hint.
- [ ] **Step 3: Minimal implementation.**

| File:line | Old | New |
|---|---|---|
| `WorkModal.tsx:151` | `<span className="text-sm text-muted">` | `<span className="font-label text-label text-muted">` |
| `PhotoModal.tsx:142` | `<p className="mt-5 text-sm text-muted">` | `<p className="mt-5 font-label text-label text-muted">` |
| `DefinitionModal.tsx:112-114` | `<p className="mt-1 text-sm text-muted">` / `Press Esc to close` / `</p>` | `<p className="mt-1 font-label text-label text-muted">` / `{siteContent.modals.closeHintKeyboard}` / `</p>` |
- [ ] **Step 4: Run them and confirm they pass.** `pnpm test`, then rebuild, restart on 3260 and run `-g "label face: hints"`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add components/WorkModal.tsx components/PhotoModal.tsx components/DefinitionModal.tsx e2e/label-face.spec.ts lib/labelFace.test.ts
git commit -m "Label face: close hints muted in Profa Bold; the definition hint reads from content" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Kickers and Connect labels (muted)

**Files:**
- Modify: `components/AboutIntro.tsx` (21), `components/WhoIAm.tsx` (20), `components/UpToNow.tsx` (20), `components/Connect.tsx` (18, 51)
- Test: `e2e/label-face.spec.ts` (append)

**Interfaces.** Produces the kicker classes `font-label text-label text-muted`, which `sections` consumes.

- [ ] **Step 1: Write the failing test.**
```ts
test("label face: kickers and the Connect labels are Profa Bold, muted", async ({ page }) => {
  await page.goto("/");
  await settled(page);
  const { about, whoIAm, upToNow, connect } = siteContent;
  for (const label of [about.label, whoIAm.label, upToNow.label, connect.label]) {
    await expectLabel(page.locator(`section[aria-label="${label}"]`).getByText(label, { exact: true }).first(), "label", "muted");
  }
  await expectLabel(page.locator("#connect li a > span").first(), "label", "muted");
});
```
- [ ] **Step 2: Run it and confirm it fails.** Run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: kickers"`. Expected: FAIL on `family`.
- [ ] **Step 3: Minimal implementation.**

| File:line | Old | New |
|---|---|---|
| `AboutIntro.tsx:21`, `WhoIAm.tsx:20`, `UpToNow.tsx:20`, `Connect.tsx:18` | `reveal-item flex items-center gap-3 text-sm text-muted` | `reveal-item flex items-center gap-3 font-label text-label text-muted` |
| `Connect.tsx:51` | `w-28 shrink-0 text-sm text-muted` | `w-28 shrink-0 font-label text-label text-muted` |
- [ ] **Step 4: Run it and confirm it passes.** Rebuild, restart on 3260, run `-g "label face: kickers"`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add components/AboutIntro.tsx components/WhoIAm.tsx components/UpToNow.tsx components/Connect.tsx e2e/label-face.spec.ts
git commit -m "Label face: kickers and Connect labels muted in Profa Bold" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Nav (accent, every link)

**Files:**
- Modify: `components/SiteNav.tsx` (145, 157 to 161), `components/menu/MenuPill.tsx` (272, 283, 290), `components/menu/MenuPanel.tsx` (161, 164, 166, 176, 178, 188, 192, 203)
- Test: `e2e/label-face.spec.ts` (append)

**Interfaces.** Produces the nav in the label face. The active nav link keeps its dot; its colour no longer differs. `controls` reworks these hovers next.

- [ ] **Step 1: Write the failing test.** The `.first()` on the pill label keeps the locator to one match once `controls` duplicates the label into an aria-hidden fill overlay.
```ts
test("label face: the nav bar, the Menu pill and the panel are Profa Bold in the accent", async ({ page }) => {
  const m = siteContent.menu;
  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator("header nav a").first(), "label", "accent");
  const pill = page.locator(`button[aria-controls]`, { hasText: m.pillLabel });
  await expectLabel(pill.getByText(m.pillLabel, { exact: true }).first(), "label", "accent");
  await pill.click();
  await expectLabel(page.getByRole("button", { name: m.themeAriaLabelToDark }), "label", "accent");
  await expectLabel(page.getByRole("link", { name: m.email.label }), "label", "accent");
  await expectLabel(page.getByRole("link", { name: m.socials[0].label, exact: true }).last(), "label", "accent");
});
```
- [ ] **Step 2: Run it and confirm it fails.** Run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: the nav"`. Expected: FAIL on `family`.
- [ ] **Step 3: Minimal implementation.**

| File:line | Old | New |
|---|---|---|
| `SiteNav.tsx:145` | `gap-8 text-sm font-medium transition-opacity` | `gap-8 font-label text-label transition-opacity` |
| `SiteNav.tsx:157` | `` `relative transition-colors duration-200 hover:text-foreground ${ `` | `` `relative text-accent transition-colors duration-200 hover:text-accent-hover ${ `` |
| `SiteNav.tsx:159` | `"text-foreground after:absolute` | `"after:absolute` |
| `SiteNav.tsx:160` | `: "text-muted"` | `: ""` |
| `MenuPill.tsx:272` | `pr-[17px] text-sm font-medium tracking-[0.005em] focus-visible:rounded-full` | `pr-[17px] font-label text-label focus-visible:rounded-full` |
| `MenuPill.tsx:283` | `"flex h-[22px] items-center justify-end"` | `"flex h-[22px] items-center justify-end text-accent"` |
| `MenuPill.tsx:290` | `flex h-[22px] items-center justify-end transition-transform` | `flex h-[22px] items-center justify-end text-accent transition-transform` |
| `MenuPanel.tsx:161`, `:176` | `pr-3.5 text-[13px] font-medium text-foreground shadow-` | `pr-3.5 font-label text-label text-accent shadow-` |
| `MenuPanel.tsx:164`, `:166` | `className="h-4 w-4"` | `className="relative -top-px h-4 w-4"` |
| `MenuPanel.tsx:178` | `"flex h-4 w-4 items-center justify-center"` | `"relative -top-px flex h-4 w-4 items-center justify-center"` |
| `MenuPanel.tsx:188` | `` `flex text-[13px] ${ `` | `` `flex font-label text-label ${ `` |
| `MenuPanel.tsx:192`, `:203` | `"text-muted transition-colors duration-200 hover:text-foreground"` | `"text-accent transition-colors duration-200 hover:text-accent-hover"` |

`tracking-[0.005em]` must go: Tailwind emits `tracking-*` after `text-*`, so leaving it would override the token's 0.01em. The AS mark in the pill keeps its own colour because `text-accent` is on the text spans only.
- [ ] **Step 4: Run it and confirm it passes.** Rebuild, restart on 3260, run `-g "label face: the nav"`, then `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/chrome.spec.ts --project=chromium`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add components/SiteNav.tsx components/menu/MenuPill.tsx components/menu/MenuPanel.tsx e2e/label-face.spec.ts
git commit -m "Label face: nav bar, Menu pill and panel in Profa Bold, accent" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Footer copyright (muted)

**Files:** Modify `components/Footer.tsx` (11, 13). Test: `e2e/label-face.spec.ts`.

- [ ] **Step 1: Write the failing test.**
```ts
test("label face: the footer copyright is Profa Bold, muted, at the small step", async ({ page }) => {
  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator("footer").getByText(siteContent.footer.copyright, { exact: true }), "label-sm", "muted");
});
```
- [ ] **Step 2: Run it and confirm it fails.** Run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: the footer"`. Expected: FAIL on `family`.
- [ ] **Step 3: Minimal implementation.** On line 11, `flex-col gap-2 text-[12px] text-muted md:flex-row` becomes `flex-col gap-2 md:flex-row`. On line 13, `<p className="tracking-wide">` becomes `<p className="font-label text-label-sm text-muted">`.
- [ ] **Step 4: Run it and confirm it passes.** Rebuild, restart on 3260 and rerun. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add components/Footer.tsx e2e/label-face.spec.ts
git commit -m "Label face: footer copyright muted in Profa Bold" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: The pill and the player card off inline styles

**Files:**
- Modify: `components/soundtrack/PlaybackPill.tsx` (capsule style, tip style, tip div, capsule button, preview spans, glyph wrapper, capsule text), `PillLabel.tsx` (27), `PillParts.tsx` (FreezeRow), `PlayerCard.tsx` (78, 106, 114, 128, 178 to 190)
- Test: `lib/labelFace.test.ts` and `e2e/label-face.spec.ts` (append)

**Interfaces.** Produces a pill whose text reads `var(--font-label)` through classes. The capsule's inline padding change during preview stays.

- [ ] **Step 1: Write the failing tests.** Append to `lib/labelFace.test.ts`:
```ts
describe("the playback pill and player card", () => {
  it("take the label face from classes, never inline font styles", () => {
    for (const file of ["PlaybackPill", "PillParts", "PillLabel", "PlayerCard"]) {
      const source = readFileSync(`components/soundtrack/${file}.tsx`, "utf8");
      expect(source, file).not.toContain("var(--font-sans)");
      expect(source, file).not.toMatch(/fontSize: 1[0-2]\b/);
      expect(source, file).not.toMatch(/fontWeight: 500/);
    }
  });
});
```
Append to `e2e/label-face.spec.ts`, adding `import { capsuleText } from "@/lib/waveform/dock";` to the imports. The `.first()` on each capsule lookup keeps one match once `controls` duplicates the capsule's children into an aria-hidden fill overlay.
```ts
test("label face: the pill and the player card are Profa Bold at the small step", async ({ page }) => {
  const S = siteContent.soundtrack;
  const track = S.tracks[0];
  await page.goto("/");
  await settled(page);
  const pill = page.locator("[data-pill]");
  await expect(pill).toBeAttached();
  await expectLabel(pill.getByText(S.prompt, { exact: true }), "label-sm", "muted");
  const capsule = pill.locator(".pill-hit");
  await expectLabel(capsule.getByText(capsuleText("before", track.title), { exact: true }).first(), "label-sm", "muted");
  await expectLabel(capsule.getByText(track.title, { exact: true }).first(), "label-sm", "foreground");
  await expectLabel(capsule.getByText(track.artist, { exact: true }).first(), "label-sm", "muted");
  const card = pill.locator('[role="group"]');
  await expectLabel(card.getByText(track.artist, { exact: true }), "label-sm", "muted");
  await expectLabel(card.getByText(S.statusReady, { exact: true }), "label-sm", "muted");
  const time = card.getByText("0:00").first();
  await expectLabel(time, "label-sm", "muted");
  expect(await time.evaluate((el) => getComputedStyle(el).fontVariantNumeric)).toBe("tabular-nums");
  await expectLabel(card.locator("button", { hasText: siteContent.listen.freeze }), "label-sm", "accent");
});
```
- [ ] **Step 2: Run them and confirm they fail.** `pnpm test lib/labelFace.test.ts` fails with `PlaybackPill` containing `var(--font-sans)`. `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: the pill"` fails on `family`.
- [ ] **Step 3: Minimal implementation.** Find each change by its old string, since tier 1 moves these lines.
  - **`PlaybackPill.tsx`, the capsule style:** delete `fontFamily: "var(--font-sans)",` and `color: "var(--color-foreground)",`. The capsule's `className="pill-hit"` becomes `className="pill-hit font-label text-foreground"`.
  - **`PlaybackPill.tsx`, the tip style:** delete `color`, `fontSize` and `fontFamily`. The tip becomes `<div aria-hidden="true" className="font-label text-label-sm text-muted" style={tip}>`.
  - **`PlaybackPill.tsx`, the preview spans:** `<span className="block font-label text-label-sm text-foreground">{track.title}</span>` and `<span className="block font-label text-label-sm text-muted">{track.artist}</span>`.
  - **`PlaybackPill.tsx`, the glyph wrapper:** `<span style={{ display: "flex" }}>` becomes `<span className="relative -top-px flex">`.
  - **`PlaybackPill.tsx`, the capsule text span:** ``<span className={`font-label text-label-sm ${music === "on" ? "text-foreground" : "text-muted"}`}>``.
  - **`PillLabel.tsx:27`:** `<span className="font-label text-label-sm text-muted">{line}</span>`.
  - **`PillParts.tsx`, FreezeRow:** the style becomes `{ ...iconButton(), color: undefined, justifyContent: "flex-start", minHeight: 24, marginTop: 10 }`. Add `className="font-label text-label-sm text-accent underline underline-offset-[3px] transition-colors duration-200 hover:text-accent-hover"`. `color: undefined` removes `iconButton()`'s inline colour so the class can win.
  - **`PlayerCard.tsx`, line 78:** delete `const small`.
  - **`PlayerCard.tsx`, line 106:** `<span className="mt-0.5 block font-label text-label-sm text-muted">{track.artist}</span>`.
  - **`PlayerCard.tsx`, lines 114 and 128:** `<span className="font-label text-label-sm tabular-nums text-muted">`.
  - **`PlayerCard.tsx`, line 178:** `<span className="font-label text-label-sm text-muted">`.
  - **`PlayerCard.tsx`, the Spotify anchor:** replace its `style` with `className="inline-flex items-center gap-1.5 font-label text-label-sm text-accent transition-colors duration-200 hover:text-accent-hover"`, and give `<ExternalLink aria-hidden="true" size={12} className="relative -top-px" />`. The track has no `spotifyUrl` today, so review covers this, not e2e.
- [ ] **Step 4: Run them and confirm they pass.** `pnpm test && pnpm tsc --noEmit`. Rebuild, restart on 3260, run `-g "label face: the pill"`, then `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/soundtrack.spec.ts --project=chromium -g "dock:"`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add components/soundtrack/PlaybackPill.tsx components/soundtrack/PillLabel.tsx components/soundtrack/PillParts.tsx components/soundtrack/PlayerCard.tsx lib/labelFace.test.ts e2e/label-face.spec.ts
git commit -m "Label face: the pill and player card take the face from classes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: The band row

**Files:** Modify `components/soundtrack/BandInvite.tsx` (the row, the controls grid, the "before" layer, QUIET). Test: `e2e/label-face.spec.ts`.

**Interfaces.** Produces "Not now" as a muted label with a faint underline, controls on the heading's baseline, 36px after the question and 16px inside the pair. All gaps are measured between the text itself, so `controls`' later padding on the buttons (`-mx-2 px-2`, `-mx-1.5 px-1.5`) leaves them unchanged.

- [ ] **Step 1: Write the failing test.**
```ts
test("label face: the band's answers sit on the question's baseline, 36px after it, 16px apart", async ({ page }) => {
  const read = () =>
    page.evaluate(() => {
      const baseline = (el: Element) => {
        const probe = document.createElement("span");
        probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
        el.append(probe);
        const y = probe.getBoundingClientRect().top;
        probe.remove();
        return y;
      };
      const text = (el: Element) => {
        const r = document.createRange();
        r.selectNodeContents(el.firstChild!);
        return r.getBoundingClientRect();
      };
      const q = document.querySelector("#listen h2")!;
      const play = document.querySelector('#listen [data-control="before"]')!;
      const not = play.nextElementSibling!;
      const s = getComputedStyle(not);
      return {
        drift: ["before", "on", "paused"].map((k) => Math.abs(baseline(document.querySelector(`#listen [data-control="${k}"]`)!) - baseline(q))),
        afterQuestion: text(play).left - text(q).right,
        inPair: text(not).left - text(play).right,
        line: s.textDecorationLine,
        offset: s.textUnderlineOffset,
        alpha: Number(s.textDecorationColor.match(/([\d.]+)\)$/)![1]),
      };
    });
  await page.goto("/");
  await settled(page);
  await expectLabel(page.locator("#listen button", { hasText: siteContent.listen.decline }), "label", "muted");
  const light = await read();
  for (const d of light.drift) expect(d, "control baseline to the question's").toBeLessThanOrEqual(0.5);
  expect(light.afterQuestion).toBeCloseTo(36, 0);
  expect(light.inPair).toBeCloseTo(16, 0);
  expect({ line: light.line, offset: light.offset }).toEqual({ line: "underline", offset: "4px" });
  expect(light.alpha).toBeCloseTo(0.4, 2);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await settled(page);
  expect((await read()).alpha).toBeCloseTo(0.55, 2);
});
```
- [ ] **Step 2: Run it and confirm it fails.** Run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: the band"`. Expected: FAIL on `family` for "Not now".
- [ ] **Step 3: Minimal implementation.** Tier 1 rewrites the controls grid to `className="grid"`, so its row reads from that string:

| Where | Old | New |
|---|---|---|
| question row | `items-baseline gap-x-7 gap-y-3` | `items-baseline gap-x-9 gap-y-3` |
| controls grid (`data-band-controls`) | `className="grid"` | `className="grid items-baseline"` |
| "before" layer | `className="flex items-baseline gap-6"` | `className="flex items-baseline gap-4"` |
| QUIET | `` `text-sm text-muted transition-colors `` | `` `font-label text-label text-muted underline decoration-1 underline-offset-[4px] decoration-[color:color-mix(in_srgb,var(--color-muted)_40%,transparent)] dark:decoration-[color:color-mix(in_srgb,var(--color-muted)_55%,transparent)] transition-colors `` |
- [ ] **Step 4: Run it and confirm it passes.** Rebuild, restart on 3260, run `-g "label face: the band"`, then `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/soundtrack.spec.ts --project=chromium -g "band:"`. Expected: PASS, except `band: the still line` (Task 14 regenerates it).
- [ ] **Step 5: Commit.**
```bash
git add components/soundtrack/BandInvite.tsx e2e/label-face.spec.ts
git commit -m "Label face: band controls on the question's baseline; Not now muted with a faint underline" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: The back link

**Files:** Modify `lib/content.ts` (218), `app/work/[slug]/page.tsx` (5, 47 to 52). Test: `lib/content.test.ts` and `e2e/label-face.spec.ts`.

- [ ] **Step 1: Write the failing tests.** Append inside `lib/content.test.ts`:
```ts
describe("the case page", () => {
  it("labels the back link with the word alone; the page draws the arrow", () => {
    expect(siteContent.work.backLabel).toBe("Work");
  });
});
```
Append to `e2e/label-face.spec.ts`:
```ts
test("label face: the back link is a drawn 14px arrow, lifted 1px, then Work", async ({ page }) => {
  await page.goto("/work/capital-one-pm");
  const link = page.locator("article a[href='/#work']");
  await expect(link).toHaveText("Work");
  const icon = link.locator("svg");
  expect(await icon.evaluate((el) => ({
    w: el.getBoundingClientRect().width,
    stroke: el.getAttribute("stroke-width"),
    top: getComputedStyle(el).top,
    first: el.parentElement!.firstElementChild === el,
  }))).toEqual({ w: 14, stroke: "2.5", top: "-1px", first: true });
});
```
- [ ] **Step 2: Run them and confirm they fail.** `pnpm test lib/content.test.ts` fails because it receives "← Work".
- [ ] **Step 3: Minimal implementation.** In `content.ts:218`, set `backLabel: "Work",`. In `page.tsx:5`, use `import { ArrowLeft, ArrowUpRight } from "lucide-react";`. Lines 47 to 52 become:
```tsx
            <Link
              href="/#work"
              className="mb-12 inline-flex items-center gap-1 font-label text-label text-accent transition-colors duration-200 hover:text-accent-hover md:mb-16"
            >
              <ArrowLeft aria-hidden="true" size={14} strokeWidth={2.5} className="relative -top-px shrink-0" />
              {backLabel}
            </Link>
```
The gap is `gap-1`, the lab's 4px icon gap.
- [ ] **Step 4: Run them and confirm they pass.** `pnpm test`, then rebuild, restart on 3260 and run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: the back link"`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add lib/content.ts lib/content.test.ts "app/work/[slug]/page.tsx" e2e/label-face.spec.ts
git commit -m "Label face: the back link draws its arrow and reads Work" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Role lines below their titles

**Files:** Modify `app/work/[slug]/page.tsx` (64 to 71), `components/WorkModal.tsx` (128 to 135). Test: `e2e/label-face.spec.ts`, then rerun `e2e/flight.spec.ts`.

**Interfaces.** The dialog's accessible name is unchanged (`aria-label`). The title block stays at or under the 80px logo slot, so `[data-tile-slot="work"]` does not move.

- [ ] **Step 1: Write the failing test.**
```ts
test("label face: role lines sit under their titles, 14px on the case page and 6px in the modal", async ({ page, cdp }) => {
  const gap = (title: Locator) =>
    title.evaluate((h) => {
      const p = h.nextElementSibling as HTMLElement | null;
      return p?.tagName === "P" ? p.getBoundingClientRect().top - h.getBoundingClientRect().bottom : null;
    });
  await page.goto("/work/capital-one-pm");
  expect(await gap(page.locator("article h1"))).toBeCloseTo(14, 0);
  const dialog = await openWorkModal(page, cdp);
  expect(await gap(dialog.locator("h2"))).toBeCloseTo(6, 0);
  const fit = await dialog.locator("[data-tile-slot='work']").evaluate((slot) => ({
    block: slot.nextElementSibling!.getBoundingClientRect().height,
    slot: slot.getBoundingClientRect().height,
  }));
  expect(fit.block, "title block within the logo slot's height").toBeLessThanOrEqual(fit.slot);
});
```
- [ ] **Step 2: Run it and confirm it fails.** Run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: role lines"`. Expected: FAIL, because the h1's next sibling is null.
- [ ] **Step 3: Minimal implementation.** In `page.tsx`, lines 64 to 71:
```tsx
              <div className="flex flex-col gap-3.5">
                <h1 className="font-display text-display-page text-foreground">
                  {item.title}
                </h1>
                <p className="font-label text-label-lg leading-5 text-accent">
                  {item.role}, {item.year}
                </p>
              </div>
```
In `WorkModal.tsx`, lines 128 to 135:
```tsx
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-3xl leading-tight text-foreground md:text-4xl">
                  {item.title}
                </h2>
                <p className="font-label text-label text-accent">
                  {item.role}, {item.year}
                </p>
              </div>
```
- [ ] **Step 4: Run it and confirm it passes.** Rebuild and restart on 3260. Run `-g "label face: role lines"`, then `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/flight.spec.ts --project=chromium -g "work card"` in both schemes. Expected: PASS, with the swaps seamless.
- [ ] **Step 5: Commit.**
```bash
git add "app/work/[slug]/page.tsx" components/WorkModal.tsx e2e/label-face.spec.ts
git commit -m "Label face: role lines move under their titles on the case page and in the modal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Book rows wrap; a seen row dims its meta

**Files:** Modify `components/book/BookRow.tsx` (39 to 43, 97 to 118). Test: `e2e/label-face.spec.ts`, then rerun `e2e/modal.spec.ts` and `e2e/row-hold.spec.ts`.

- [ ] **Step 1: Write the failing test.** Add `import { SEEN_STORAGE_KEY } from "@/lib/home/seen";` to the imports.
```ts
const rowLayout = (page: Page) =>
  page.locator("#work .book-row").evaluateAll((rows) =>
    rows.map((row) => {
      const [title, meta] = [row.children[0], row.children[1]].map((el) => el.getBoundingClientRect());
      const box = row.getBoundingClientRect();
      const s = getComputedStyle(row);
      const inner = box.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      return {
        text: row.textContent,
        wrap: s.flexWrap,
        wrapped: meta.top >= title.bottom - 1,
        fits: title.width + 14 + meta.width <= inner + 0.5,
      };
    }),
  );

test("label face: a row's meta wraps under its title only when the two do not fit, and a seen row dims it to 0.75", async ({ page }) => {
  await page.addInitScript((key) => sessionStorage.setItem(key, JSON.stringify(["capital-one-pm"])), SEEN_STORAGE_KEY);
  for (const viewport of [{ width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await settled(page);
    for (const row of await rowLayout(page)) {
      expect(row.wrap).toBe("wrap");
      expect(row.wrapped, `${viewport.width}: ${row.text}`).toBe(!row.fits);
    }
  }
  const meta = page.locator("#work .book-row").getByText(siteContent.book.workRows.find((r) => r.key === "capital-one-pm")!.meta, { exact: true });
  await page.mouse.move(1, 1);
  await expect.poll(() => meta.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeCloseTo(0.75, 2);
  await meta.hover();
  await expect.poll(() => meta.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
});
```
- [ ] **Step 2: Run it and confirm it fails.** Run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: a row"`. Expected: FAIL with `wrap` reading "nowrap" (the row is a grid).
- [ ] **Step 3: Minimal implementation.** Lines 39 to 43:
```tsx
      <span className="flex max-w-full items-center">
        <span className={seen ? `${TITLE_CLASS} ${SEEN_TITLE_CLASS}` : TITLE_CLASS}>{entry.row.title}</span>
        {seen && <span aria-hidden="true" className={SEEN_RING_CLASS} />}
      </span>
      <span className={seen ? `${META_CLASS} ${SEEN_META_CLASS}` : META_CLASS}>{entry.row.meta}</span>
```
Then set:
```ts
// A wrapping flex row: the meta drops under its title only when the two do
// not fit side by side, and then starts at the row's left edge.
const ROW_BASE =
  "book-row flex min-h-[60px] w-full flex-wrap items-center justify-between gap-x-[14px] gap-y-1 py-[10px] text-left min-[720px]:min-h-[54px]";
const META_CLASS = "max-w-full font-label text-label text-accent transition-opacity duration-200";
```
In the fx-chrome comment, "the meta stays full muted" becomes "the meta dims to 0.75 (0.55 fails AA for small text)". Add:
```ts
const SEEN_META_CLASS = "opacity-75 [.book-row:focus-visible_&]:opacity-100 [.book-row:hover_&]:opacity-100";
```
`whitespace-nowrap` goes. A flex item breaks its line at its max-content width, so the meta still moves as a unit; at 390px a meta longer than its row now wraps inside instead of overflowing. The 360px whole-column fallback is not built. It waits for Fable's look.
- [ ] **Step 4: Run it and confirm it passes.** Rebuild and restart on 3260. Run `-g "label face: a row"`, then `e2e/modal.spec.ts` and `e2e/row-hold.spec.ts` with `E2E_BASE_URL=http://localhost:3260` and `--project=chromium`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add components/book/BookRow.tsx e2e/label-face.spec.ts
git commit -m "Label face: book rows wrap their meta when cramped; a seen row dims its meta to 0.75" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: The copy change

**Files:** Modify `lib/content.ts` (159). Test: `lib/content.test.ts` and `e2e/label-face.spec.ts`.

- [ ] **Step 1: Write the failing tests.** Append inside `describe("the book")`:
```ts
  it("keeps the ambassador meta short enough to sit beside its title", () => {
    expect(book.workRows.find((row) => row.key === "claude-ambassador")?.meta).toBe("Claude ambassador, 2025");
  });
```
And append to the e2e file:
```ts
test("label face: at 1440 every work row's meta sits beside its title", async ({ page }) => {
  await page.goto("/");
  await settled(page);
  for (const row of await rowLayout(page)) expect(row.wrapped, row.text ?? "").toBe(false);
});
```
- [ ] **Step 2: Run them and confirm they fail.** `pnpm test lib/content.test.ts` fails because it receives "Claude ambassador at UT Austin, 2025".
- [ ] **Step 3: Minimal implementation.** On line 159, `meta: "Claude ambassador at UT Austin, 2025"` becomes `meta: "Claude ambassador, 2025"`.
- [ ] **Step 4: Run them and confirm they pass.** `pnpm test`, then rebuild, restart on 3260 and run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/label-face.spec.ts --project=chromium -g "label face: at 1440"`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add lib/content.ts lib/content.test.ts e2e/label-face.spec.ts
git commit -m "Content: the ambassador row's meta reads Claude ambassador, 2025" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Contrast pass, snapshots and full verification

**Files:** Modify `e2e/a11y.spec.ts` (append) and `e2e/soundtrack.spec.ts-snapshots/band-still-chromium-darwin.png` (regenerated).

- [ ] **Step 1: Write the contrast test.** Append to `e2e/a11y.spec.ts`, adding `import { SEEN_STORAGE_KEY } from "@/lib/home/seen";` and `scrollToY` to the coil import:
```ts
for (const colorScheme of ["light", "dark"] as const) {
  test(`a11y: every label-face text on the page meets 4.5:1 in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.addInitScript((key) => sessionStorage.setItem(key, JSON.stringify(["capital-one-pm"])), SEEN_STORAGE_KEY);
    await openHome(page);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 600) await scrollToY(page, y);
    await page.waitForTimeout(1000);
    await page.mouse.move(1, 1);
    const report = await page.evaluate(() => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const probe = document.createElement("span");
      probe.style.color = "var(--color-background)";
      document.body.append(probe);
      const bg = parse(getComputedStyle(probe).color);
      probe.remove();
      const failures: string[] = [];
      let checked = 0;
      for (const el of document.querySelectorAll<HTMLElement>("main .font-label, footer .font-label")) {
        if (!el.getClientRects().length || el.closest("[inert]")) continue;
        let alpha = 1;
        for (let n: HTMLElement | null = el; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity);
        if (alpha < 0.5) continue; // a hidden layer
        const [r, g, b, a = 1] = parse(getComputedStyle(el).color);
        const fg = [r, g, b].map((v, i) => v * alpha * a + bg[i] * (1 - alpha * a));
        const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
        const ratio = (hi + 0.05) / (lo + 0.05);
        checked += 1;
        if (ratio < 4.5) failures.push(`${el.textContent?.trim().slice(0, 30)}: ${ratio.toFixed(2)}`);
      }
      return { checked, failures };
    });
    expect(report.checked, "label-face texts measured").toBeGreaterThan(15);
    expect(report.failures, "label-face texts under 4.5:1").toEqual([]);
  });
}
```
- [ ] **Step 2: Run it.** Serve the current build on 3260 and run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/a11y.spec.ts --project=chromium`. Expected: PASS in both themes. If it fails, a colour or opacity in an earlier task is wrong; fix that task's row, not the threshold.
- [ ] **Step 3: Regenerate `band-still`.** The wave avoids the band's wider text boxes, so its canvas pixels move. Run `E2E_BASE_URL=http://localhost:3260 pnpm test:e2e e2e/soundtrack.spec.ts --project=chromium -g "band: the still line" --update-snapshots`, then the same command without the flag. Expected: PASS. Open the new PNG beside the old one: the change must sit only around the text regions.
- [ ] **Step 4: Rerun the regression set, then the full run.** First, against 3260 with `E2E_BASE_URL=http://localhost:3260` and `--project=chromium`:
  - `e2e/soundtrack.spec.ts -g "footer:"` (Profa Bold is wider than Inter Medium; the capsule must still clear the copyright at 1440 and 1024)
  - `e2e/flight.spec.ts`
  - `e2e/modal.spec.ts`
  - `e2e/chrome.spec.ts`
  - `e2e/label-face.spec.ts`

  Then stop the 3260 server (only that PID). Confirm `lsof -iTCP:3140 -iTCP:3141 -sTCP:LISTEN` prints nothing, and run the whole suite with `CI=1 pnpm test:e2e`, which builds and serves both modes itself. Finish with `pnpm test && pnpm tsc --noEmit && pnpm lint`. Expected: all PASS.
- [ ] **Step 5: Commit.**
```bash
git add e2e/a11y.spec.ts e2e/soundtrack.spec.ts-snapshots/band-still-chromium-darwin.png
git commit -m "Tests: label-face contrast pass in both themes; band-still regenerated for the wider labels" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
- [ ] **Step 6: Draft the Layer 1 edit for Aaron (do not apply it).** AGENTS.md is gitignored and Layer 1 is his. Show him this as a unified diff. The Stack "Fonts" row becomes:

  > Profa Black, the display face site-wide, and Profa Bold, the label face, via `lib/fonts.ts` (`next/font/local`, `--font-display` and `--font-label`, `app/fonts/ProfaTrial-Black.ttf` and `app/fonts/ProfaTrial-Bold.ttf`, the only tracked font files; a `unicode-range` fallback covers the trial cuts' stamped glyphs until the full cut lands). Inter via `next/font/google` (`--font-sans`). Instrument Serif and Space Grotesk are retired.

  The Typography paragraph's first two sentences become:

  > Profa Black (display, upright only, `font-synthesis: none`), Profa Bold (labels: small non-body text, `font-label` at `text-label-sm`, `text-label`, `text-label-lg`; accent when clickable or attached to a title, muted otherwise; see `docs/label-face-spec.md`) and Inter (body). All three are exposed on `<html>` as `--font-display`, `--font-label` and `--font-sans`; Tailwind's `font-display` and `font-serif` both resolve to Profa Black.

- [ ] **Step 7: Hand off.** Push the branch and open the PR into `main`. The PR body ends with the Claude Code line and lists the five review-focus items above. Fable's look comes next: a local production build in both themes at 1440, 1024 and 390, served on 3260 for Aaron's preview. It should check the mixed wrapped and unwrapped book rows, the glass surfaces, and the nav's active state (now the dot alone). Merging is Aaron's call.

### Critical files for implementation
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/docs/label-face-spec.md
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/tailwind.config.ts
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/lib/fonts.ts
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/soundtrack/PlaybackPill.tsx
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/book/BookRow.tsx
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/e2e/soundtrack.spec.ts
- /Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-lab/app/lab/type/settings.ts (the `AARON_REVIEWED` preset the values come from)

## Notes for the caller (outside the plan)

- **All six edits are in:**
  1. The Task 9 grid row now reads old `className="grid"`, new `className="grid items-baseline"`.
  2. The preview port is 3260 everywhere.
  3. `inPair` is measured between the text ranges. I also measured `afterQuestion` text to text (the question's text right edge to "Play it"'s text left edge), because the `-mx-2` that `controls` adds would shift box-based measurements the same way.
  4. `.first()` is added to the pill label lookup in Task 6 and to the three capsule lookups in Task 8.
  5. Every intermediate run uses `E2E_BASE_URL=http://localhost:3260`. The full run uses `CI=1` after the `lsof` check, and the 3260 server is stopped first because the full run rebuilds the same `.next`.
  6. The worktree is cut from `origin/main` once `git branch -r --merged origin/main` shows `wave-band-only`. Review-focus item 5 is kept, reworded for that base.
- **Where I departed from the spec, and why:**
  - **Weight 700 in each size step.** The steps are in `fontSize`, not on the family, so the Inter fallback is bold too.
  - **`fontFeatureSettings: "normal"` on `font-label`.** This matches the lab and keeps Inter's alternates out of Profa.
  - **"Not now" is muted.** Section 5 of the spec lists it among the accent controls, but the values table and Aaron's ruling make it muted with the 40/55 percent underline. The plan follows the table.
  - **No `whitespace-nowrap` on book meta.** This prevents overflow at 390px and is otherwise the same as the lab's layout.
  - **Back link gap of 4px.** The spec doesn't give one; this is the lab's icon gap.
- **`components/DefinitionModal.tsx` is imported nowhere.** It is dead code and may be worth its own cleanup task.
