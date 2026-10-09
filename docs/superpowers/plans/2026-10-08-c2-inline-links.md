# C2 Inline Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the copy's `[words](def:key)`, `[words](tip:key)`, `[words](pop:key)` and `[words](https://...)` as real, reachable links: a definition opens the house text modal; a tip is one shared label that follows a mouse or anchors under a focused or tapped link; a photo pop is that label holding a small photo and caption; the matcha pop's `href` opens in a new tab.

**Architecture:** `InlineCopy` is a Server Component that parses a string once (`inlineRuns`, on top of C1's `parseInlineLinks`) and emits text, `<strong>`/`<em>`, and native `<button>`/`<a>` elements marked with `data-inline`; it attaches no handlers. One client `InlineLayer`, mounted once in `app/layout.tsx`, drives every link through delegated document listeners: one portalled label whose position is written straight to its transform in the pointer handler, the definition modal (WorkModal's shell and the `lib/modal.ts` hooks), and a hidden list of descriptions each tip and pop link points at with `aria-describedby`. Delegation is forced by the sections grammar (Decision 1).

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind 3.4 with CSS custom properties, Framer Motion 12 (modal only), vitest 4 (`lib/**/*.test.ts`, node, `renderToStaticMarkup`), Playwright 1.63 (Chromium, local production builds).

**Spec:** untracked hand-off files in the main checkout's `docs/content/`: `tooltips.md` (register, three kinds), `interactions-brief.md` section 1, `build-brief.md` ("GO" and "Updates after Aaron's second round": a pop may carry an `href`; on touch the first tap shows the pop with a visible "Open in Google Maps" link), `who-i-am.md` and `connect-footer-band.md` (which strings carry links). Builders cannot see them; everything needed is quoted here. Base code: branch `c1-content-model` (PR 40, head 96bc86d): `lib/content/{links,register,tracks,types}.ts`.

## Global Constraints
- No em dashes anywhere (code, comments, strings, commits, the PR body). Copy only through `siteContent` from `@/lib/content`; first person; sentence case.
- Tokens only: no hex in components or the new CSS; `bg-background/NN` alpha classes emit nothing (known issue), never use them.
- External links and the pop `href`: `target="_blank" rel="noopener noreferrer"`. Reduced motion: the label and the modal panel fade only, live.
- `InlineCopy` and the fixture page stay Server Components; only `components/inline/{InlineLayer,DefinitionModal,TipBubble}.tsx` and its two hooks are `"use client"`.
- Modal primitives only from `lib/modal.ts`; fixed overlays through `components/Portal.tsx`. No new dependency. Component files under 200 lines; `components/CustomCursor.tsx` (199 lines) is not edited.
- Branch `c2-inline-links` from `c1-content-model`; worktree `/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c2-inline-links`; preview port 3360; e2e always `CI=1 E2E_FULL_PORT=3202 E2E_HOLDING_PORT=3203` after `lsof -nP -iTCP:3202 -sTCP:LISTEN; lsof -nP -iTCP:3203 -sTCP:LISTEN` prints nothing. PR into `main` if PR 40 merged, else into `c1-content-model` (retarget after 40 merges).
- Stop only servers you started, by the PID written to a file in the session scratchpad (shell variables do not survive between Bash calls; `$TMPDIR` below means that scratchpad, so write its absolute path if your environment names one); never `pkill`, `killall`, a pattern or a port you did not open. Never `pnpm dev` and `pnpm build` in one checkout. Never `vercel deploy`, never push `main`.
- Do not edit `docs/`, `AGENTS.md`, card copy in `lib/content/cards.ts`, the recruiting files or the holding page.
- At least one commit per task, never squashed. Every commit is `git commit -m "<subject>" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`: the second `-m` makes the trailer its own paragraph, so git and GitHub read it (Sonnet builds, Opus reviews; Aaron's instruction).
- Shorthand used below: `E2E` means `CI=1 E2E_FULL_PORT=3202 E2E_HOLDING_PORT=3203 pnpm test:e2e`.

## Decisions (flagged for Aaron)
1. **Server markup plus one delegated client layer, not client leaves inside the copy.** `components/sections/Block.tsx` says a lines-split Block's children must be static text: SplitText (`autoSplit: true`) re-splits on resize and font load and its revert restores `innerHTML`, recreating every node in Who I am and Connect. A client leaf's handler would die after the first re-split. The links are native buttons and anchors with `data-inline` attributes; `InlineLayer` listens on the document. The line-by-line mask stays.
2. **One shared portalled label, never one per link** (ruling). Not built inside `CustomCursor` (the brief's suggestion; that file is at 199 lines), but wearing the "Open me" pill's look (accent fill, background ink, 13px Inter medium) beside the cursor ring, so it reads as one cursor system. Its position is a fixed offset (14px right, 18px down) written in the pointer handler; under a mouse it trails slightly (the brief's Figma name tag) through an 80ms transform transition, with no frame loop, and lands in place on its first show; reduced motion drops the trail.
3. **The pop photo size comes from `lib/photoSizes.ts`** (ruling): 280px wide, `sizes="280px"`, height from the file's aspect.
4. **The first definition is "product" in Who I am** (ruling). Until C5 lands that string the e2e uses a fixture string; the spec moves to the home by itself once a `siteContent.whoIAm` string carries `](def:product)`.
5. **No new dependency** (ruling).
6. **A test-only route, which needs Aaron's OK:** `/fixtures/inline?copy=...` renders each `copy` through a lines-split body Block, only while the server runs with `E2E_FIXTURES=1` (Playwright's full server); elsewhere, production included, a 404, `noindex`, not in the sitemap. AGENTS.md Layer 1 says `/work/[slug]` and `/recruiting` are the only other routes, and only Aaron edits Layer 1, so the PR asks him to amend that sentence. If he declines, the route is deleted and the same cases run against the home page's real copy once C5 lands it.
7. **A pop whose photo has not landed (all nine until C4) shows its caption, or its alt when it has none**, so a dotted link never opens onto nothing.
8. **Touch:** a tap is any non-mouse pointer (finger or pen), judged by its own pointerdown on that link. The first tap pins the label under the link; a tap elsewhere or Escape lets it go; a second tap on a pinned tip closes it, and a second tap on a pinned pop anchor (the matcha) follows its `href` natively. A pop's `href` link shows inside the label only when a tap pinned it; a mouse click, Enter, or a click with no pointerdown of its own (assistive tech, such as VoiceOver's activation) follows the `href` natively.
9. **C1 type extension:** `PopEntry.hrefLabel?: string`; the matcha's is "Open in Google Maps" (the brief's words); a test pins a label on every `href`.
10. **New string:** `siteContent.inline.symbolLabel: "Footnote"`, the accessible name of a link whose words are only a symbol (Connect's `[*](tip:killer-drones)`); its description is still the tip. Its visible text is "*", so this is a WCAG 2.5.3 (label in name) edge case: a voice user may say "click star". "Footnote" is right for screen readers; Aaron's call.
11. **External links** get a solid underline in `--color-muted` (the brief is silent).
12. **Z scale:** the label sits at 58, above modals (50) and the flight (55) so tips work in card modals (C3) and the mark card, below the loader (60) and cursor (100). Escape hides a shown label before the modal under it (the escape stack).
13. **A link never wraps** (`white-space: nowrap`), so SplitText never slices it into two buttons. Vertically its ring fits the masked line (a button's box is `line-height: 1.15`; an inline anchor rings its font's content area, about 1.21em in Inter). SplitText's mask clips both axes, so a mask that holds a link clips only vertically (`.sections-line-mask:has(.inline-link) { overflow-x: visible !important; }`; the reveal rises on y only), and a link at a line's start or end keeps its whole ring.
14. **No layoutId bloom** (commit f6608f2's word-to-title effect): the word sits in a masked SplitText line. The modal rises and fades like WorkModal; reduced motion fades.
15. **For C3 (build brief ask 4):** a link cannot sit inside a book row's button (nested interactive content); C3 renders the IEEE meta with `visibleText` and keeps the AO tip in the modal.
16. **Wiring lands now:** Who I am, Connect's lede, the band's two notes and the mark card's lines render through `InlineCopy` today, so C5's copy brings its links without more wiring.

### Calls Aaron has not made (one line each in the PR body under "For Aaron", so he can veto)
- The label trails a mouse through an 80ms transform transition (his Figma name tag, interactions-brief.md section 1); built, and one CSS rule turns it off (Decision 2).
- The label wears the "Open me" pill's look instead of being built inside `CustomCursor` (Decision 2).
- No layoutId bloom from the word into the modal (Decision 14).
- Touch beyond his approved first tap: a second tap closes a tip and follows a pop's `href`; a pen counts as a tap (Decision 8).
- A pop with no photo yet shows its caption, or its alt as visible words, until C4 (Decision 7).
- The new string "Footnote", and its label-in-name edge case (Decision 10).
- A solid muted underline on external links (Decision 11).
- Five components wired to `InlineCopy` before any of their strings carries a link (Decision 16).
- Escape hides a shown label before the modal under it, so a hovered tip in a card modal costs one extra Escape (Decision 12).
- The env-gated test route against Layer 1's route list (Decision 6).
- The pop caption in the label face (`font-label text-label-sm text-muted`, docs/label-face-spec.md section 2) instead of Inter.

## Review Focus
1. A link's own asterisk (`[*](tip:killer-drones)`) beside real emphasis in one string must not pair with it. Test: Task 1.
2. SplitText re-splits after hydration; links must keep working because nothing is bound to their nodes. Tests: Tasks 5 and 6 run on a lines-split Block.
3. A focused link inside a masked line shows its whole focus ring, mid-line and at a line's start. Test: Task 7.
4. A pop with no photo yet still shows words. Tests: Tasks 2 and 5.
5. A definition closed after SplitText rebuilt its line still returns focus to the product link (refocus by key). Test: Task 6.

## File Structure

| Files | Responsibility |
|---|---|
| `lib/content/links.ts`, `types.ts`, `register.ts`, `lib/content.ts`, `lib/photoSizes.ts` (modify) | `inlineRuns` and the fixed `visibleText`; `hrefLabel`; `siteContent.inline`; pop photo size |
| `lib/inline/{attrs,view,placement,tipState}.ts` | A run to its element; what the label shows; geometry; who shows it (all pure) |
| `components/inline/InlineCopy.tsx` | Server: a string to React |
| `components/inline/{useTipController.ts,TipBubble.tsx,useDefinition.ts,DefinitionModal.tsx,InlineLayer.tsx}` | The delegated layer: one label, the text modal, hidden descriptions |
| `app/layout.tsx`, `app/page.tsx`, `app/fixtures/inline/page.tsx`, `playwright.config.ts`, `app/globals.css` | Mount; the z-scale comment; env-gated e2e surface; `E2E_FIXTURES`; underline tokens |
| `components/{WhoIAm,Connect}.tsx`, `soundtrack/BandInvite.tsx`, `mark/MarkCard.tsx` | Render their strings through `InlineCopy` |
| `e2e/inline-links.spec.ts`, `e2e/inline-links-touch.spec.ts`, `e2e/support/inline.ts`; `e2e/{sections,soundtrack}.spec.ts` | The suite (touch in the touch project) and its helpers; compare visible words |

---

### Task 0: Worktree and baseline
- [ ] **Step 1:** Create the worktree (use `origin/main` instead if `gh pr view 40 --json state -q .state` prints `MERGED`):
```bash
cd "/Users/asulbaran21/Personal Projects/aaron-portfolio-website" && git fetch origin
git worktree add -b c2-inline-links "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c2-inline-links" origin/c1-content-model
cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c2-inline-links" && pnpm install --frozen-lockfile
```
- [ ] **Step 2:** Baseline: `pnpm test` (79 files, 672 passed), `pnpm tsc --noEmit` (silent), `pnpm lint` (0 errors). Record for the PR body.

---

### Task 1: Emphasis-aware runs and the `visibleText` fix
**Files:** Modify `lib/content/links.ts`, `lib/content/links.test.ts`.

**Interfaces:** Consumes `parseInlineLinks`, `InlineSegment`, `KnownKey` (C1). Produces `type InlineRun = InlineSegment & { strong: boolean; em: boolean }`, `inlineRuns(source: string, known: KnownKey): InlineRun[]`, `visibleText(source: string): string` (same signature, fixed).

The defect: `visibleText` strips links first, so `building[*](tip:killer-drones). I *know* it` becomes `building*. I *know* it`, and the italic pattern pairs the footnote's asterisk with the one before "know": `building. I know* it`. The fix keeps each link one opaque cell while asterisks pair.
- [ ] **Step 1: Failing tests** (append to `lib/content/links.test.ts`; add `inlineRuns` to its import)
```ts
const t = (text: string, strong = false, em = false) => ({ kind: "text", text, strong, em });
describe("inlineRuns", () => {
  it("carries bold and italic as flags and drops the markers", () => { expect(inlineRuns("**2024, business analyst.** My first look, I *know* it.", known)).toEqual([t("2024, business analyst.", true), t(" My first look, I "), t("know", false, true), t(" it.")]); });
  it("keeps a link whole and lets emphasis wrap it", () => { expect(inlineRuns("*see [Rango](tip:aango) now*", known)).toEqual([t("see ", false, true), { kind: "tip", text: "Rango", key: "aango", strong: false, em: true }, t(" now", false, true)]); });
  it("never pairs a link's asterisk with a marker in the text", () => { expect(inlineRuns("building[*](tip:aango). I *know* it", known)).toEqual([t("building"), { kind: "tip", text: "*", key: "aango", strong: false, em: false }, t(". I "), t("know", false, true), t(" it")]); });
  it("returns nothing for an empty string and keeps an unknown link as its words", () => {
    expect(inlineRuns("", known)).toEqual([]);
    expect(inlineRuns("a [Rango](tip:rango) knockoff", known)).toEqual([t("a Rango knockoff")]);
  });
});
describe("visibleText and the footnote", () => {
  it("never pairs a link's asterisk with emphasis", () => { expect(visibleText("no matter what you're building[*](tip:killer-drones). I *know* it")).toBe("no matter what you're building*. I know it"); });
  it("reads the approved Connect body as a visitor sees it", () => {
    const body = "I check everything (or Talos does) so take your pick. If you want to talk screen to screen, [grab a time on my calendar](https://cal.com/aaron-sulbaran). If you're in my city, let's grab a coffee ([or matcha](pop:matcha)). I take coffee chats with anyone, no matter what you're building[*](tip:killer-drones).";
    expect(visibleText(body)).toBe("I check everything (or Talos does) so take your pick. If you want to talk screen to screen, grab a time on my calendar. If you're in my city, let's grab a coffee (or matcha). I take coffee chats with anyone, no matter what you're building*.");
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/content/links.test.ts`. Expected FAIL: `inlineRuns` not exported; the footnote test receives `...building. I know* it`.
- [ ] **Step 3: Implement.** In `lib/content/links.ts`, replace the `visibleText` function and its comment (the end of the file) with:
```ts
// A run is a segment with the emphasis around it. While asterisks pair, a
// link is one opaque cell, so a link whose words are an asterisk (Connect's
// footnote, [*](tip:killer-drones)) never pairs with a marker in the text.
export type InlineRun = InlineSegment & { strong: boolean; em: boolean };
interface Cell { char: string; link: InlineSegment | null; strong: boolean; em: boolean }
const ATOM = "\uE000";
const BOLD = /\*\*(?=\S)(.+?)\*\*/g;
const ITALIC = /\*(?=\S)([^*]+?)\*/g;
const anyKey: KnownKey = () => true;
function pairMarkers(cells: Cell[], pattern: RegExp, width: number, flag: "strong" | "em"): Cell[] {
  const line = cells.map((cell) => cell.char).join("");
  const dropped = new Set<number>();
  for (const match of line.matchAll(pattern)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    for (let i = 0; i < width; i++) dropped.add(start + i).add(end - 1 - i);
    for (let i = start + width; i < end - width; i++) cells[i] = flag === "strong" ? { ...cells[i], strong: true } : { ...cells[i], em: true };
  }
  return cells.filter((_, i) => !dropped.has(i));
}
export function inlineRuns(source: string, known: KnownKey): InlineRun[] {
  let cells: Cell[] = [];
  for (const segment of parseInlineLinks(source, known).segments) {
    if (segment.kind !== "text") cells.push({ char: ATOM, link: segment, strong: false, em: false });
    else for (const char of segment.text.split("")) cells.push({ char, link: null, strong: false, em: false });
  }
  cells = pairMarkers(cells, BOLD, 2, "strong");
  cells = pairMarkers(cells, ITALIC, 1, "em");
  const runs: InlineRun[] = [];
  for (const { char, link, strong, em } of cells) {
    const last = runs[runs.length - 1];
    if (link) runs.push({ ...link, strong, em });
    else if (last && last.kind === "text" && last.strong === strong && last.em === em) last.text += char;
    else runs.push({ kind: "text", text: char, strong, em });
  }
  return runs;
}
// The words a reader sees: links as their words, paired ** and * removed; a
// lone * stays, and a link's own asterisk never pairs.
export function visibleText(source: string): string {
  return inlineRuns(source, anyKey).map((run) => run.text).join("");
}
```
`split("")` splits by UTF-16 code units on purpose, so cells line up with regex indices.
- [ ] **Step 4:** `pnpm vitest run lib/content/links.test.ts && pnpm test`. Expected PASS, C1's `visibleText` and `plainText` tests included.
- [ ] **Step 5:** Commit:
```bash
git add lib/content/links.ts lib/content/links.test.ts
git commit -m "Inline links: emphasis-aware runs, and a link's asterisk never pairs with emphasis" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The element map, the label's view, the pop's link label
**Files:** Modify `lib/content/types.ts`, `lib/content/register.ts`, `lib/content/register.test.ts`, `lib/content.ts`, `lib/photoSizes.ts`. Create `lib/inline/attrs.ts`, `lib/inline/attrs.test.ts`, `lib/inline/view.ts`, `lib/inline/view.test.ts`.

**Interfaces:** Consumes `InlineRun`, `inlineRuns`, `visibleText` (Task 1); `registerHas`, `tipText(key): string | null` (`@/lib/content/tracks`), `walkStrings` (`@/lib/testing/walk`) from C1. Produces:
- `type TipKind = "tip" | "pop"`; `descriptionId(kind, key)` returns `inline-desc-${kind}-${key}`; `inlineLinkElement(run: InlineRun): { tag: "a" | "button"; props: InlineLinkProps } | null`.
- `PopPhoto { src; width; height; alt; displayWidth; displayHeight }`; `TipView { text: string | null; photo: PopPhoto | null; caption: string | null; link: { href: string; label: string } | null; description: string }`; `popView(entry: PopEntry): TipView`; `tipView(kind: TipKind, key: string): TipView | null`.
- `POP_PHOTO_WIDTH = 280`, `POP_PHOTO_SIZES = "280px"`; `siteContent.inline.symbolLabel` is `"Footnote"`.
- [ ] **Step 1: Failing tests.** Append inside `lib/content/register.test.ts`'s `describe`:
```ts
  it("labels every pop link for the touch label", () => {
    for (const [key, entry] of Object.entries(register.pop)) if (entry.href) expect(entry.hrefLabel, key).toBeTruthy();
    expect(register.pop.matcha.hrefLabel).toBe("Open in Google Maps");
  });
```
Create `lib/inline/attrs.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { inlineRuns, visibleText, type InlineRun } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { inlineLinkElement } from "@/lib/inline/attrs";
import { walkStrings } from "@/lib/testing/walk";
const linkRun = (source: string) => inlineRuns(source, registerHas).find((run) => run.kind !== "text") as InlineRun;
const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" };
describe("inlineLinkElement", () => {
  it("makes a definition a button that opens a dialog", () => { expect(inlineLinkElement(linkRun("[product](def:product)"))).toEqual({ tag: "button", props: { className: "inline-link", "data-inline": "def", "data-inline-key": "product", type: "button", "aria-haspopup": "dialog" } }); });
  it("makes a tip a button described by its hidden words", () => { expect(inlineLinkElement(linkRun("a [Rango](tip:aango) knockoff"))).toEqual({ tag: "button", props: { className: "inline-link", "data-inline": "tip", "data-inline-key": "aango", "aria-describedby": "inline-desc-tip-aango", type: "button" } }); });
  it("makes a pop with an href a new-tab anchor, and one without a button", () => {
    expect(inlineLinkElement(linkRun("([or matcha](pop:matcha))"))).toEqual({ tag: "a", props: { className: "inline-link", "data-inline": "pop", "data-inline-key": "matcha", "aria-describedby": "inline-desc-pop-matcha", href: siteContent.register.pop.matcha.href, ...NEW_TAB } });
    expect(inlineLinkElement(linkRun("[bass clarinet](pop:contrabass-clarinet)"))?.tag).toBe("button");
  });
  it("makes an https link a new-tab anchor", () => { expect(inlineLinkElement(linkRun("[grab a time on my calendar](https://cal.com/aaron-sulbaran)"))).toEqual({ tag: "a", props: { className: "inline-link", "data-inline": "external", href: "https://cal.com/aaron-sulbaran", ...NEW_TAB } }); });
  it("names a link whose words are only a symbol, and no other", () => {
    expect(siteContent.inline.symbolLabel).toBe("Footnote");
    expect(inlineLinkElement(linkRun("building[*](tip:killer-drones)."))?.props["aria-label"]).toBe("Footnote");
    expect(inlineLinkElement(linkRun("[Rango](tip:aango)"))?.props["aria-label"]).toBeUndefined();
  });
  it("returns null for text", () => { expect(inlineLinkElement({ kind: "text", text: "plain", strong: false, em: false })).toBeNull(); });
});
describe("every string in siteContent", () => {
  it("renders exactly its visible words", () => { for (const leaf of walkStrings(siteContent)) expect(inlineRuns(leaf.text, registerHas).map((run) => run.text).join(""), leaf.path).toBe(visibleText(leaf.text)); });
});
```
(C1's `lib/content/sweep.test.ts` already fails on any unknown key anywhere in `siteContent`; it stays the "no unknown keys" test.)
Create `lib/inline/view.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import { POP_PHOTO_SIZES } from "@/lib/photoSizes";
import { popView, tipView } from "@/lib/inline/view";
const { pop } = siteContent.register;
describe("tipView", () => {
  it("shows a tip's words, and the music note as tipText gives it", () => {
    const aango = "yes, the chameleon from that one kid's movie";
    expect(tipView("tip", "aango")).toEqual({ text: aango, photo: null, caption: null, link: null, description: aango });
    expect(tipView("tip", "music-note")?.text).toBe(tipText("music-note"));
  });
  it("returns null for a key the register lacks, prototype keys included", () => {
    expect(tipView("tip", "rango")).toBeNull();
    expect(tipView("pop", "constructor")).toBeNull();
  });
  it("shows a pop's caption, or its alt, until its photo lands, and is described by both", () => {
    const clarinet = pop["contrabass-clarinet"];
    expect(tipView("pop", "contrabass-clarinet")).toMatchObject({ text: null, photo: null, caption: clarinet.caption, description: `${clarinet.alt}. ${clarinet.caption}` });
    expect(tipView("pop", "sandboarding")).toMatchObject({ text: pop.sandboarding.alt, caption: null, description: pop.sandboarding.alt });
  });
  it("carries the matcha's Maps link and label", () => { expect(tipView("pop", "matcha")?.link).toEqual({ href: pop.matcha.href, label: "Open in Google Maps" }); });
});
describe("popView", () => {
  it("sizes a landed photo 280px wide at its own aspect", () => {
    const view = popView({ file: { src: "/inline/x.jpg", width: 800, height: 600 }, alt: "Me", caption: null, crop: null });
    expect(view.photo).toEqual({ src: "/inline/x.jpg", width: 800, height: 600, alt: "Me", displayWidth: 280, displayHeight: 210 });
    expect(view.text).toBeNull();
    expect(POP_PHOTO_SIZES).toBe("280px");
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/inline lib/content/register.test.ts`. Expected FAIL: modules missing, `hrefLabel` undefined.
- [ ] **Step 3: Implement.** In `lib/content/types.ts`, inside `PopEntry` after `href?: string;`:
```ts
  // The words of the link inside a tap-pinned pop (touch only).
  hrefLabel?: string;
```
In `lib/content/register.ts`, in the `matcha` entry after its `href` line: `hrefLabel: "Open in Google Maps",`
In `lib/content.ts`, after `register,` inside `siteContent`:
```ts
  // The inline links' own words (components/inline).
  inline: {
    // The accessible name of a link whose words are only a symbol (Connect's footnote).
    symbolLabel: "Footnote",
  },
```
Append to `lib/photoSizes.ts`:
```ts
// A photo pop (components/inline/TipBubble) shows its photo about 280px wide
// (docs/content/tooltips.md); its export caps the long edge at 800px.
export const POP_PHOTO_WIDTH = 280;
export const POP_PHOTO_SIZES = `${POP_PHOTO_WIDTH}px`;
```
Create `lib/inline/attrs.ts`:
```ts
import { siteContent } from "@/lib/content";
import type { InlineRun } from "@/lib/content/links";
export type TipKind = "tip" | "pop";
// The hidden element (components/inline/InlineLayer) whose words describe a
// tip or pop link through aria-describedby.
export const descriptionId = (kind: TipKind, key: string): string => `inline-desc-${kind}-${key}`;
export interface InlineLinkProps {
  className: "inline-link"; "data-inline": "def" | "tip" | "pop" | "external"; "data-inline-key"?: string;
  type?: "button"; href?: string; target?: "_blank"; rel?: "noopener noreferrer";
  "aria-haspopup"?: "dialog"; "aria-describedby"?: string; "aria-label"?: string;
}
export interface InlineLinkElement { tag: "a" | "button"; props: InlineLinkProps }
const NO_WORDS = /^[^\p{L}\p{N}]+$/u;
// What a link run renders as: native elements only, marked for the delegated
// layer. A pop with an href is an anchor, so a click and Enter follow it.
export function inlineLinkElement(run: InlineRun): InlineLinkElement | null {
  if (run.kind === "text") return null;
  const named: Pick<InlineLinkProps, "aria-label"> = NO_WORDS.test(run.text) ? { "aria-label": siteContent.inline.symbolLabel } : {};
  if (run.kind === "external") {
    return { tag: "a", props: { className: "inline-link", "data-inline": "external", href: run.href, target: "_blank", rel: "noopener noreferrer", ...named } };
  }
  const base: InlineLinkProps = { className: "inline-link", "data-inline": run.kind, "data-inline-key": run.key, ...named };
  if (run.kind === "def") return { tag: "button", props: { ...base, type: "button", "aria-haspopup": "dialog" } };
  const described: InlineLinkProps = { ...base, "aria-describedby": descriptionId(run.kind, run.key) };
  const href = run.kind === "pop" ? siteContent.register.pop[run.key]?.href : undefined;
  if (href) return { tag: "a", props: { ...described, href, target: "_blank", rel: "noopener noreferrer" } };
  return { tag: "button", props: { ...described, type: "button" } };
}
```
Create `lib/inline/view.ts`:
```ts
import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import type { PopEntry } from "@/lib/content/types";
import { POP_PHOTO_WIDTH } from "@/lib/photoSizes";
import type { TipKind } from "./attrs";
export interface PopPhoto { src: string; width: number; height: number; alt: string; displayWidth: number; displayHeight: number }
export interface TipView { text: string | null; photo: PopPhoto | null; caption: string | null; link: { href: string; label: string } | null; description: string }
// A pop whose photo has not landed (C4) shows its caption, or its alt when it
// has none, so a dotted link never opens onto nothing.
export function popView(entry: PopEntry): TipView {
  const photo = entry.file
    ? { ...entry.file, alt: entry.alt, displayWidth: POP_PHOTO_WIDTH, displayHeight: Math.round((POP_PHOTO_WIDTH * entry.file.height) / entry.file.width) }
    : null;
  return {
    text: photo || entry.caption ? null : entry.alt,
    photo,
    caption: entry.caption,
    link: entry.href ? { href: entry.href, label: entry.hrefLabel ?? entry.href } : null,
    description: [entry.alt, entry.caption].filter(Boolean).join(". "),
  };
}
export function tipView(kind: TipKind, key: string): TipView | null {
  if (kind === "tip") {
    const text = tipText(key);
    return text === null ? null : { text, photo: null, caption: null, link: null, description: text };
  }
  return Object.hasOwn(siteContent.register.pop, key) ? popView(siteContent.register.pop[key]) : null;
}
```
- [ ] **Step 4:** `pnpm vitest run lib/inline lib/content && pnpm test && pnpm tsc --noEmit`. Expected PASS, tsc silent.
- [ ] **Step 5:** Commit: `git add lib/content/types.ts lib/content/register.ts lib/content/register.test.ts lib/content.ts lib/photoSizes.ts lib/inline && git commit -m "Inline links: the element each link renders as, what the label shows, and the matcha's Maps label" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.

---

### Task 3: Placement and the label's state, pure
**Files:** Create `lib/inline/placement.ts`, `lib/inline/placement.test.ts`, `lib/inline/tipState.ts`, `lib/inline/tipState.test.ts`.

**Interfaces:** Produces `Point`, `Size`, `Rect`, `TIP_GEOMETRY = { offsetX: 14, offsetY: 18, gap: 8, margin: 12 }`, `followPosition(pointer, size, view): Point`, `anchorPosition(link: Rect, size, view): Point`; `TipTarget { kind: "tip" | "pop"; key }`, `TipVia = "hover" | "focus" | "tap"`, `TipState { target; via }`, `TipEvent`, `TIP_IDLE`, `sameTarget`, `tipReducer`, `tipMode(state): "follow" | "anchor" | null`.
- [ ] **Step 1: Failing tests.** `lib/inline/placement.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { anchorPosition, followPosition } from "@/lib/inline/placement";
const view = { width: 1440, height: 900 };
const size = { width: 120, height: 30 };
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
describe("followPosition", () => {
  it("sits below and right of the pointer, flips at the edges, and clamps", () => {
    expect(followPosition({ x: 100, y: 100 }, size, view)).toEqual({ x: 114, y: 118 });
    expect(followPosition({ x: 1400, y: 100 }, size, view)).toEqual({ x: 1266, y: 118 });
    expect(followPosition({ x: 100, y: 880 }, size, view)).toEqual({ x: 114, y: 832 });
    expect(followPosition({ x: 100, y: 100 }, { width: 2000, height: 30 }, view).x).toBe(12);
  });
});
describe("anchorPosition", () => {
  it("centres under the link, flips above near the bottom, and clamps", () => {
    expect(anchorPosition(rect(200, 300, 60, 30), size, view)).toEqual({ x: 170, y: 338 });
    expect(anchorPosition(rect(200, 850, 60, 30), size, view)).toEqual({ x: 170, y: 812 });
    expect(anchorPosition(rect(0, 300, 20, 30), size, view).x).toBe(12);
  });
});
```
`lib/inline/tipState.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { TIP_IDLE, tipMode, tipReducer, type TipEvent, type TipState } from "@/lib/inline/tipState";
const rango = { kind: "tip" as const, key: "aango" };
const matcha = { kind: "pop" as const, key: "matcha" };
const run = (...events: TipEvent[]) => events.reduce<TipState>(tipReducer, TIP_IDLE);
describe("tipReducer", () => {
  it("shows on hover, follows, and leaves with the pointer", () => {
    expect(run({ type: "hover", target: rango })).toEqual({ target: rango, via: "hover" });
    expect(tipMode(run({ type: "hover", target: rango }))).toBe("follow");
    expect(run({ type: "hover", target: rango }, { type: "unhover" })).toEqual(TIP_IDLE);
  });
  it("anchors on focus, keeps it under a passing mouse, hides on blur", () => {
    expect(tipMode(run({ type: "focus", target: rango }))).toBe("anchor");
    expect(run({ type: "focus", target: rango }, { type: "hover", target: rango }, { type: "unhover" })).toEqual({ target: rango, via: "focus" });
    expect(run({ type: "focus", target: rango }, { type: "blur" })).toEqual(TIP_IDLE);
  });
  it("toggles on a keyboard press", () => {
    expect(run({ type: "focus", target: rango }, { type: "press", target: rango })).toEqual(TIP_IDLE);
    expect(run({ type: "focus", target: rango }, { type: "dismiss" }, { type: "press", target: rango })).toEqual({ target: rango, via: "focus" });
  });
  it("pins on a tap until a second tap, moves to another tapped link, ignores hover and blur", () => {
    expect(run({ type: "tap", target: matcha }, { type: "tap", target: matcha })).toEqual(TIP_IDLE);
    expect(run({ type: "tap", target: matcha }, { type: "tap", target: rango })).toEqual({ target: rango, via: "tap" });
    expect(run({ type: "tap", target: matcha }, { type: "hover", target: rango }, { type: "blur" })).toEqual({ target: matcha, via: "tap" });
  });
  it("lets anything go on dismiss and keeps the same idle object", () => {
    expect(run({ type: "tap", target: matcha }, { type: "dismiss" })).toEqual(TIP_IDLE);
    expect(tipReducer(TIP_IDLE, { type: "dismiss" })).toBe(TIP_IDLE);
    expect(tipMode(TIP_IDLE)).toBeNull();
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/inline/placement.test.ts lib/inline/tipState.test.ts`. Expected FAIL: modules missing.
- [ ] **Step 3: Implement.** `lib/inline/placement.ts`:
```ts
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }
// The shared label's geometry (components/inline/TipBubble): beside a mouse
// pointer like a multiplayer name tag, or centred under a focused or tapped
// link; flipped near a viewport edge and clamped inside the margin.
export const TIP_GEOMETRY = { offsetX: 14, offsetY: 18, gap: 8, margin: 12 } as const;
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high));
export function followPosition(pointer: Point, size: Size, view: Size, g = TIP_GEOMETRY): Point {
  const right = pointer.x + g.offsetX;
  const below = pointer.y + g.offsetY;
  const x = right + size.width > view.width - g.margin ? pointer.x - g.offsetX - size.width : right;
  const y = below + size.height > view.height - g.margin ? pointer.y - g.offsetY - size.height : below;
  return { x: clamp(x, g.margin, view.width - g.margin - size.width), y: clamp(y, g.margin, view.height - g.margin - size.height) };
}
export function anchorPosition(link: Rect, size: Size, view: Size, g = TIP_GEOMETRY): Point {
  const below = link.bottom + g.gap;
  const y = below + size.height > view.height - g.margin ? link.top - g.gap - size.height : below;
  const x = link.left + link.width / 2 - size.width / 2;
  return { x: clamp(x, g.margin, view.width - g.margin - size.width), y: Math.max(g.margin, y) };
}
```
`lib/inline/tipState.ts`:
```ts
export interface TipTarget { kind: "tip" | "pop"; key: string }
export type TipVia = "hover" | "focus" | "tap";
export interface TipState { target: TipTarget | null; via: TipVia | null }
export type TipEvent =
  | { type: "hover" | "focus" | "press" | "tap"; target: TipTarget }
  | { type: "unhover" | "blur" | "dismiss" };
export const TIP_IDLE: TipState = { target: null, via: null };
export const sameTarget = (a: TipTarget | null, b: TipTarget | null): boolean => !!a && !!b && a.kind === b.kind && a.key === b.key;
// Who shows the shared label. A tap pins it until a second tap on the same
// link, a tap elsewhere or Escape; keyboard focus anchors it under the link
// (Enter toggles it); a mouse shows it while the pointer is on the link.
export function tipReducer(state: TipState, event: TipEvent): TipState {
  switch (event.type) {
    case "hover": return state.via === "tap" || (state.via === "focus" && sameTarget(state.target, event.target)) ? state : { target: event.target, via: "hover" };
    case "unhover": return state.via === "hover" ? TIP_IDLE : state;
    case "focus": return state.via === "tap" && sameTarget(state.target, event.target) ? state : { target: event.target, via: "focus" };
    case "blur": return state.via === "focus" ? TIP_IDLE : state;
    case "press": return sameTarget(state.target, event.target) && state.via !== "hover" ? TIP_IDLE : { target: event.target, via: "focus" };
    case "tap": return state.via === "tap" && sameTarget(state.target, event.target) ? TIP_IDLE : { target: event.target, via: "tap" };
    case "dismiss": return state.target ? TIP_IDLE : state;
  }
}
export function tipMode(state: TipState): "follow" | "anchor" | null {
  return state.target ? (state.via === "hover" ? "follow" : "anchor") : null;
}
```
- [ ] **Step 4:** `pnpm vitest run lib/inline && pnpm tsc --noEmit`. Expected PASS.
- [ ] **Step 5:** Commit: `git add lib/inline/placement.ts lib/inline/placement.test.ts lib/inline/tipState.ts lib/inline/tipState.test.ts && git commit -m "Inline links: the label's placement and who shows it, pure" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.

---

### Task 4: `InlineCopy` and the underline tokens
**Files:** Create `components/inline/InlineCopy.tsx`, `lib/inline/render.test.ts`. Modify `app/globals.css` (append).

**Interfaces:** Consumes `inlineRuns`, `registerHas`, `inlineLinkElement`. Produces `InlineCopy({ source }: { source: string })` (Server Component, also usable inside client components); CSS `.inline-link` with `[data-inline]` variants and `.inline-tip` with `[data-shown="true"]`.
- [ ] **Step 1: Failing test** (`lib/inline/render.test.ts`; no apostrophes in fixtures, React escapes them):
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InlineCopy } from "@/components/inline/InlineCopy";
const html = (source: string) => renderToStaticMarkup(createElement(InlineCopy, { source }));
describe("InlineCopy", () => {
  it("renders plain copy as its text and nothing else", () => { expect(html("I spent three summers at Capital One.")).toBe("I spent three summers at Capital One."); });
  it("renders a definition as a dialog button inside the sentence", () => { expect(html("I am a [product](def:product)-focused engineer.")).toMatch(/^I am a <button [^>]*data-inline="def" data-inline-key="product"[^>]*aria-haspopup="dialog">product<\/button>-focused engineer\.$/); });
  it("wraps emphasis around text and links", () => {
    const out = html("**Bold** and *a [Rango](tip:aango) knockoff*");
    expect(out).toContain("<strong>Bold</strong> and ");
    expect(out).toMatch(/<em>a <\/em><em><button [^>]*data-inline="tip"[^>]*>Rango<\/button><\/em><em> knockoff<\/em>$/);
  });
  it("renders an https link and the matcha pop as new-tab anchors", () => {
    expect(html("[grab a time on my calendar](https://cal.com/aaron-sulbaran)")).toMatch(/^<a [^>]*href="https:\/\/cal.com\/aaron-sulbaran" target="_blank" rel="noopener noreferrer"[^>]*>grab a time on my calendar<\/a>$/);
    expect(html("([or matcha](pop:matcha))")).toMatch(/^\(<a [^>]*data-inline="pop"[^>]*target="_blank" rel="noopener noreferrer"[^>]*>or matcha<\/a>\)$/);
  });
  it("renders an unknown key or a bad target as plain words and never throws", () => {
    expect(html("a [Rango](tip:rango) knockoff")).toBe("a Rango knockoff");
    expect(html("[x](javascript:alert(1))")).toBe("[x](javascript:alert(1))");
  });
});
describe("the inline link tokens", () => {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const block = css.slice(css.indexOf("/* ---- inline links"), css.indexOf("/* ---- end inline links ---- */"));
  it("draws solid definitions and dotted tips from tokens, with no hex, keeps a ring out of the mask, and fades under reduced motion", () => {
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/\.inline-link\[data-inline="def"\] \{ text-decoration-style: solid; \}/);
    expect(block).toMatch(/\.inline-link\[data-inline="tip"\], \.inline-link\[data-inline="pop"\] \{ text-decoration-style: dotted; \}/);
    expect(block).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(block).toContain(".sections-line-mask:has(.inline-link) { overflow-x: visible !important; }");
    expect(block).toContain("prefers-reduced-motion: reduce");
  });
});
```
- [ ] **Step 2:** `pnpm vitest run lib/inline/render.test.ts`. Expected FAIL: component missing, CSS block empty.
- [ ] **Step 3: Implement.** `components/inline/InlineCopy.tsx`:
```tsx
import { createElement, Fragment, type ReactNode } from "react";
import { inlineRuns, type InlineRun } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { inlineLinkElement } from "@/lib/inline/attrs";
function emphasize(run: InlineRun, node: ReactNode): ReactNode {
  return run.strong ? <strong>{run.em ? <em>{node}</em> : node}</strong> : run.em ? <em>{node}</em> : node;
}
// One copy string as React. A Server Component that renders only text,
// emphasis and native buttons and anchors marked with data-inline; the
// behaviour is one delegated layer (components/inline/InlineLayer), because a
// lines-split Block rebuilds its children (SplitText's revert restores
// innerHTML) and would drop any handler attached here. A key the register
// lacks arrives as plain words from the parser; this never throws.
export function InlineCopy({ source }: { source: string }) {
  return (
    <>
      {inlineRuns(source, registerHas).map((run, index) => {
        const link = inlineLinkElement(run);
        return <Fragment key={index}>{emphasize(run, link ? createElement(link.tag, link.props, run.text) : run.text)}</Fragment>;
      })}
    </>
  );
}
```
Append to `app/globals.css` (keep each rule's spacing exactly; the test reads it):
```css
/* ---- inline links (components/inline): definitions solid, tips and pops
   dotted, both in the accent; external links solid in the muted ink. A link
   never wraps, so SplitText never slices it in two. Its ring fits the masked
   line vertically (a button is 1.15 lines tall; an inline anchor rings its
   font's content area), and a mask that holds a link clips only vertically,
   so a link at a line's start or end keeps its whole ring. The label is one
   fixed element above modals (58) and below the loader (60); under a mouse it
   trails the pointer slightly, after landing in place (data-trail). ---- */
:root {
  --inline-underline: var(--color-accent);
  --inline-underline-external: var(--color-muted);
  --inline-underline-width: 0.08em;
  --inline-underline-offset: 0.2em;
  --inline-tip-ms: 140ms;
  --inline-tip-trail-ms: 80ms;
}
.inline-link {
  margin: 0; padding: 0; border: 0; background: none; white-space: nowrap;
  font: inherit; line-height: 1.15; color: inherit; letter-spacing: inherit; text-align: inherit;
  text-decoration: underline var(--inline-underline); text-decoration-thickness: max(1px, var(--inline-underline-width));
  text-underline-offset: var(--inline-underline-offset); transition: color 150ms var(--ease-out);
}
.inline-link[data-inline="def"] { text-decoration-style: solid; }
.inline-link[data-inline="tip"], .inline-link[data-inline="pop"] { text-decoration-style: dotted; }
.inline-link[data-inline="external"] { text-decoration-style: solid; text-decoration-color: var(--inline-underline-external); }
.inline-link:hover { color: var(--color-accent); }
.inline-link:focus-visible { outline-offset: 1px; }
.sections-line-mask:has(.inline-link) { overflow-x: visible !important; }
.inline-tip {
  position: fixed; left: 0; top: 0; z-index: 58;
  opacity: 0; visibility: hidden; scale: 0.96; transform-origin: top left;
  transition: opacity var(--inline-tip-ms) var(--ease-out), scale var(--inline-tip-ms) var(--ease-out), visibility 0s linear var(--inline-tip-ms);
}
.inline-tip[data-shown="true"] { opacity: 1; visibility: visible; scale: 1; transition-delay: 0s; }
@media (prefers-reduced-motion: no-preference) {
  .inline-tip[data-mode="hover"][data-trail] { transition-property: opacity, scale, visibility, transform; transition-duration: var(--inline-tip-ms), var(--inline-tip-ms), 0s, var(--inline-tip-trail-ms); }
}
@media (prefers-reduced-motion: reduce) {
  .inline-tip { scale: none; transition: opacity 120ms linear, visibility 0s linear 120ms; }
  .inline-tip[data-shown="true"] { scale: none; transition: opacity 120ms linear, visibility 0s; }
}
/* ---- end inline links ---- */
```
- [ ] **Step 4:** `pnpm vitest run lib/inline && pnpm test && pnpm tsc --noEmit && pnpm lint`. Expected PASS, 0 lint errors.
- [ ] **Step 5:** Commit: `git add components/inline/InlineCopy.tsx lib/inline/render.test.ts app/globals.css && git commit -m "Inline links: InlineCopy renders the markup as native links, with the underline tokens" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.

---

### Task 5: The one label for tips and pops, the layer, and the e2e surface
**Files:** Create `components/inline/useTipController.ts`, `components/inline/TipBubble.tsx`, `components/inline/InlineLayer.tsx`, `app/fixtures/inline/page.tsx`, `e2e/support/inline.ts`, `e2e/inline-links.spec.ts`. Modify `app/layout.tsx`, `app/page.tsx` (a comment), `playwright.config.ts`.

**Interfaces:** Consumes Tasks 2 to 4, `useEscapeKey`, `Portal`, `Block`. Produces `useTipController(bubbleRef): { state: TipState; dismiss: () => void }`; `TipBubble({ state, ref })` rendering `[data-inline-tip]` with `data-shown="true|false"`, `data-mode="hover|focus|tap"`, `data-target="kind:key"`, `aria-hidden="true"`; `InlineLayer()` (mounted once; sets `<html data-inline-links="ready">` after its listeners attach); route `/fixtures/inline?copy=...` (404 unless `E2E_FIXTURES=1`); `e2e/support/inline.ts` exports the fixture strings `DEF`, `TIP`, `POP`, `MATCHA`, `CALENDAR`, `MATCHA_HREF` and the helpers `openFixture`, `tabTo`, `bubble`, `rango` (Tasks 6 to 8 and the touch spec reuse them).
- [ ] **Step 1: Failing e2e.** `e2e/support/inline.ts` (shared with the touch spec, Task 7):
```ts
import type { Locator, Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
// The inline links' e2e helpers (e2e/inline-links.spec.ts and
// e2e/inline-links-touch.spec.ts). Until C5 lands Aaron's copy the links come
// from fixture strings on /fixtures/inline, a route that exists only while the
// server runs with E2E_FIXTURES=1 (playwright.config.ts).
export const DEF = "I'm a [product](def:product)-focused engineer.";
export const TIP = "I performed as a [Rango](tip:aango) knockoff that rapped.";
export const POP = "I played [bass clarinet](pop:contrabass-clarinet).";
export const MATCHA = "Let's grab a coffee ([or matcha](pop:matcha)). No matter what you're building[*](tip:killer-drones).";
export const CALENDAR = "Or [grab a time on my calendar](https://cal.com/aaron-sulbaran).";
export const MATCHA_HREF = siteContent.register.pop.matcha.href!;
export async function openFixture(page: Page, ...copies: string[]) {
  await page.goto(`/fixtures/inline?${copies.map((copy) => `copy=${encodeURIComponent(copy)}`).join("&")}`);
  await page.waitForSelector("html[data-inline-links='ready']", { state: "attached" });
  // Each lines-split block has masked its lines in (or is still under reduced motion).
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLElement>("main [data-sections-block]")].every((block) => block.dataset.sectionsState !== "armed"
    || [...block.querySelectorAll<HTMLElement>(".sections-line")].every((line) => ["none", "matrix(1, 0, 0, 1, 0, 0)"].includes(getComputedStyle(line).transform))));
}
export async function tabTo(page: Page, link: Locator) {
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press("Tab");
    if (await link.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("Tab never reached the link");
}
export const bubble = (page: Page) => page.locator("[data-inline-tip]");
export const rango = (page: Page) => page.locator('[data-inline="tip"][data-inline-key="aango"]');
```
`e2e/inline-links.spec.ts`:
```ts
import type { Page } from "@playwright/test";
import { siteContent } from "@/lib/content";
import { tipText } from "@/lib/content/tracks";
import { test, expect } from "./support/fixtures";
import { bubble, CALENDAR, DEF, MATCHA, MATCHA_HREF, openFixture, POP, rango, tabTo, TIP } from "./support/inline";
// The copy's inline links (components/inline) by mouse and keyboard, each on a
// lines-split Block; touch is e2e/inline-links-touch.spec.ts (the touch project).
const { register } = siteContent;
const shift = (page: Page) => bubble(page).evaluate((el) => (({ m41: x, m42: y }) => ({ x, y }))(new DOMMatrixReadOnly(getComputedStyle(el).transform)));
test("inline links: a tip follows a mouse with no render per move, leaves with it, and Escape hides it", async ({ page }) => {
  await openFixture(page, TIP);
  const box = (await rango(page).boundingBox())!;
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await expect(bubble(page)).toHaveAttribute("data-mode", "hover");
  await expect(bubble(page)).toHaveText(tipText("aango")!);
  expect(await bubble(page).evaluate((el) => getComputedStyle(el).transitionProperty)).toContain("transform"); // the trail
  const before = await shift(page);
  await page.evaluate(() => {
    const w = Object.assign(window, { __tipMutations: 0 });
    new MutationObserver((records) => void (w.__tipMutations += records.length)).observe(document.querySelector("[data-inline-tip]")!, { childList: true, subtree: true, characterData: true });
  });
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 6 });
  // The label trails the pointer (an 80ms transform transition), so poll until it settles.
  await expect.poll(async () => Math.abs((await shift(page)).x - before.x - (box.width - 8))).toBeLessThanOrEqual(1);
  expect((await shift(page)).y).toBe(before.y);
  expect(await page.evaluate(() => (window as Window & { __tipMutations?: number }).__tipMutations)).toBe(0); // style writes are not child mutations
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 160);
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
  await rango(page).hover();
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});
test("inline links: keyboard focus anchors a tip under its link; Escape, Enter and Tab drive it", async ({ page }) => {
  await openFixture(page, TIP);
  await expect(rango(page)).toHaveAccessibleDescription(tipText("aango")!);
  await tabTo(page, rango(page));
  await expect(bubble(page)).toHaveAttribute("data-mode", "focus");
  await page.waitForTimeout(250);
  const link = (await rango(page).boundingBox())!;
  const tip = (await bubble(page).boundingBox())!;
  expect(tip.y).toBeGreaterThanOrEqual(link.y + link.height);
  expect(Math.abs(tip.x + tip.width / 2 - (link.x + link.width / 2))).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
  await expect(rango(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(bubble(page)).toHaveAttribute("data-shown", "true");
  await page.keyboard.press("Tab");
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});
test("inline links: a photo pop holds its photo, or its caption until the photo lands", async ({ page }) => {
  await openFixture(page, POP);
  const entry = register.pop["contrabass-clarinet"];
  const link = page.locator('[data-inline="pop"][data-inline-key="contrabass-clarinet"]');
  await expect(link).toHaveAccessibleDescription([entry.alt, entry.caption].filter(Boolean).join(". "));
  await link.hover();
  await expect(bubble(page)).toContainText(entry.caption!);
  if (entry.file) await expect(bubble(page).locator("img")).toHaveAttribute("alt", entry.alt);
  else await expect(bubble(page).locator("img")).toHaveCount(0);
});
test("inline links: the matcha shows its pop on hover and opens the Maps pin in a new tab on click", async ({ page, offsite }) => {
  await openFixture(page, MATCHA);
  const link = page.getByRole("link", { name: "or matcha" });
  await expect(link).toHaveAttribute("href", MATCHA_HREF);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await link.hover();
  await expect(bubble(page)).toContainText(register.pop.matcha.caption!);
  await expect(bubble(page).getByText(register.pop.matcha.hrefLabel!)).toHaveCount(0);
  const popup = page.waitForEvent("popup");
  await link.click();
  await (await popup).close();
  await expect.poll(() => offsite).toContain(MATCHA_HREF);
});
test("inline links: every link is a named button or link, the footnote included; the label stays out of the tree", async ({ page }) => {
  await openFixture(page, MATCHA, CALENDAR, TIP, DEF);
  await expect(page.getByRole("button", { name: siteContent.inline.symbolLabel })).toHaveAccessibleDescription(tipText("killer-drones")!);
  await expect(page.getByRole("link", { name: "grab a time on my calendar" })).toHaveAttribute("rel", "noopener noreferrer");
  const tags = await page.locator("main [data-inline]").evaluateAll((els) => els.map((el) => el.tagName));
  expect(tags).toHaveLength(5);
  expect(tags.every((tag) => tag === "A" || tag === "BUTTON")).toBe(true);
  await expect(bubble(page)).toHaveAttribute("aria-hidden", "true");
});
```
In `playwright.config.ts`, the full server's env becomes `env: { NEXT_PUBLIC_SITE_MODE: "full", GITHUB_CONTRIB_TOKEN: "", E2E_FIXTURES: "1" },` and the header comment, after its E2E_BASE_URL paragraph, gains:
```ts
// The full server runs with E2E_FIXTURES=1, which serves /fixtures/inline
// (e2e/inline-links*.spec.ts). Under E2E_BASE_URL that route is a 404 unless
// that server was started with E2E_FIXTURES=1.
```
The project regexes need no edit: `touch\.spec\.ts` already sends `e2e/inline-links-touch.spec.ts` (Task 7) to the touch project and keeps it out of chromium, webkit and firefox.
- [ ] **Step 2:** `E2E e2e/inline-links.spec.ts --project=chromium`. Expected: all five FAIL (`/fixtures/inline` is a 404).
- [ ] **Step 3: Implement.** `app/fixtures/inline/page.tsx`:
```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InlineCopy } from "@/components/inline/InlineCopy";
import { Block } from "@/components/sections/Block";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
// The surface for e2e/inline-links.spec.ts: each ?copy= string rendered the
// way the sections render prose, through a lines-split body Block. It exists
// only while the server runs with E2E_FIXTURES=1 (playwright.config.ts);
// everywhere else, production included, it is a 404.
export default async function InlineFixture({ searchParams }: { searchParams: Promise<{ copy?: string | string[] }> }) {
  if (process.env.E2E_FIXTURES !== "1") notFound();
  const { copy } = await searchParams;
  const copies = (Array.isArray(copy) ? copy : copy ? [copy] : []).slice(0, 8).map((text) => text.slice(0, 600));
  return (
    <main id="main" className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-24">
      {copies.map((text, index) => (
        <Block key={index} kind="body" as="p" className="text-xl leading-[1.6] text-foreground md:text-[22px] md:leading-[1.55]">
          <InlineCopy source={text} />
        </Block>
      ))}
    </main>
  );
}
```
`components/inline/useTipController.ts`:
```ts
"use client";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type RefObject } from "react";
import { anchorPosition, followPosition, type Size } from "@/lib/inline/placement";
import { sameTarget, TIP_IDLE, tipMode, tipReducer, type TipState, type TipTarget } from "@/lib/inline/tipState";
import { useEscapeKey } from "@/lib/modal";
const linkOf = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[data-inline="tip"], [data-inline="pop"]') : null);
function targetOf({ dataset: { inline: kind, inlineKey: key } }: HTMLElement): TipTarget | null {
  return (kind === "tip" || kind === "pop") && key ? { kind, key } : null;
}
// The shared label's driver: delegated document listeners (the links are
// server markup), one reducer for who shows it, and the position written
// straight to the label's transform in the pointer handler, as CustomCursor
// does: a move never renders React and never reads layout.
export function useTipController(bubbleRef: RefObject<HTMLElement | null>): { state: TipState; dismiss: () => void } {
  const [state, dispatch] = useReducer(tipReducer, TIP_IDLE);
  const stateRef = useRef(state);
  const linkRef = useRef<HTMLElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef<Size>({ width: 0, height: 0 });
  // The pointerdown of the current gesture: a click is judged by its own press.
  const downRef = useRef<{ type: string; link: HTMLElement | null } | null>(null);
  // A re-split (SplitText) can remove an anchored label's link; the label goes.
  const place = useCallback(() => {
    const bubble = bubbleRef.current;
    const mode = tipMode(stateRef.current);
    if (!bubble || !mode) return;
    const link = linkRef.current;
    const anchor = mode === "anchor" && link?.isConnected ? link.getBoundingClientRect() : null;
    if (mode === "anchor" && !anchor) { dispatch({ type: "dismiss" }); return; }
    const view = { width: window.innerWidth, height: window.innerHeight };
    const at = anchor ? anchorPosition(anchor, sizeRef.current, view) : followPosition(pointerRef.current, sizeRef.current, view);
    bubble.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
  }, [bubbleRef]);
  // One size read per shown target, never one per move. A fresh label lands
  // in place (a style flush with no data-trail) before it may trail a mouse.
  useLayoutEffect(() => {
    const fresh = !stateRef.current.target;
    stateRef.current = state;
    const bubble = bubbleRef.current;
    if (!bubble || !state.target) return;
    if (fresh) delete bubble.dataset.trail;
    sizeRef.current = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    place();
    if (fresh) { bubble.getBoundingClientRect(); bubble.dataset.trail = ""; }
  }, [state, place, bubbleRef]);
  useEffect(() => {
    const show = (link: HTMLElement, type: "hover" | "focus" | "press" | "tap") => {
      const target = targetOf(link);
      if (target) { linkRef.current = link; dispatch({ type, target }); }
    };
    const onPointerDown = (event: PointerEvent) => {
      const link = linkOf(event.target);
      downRef.current = { type: event.pointerType, link };
      const inBubble = event.target instanceof Node && !!bubbleRef.current?.contains(event.target);
      if (!link && !inBubble && stateRef.current.via === "tap") dispatch({ type: "dismiss" });
    };
    const onPointerOver = (event: PointerEvent) => {
      const link = event.pointerType === "mouse" ? linkOf(event.target) : null;
      if (link) { pointerRef.current = { x: event.clientX, y: event.clientY }; show(link, "hover"); }
    };
    const onPointerOut = (event: PointerEvent) => {
      const link = event.pointerType === "mouse" ? linkOf(event.target) : null;
      if (link && !(event.relatedTarget instanceof Node && link.contains(event.relatedTarget))) dispatch({ type: "unhover" });
    };
    // A re-split removes the hovered link without a pointerout; the next move
    // off any link lets the label go (one dispatch: the state is then idle).
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (tipMode(stateRef.current) !== "follow") return;
      if (linkOf(event.target)) place(); // a write, never a render
      else dispatch({ type: "unhover" });
    };
    const onFocusIn = (event: FocusEvent) => { const link = linkOf(event.target); if (link?.matches(":focus-visible")) show(link, "focus"); };
    const onFocusOut = (event: FocusEvent) => { if (linkOf(event.target)) dispatch({ type: "blur" }); };
    // A tap (any pointer but a mouse, pressed on this same link) pins the
    // label, holding a pop's href; a second tap on a pinned pop anchor follows
    // the href natively. Enter on a button toggles the label. A mouse click,
    // Enter on an anchor, and a click with no pointerdown of its own (assistive
    // tech) follow the href natively.
    const onClick = (event: MouseEvent) => {
      const down = downRef.current;
      downRef.current = null;
      const link = linkOf(event.target);
      if (!link) return;
      if (event.detail !== 0 && down?.link === link && down.type !== "mouse") {
        const { target, via } = stateRef.current;
        if (via === "tap" && sameTarget(target, targetOf(link)) && link.tagName === "A") { dispatch({ type: "dismiss" }); return; }
        event.preventDefault();
        show(link, "tap");
      } else if (event.detail === 0 && link.tagName !== "A") show(link, "press");
    };
    const onScroll = () => (stateRef.current.via === "hover" ? dispatch({ type: "dismiss" }) : place());
    const onDocument: Array<[string, EventListener, AddEventListenerOptions]> = [
      ["pointerdown", onPointerDown as EventListener, { capture: true, passive: true }],
      ["pointerover", onPointerOver as EventListener, { passive: true }],
      ["pointerout", onPointerOut as EventListener, { passive: true }],
      ["pointermove", onPointerMove as EventListener, { passive: true }],
      ["focusin", onFocusIn as EventListener, {}],
      ["focusout", onFocusOut as EventListener, {}],
      ["click", onClick as EventListener, {}],
    ];
    for (const [type, listener, options] of onDocument) document.addEventListener(type, listener, options);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", place, { passive: true });
    return () => {
      for (const [type, listener, options] of onDocument) document.removeEventListener(type, listener, options);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [bubbleRef, place]);
  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);
  useEscapeKey(state.target !== null, dismiss);
  return { state, dismiss };
}
```
`components/inline/TipBubble.tsx`:
```tsx
"use client";
import Image from "next/image";
import { useState, type Ref } from "react";
import type { TipState } from "@/lib/inline/tipState";
import { tipView } from "@/lib/inline/view";
import { POP_PHOTO_SIZES } from "@/lib/photoSizes";
// The one label every tip and photo pop shares, portalled to body and placed
// by useTipController. Hidden from assistive tech: each link already carries
// these words through aria-describedby. A pop's link shows only when a tap
// pinned it, the touch path to an href the tap did not follow. Once the state
// goes idle the label keeps its last words while it fades out.
export function TipBubble({ state, ref }: { state: TipState; ref: Ref<HTMLDivElement> }) {
  const [last, setLast] = useState(state);
  if (state.target && state !== last) setLast(state);
  const shown = state.target ? state : last;
  const view = shown.target ? tipView(shown.target.kind, shown.target.key) : null;
  const pinnedLink = shown.via === "tap" ? (view?.link ?? null) : null;
  return (
    <div ref={ref} aria-hidden="true" data-inline-tip="" data-shown={state.target && view ? "true" : "false"} data-mode={shown.via ?? undefined}
      data-target={shown.target ? `${shown.target.kind}:${shown.target.key}` : undefined} style={{ pointerEvents: state.via === "tap" && pinnedLink ? "auto" : "none" }} className="inline-tip">
      {view?.text && (
        <span className="block max-w-[20rem] rounded-2xl bg-accent px-3 py-[7px] font-sans text-[13px] font-medium leading-snug text-background">{view.text}</span>
      )}
      {view && !view.text && (
        <span className="flex w-[296px] max-w-[calc(100vw-24px)] flex-col gap-2 rounded-xl border border-border bg-background p-2 text-foreground shadow-[var(--pill-shadow)]">
          {view.photo && (
            <Image src={view.photo.src} alt={view.photo.alt} width={view.photo.displayWidth} height={view.photo.displayHeight} sizes={POP_PHOTO_SIZES} loading="eager" className="h-auto w-full rounded-lg" />
          )}
          {view.caption && <span className="px-1 font-label text-label-sm leading-snug text-muted">{view.caption}</span>}
          {pinnedLink && (
            <a href={pinnedLink.href} target="_blank" rel="noopener noreferrer" tabIndex={-1} className="px-1 pb-1 font-label text-label-sm text-accent underline underline-offset-2">{pinnedLink.label}</a>
          )}
        </span>
      )}
    </div>
  );
}
```
The text tip keeps the "Open me" pill's Inter (the cursor's own label, exempt in docs/label-face-spec.md section 5); the caption is small muted text, so it takes the label face. The image loads eagerly: it mounts only when shown, and a lazy load would open an empty frame on first hover.
`components/inline/InlineLayer.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { Portal } from "@/components/Portal";
import { siteContent } from "@/lib/content";
import { descriptionId, type TipKind } from "@/lib/inline/attrs";
import { tipView } from "@/lib/inline/view";
import { TipBubble } from "./TipBubble";
import { useTipController } from "./useTipController";
const { register } = siteContent;
const DESCRIBED: Array<readonly [TipKind, string]> = [
  ...Object.keys(register.tip).map((key) => ["tip", key] as const),
  ...Object.keys(register.pop).map((key) => ["pop", key] as const),
];
// The copy's inline links come alive here, once per page (app/layout.tsx):
// tips and pops share one label, and every tip and pop link is described by
// a hidden element listed below.
export function InlineLayer() {
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const tip = useTipController(bubbleRef);
  useEffect(() => {
    document.documentElement.dataset.inlineLinks = "ready";
    return () => void delete document.documentElement.dataset.inlineLinks;
  }, []);
  return (
    <>
      <div hidden>
        {DESCRIBED.map(([kind, key]) => (
          <span key={`${kind}-${key}`} id={descriptionId(kind, key)}>{tipView(kind, key)?.description}</span>
        ))}
      </div>
      <Portal>
        <TipBubble ref={bubbleRef} state={tip.state} />
      </Portal>
    </>
  );
}
```
In `app/layout.tsx`, add `import { InlineLayer } from "@/components/inline/InlineLayer";` and, directly after `<CustomCursor />`: `{!HOLDING_MODE && <InlineLayer />}`.
In `app/page.tsx` (comment only), the z-scale line `// modals z-50, the flight z-[55], the loader z-60, its root absolute at the` becomes `// modals z-50, the flight z-[55], the inline label z-[58], the loader z-60, its root absolute at the`.
- [ ] **Step 4:** `pnpm tsc --noEmit && pnpm lint && pnpm test`, then `E2E e2e/inline-links.spec.ts --project=chromium` (5 passed), then `E2E e2e/a11y.spec.ts e2e/modal.spec.ts e2e/mark.spec.ts --project=chromium` (all pass: the layer adds no tab stop and nothing focusable in aria-hidden). `pnpm lint components/inline` shows no new warnings.
- [ ] **Step 5:** Commit: `git add components/inline app/fixtures app/layout.tsx app/page.tsx playwright.config.ts e2e/inline-links.spec.ts e2e/support/inline.ts && git commit -m "Inline links: tips and photo pops share one label that follows a mouse and anchors for keys and taps" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.

---

### Task 6: The definition modal
**Files:** Create `components/inline/useDefinition.ts`, `components/inline/DefinitionModal.tsx`. Modify `components/inline/InlineLayer.tsx`, `e2e/support/inline.ts`, `e2e/inline-links.spec.ts`.

**Interfaces:** Consumes `useTipController`'s `dismiss`; `lib/modal.ts`; `useCloseHint` from `components/PhotoModal`; `InlineCopy`. Produces `useDefinition(dismissTip: () => void): { entry: DefinitionEntry | null; close: () => void }`; `DefinitionModal({ entry, onClose })` with `[data-definition-panel]` on its panel; e2e helper `productLink(page)` exported from `e2e/support/inline.ts`.
- [ ] **Step 1: Failing e2e.** Append to `e2e/support/inline.ts`, adding `import { walkStrings } from "@/lib/testing/walk";`, `import { openHome } from "./coil";` and `import { expect } from "./fixtures";` to its imports:
```ts
const PRODUCT_ON_HOME = walkStrings(siteContent.whoIAm).some((leaf) => leaf.text.includes("](def:product)"));
// The definition lives in Who I am once C5 lands it; until then, on the fixture.
export async function productLink(page: Page): Promise<Locator> {
  if (PRODUCT_ON_HOME) await openHome(page);
  else await openFixture(page, DEF);
  const link = page.locator('[data-inline="def"][data-inline-key="product"]').first();
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  return link;
}
```
Append to `e2e/inline-links.spec.ts`, adding `productLink` to its import from `./support/inline`:
```ts
test("inline links: a definition opens the house text modal by mouse; Escape closes it and focus returns", async ({ page }) => {
  const link = await productLink(page);
  await expect(link).toHaveAttribute("aria-haspopup", "dialog");
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toContainText(register.def.product.body);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
});
test("inline links: a definition opens from the keyboard, holds focus inside, and returns it", async ({ page }) => {
  const link = await productLink(page);
  await tabTo(page, link);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  const close = dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
});
test("inline links: focus returns to the product link even when its line was rebuilt", async ({ page }) => {
  const link = await productLink(page);
  await link.click();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  await page.evaluate(() => {
    const old = document.querySelector('[data-inline="def"][data-inline-key="product"]')!;
    old.replaceWith(old.cloneNode(true)); // what a SplitText revert does to the node
  });
  await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-inline="def"][data-inline-key="product"]').first()).toBeFocused();
});
```
- [ ] **Step 2:** `E2E e2e/inline-links.spec.ts --project=chromium`. Expected: the three new tests FAIL (no dialog).
- [ ] **Step 3: Implement.** `components/inline/useDefinition.ts`:
```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { siteContent } from "@/lib/content";
import type { DefinitionEntry } from "@/lib/content/types";
const { def } = siteContent.register;
// A re-split line (SplitText) may have replaced the trigger while the modal
// was open; the same link is then found again by its key.
function refocus(trigger: HTMLElement | null, key: string) {
  const live = trigger?.isConnected ? trigger : document.querySelector<HTMLElement>(`[data-inline="def"][data-inline-key="${CSS.escape(key)}"]`);
  live?.focus({ preventScroll: true });
}
// One delegated listener for every definition link on the page (server
// markup, components/inline/InlineCopy). Opening focuses the trigger first,
// so useFocusTrap returns focus to it.
export function useDefinition(dismissTip: () => void): { entry: DefinitionEntry | null; close: () => void } {
  const [key, setKey] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dismissRef = useRef(dismissTip);
  useEffect(() => void (dismissRef.current = dismissTip), [dismissTip]);
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const trigger = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-inline="def"]') : null;
      const next = trigger?.dataset.inlineKey;
      if (!trigger || !next || !Object.hasOwn(def, next)) return;
      event.preventDefault();
      dismissRef.current();
      trigger.focus({ preventScroll: true });
      triggerRef.current = trigger;
      setKey(next);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  const close = useCallback(() => {
    if (key === null) return;
    setKey(null);
    requestAnimationFrame(() => refocus(triggerRef.current, key));
  }, [key]);
  return { entry: key === null ? null : def[key], close };
}
```
`components/inline/DefinitionModal.tsx`:
```tsx
"use client";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useId, useRef } from "react";
import { Portal } from "@/components/Portal";
import { useCloseHint } from "@/components/PhotoModal";
import { siteContent } from "@/lib/content";
import type { DefinitionEntry } from "@/lib/content/types";
import { modalBackdropBlurVariants, modalBackdropTintVariants, useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
import { InlineCopy } from "./InlineCopy";
const RISE = { hidden: { opacity: 0, y: 16, scale: 0.97 }, visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: "easeOut" as const } }, exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" as const } } };
const FADE = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18 } }, exit: { opacity: 0, transition: { duration: 0.12 } } };
// The house text modal for a definition link (WorkModal's shell: Portal, the
// lib/modal hooks, the shared backdrop). No flight and no layoutId bloom:
// the word sits in a masked SplitText line. Reduced motion fades.
export function DefinitionModal({ entry, onClose }: { entry: DefinitionEntry | null; onClose: () => void }) {
  const open = entry !== null;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const reduced = useReducedMotion();
  const closeHint = useCloseHint();
  useBodyScrollLock(open);
  useEscapeKey(open, onClose);
  useFocusTrap(dialogRef, open);
  return (
    <Portal>
      <AnimatePresence>
        {entry && (
          <motion.div key="definition-modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
            initial="hidden" animate="visible" exit="exit" variants={modalBackdropBlurVariants(0)}
            onMouseDown={(event) => event.target === event.currentTarget && onClose()}
            className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain px-4 py-6 md:px-10 md:py-14">
            <motion.div aria-hidden="true" variants={modalBackdropTintVariants(0)} className="pointer-events-none fixed inset-0 bg-glass" />
            <motion.div data-definition-panel variants={reduced ? FADE : RISE} onMouseDown={(event) => event.stopPropagation()}
              className="relative my-auto flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-border bg-glass-strong p-6 shadow-[var(--shadow-card)] backdrop-blur-xl md:p-10">
              <button type="button" onClick={onClose} aria-label={siteContent.modals.closeAriaLabel}
                className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors duration-200 hover:text-accent">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
              <h2 id={titleId} className="pr-12 font-display text-3xl leading-tight text-foreground md:text-4xl">{entry.title}</h2>
              <p className="text-base leading-relaxed text-foreground md:text-lg md:leading-[1.55]"><InlineCopy source={entry.body} /></p>
              <span className="font-label text-label text-muted">{closeHint}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
```
In `components/inline/InlineLayer.tsx`: add `import { DefinitionModal } from "./DefinitionModal";` and `import { useDefinition } from "./useDefinition";`; directly under `const tip = useTipController(bubbleRef);` add `const definition = useDefinition(tip.dismiss);` (above the ready-flag effect, so its listener attaches before the flag); after the `</Portal>` line add `<DefinitionModal entry={definition.entry} onClose={definition.close} />`; and replace the component comment's second and third lines with `// definitions open the house text modal, tips and pops share one label, and` and `// every tip and pop link is described by a hidden element listed below.`
- [ ] **Step 4:** `pnpm tsc --noEmit && pnpm lint && pnpm test`, then `E2E e2e/inline-links.spec.ts e2e/modal.spec.ts --project=chromium`. Expected PASS (8 in the inline spec).
- [ ] **Step 5:** Commit: `git add components/inline e2e/inline-links.spec.ts e2e/support/inline.ts && git commit -m "Inline links: a definition opens the house text modal and focus comes home" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.

---

### Task 7: Touch, reduced motion, both themes, the focus ring
**Files:** Create `e2e/inline-links-touch.spec.ts`. Modify `e2e/inline-links.spec.ts` (tests); code only where a test points.
- [ ] **Step 1: Tests.** Touch has its own file: the touch project (a Pixel 7 with touch) matches `touch\.spec\.ts`, and chromium, webkit and firefox ignore it; a `test.use({ isMobile })` inside the shared spec would error on Firefox under `E2E_ALL=1`. `e2e/inline-links-touch.spec.ts`:
```ts
import { siteContent } from "@/lib/content";
import { test, expect } from "./support/fixtures";
import { bubble, MATCHA, MATCHA_HREF, openFixture, productLink, rango, TIP } from "./support/inline";
// The inline links on a phone. The touch project (playwright.config.ts) runs
// this file as a Pixel 7 with touch; chromium, webkit and firefox skip it.
const { register } = siteContent;
test("inline links (touch): a tap pins a tip under its link and a tap elsewhere lets it go", async ({ page }) => {
  await openFixture(page, TIP);
  await rango(page).tap();
  await expect(bubble(page)).toHaveAttribute("data-mode", "tap");
  await page.waitForTimeout(250);
  const link = (await rango(page).boundingBox())!;
  expect((await bubble(page).boundingBox())!.y).toBeGreaterThanOrEqual(link.y + link.height);
  await page.locator("main").tap({ position: { x: 4, y: 4 } });
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});
test("inline links (touch): the first tap on the matcha shows its pop and Maps link; that link opens the pin", async ({ page, offsite }) => {
  await openFixture(page, MATCHA);
  let popups = 0;
  page.on("popup", () => void (popups += 1));
  await page.getByRole("link", { name: "or matcha" }).tap();
  const maps = bubble(page).getByText(register.pop.matcha.hrefLabel!);
  await expect(maps).toBeVisible();
  await page.waitForTimeout(300);
  expect(popups).toBe(0);
  const popup = page.waitForEvent("popup");
  await maps.tap();
  await (await popup).close();
  await expect.poll(() => offsite).toContain(MATCHA_HREF);
});
test("inline links (touch): a second tap on the matcha follows its href and lets the label go", async ({ page, offsite }) => {
  await openFixture(page, MATCHA);
  const link = page.getByRole("link", { name: "or matcha" });
  await link.tap();
  await expect(bubble(page)).toHaveAttribute("data-mode", "tap");
  const popup = page.waitForEvent("popup");
  await link.tap();
  await (await popup).close();
  await expect.poll(() => offsite).toContain(MATCHA_HREF);
  await expect(bubble(page)).toHaveAttribute("data-shown", "false");
});
test("inline links (touch): a tap opens the definition and its close button closes it", async ({ page }) => {
  await (await productLink(page)).tap();
  const dialog = page.getByRole("dialog", { name: register.def.product.title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: siteContent.modals.closeAriaLabel }).tap();
  await expect(dialog).toBeHidden();
});
```
Append to `e2e/inline-links.spec.ts`:
```ts
test("inline links (reduced motion): the label and the definition only fade", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFixture(page, DEF, TIP);
  await rango(page).hover();
  await expect(bubble(page)).toHaveAttribute("data-shown", "true");
  expect(await bubble(page).evaluate((el) => getComputedStyle(el).scale)).toBe("none");
  expect(await bubble(page).evaluate((el) => getComputedStyle(el).transitionProperty)).not.toContain("transform"); // no trail
  await page.mouse.move(2, 700);
  await page.locator('[data-inline="def"]').click();
  const panel = page.locator("[data-definition-panel]");
  await panel.waitFor();
  // Read at once: the rise would still be moving the panel; the fade never writes a transform.
  expect(await panel.evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});
for (const colorScheme of ["light", "dark"] as const) {
  test(`inline links: underlines come from the accent token and the label reads at 4.5:1 in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await openFixture(page, DEF, TIP);
    const read = await page.evaluate(() => {
      const probe = document.body.appendChild(Object.assign(document.createElement("span"), { style: "color: var(--color-accent)" }));
      const accent = getComputedStyle(probe).color;
      probe.remove();
      const line = (s: CSSStyleDeclaration) => [s.textDecorationColor, s.textDecorationStyle];
      return { accent, def: line(getComputedStyle(document.querySelector('[data-inline="def"]')!)), tip: line(getComputedStyle(document.querySelector('[data-inline="tip"]')!)) };
    });
    expect(read.def).toEqual([read.accent, "solid"]);
    expect(read.tip).toEqual([read.accent, "dotted"]);
    await rango(page).hover();
    await expect(bubble(page)).toHaveAttribute("data-shown", "true");
    const ratio = await bubble(page).locator("span").first().evaluate((el) => {
      const lum = (c: string) => {
        const [r, g, b] = (c.match(/[\d.]+/g) ?? []).map(Number).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [hi, lo] = [lum(getComputedStyle(el).color), lum(getComputedStyle(el).backgroundColor)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}
// Rango opens this paragraph, so it sits at the left edge of its line's mask.
const LEAD = "[Rango](tip:aango) leads this line.";
test("inline links: a focused link's ring is not clipped by its line's mask, mid-line or at a line's start", async ({ page }) => {
  await openFixture(page, TIP, LEAD, CALENDAR);
  expect(await page.locator("main .sections-line-mask").count()).toBeGreaterThan(0);
  for (const link of [rango(page).first(), rango(page).nth(1), page.getByRole("link", { name: "grab a time on my calendar" })]) {
    await tabTo(page, link);
    const clipped = await link.evaluate((el) => {
      const ring = el.getBoundingClientRect();
      const reach = 3; // a 2px outline at a 1px offset
      const clipBox = (axis: "overflowX" | "overflowY") => {
        let node = el.parentElement;
        while (node && getComputedStyle(node)[axis] === "visible") node = node.parentElement;
        return node?.getBoundingClientRect() ?? null;
      };
      const [x, y] = [clipBox("overflowX"), clipBox("overflowY")];
      return { left: !!x && ring.left - reach < x.left, right: !!x && ring.right + reach > x.right, top: !!y && ring.top - reach < y.top, bottom: !!y && ring.bottom + reach > y.bottom };
    });
    expect(clipped).toEqual({ left: false, right: false, top: false, bottom: false });
  }
});
```
- [ ] **Step 2:** `pnpm exec playwright test --list --project=touch e2e/inline-links-touch.spec.ts` lists 4 tests, and the same with `--project=chromium` finds none. Then `E2E e2e/inline-links.spec.ts --project=chromium` (12 passed) and `E2E e2e/inline-links-touch.spec.ts --project=touch` (4 passed). Expected PASS if Tasks 4 to 6 are right. A failure is fixed in the code it names (the CSS block for the ring or reduced motion, `useTipController` for touch), never in the assertion; say so in the commit body.
- [ ] **Step 3:** Commit (add any file a failure fixed to the `git add`; the reason goes in a third `-m` before the trailer): `git add e2e/inline-links.spec.ts e2e/inline-links-touch.spec.ts && git commit -m "Inline links: touch, reduced motion, both themes and the focus ring under the line mask" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.

---

### Task 8: Wire the strings that carry links
**Files:** Modify `components/WhoIAm.tsx`, `components/Connect.tsx`, `components/soundtrack/BandInvite.tsx`, `components/mark/MarkCard.tsx`, `e2e/sections.spec.ts`, `e2e/soundtrack.spec.ts`, `e2e/inline-links.spec.ts`. Create `lib/inline/wiring.test.ts`.

**Interfaces:** Produces the five render sites C5 must keep: `<InlineCopy source={paragraph} />`, `<InlineCopy source={lede} />`, `<InlineCopy source={c.body} />`, `<InlineCopy source={c.acceptedNote} />`, `<InlineCopy source={line} />`.
- [ ] **Step 1: Failing tests.** `lib/inline/wiring.test.ts`:
```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// Where the copy carries links (docs/content/who-i-am.md,
// connect-footer-band.md, mark-card.md). C5 reshapes the strings; these sites
// must keep rendering through InlineCopy, or the markup shows as text.
const WIRED: Array<[string, string]> = [
  ["components/WhoIAm.tsx", "paragraph"],
  ["components/Connect.tsx", "lede"],
  ["components/soundtrack/BandInvite.tsx", "c.body"],
  ["components/soundtrack/BandInvite.tsx", "c.acceptedNote"],
  ["components/mark/MarkCard.tsx", "line"],
];
describe("copy that carries links", () => {
  it.each(WIRED)("%s renders %s through InlineCopy", (file, expression) => { expect(readFileSync(join(process.cwd(), file), "utf8")).toContain(`<InlineCopy source={${expression}} />`); });
});
```
Append to `e2e/inline-links.spec.ts`, adding `import { openHome } from "./support/coil";`:
```ts
test("inline links: no markup leaks onto the home as text", async ({ page }) => {
  await openHome(page);
  expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/\]\((?:def|tip|pop):|\]\(https:|\*\*/);
});
```
- [ ] **Step 2:** `pnpm vitest run lib/inline/wiring.test.ts`. Expected FAIL ×5.
- [ ] **Step 3: Implement.**
- `components/WhoIAm.tsx`: `import { InlineCopy } from "./inline/InlineCopy";`; the Block's child `{paragraph}` becomes `<InlineCopy source={paragraph} />`.
- `components/Connect.tsx`: same import; the lede Block's child `{lede}` becomes `<InlineCopy source={lede} />`.
- `components/soundtrack/BandInvite.tsx`: `import { InlineCopy } from "@/components/inline/InlineCopy";`; `<p>{c.body}</p>` becomes `<p><InlineCopy source={c.body} /></p>` and `<p>{c.acceptedNote}</p>` becomes `<p><InlineCopy source={c.acceptedNote} /></p>`.
- `components/mark/MarkCard.tsx`: the same import; inside `COPY.lines.map`, the paragraph's child `{line}` becomes `<InlineCopy source={line} />` (the `<p key={line} data-card="text" ...>` wrapper is unchanged).
- `e2e/sections.spec.ts`: `import { visibleText } from "@/lib/content/links";`, and wrap the existing `PROSE` literal so every string is compared as a visitor sees it:
```ts
const PROSE: Record<string, string[]> = Object.fromEntries(
  Object.entries({
    // the existing "#about", "#who-i-am", "#up-to-now" and "#connect" entries, moved here verbatim
  }).map(([id, prose]) => [id, prose.map(visibleText)]),
);
```
- `e2e/soundtrack.spec.ts`: `import { visibleText } from "@/lib/content/links";`; `toHaveText(L.acceptedNote)` becomes `toHaveText(visibleText(L.acceptedNote))`.
- [ ] **Step 4:** `pnpm vitest run lib/inline && pnpm test && pnpm tsc --noEmit && pnpm lint`, then `E2E e2e/inline-links.spec.ts e2e/sections.spec.ts e2e/soundtrack.spec.ts e2e/mark.spec.ts --project=chromium` (13 in the inline spec). Expected PASS. `wc -l components/inline/* components/WhoIAm.tsx components/Connect.tsx components/soundtrack/BandInvite.tsx components/mark/MarkCard.tsx`: every file under 200.
- [ ] **Step 5:** Commit: `git add components/WhoIAm.tsx components/Connect.tsx components/soundtrack/BandInvite.tsx components/mark/MarkCard.tsx e2e/sections.spec.ts e2e/soundtrack.spec.ts e2e/inline-links.spec.ts lib/inline/wiring.test.ts && git commit -m "Inline links: Who I am, Connect, the band notes and the mark card render their copy through InlineCopy" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"`.

---

### Task 9: Full verification, preview, PR
- [ ] **Step 1:** `pnpm tsc --noEmit && pnpm lint && pnpm test`. Record unit totals (above the Task 0 baseline).
- [ ] **Step 2:** The whole suite (after the lsof check): `E2E 2>&1 | tee "$TMPDIR/c2-e2e.log" | tail -30`. Expected: every project passes, `a11y.spec.ts`'s label-face contrast check (both themes) and "nothing focusable inside aria-hidden" included. Record passed, skipped, flaky.
- [ ] **Step 3: Preview for Aaron** (after the suite, which shares `.next`). The suite's last build is a full build, so starting it is enough; run `NEXT_PUBLIC_SITE_MODE=full pnpm build` first only if `.next` is missing. Start next itself (not the pnpm wrapper, whose PID is not the server's) and keep its PID in a file:
```bash
E2E_FIXTURES=1 ./node_modules/.bin/next start -p 3360 > "$TMPDIR/c2-preview.log" 2>&1 & echo $! > "$TMPDIR/c2-preview.pid"; echo "preview pid $(cat "$TMPDIR/c2-preview.pid")"
```
Open `http://localhost:3360/fixtures/inline?copy=I%27m%20a%20%5Bproduct%5D(def%3Aproduct)-focused%20engineer.&copy=Let%27s%20grab%20a%20coffee%20(%5Bor%20matcha%5D(pop%3Amatcha)).%20No%20matter%20what%20you%27re%20building%5B*%5D(tip%3Akiller-drones).` in both themes at 1440, 1024 and 390. Record the PID number in the report and leave the server for Aaron; stop it later only with `kill "$(cat "$TMPDIR/c2-preview.pid")"`.
- [ ] **Step 4: PR.** `git push -u origin c2-inline-links`; `BASE=$(gh pr view 40 --json state -q 'if .state == "MERGED" then "main" else "c1-content-model" end')`; write `$TMPDIR/c2-pr-body.md`; `gh pr create --base "$BASE" --title "C2: the copy's inline links, rendered (definitions, tips, photo pops)" --body-file "$TMPDIR/c2-pr-body.md"`. The body holds: what ships; Decisions 1 to 16 (headings verbatim); "For Aaron", one line per item of "Calls Aaron has not made"; the counts from Steps 1 and 2; "Retarget to main after PR 40 merges" when the base is `c1-content-model`; and hand-off notes:
  - C3: Decision 15; card modal blocks render through `InlineCopy`; the label sits at z 58 above modals.
  - C3 and C6: the Connect logos' handles and the jobs timeline's `TimelineEntry.tip` are free text in the same label; extend `TipTarget` with a text kind read from a data attribute; the controller and bubble stay the one label.
  - C5: rename the expressions in `lib/inline/wiring.test.ts` as you reshape `whoIAm`, `connect` and the mark card (`whoIAm.blocks.N.body`, `connect.body`, `markCard.line2` and `line3`); every string that carries markup must still reach `InlineCopy`. The definition e2e moves to the home by itself once `whoIAm` carries `[product](def:product)`; `e2e/sections.spec.ts` already compares visible words.
  - The orchestrator's Layer 2 edit: the Z scale gains "inline label 58"; the Architecture tree gains `app/fixtures/inline` (env-gated, test only). Layer 1 is Aaron's: ask him to amend the sentence that names `/work/[slug]` and `/recruiting` as the only other routes, or to veto the route (Decision 6).
It ends with:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

