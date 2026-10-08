# C1 Content Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `siteContent` the fourteen launch cards, the inline-link register, a pure parser for the copy's link markup, the soundtrack's credit fields and the mentors list's shape (held empty), pinned by content tests, without changing anything a visitor sees.

**Architecture:** New types and data live in a `lib/content/` folder beside `lib/content.ts` (types, links, register, cards, tracks); `lib/content.ts` wires them into `siteContent` and re-exports the types, so consumers keep importing from `@/lib/content`. The legacy shapes (`WorkItem`, `Photo`, `HomeTile`, `strandTiles`, `book.workRows`/`photoRows`, `strand.pattern`) stay exactly as they are until C3 swaps the Coil and the book. The parser is import-free and pure, so C2's renderer and the tests share it.

**Tech Stack:** TypeScript 5.9 (strict, `moduleResolution: bundler`), vitest 4 (`pnpm test`, node environment, `lib/**/*.test.ts`), Next.js 16.2.

**Spec:** the untracked hand-off files in the main checkout's `docs/content/` (`build-brief.md` with "Updates after Aaron's second round", `cards.md`, `tooltips.md`, `interactions-brief.md` sections 1, 2 and 5, `music.md`, `launch-content-plan.md`), as of 2026-10-08 18:41, with `photos.md` and `modal-gallery.md` read for shapes only (C1 exports nothing). A builder in the worktree cannot see them, so every string this plan needs is quoted below verbatim. Never reword a quoted string; never add copy the plan does not give.

## Global Constraints

- No em dashes anywhere: strings, comments, commit messages, the PR body.
- All copy reaches components through `siteContent` from `@/lib/content` (`lib/content.ts` plus the `lib/content/*.ts` files it imports).
- First person in all copy; no `alt` describes me in the third person. Sentence case for titles; two lowercase titles, one lowercase subtitle and three title-case metas are kept verbatim and listed in Decision 12 for Aaron. Never "fix" them.
- No component, route, style or `public/` change. No photo is exported, cropped, copied or added; crops are numbers in data only. No hex.
- An asset C4 has not landed is `null`, never an invented path. A line Aaron still owes is `null` with a `// PLACEHOLDER:` comment (none today).
- No mentor name or link enters the repo in C1: the mentors list ships empty until each mentor agrees to be named. Do not read the private mentors file.
- Code comments cite hand-off files as `docs/content/<file>.md`. Never edit `docs/`, `AGENTS.md`, the recruiting files or the holding page.
- `pnpm tsc --noEmit` covers test files: compare a `licenseKind` only through a value typed `SoundtrackTrack`, never against the `as const` literal (TS2367).
- Branch `c1-content-model`; worktree `/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c1-content-model` from `origin/main`; preview port 3340; e2e `E2E_FULL_PORT=3190 E2E_HOLDING_PORT=3191`; PR into `main`.
- Stop only servers you started, by the PID in a shell variable; never `pkill`, `killall`, a pattern, or a port you did not open. Never `pnpm dev` and `pnpm build` in one checkout. Never `vercel deploy`, never push `main`.
- At least one commit per task, never squashed, each ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions (flagged for Aaron's veto)

1. **The parser is pure** (orchestrator ruling). `parseInlineLinks(source, known)` returns `{ segments, unknown }` and never throws; rendering is C2. Besides `def`, `tip` and `pop` it reads `[words](https://...)` as an `external` segment, because `cards.md` writes the Travel card's two sister links that way. Any other target (`http:`, `mailto:`, `javascript:`, an uppercase or misspelled key, a key the register lacks) is reported in `unknown` and kept as its plain words. Link text must hold a visible character (`[ ](tip:x)` stays literal). `plainText` is for labels; `visibleText` also drops paired `**` and `*`.
2. **One card list, three orders.** `strand.order` is the Coil's order (lead card first). `cards.md` gives the book its own `book.workOrder` and `book.peopleOrder` in Aaron's doc order, which differ from the strand's, so "the book reads the same array" becomes "the book reads the same cards": a test pins that the three orders cover the same 14 keys and that each column matches the cards' `group`. `strandTiles` stays derived from the legacy `strand.pattern`/`photos`/`work`, unchanged; it cannot come from `strand.order` before C3, since five of the fourteen (talos, min-max, jobs, fsdatalink, building-in-public) have no legacy tile and the Coil would change.
3. **Crops are data:** `{ x, y, w, h }`, a box inside the file at `src`, in that file's pixels. Export boxes on Aaron's originals stay in `docs/content/photos.md` (written `x0,y0,x1,y1`). The lead card's source is the 4240 by 2832 original (box `860,0,2984,2832`); until C4 exports it, the 1084 by 724 repo copy stands in for layout only, with that box scaled: `{ x: 220, y: 0, w: 543, h: 724 }` (exactly 3:4). Every pop crop is `null`.
4. **Needs Aaron (Layer 1 wording): split, not grown.** Copy goes in `lib/content/*.ts` and reaches components only through `siteContent`; yes or no? Layer 1 says "All site copy lives in `lib/content.ts`". The fallback is everything in `lib/content.ts`, about 250 more lines. With the split, every new file is under 200 lines, and `lib/content.ts` (873 today) shrinks, because the live tracks and `tipText` move to `lib/content/tracks.ts`. `@/lib/content` still resolves to the file (a file wins over a same-named folder).
5. **Kinds follow `cards.md`:** `visual.kind` is `photo`, `logo`, `mark` or `circles`; `modal.kind` is `logo`, `timeline`, `mentors` or `photo`. The orchestrator's six "card kinds" map onto them (timeline is jobs, mentors is the list on Mentorship, this-site is `mark`). Building in public is a photo card (the Ship NYC selfie, `flipX: true`), waiting on C4 like the others. min/Max's logo visual carries the final subtitle; its slide-out animation waits. Mentorship's own modal is `logo`; how the mentors list opens is C3's call, so it is data on the card.
6. **Assets not landed are `null`**, and a test pins the twelve cards still waiting so C4 shrinks the list. Only Mentorship has a picture (the repo copy, Decision 3); This site is the AS mark the site already draws. Misuki's and Building in public's chosen pictures are outside the repo and wait for C4.
7. **Modal photos are a typed, empty slot.** A card has one card picture, then up to three modal photos; the modal never repeats the card picture. Each modal gets `photos: []`; a `ModalPhoto` carries its required caption and the index of the block it sits beside. The card picture's own modal caption is `CardPicture.caption`, `null` until Aaron okays captions (the build brief says every crop and caption waits for him).
8. **`SoundtrackTrack` is extended in place** (the one true one-to-one migration). `music.md`'s `licenseKind` union lacks the CC BY 4.0 of the three live Lee Rosevere tracks, so it gains `"cc-by-4.0"`, and a `licenseUrl` field carries the license URL the credit rules ask for. The live tracks get credit lines in the approved Sunset Pier format, from `public/audio/LICENSES.md` facts, with `why: null`. Sunset Pier's record lands with its file in C7; its approved credit is a test fixture here.
9. **The music tip stays true.** `tip.music-note` says Aaron adapted tracks; `tooltips.md` keeps that clause only while an adapted track plays. The register stores the clause and `tipText("music-note")` drops it while no track is `adapted` (true today).
10. **Proposed tips:** `voltaage` is in (the approved mark card points at it), flagged `proposed: true`; `parentheses` is out ("skip it unless he says yes").
11. **Nothing else migrates.** `book.photosHeading: "Photos"` stays beside the new `book.peopleHeading: "People"` because the book renders photo rows under it until C3.
12. **Needs Aaron: casing kept verbatim.** Layer 1 says sentence case, never title case; the build brief allows lowercase for big display headings only. These approved strings are neither, and ship exactly as written until he rules: the mentors title "the people who shaped me"; the jobs row title "\"unflattering\" jobs that paid for school"; the min/Max subtitle "minimize spend. Maximize rewards"; the metas "Claude Campus Ambassador, 2026", "President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026" and "Assistant Manager & SWE, 2022 to 2024".
13. **The mentors list ships empty.** The repo is public, so names and links would be public before the site shows them. C1 models the list (`title` plus `people: []`); each mentor goes in once that person agrees to be named.

## Review Focus

1. A key that exists only on `Object.prototype` (`[x](tip:constructor)`) must be reported unknown, not read as a tip. Test: Task 2.
2. A target that is not https (`http:`, `mailto:`, `javascript:void`) must never become a link. Test: Task 1.
3. A near-miss link (`[x] (tip:aango)`, `[](tip:aango)`, an unclosed bracket) stays literal, never throws, and the sweep fails on any `[` or `]` left in plain text. Tests: Tasks 1 and 5.
4. Markup where a label needs plain words: the IEEE book meta reads "President, Corporate Director, and AO, 2023 to 2026" through `plainText`. Tests: Tasks 1 and 3.
5. The music tip must not claim adapted tracks while none ship. Tests: Tasks 2 and 4.

## File Structure

| File | Responsibility |
|---|---|
| `lib/content/links.ts` (create) | Import-free parser: `parseInlineLinks`, `plainText`, `visibleText`, segment types |
| `lib/content/types.ts` (create) | Every new type: register, cards, mentors, timeline, tracks |
| `lib/content/register.ts` (create) | Definitions, tips, photo pops; `registerHas`, `resolveTip` |
| `lib/content/cards.ts` (create) | The fourteen cards and the three orders |
| `lib/content/tracks.ts` (create) | The live tracks, the credit rules and `tipText` |
| `lib/content.ts` (modify) | Wire `register`, `cards`, orders and `liveTracks`; re-export types and `tipText` |
| `lib/testing/jpegSize.ts`, `lib/testing/walk.ts` (create) | Test helpers (not `*.test.ts`, so vitest does not collect them) |
| `lib/photoSizes.test.ts` (modify) | Import the shared `jpegSize` |
| `lib/content/*.test.ts`, `lib/testing/walk.test.ts` (create) | The tests |

---

### Task 0: Worktree and baseline

- [ ] **Step 1: Create the worktree**

```bash
cd "/Users/asulbaran21/Personal Projects/aaron-portfolio-website"
git fetch origin
git worktree add -b c1-content-model "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c1-content-model" origin/main
cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-c1-content-model"
pnpm install --frozen-lockfile
```

- [ ] **Step 2: Record the baseline.** Run `pnpm test`. Expected: `Test Files  73 passed (73)`, `Tests  623 passed (623)` (taken 2026-10-08 on `main` at 0d689ef, which is 26e9831 plus one docs-only commit). If it differs, report the new baseline; every later count is baseline plus the new tests. All later commands run from the worktree root.

---

### Task 1: The inline link parser

**Files:** Create `lib/content/links.ts`; Test `lib/content/links.test.ts`.

**Interfaces:**
- Consumes: nothing.
- Produces: `type InlineKind = "def" | "tip" | "pop"`; `type InlineSegment = { kind: "text"; text: string } | { kind: InlineKind; text: string; key: string } | { kind: "external"; text: string; href: string }`; `interface UnknownLink { text: string; target: string }`; `interface ParsedInline { segments: InlineSegment[]; unknown: UnknownLink[] }`; `type KnownKey = (kind: InlineKind, key: string) => boolean`; `parseInlineLinks(source: string, known: KnownKey): ParsedInline`; `plainText(source: string): string` (links as their words, for labels); `visibleText(source: string): string` (also drops paired `**` and `*`).

- [ ] **Step 1: Write the failing test** `lib/content/links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseInlineLinks, plainText, visibleText, type InlineKind } from "@/lib/content/links";

const known = (kind: InlineKind, key: string) =>
  (kind === "tip" && (key === "ieee-ao" || key === "aango")) || (kind === "pop" && key === "sister-kyoto") || (kind === "def" && key === "product");

describe("parseInlineLinks", () => {
  it("returns nothing for an empty string and one text segment for plain copy", () => {
    expect(parseInlineLinks("", known)).toEqual({ segments: [], unknown: [] });
    expect(parseInlineLinks("I spent three summers at Capital One.", known)).toEqual({ segments: [{ kind: "text", text: "I spent three summers at Capital One." }], unknown: [] });
  });

  it("splits a tip out of the middle of a book meta", () => {
    expect(parseInlineLinks("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026", known)).toEqual({
      segments: [{ kind: "text", text: "President, Corporate Director, and " }, { kind: "tip", text: "AO", key: "ieee-ao" }, { kind: "text", text: ", 2023 to 2026" }],
      unknown: [],
    });
  });

  it("reads def, pop and https links, at the start and at the end", () => {
    expect(parseInlineLinks("[product](def:product)-focused, [my sister](pop:sister-kyoto) and [Sulara](https://sularatravel.com/)", known).segments).toEqual([
      { kind: "def", text: "product", key: "product" }, { kind: "text", text: "-focused, " }, { kind: "pop", text: "my sister", key: "sister-kyoto" },
      { kind: "text", text: " and " }, { kind: "external", text: "Sulara", href: "https://sularatravel.com/" },
    ]);
  });

  it("keeps quotes and punctuation around a link outside it", () => {
    expect(parseInlineLinks("called \"[Sulara](https://sularatravel.com/).\"", known).segments).toEqual([
      { kind: "text", text: "called \"" }, { kind: "external", text: "Sulara", href: "https://sularatravel.com/" }, { kind: "text", text: ".\"" },
    ]);
  });

  it("reports a key the register lacks and keeps its words as text", () => {
    expect(parseInlineLinks("a [Rango](tip:rango) knockoff", known)).toEqual({
      segments: [{ kind: "text", text: "a Rango knockoff" }],
      unknown: [{ text: "Rango", target: "tip:rango" }],
    });
  });

  it("never makes a link of a target that is not https or a known kind", () => {
    for (const target of ["http://example.com", "mailto:me@example.com", "javascript:void", "ftp://example.com", "tip:Bad_Key", "tip:", "foo:bar"]) {
      expect(parseInlineLinks(`see [x](${target})`, known)).toEqual({ segments: [{ kind: "text", text: "see x" }], unknown: [{ text: "x", target }] });
    }
  });

  it("leaves malformed markup literal and never throws", () => {
    for (const source of ["[x] (tip:aango)", "[](tip:aango)", "[ ](tip:aango)", "[x](tip:aango", "x](tip:aango)", "[[x]](tip:aango)", "[x](javascript:alert(1))"]) {
      expect(parseInlineLinks(source, known)).toEqual({ segments: [{ kind: "text", text: source }], unknown: [] });
    }
  });

  it("reads adjacent links, a lone asterisk, a link in parentheses, and leaves literal brackets", () => {
    expect(parseInlineLinks("[a](tip:aango)[b](tip:ieee-ao)", known).segments).toEqual([{ kind: "tip", text: "a", key: "aango" }, { kind: "tip", text: "b", key: "ieee-ao" }]);
    expect(parseInlineLinks("no matter what you're building[*](tip:aango).", known).segments[1]).toEqual({ kind: "tip", text: "*", key: "aango" });
    expect(parseInlineLinks("a coffee ([or matcha](pop:sister-kyoto)).", known).segments.map((segment) => segment.text)).toEqual(["a coffee (", "or matcha", ")."]);
    expect(parseInlineLinks("I said [sic] and [AO](tip:ieee-ao)", known).segments[0]).toEqual({ kind: "text", text: "I said [sic] and " });
    expect(parseInlineLinks("[Rango](https://en.wikipedia.org/wiki/Rango_(2011_film))", known).unknown).toEqual([]);
  });

  it("leaves bold and italic markers for the renderer", () => {
    const source = "**2024, business analyst.** My first look, I *know* it.";
    expect(parseInlineLinks(source, known).segments).toEqual([{ kind: "text", text: source }]);
  });
});

describe("plainText", () => {
  it("reads a link as its words", () => {
    expect(plainText("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026")).toBe("President, Corporate Director, and AO, 2023 to 2026");
  });

  it("matches the parsed segments' words for known, unknown, external and malformed links", () => {
    for (const source of ["a [Rango](tip:rango) knockoff", "[product](def:product)-focused", "go [check her out](https://www.instagram.com/travelwithbarbss/)!", "[x] (tip:aango)"]) {
      expect(parseInlineLinks(source, known).segments.map((segment) => segment.text).join("")).toBe(plainText(source));
    }
  });
});

describe("visibleText", () => {
  it("drops paired emphasis markers and keeps a lone asterisk", () => {
    expect(visibleText("**2024, business analyst.** My first look at corporate America.")).toBe("2024, business analyst. My first look at corporate America.");
    expect(visibleText("an invitational I *know* it had been chasing")).toBe("an invitational I know it had been chasing");
    expect(visibleText("building[*](tip:aango).")).toBe("building*.");
  });
});
```

- [ ] **Step 2: Run it.** `pnpm vitest run lib/content/links.test.ts`. Expected: FAIL, `Failed to resolve import "@/lib/content/links"`.

- [ ] **Step 3: Implement** `lib/content/links.ts`:

```ts
// The copy's inline link markup: [words](def:key), [words](tip:key),
// [words](pop:key) and [words](https://...). Pure and import-free, so the
// renderer and the content tests share it. A link whose key the register lacks,
// or whose target is not https, is reported and kept as its plain words; this
// never throws.

export type InlineKind = "def" | "tip" | "pop";

export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: InlineKind; text: string; key: string }
  | { kind: "external"; text: string; href: string };

export interface UnknownLink { text: string; target: string }

export interface ParsedInline { segments: InlineSegment[]; unknown: UnknownLink[] }

export type KnownKey = (kind: InlineKind, key: string) => boolean;

const LINK = /\[([^[\]]*[^[\]\s][^[\]]*)\]\(([^()\s]+)\)/g;
const KEYED = /^(def|tip|pop):([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const EXTERNAL = /^https:\/\/\S+$/;

export function parseInlineLinks(source: string, known: KnownKey): ParsedInline {
  const segments: InlineSegment[] = [];
  const unknown: UnknownLink[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.kind === "text") last.text += text;
    else segments.push({ kind: "text", text });
  };
  let cursor = 0;
  for (const match of source.matchAll(LINK)) {
    const [whole, text, target] = match;
    const start = match.index ?? 0;
    pushText(source.slice(cursor, start));
    cursor = start + whole.length;
    const keyed = KEYED.exec(target);
    if (keyed && known(keyed[1] as InlineKind, keyed[2])) {
      segments.push({ kind: keyed[1] as InlineKind, text, key: keyed[2] });
    } else if (!keyed && EXTERNAL.test(target)) {
      segments.push({ kind: "external", text, href: target });
    } else {
      unknown.push({ text, target });
      pushText(text);
    }
  }
  pushText(source.slice(cursor));
  return { segments, unknown };
}

// Links as their words: for labels, alts and comparisons.
export function plainText(source: string): string {
  return source.replace(LINK, "$1");
}

// The words a reader sees: links as their words, paired ** and * removed; a lone * stays.
export function visibleText(source: string): string {
  return plainText(source).replace(/\*\*(?=\S)(.+?)\*\*/g, "$1").replace(/\*(?=\S)([^*]+?)\*/g, "$1");
}
```

- [ ] **Step 4: Run it.** `pnpm vitest run lib/content/links.test.ts && pnpm tsc --noEmit`. Expected: 12 PASS; tsc silent.

- [ ] **Step 5: Commit**

```bash
git add lib/content/links.ts lib/content/links.test.ts
git commit -m "Content: a pure parser for the copy's inline link markup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The inline register

**Files:** Create `lib/content/types.ts`, `lib/content/register.ts`; Modify `lib/content.ts`; Test `lib/content/register.test.ts`.

**Interfaces:**
- Consumes: `InlineKind`, `parseInlineLinks` (Task 1).
- Produces: types `PhotoCrop { x: number; y: number; w: number; h: number }`, `DefinitionEntry { title: string; body: string }`, `TipEntry { text: string; proposed?: true; adaptedClause?: string }`, `PopEntry { file: { src: string; width: number; height: number } | null; alt: string; caption: string | null; crop: PhotoCrop | null; href?: string }`, `InlineRegister { def: Record<string, DefinitionEntry>; tip: Record<string, TipEntry>; pop: Record<string, PopEntry> }`; `register: InlineRegister`; `registerHas(kind: InlineKind, key: string): boolean`; `resolveTip(entry: TipEntry, hasAdaptedTrack: boolean): string`; `siteContent.register`. Types re-exported from `@/lib/content`.

- [ ] **Step 1: Write the failing test** `lib/content/register.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks } from "@/lib/content/links";
import { register, registerHas, resolveTip } from "@/lib/content/register";

const musicNoteWithoutAdapting =
  "I'm not playing my usual playlist (a lot of Tyler, the Creator, Childish Gambino and Steve Lacy) because I don't own it, and I picked music that's easy to read to. The credits are in the corner.";

describe("the inline register", () => {
  it("holds the approved keys and only those", () => {
    expect(Object.keys(register.def)).toEqual(["product"]);
    expect(Object.keys(register.tip)).toEqual(["voltage", "two-as", "voltaage", "killer-drones", "evolving-isle", "music-note", "ieee-ao", "aango", "this-site-playground", "misuki-suk"]);
    expect(Object.keys(register.pop)).toEqual(["leadership-award", "sandboarding", "downhill-skating", "skydiving", "rock-climbing", "venezuela-flag", "matcha", "sister-kyoto", "contrabass-clarinet"]);
  });

  it("is the register siteContent carries", () => {
    expect(siteContent.register).toBe(register);
  });

  it("keeps one proposed tip, flagged", () => {
    expect(Object.entries(register.tip).filter(([, entry]) => entry.proposed).map(([key]) => key)).toEqual(["voltaage"]);
  });

  it("defines product in Aaron's words", () => {
    expect(register.def.product.title).toBe("What a product is");
    expect(register.def.product.body.startsWith("A product (to me) is a tool that's genuinely useful")).toBe(true);
  });

  it("describes every pop without the third person, with the approved captions and link; files come with C4", () => {
    for (const entry of Object.values(register.pop)) {
      expect(entry.alt).not.toMatch(/\bAaron\b/);
      expect(entry.file).toBeNull();
    }
    const captions = Object.fromEntries(Object.entries(register.pop).filter(([, entry]) => entry.caption).map(([key, entry]) => [key, entry.caption]));
    expect(captions).toEqual({
      "leadership-award": "Getting the Cockrell School undergraduate leadership award.",
      matcha: "7T+ is my favorite matcha place in the world, literally in the world. This one is in Kyoto.",
      "contrabass-clarinet": "Bass clarinet was my main instrument. In concert season I played contrabass.",
    });
    expect(Object.values(register.pop).every((entry) => entry.crop === null)).toBe(true);
    expect(Object.entries(register.pop).filter(([, entry]) => entry.href).map(([key, entry]) => [key, entry.href])).toEqual([["matcha", "https://www.google.com/maps/search/?api=1&query=35.0025497%2C135.7652173"]]);
  });

  it("knows a key only when the register itself holds it", () => {
    expect(registerHas("tip", "ieee-ao")).toBe(true);
    expect(registerHas("pop", "ieee-ao")).toBe(false);
    expect(registerHas("tip", "constructor")).toBe(false);
    expect(registerHas("def", "toString")).toBe(false);
    expect(parseInlineLinks("[x](tip:constructor)", registerHas).unknown).toEqual([{ text: "x", target: "tip:constructor" }]);
  });

  it("drops the music note's adapting clause while no adapted track plays", () => {
    const note = register.tip["music-note"];
    expect(Boolean(note.adaptedClause && note.text.includes(note.adaptedClause))).toBe(true);
    expect(resolveTip(note, false)).toBe(musicNoteWithoutAdapting);
    expect(resolveTip(note, true)).toBe(note.text);
    expect(resolveTip(register.tip.aango, false)).toBe("yes, the chameleon from that one kid's movie");
  });
});
```

- [ ] **Step 2: Run it.** `pnpm vitest run lib/content/register.test.ts`. Expected: FAIL, `Failed to resolve import "@/lib/content/register"`.

- [ ] **Step 3: Write the types** `lib/content/types.ts`:

```ts
// The content model's shapes. Data lives in the sibling files and reaches
// components through siteContent in lib/content.ts, which re-exports these.

// A box inside the file at src, in that file's pixels. Export boxes on Aaron's
// originals stay in docs/content/photos.md.
export interface PhotoCrop { x: number; y: number; w: number; h: number }

// The inline register: what [words](def:key), (tip:key) and (pop:key) open.
export interface DefinitionEntry { title: string; body: string }

export interface TipEntry {
  text: string;
  proposed?: true;
  // A clause that is true only while an adapted track is in the player.
  adaptedClause?: string;
}

export interface PopEntry {
  // The exported file; null until C4 lands it.
  file: { src: string; width: number; height: number } | null;
  alt: string;
  caption: string | null;
  crop: PhotoCrop | null;
  // Opens in a new tab on click; hover and the first tap still show the pop.
  href?: string;
}

export interface InlineRegister {
  def: Record<string, DefinitionEntry>;
  tip: Record<string, TipEntry>;
  pop: Record<string, PopEntry>;
}
```

- [ ] **Step 4: Write the register, every string verbatim,** `lib/content/register.ts`:

```ts
import type { InlineKind } from "./links";
import type { InlineRegister, TipEntry } from "./types";

// Every inline link the copy may point at (docs/content/tooltips.md, approved
// 2026-10-08). Pop photos are exported by C4; until then file is null.
export const register: InlineRegister = {
  def: {
    product: {
      title: "What a product is",
      body: "A product (to me) is a tool that's genuinely useful to someone and easy for them to pick up. If it's for everyone, anyone should get it on their first try. If it's for niche hobbyists, the hobbyists in that community should get it immediately. About 99% of the time a product should be built for the user instead of forcing the user to get used to the product. The other 1% is how you get a moonshot product like the iPhone, which didn't just change the way people use a phone (the product), it changed the world.",
    },
  },
  tip: {
    voltage: { text: "the electrical pressure from a power source that pushes electric charges through a conducting path in a circuit" },
    "two-as": { text: "(it's my name, A-Aron)" },
    voltaage: { text: "voltage + A + A", proposed: true },
    "killer-drones": { text: "unless it's killer drones, I don't do that" },
    "evolving-isle": { text: "not dynamic island, a nod to Apple" },
    "music-note": {
      text: "I'm not playing my usual playlist (a lot of Tyler, the Creator, Childish Gambino and Steve Lacy) because I don't own it, and I picked music that's easy to read to, and I adapted a couple of the tracks myself in Epidemic Sound's studio. The credits are in the corner.",
      adaptedClause: ", and I adapted a couple of the tracks myself in Epidemic Sound's studio",
    },
    "ieee-ao": { text: "External Activities and Events Assistant Officer" },
    aango: { text: "yes, the chameleon from that one kid's movie" },
    "this-site-playground": { text: "this site is my design playground" },
    "misuki-suk": { text: "shoutout suk and her S2000" },
  },
  pop: {
    "leadership-award": { file: null, alt: "Me holding my Cockrell Student Leadership Award certificate", caption: "Getting the Cockrell School undergraduate leadership award.", crop: null },
    sandboarding: { file: null, alt: "Me sandboarding down a dune in the Dubai desert", caption: null, crop: null },
    "downhill-skating": { file: null, alt: "My skateboards and longboards lined up at the back of my Miata", caption: null, crop: null },
    skydiving: { file: null, alt: "Me in freefall on a tandem skydive", caption: null, crop: null },
    "rock-climbing": { file: null, alt: "Me climbing a wall at a bouldering gym", caption: null, crop: null },
    "venezuela-flag": { file: null, alt: "Me holding a Venezuelan flag in a convention hall", caption: null, crop: null },
    matcha: {
      file: null,
      alt: "A matcha from 7T+ in Kyoto",
      caption: "7T+ is my favorite matcha place in the world, literally in the world. This one is in Kyoto.",
      crop: null,
      href: "https://www.google.com/maps/search/?api=1&query=35.0025497%2C135.7652173",
    },
    "sister-kyoto": { file: null, alt: "Me and my sister in the Arashiyama bamboo grove in Kyoto", caption: null, crop: null },
    "contrabass-clarinet": { file: null, alt: "Me, on the right, holding a contrabass clarinet next to my friend with a baritone saxophone", caption: "Bass clarinet was my main instrument. In concert season I played contrabass.", crop: null },
  },
};

// Own keys only: "constructor" and friends live on every object's prototype.
export function registerHas(kind: InlineKind, key: string): boolean {
  return Object.hasOwn(register[kind], key);
}

export function resolveTip(entry: TipEntry, hasAdaptedTrack: boolean): string {
  if (!entry.adaptedClause || hasAdaptedTrack) return entry.text;
  return entry.text.replace(entry.adaptedClause, "");
}
```

- [ ] **Step 5: Wire it into `siteContent`** in `lib/content.ts`:
  1. Add as the file's first line: `import { register } from "./content/register";`
  2. Directly after the closing `},` of `meta: { ... },` inside `siteContent`, add:
     ```ts
       // Every inline link the copy may point at (lib/content/register.ts).
       register,
     ```
  3. After `export type HomeTile = (typeof siteContent.homeTiles)[number];` add:
     ```ts
     export type { DefinitionEntry, InlineRegister, PhotoCrop, PopEntry, TipEntry } from "./content/types";
     ```

- [ ] **Step 6: Run it.** `pnpm vitest run lib/content && pnpm tsc --noEmit`. Expected: links 12 and register 7 PASS; tsc silent.

- [ ] **Step 7: Commit**

```bash
git add lib/content/types.ts lib/content/register.ts lib/content/register.test.ts lib/content.ts
git commit -m "Content: the inline register of definitions, tips and photo pops

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The fourteen cards, the mentors list's shape and the orders

**Files:** Create `lib/testing/jpegSize.ts`, `lib/content/cards.ts`; Modify `lib/content/types.ts`, `lib/content.ts`, `lib/photoSizes.test.ts`; Test `lib/content/cards.test.ts`.

**Interfaces:**
- Consumes: `parseInlineLinks`, `plainText` (Task 1); `registerHas`, `PhotoCrop` (Task 2).
- Produces: types `CardKey`, `CardGroup`, `ImageRef`, `PhotoRef`, `CardPicture`, `LogoRef`, `ModalPhoto`, `CardVisual`, `CardModalKind`, `CardLink`, `CardModal`, `CardContent`, `Mentor`, `MentorsList`, `TimelineEntry`, `Cards` (re-exported from `@/lib/content`); `cards: Cards`, `strandOrder`, `bookWorkOrder`, `bookPeopleOrder: readonly CardKey[]` from `lib/content/cards.ts`; `siteContent.cards`, `.strand.order`, `.book.peopleHeading`, `.book.workOrder`, `.book.peopleOrder`; `jpegSize(file: string): [number, number]` from `lib/testing/jpegSize.ts`.

- [ ] **Step 1: Share `jpegSize`.** A refactor, so no failing test first; the existing photo-size test is its check. Create `lib/testing/jpegSize.ts`:

```ts
import { readFileSync } from "node:fs";

// Width and height from a JPEG's start-of-frame segment.
export function jpegSize(file: string): [number, number] {
  const b = readFileSync(file);
  let i = 2;
  while (i < b.length) {
    const marker = b[i + 1];
    const length = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    }
    i += 2 + length;
  }
  throw new Error(`no frame header in ${file}`);
}
```

In `lib/photoSizes.test.ts`, delete the local comment and `function jpegSize(...) { ... }` (lines 7 to 20), add `import { jpegSize } from "@/lib/testing/jpegSize";` after the `@/lib/photoSizes` import, and keep the `readFileSync` import (the SVG branch uses it). Run `pnpm vitest run lib/photoSizes.test.ts`. Expected: 3 PASS.

- [ ] **Step 2: Write the failing test** `lib/content/cards.test.ts`:

```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent, type CardKey } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { jpegSize } from "@/lib/testing/jpegSize";

const { cards, strand, book } = siteContent;
const keys = Object.keys(cards) as CardKey[];
const STRAND = ["mentorship", "min-max", "band", "talos", "travel", "capital-one", "hackathons", "anthropic", "misuki", "ieee", "jobs", "this-site", "fsdatalink", "building-in-public"];

describe("the fourteen cards", () => {
  it("are the approved keys in the strand order, lead card first", () => {
    expect(strand.order).toEqual(STRAND);
    expect(keys).toEqual(STRAND);
  });

  it("fill the book's two columns by group, in Aaron's doc order", () => {
    expect([book.workHeading, book.peopleHeading]).toEqual(["Work", "People"]);
    expect(book.workOrder).toEqual(["min-max", "talos", "capital-one", "anthropic", "ieee", "hackathons", "this-site"]);
    expect(book.peopleOrder).toEqual(["mentorship", "band", "jobs", "fsdatalink", "misuki", "travel", "building-in-public"]);
    for (const key of book.workOrder) expect(cards[key].group).toBe("work");
    for (const key of book.peopleOrder) expect(cards[key].group).toBe("people");
    expect([...book.workOrder, ...book.peopleOrder].sort()).toEqual([...STRAND].sort());
  });

  it("give each card its approved visual and modal kind", () => {
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].visual.kind]))).toEqual({
      mentorship: "photo", "min-max": "logo", band: "photo", talos: "logo", travel: "photo", "capital-one": "logo", hackathons: "photo",
      anthropic: "logo", misuki: "photo", ieee: "logo", jobs: "circles", "this-site": "mark", fsdatalink: "logo", "building-in-public": "photo",
    });
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].modal.kind]))).toEqual({
      ...Object.fromEntries(STRAND.map((key) => [key, "logo"])), travel: "photo", misuki: "photo", jobs: "timeline",
    });
    expect(cards.talos.visual).toEqual({ kind: "logo", logo: null, tile: "anvil" });
  });

  it("lead with the HSF speaking photo, cropped 3:4 inside its source", () => {
    const visual = cards.mentorship.visual;
    const photo = visual.kind === "photo" ? visual.photo : null;
    const crop = photo?.crop;
    if (!photo || !crop) throw new Error("the lead card needs its cropped photo");
    expect(photo.src).toBe("/photos/hsf-speaking.jpeg");
    expect(jpegSize(join(process.cwd(), "public", photo.src))).toEqual([photo.width, photo.height]);
    expect(crop).toEqual({ x: 220, y: 0, w: 543, h: 724 });
    expect(crop.x + crop.w).toBeLessThanOrEqual(photo.width);
    expect(crop.y + crop.h).toBeLessThanOrEqual(photo.height);
    expect(photo.alt).toBe("Me speaking into a microphone at a Hispanic Scholarship Fund event");
    expect(photo.caption).toBeNull();
  });

  it("keep every card picture 3:4 and at most three modal photos after it, each tied to a block", () => {
    for (const key of keys) {
      const { visual, modal } = cards[key];
      const picture = visual.kind === "photo" ? visual.photo : null;
      if (picture?.crop) expect(picture.crop.w / picture.crop.h, key).toBeCloseTo(3 / 4, 2);
      expect(modal.photos.length, key).toBeLessThanOrEqual(3);
      for (const photo of modal.photos) {
        expect(photo.block, key).toBeLessThan(modal.blocks.length);
        expect(photo.src, key).not.toBe(picture?.src);
      }
    }
  });

  it("mirror only the Building in public picture", () => {
    expect(keys.filter((key) => { const visual = cards[key].visual; return visual.kind === "photo" && visual.flipX; })).toEqual(["building-in-public"]);
  });

  it("name the cards still waiting on C4's assets", () => {
    const awaiting = keys.filter((key) => {
      const visual = cards[key].visual;
      if (visual.kind === "photo") return visual.photo === null;
      if (visual.kind === "logo") return visual.logo === null;
      if (visual.kind === "circles") return cards.jobs.timeline.some((entry) => entry.logo === null);
      return false;
    });
    expect(awaiting).toEqual(["min-max", "band", "talos", "travel", "capital-one", "hackathons", "anthropic", "misuki", "ieee", "jobs", "fsdatalink", "building-in-public"]);
  });

  it("hold the approved words (spot checks)", () => {
    expect(cards.ieee.book.meta).toBe("President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026");
    expect(cards["min-max"].visual).toEqual({ kind: "logo", logo: null, tile: "plain", subtitle: "minimize spend. Maximize rewards" });
    expect(cards["this-site"].book.meta).toBe("Portfolio (design playground), 2026");
    expect(cards.jobs.book).toEqual({ title: "\"unflattering\" jobs that paid for school", meta: "Popeyes to Aritzia, 2021 to 2026" });
    expect(cards.band.modal.blocks[1]).toContain("an invitational I *know* it had been chasing");
    expect(cards["capital-one"].modal.blocks[1].startsWith("**2024, business analyst.** My first look")).toBe(true);
    expect(cards.hackathons.modal.blocks.at(-1)).toBe("HackTX & others, coming soon.");
    expect(cards.jobs.timeline.at(-1)?.tip.endsWith("basically unisex products...")).toBe(true);
    expect(Object.fromEntries(keys.map((key) => [key, cards[key].modal.blocks.length]))).toEqual({
      mentorship: 2, "min-max": 1, band: 3, talos: 2, travel: 2, "capital-one": 5, hackathons: 4,
      anthropic: 2, misuki: 2, ieee: 5, jobs: 3, "this-site": 1, fsdatalink: 2, "building-in-public": 3,
    });
  });

  it("open only labeled https links", () => {
    for (const key of keys) {
      for (const link of cards[key].modal.links) {
        expect(link.label.length).toBeGreaterThan(0);
        expect(link.href).toMatch(/^https:\/\//);
      }
    }
    expect(cards["building-in-public"].modal.links.map((link) => link.label)).toEqual(["LinkedIn", "X (@imaaronsulbaran)"]);
  });

  it("run the jobs timeline oldest to newest, one tip each", () => {
    expect(cards.jobs.timeline.map((entry) => entry.employer)).toEqual(["Popeyes", "MOD Pizza", "Student mentor, UT Austin", "Apple", "Aritzia"]);
    expect(cards.jobs.timeline.map((entry) => entry.role)).toEqual([null, null, null, "Specialist, then technical specialist", null]);
    for (const entry of cards.jobs.timeline) expect(entry.tip.length).toBeGreaterThan(0);
  });

  it("model the mentors list and hold it empty until each mentor agrees to be named", () => {
    expect(cards.mentorship.mentors).toEqual({ title: "the people who shaped me", people: [] });
  });

  it("resolve every inline link in a card to the register", () => {
    for (const key of keys) {
      const { book: row, modal } = cards[key];
      for (const text of [row.title, row.meta, modal.title, ...modal.blocks]) expect(parseInlineLinks(text, registerHas).unknown, key).toEqual([]);
    }
  });

  it("read the IEEE meta as plain words where a label needs them", () => {
    expect(plainText(cards.ieee.book.meta)).toBe("President, Corporate Director, and AO, 2023 to 2026");
  });

  it("write book and modal titles in sentence case", () => {
    const proper = new Set(["High", "School", "One", "UT", "Austin"]);
    for (const key of keys) {
      for (const title of [cards[key].book.title, cards[key].modal.title]) {
        for (const word of title.split(" ").slice(1)) if (/^[A-Z]/.test(word)) expect(proper.has(word), title).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 3: Run it.** `pnpm vitest run lib/content/cards.test.ts`. Expected: FAIL (`CardKey` is not exported; `Object.keys(undefined)` throws because `siteContent.cards` does not exist).

- [ ] **Step 4: Append the card types** to `lib/content/types.ts`:

```ts

// The fourteen launch cards (docs/content/cards.md, approved 2026-10-08).
export type CardKey =
  | "mentorship" | "min-max" | "band" | "talos" | "travel" | "capital-one" | "hackathons"
  | "anthropic" | "misuki" | "ieee" | "jobs" | "this-site" | "fsdatalink" | "building-in-public";

// The book's two columns.
export type CardGroup = "work" | "people";

// width and height are the file at src.
export interface ImageRef { src: string; width: number; height: number; alt: string }
export interface PhotoRef extends ImageRef { crop: PhotoCrop | null }
// The Coil card's picture (3:4). The modal shows it first, as the flown card.
export interface CardPicture extends PhotoRef { caption: string | null }
// One of up to three photos after the card picture; keeps its own shape.
export interface ModalPhoto extends PhotoRef {
  caption: string;
  // Index into modal.blocks: the paragraph it sits beside (vertical) or above (horizontal).
  block: number;
}
export interface LogoRef { src: string; srcDark: string | null; width: number; height: number }

// What the Coil shows. A null ref is an asset C4 has not landed.
export type CardVisual =
  // flipX mirrors left to right when drawn. If C4 bakes the mirror into the export, it sets this false in the same commit.
  | { kind: "photo"; flipX: boolean; photo: CardPicture | null }
  // subtitle: the line the min/Max slide-out animation reveals (the animation comes later).
  | { kind: "logo"; logo: LogoRef | null; tile: "plain" | "anvil"; subtitle?: string }
  | { kind: "mark" }
  | { kind: "circles" };

export type CardModalKind = "logo" | "timeline" | "mentors" | "photo";

// External, opened in a new tab.
export interface CardLink { label: string; href: string }

// Blocks carry **bold**, *italic* and the inline link markup (lib/content/links.ts).
export interface CardModal {
  kind: CardModalKind;
  title: string;
  links: readonly CardLink[];
  photos: readonly ModalPhoto[];
  blocks: readonly string[];
}

export interface CardContent {
  group: CardGroup;
  visual: CardVisual;
  book: { title: string; meta: string };
  modal: CardModal;
}

export interface Mentor { name: string; href: string }
export interface MentorsList { title: string; people: readonly Mentor[] }
export interface TimelineEntry { employer: string; role: string | null; when: string; logo: LogoRef | null; tip: string }

export type Cards = Record<Exclude<CardKey, "mentorship" | "jobs">, CardContent> & {
  mentorship: CardContent & { mentors: MentorsList };
  jobs: CardContent & { timeline: readonly TimelineEntry[] };
};
```

- [ ] **Step 5: Write the cards, every string verbatim,** `lib/content/cards.ts`. The file order is the strand order. `\"` is an escaped double quote; `*` and `**` are Aaron's emphasis, kept for the renderer.

```ts
import type { CardKey, Cards } from "./types";

// The fourteen launch cards (docs/content/cards.md, approved 2026-10-08), in strand order.
// A null visual ref is an asset C4 has not landed; every card opens a modal.
export const cards: Cards = {
  mentorship: {
    // The crop is a box in the 1084 by 724 repo copy (layout only): docs/content/photos.md's
    // 860,0,2984,2832 on the 4240 by 2832 original, scaled. C4 exports the original.
    group: "people", visual: { kind: "photo", flipX: false, photo: { src: "/photos/hsf-speaking.jpeg", width: 1084, height: 724, crop: { x: 220, y: 0, w: 543, h: 724 }, alt: "Me speaking into a microphone at a Hispanic Scholarship Fund event", caption: null } },
    book: { title: "Mentorship", meta: "Coach, tutor and speaker, ongoing" },
    modal: { kind: "logo", title: "Mentorship", links: [{ label: "Grab some time with me", href: "https://cal.com/aaron-sulbaran" }], photos: [], blocks: [
      "I wouldn't be where I am now without the mentors who have shaped me. People made time for me, so I make time back. I've coached first-year scholars, worked as a student mentor on campus, and been an official mentor to Hispanic Scholarship Fund (HSF) scholars at the annual STEM Summit.",
      "I take coffee chats in both directions. If I'm asking people for their time, I should be willing to give mine, and I lose track of time in them.",
    ] },
    // Held empty on purpose: each mentor's name and link go in once that person agrees to be named.
    mentors: { title: "the people who shaped me", people: [] },
  },
  "min-max": {
    group: "work", visual: { kind: "logo", logo: null, tile: "plain", subtitle: "minimize spend. Maximize rewards" },
    book: { title: "min/Max", meta: "Founder, 2025 to now" },
    modal: { kind: "logo", title: "min/Max", links: [], photos: [], blocks: [
      "An agentic credit card co-pilot that automatically picks the best card in your wallet for every purchase, every time. I haven't launched yet, but when I do you'll be the first to know.",
    ] },
  },
  band: {
    group: "people", visual: { kind: "photo", flipX: false, photo: null },
    book: { title: "Jordan High School band", meta: "Section leader to drum major, 2021 to 2023" },
    modal: { kind: "logo", title: "The band", links: [{ label: "Check out my final performance ever", href: "https://www.youtube.com/watch?v=wra00zjxQcU&list=PLeolsE0k0lv8&index=7" }], photos: [], blocks: [
      "I joined Jordan High School's band the year the school opened, as a section leader. I became woodwind captain junior year, then drum major in my last year. I played [bass clarinet](pop:contrabass-clarinet).",
      "The band kept growing as the school grew, and we started winning. We won a regional championship just before I left. After I graduated, the band won an invitational I *know* it had been chasing for years. I still count that win as partly mine.",
      "Leading a few hundred students towards the same goal through a score and a marching dot book is where I realized I first fell in love with leadership.",
    ] },
  },
  talos: {
    group: "work", visual: { kind: "logo", logo: null, tile: "anvil" },
    book: { title: "Talos", meta: "Builder, 2026" },
    modal: { kind: "logo", title: "Talos", links: [], photos: [], blocks: [
      "Talos is my executive assistant. Every day it builds my itinerary, reads all my inboxes, my messages, and tells me what needs me first. I'm currently training it to take action autonomously, with lots of safeguards in place. Its limits are written in code, not in prompts.",
      "I built it because I wanted a use of AI in my life that did something real. It started at a one-day Vercel hackathon in New York and saves me hours every week. I plan to open source it.",
    ] },
  },
  travel: {
    group: "people", visual: { kind: "photo", flipX: false, photo: null },
    book: { title: "Travel", meta: "Yosemite, Mt. Fuji and more" },
    modal: { kind: "photo", title: "Travel", links: [], photos: [], blocks: [
      "I love to travel, and I try to be intentional about it. Japan and Dubai are two of my favorite trips ever. I have lots of exciting travel planned soon and can't wait to go! If you have destination recs, feel free to let me know!",
      "A huge inspiration and fuel for my love for travel is [my sister](pop:sister-kyoto), Barbara. I call her hermana but the world knows her as \"Travel with Barbs\" and she owns her own travel agency called \"[Sulara](https://sularatravel.com/).\" She's my inspiration to, above all, follow your dreams, go [check her out](https://www.instagram.com/travelwithbarbss/)!",
    ] },
  },
  "capital-one": {
    group: "work", visual: { kind: "logo", logo: null, tile: "plain" },
    book: { title: "Capital One", meta: "Intern, 2024 to 2026" },
    modal: { kind: "logo", title: "Capital One", links: [], photos: [], blocks: [
      "I spent three summers at Capital One, and each one moved me closer to product.",
      "**2024, business analyst.** My first look at corporate America. I met my first product manager, who told me a PM is a manager \"that gets people to trust them and their decisions without having the power to change their salaries.\" That sentence changed my career trajectory.",
      "**2025, product manager.** The summer I started explaining the job to other people. Explaining it made me realize how much I enjoyed the work that comes with being a PM.",
      "**2026, applied AI (product manager).** My first stab at building agentic workflows inside Capital One's internal machine learning tools to test how those models behaved.",
      "If you want to learn more, I'll say what I can in person.",
    ] },
  },
  hackathons: {
    group: "work", visual: { kind: "photo", flipX: false, photo: null },
    book: { title: "Hackathons", meta: "Builder, 2026 to now" },
    modal: { kind: "logo", title: "Hackathons", links: [], photos: [], blocks: [
      "**Hook 'Em Hacks, spring 2026.** Won the finance track with the first build and MVP/Proof of Concept of min/Max.",
      "**UFCU Develop U, fall 2026.** Won with UFCU Front Desk, a digital front desk assistant that makes joining a credit union simple and still sounds like them.",
      "**Vercel one-day hackathon, New York.** Where I started Talos.",
      "HackTX & others, coming soon.",
    ] },
  },
  anthropic: {
    group: "work", visual: { kind: "logo", logo: null, tile: "plain" },
    book: { title: "Anthropic", meta: "Claude Campus Ambassador, 2026" },
    modal: { kind: "logo", title: "Anthropic", links: [{ label: "txclaude.org", href: "https://txclaude.org" }], photos: [], blocks: [
      "In spring 2026 I was a Claude ambassador at UT Austin. We grew the club to over a thousand members, with meetings of 60 to 80 people on average and about 100 at our end of year hackathon.",
      "What I loved most was teaching people to use these tools fast. By the end of the meetings, students were already building their own things with skills they developed in one hour classes I helped lead.",
    ] },
  },
  misuki: {
    group: "people", visual: { kind: "photo", flipX: false, photo: null },
    book: { title: "Misuki", meta: "2001 Mazda Miata, five-speed" },
    modal: { kind: "photo", title: "Misuki", links: [], photos: [], blocks: [
      "I worked all through high school to set myself up for college. That included an ongoing hunt for a car. I ended up buying this car early Senior year in cash, because I didn't want a car loan. The day my dad went to buy her for me, I was conducting a game-day halftime show and got a bank alert on my watch for a huge withdrawal from my bank account. I was nervous the whole performance, and then found out later he was trying to surprise me.",
      "Her engine blew in college, a family friend in Houston rebuilt it, and she's still my daily driver. I named her Misuki, from the M in Mazda and a nod to [Fast and Furious](tip:misuki-suk). I took her around Circuit of the Americas once, and it was one of the most fun days of my life.",
    ] },
  },
  ieee: {
    group: "work", visual: { kind: "logo", logo: null, tile: "plain" },
    book: { title: "IEEE UT Austin", meta: "President, Corporate Director, and [AO](tip:ieee-ao), 2023 to 2026" },
    modal: { kind: "logo", title: "IEEE UT Austin", links: [{ label: "ieee.ece.utexas.edu", href: "https://ieee.ece.utexas.edu/" }], photos: [], blocks: [
      "IEEE UT was my home away from home at UT. I credit much of my leadership development to my experience here. From assistant officer my freshman year to president my junior year, I made some of my closest friends in this organization.",
      "My Freshman year I helped host events to bring ECE majors together, particularly my fellow freshmen going through the same struggles I was going through. I also performed at Cockrell's yearly Ramshorn Talent show as \"Aango,\" a [Rango](tip:aango) knockoff that rapped.",
      "My Sophomore year I jumped to an exec role and started the year out with a balance sheet that said the previous year had $200 in profit (because we were spending everything we earned). I set a goal of $5K, answered company emails almost every day for a school year, and we ended at about $10K.",
      "My Junior year I helped lead the org I came to love and helped bring home the Outstanding Large Student Branch Chapter award, served as the broader IEEE Central Texas Section student representative, and wore many hats as I supported my fellow officers for one final year.",
      "My proudest moments in IEEE came when ECE students told me that a company I brought to an IEEE event is the reason they got their internships or jobs. I aim to never stop making an impact, no matter where I go.",
    ] },
  },
  jobs: {
    group: "people", visual: { kind: "circles" },
    book: { title: "\"unflattering\" jobs that paid for school", meta: "Popeyes to Aritzia, 2021 to 2026" },
    modal: { kind: "timeline", title: "The jobs that paid my way", links: [{ label: "The LinkedIn post", href: "https://lnkd.in/p/g3mXFGcY" }], photos: [], blocks: [
      "I'm self-funded, so I've worked almost every year since high school. Those jobs paid for my car in cash, covered rent, and chipped away at tuition so I could graduate debt free.",
      "The money (although it was necessary) isn't what I took away. I realized that after finishing my degree, I have my whole life to work off a screen and specs. So I intentionally went looking for jobs where someone walks up with a problem and you solve it face to face in that shift. I think some people want to move away from service industry jobs as quickly as possible once they're in school, but I took it as an opportunity to try out some different things before claiming a desk in an office.",
      "I wrote about my work experience outside of class on LinkedIn, and my hook was \"I don't trust people who haven't worked an unflattering job.\" It got 130,000 impressions and almost a thousand reactions. My favorite line is \"You know to be nice to the person behind the counter because you were the person behind the counter.\" I guess it resonated with people.",
    ] },
    timeline: [
      { employer: "Popeyes", role: null, when: "Sophomore year of high school", logo: null,
        tip: "Get the blackened tenders every time, they have to make them fresh usually (bonus points if you can get them on a spicy chicken sandwich, secret menu item)" },
      { employer: "MOD Pizza", role: null, when: "Sophomore to senior year of high school", logo: null,
        tip: "Try the sri-rancha and hot honey sauce combo. Also mix their berry lemonade with sprite and powerade for a mocktail my store called the \"galaxy\"" },
      { employer: "Student mentor, UT Austin", role: null, when: "Sophomore year of college", logo: null,
        tip: "Use your college resources! This one is a no brainer but if you don't we just get paid to do homework" },
      { employer: "Apple", role: "Specialist, then technical specialist", when: "2024 to 2025", logo: null,
        tip: "Get AppleCare and some sort of cloud storage. Simple as that, it always broke my heart to see people lose their photos and have to shell out $1k for a new phone. And yes, Apple can't recover anything the privacy is real." },
      { employer: "Aritzia", role: null, when: "2025 to 2026", logo: null,
        tip: "My most random job. If you work here, all the women in your life will want a discount. With that said, the effortless pants and sweatfleece line are basically unisex products..." },
    ],
  },
  "this-site": {
    group: "work", visual: { kind: "mark" },
    book: { title: "This site", meta: "Portfolio (design playground), 2026" },
    modal: { kind: "logo", title: "This site", links: [{ label: "The repo on GitHub", href: "https://github.com/aaron-sulbaran/aaron-personal-portfolio" }], photos: [], blocks: [
      "I'm building this site and continuing to update it as I grow. I [design](tip:this-site-playground) it, write the specs, and manage a team of AI agents that help me build it, which is a good test of how I'd run a product team. The repo is public.",
    ] },
  },
  fsdatalink: {
    group: "people", visual: { kind: "logo", logo: null, tile: "plain" },
    book: { title: "The family business", meta: "Assistant Manager & SWE, 2022 to 2024" },
    modal: { kind: "logo", title: "My dad's business", links: [{ label: "fsdatalink.com", href: "https://www.fsdatalink.com/" }], photos: [], blocks: [
      "My dad built a telecom business from nothing. I figured things out right next to him. I learned small-business taxes and tax breaks, and I was fascinated that people used laws that would never exist in Venezuela. I ended up doing the accounting, the finances and whatever else needed solving, sometimes unpaid because I wanted to help him.",
      "I even took up the role of a software engineer, building internal tools and workflows for my dad and the field engineers that we dispatched. It's where (unknowingly) my interest in money, financial literacy, and optimizing technology started.",
    ] },
  },
  "building-in-public": {
    group: "people", visual: { kind: "photo", flipX: true, photo: null },
    book: { title: "Building in public", meta: "LinkedIn and X, ongoing" },
    modal: { kind: "logo", title: "Building in public", links: [{ label: "LinkedIn", href: "https://www.linkedin.com/in/aaron-sulbaran/" }, { label: "X (@imaaronsulbaran)", href: "https://x.com/imaaronsulbaran" }], photos: [], blocks: [
      "I'm trying to build in public (tbh, I fell off for a couple of months and I'm easing back in). So far: 2,500+ people follow me on LinkedIn, and my posts have had 450,000 impressions in three months. Being active on LinkedIn opened doors in Toronto and NYC this summer and got me a few brand deals. After talking to enough founders and investors, I know I have to get on X next.",
      "While I love building, I also love creating and sharing. So why not share what works and what doesn't, with no polish on the parts that didn't. I'd rather be useful than look flawless.",
      "For every 100 people who think it's cringe, I get 1 person who DMs me saying \"your post inspired me to...\" and that makes it worth it to me.",
    ] },
  },
};

// The Coil's order; [0] is the lead card the visitor sees when it settles.
export const strandOrder: readonly CardKey[] = [
  "mentorship", "min-max", "band", "talos", "travel", "capital-one", "hackathons",
  "anthropic", "misuki", "ieee", "jobs", "this-site", "fsdatalink", "building-in-public",
];

// The book's two columns, in Aaron's doc order (not the strand's).
export const bookWorkOrder: readonly CardKey[] = ["min-max", "talos", "capital-one", "anthropic", "ieee", "hackathons", "this-site"];
export const bookPeopleOrder: readonly CardKey[] = ["mentorship", "band", "jobs", "fsdatalink", "misuki", "travel", "building-in-public"];
```

- [ ] **Step 6: Wire the cards and orders** in `lib/content.ts`:
  1. Under `import { register } from "./content/register";` add `import { bookPeopleOrder, bookWorkOrder, cards, strandOrder } from "./content/cards";`
  2. Directly after the `register,` line, add:
     ```ts
       // The fourteen launch cards (lib/content/cards.ts). C3 moves the Coil and the
       // book onto them; until then the legacy strand and rows below drive both.
       cards,
     ```
  3. In `book`, directly after `photosHeading: "Photos",` add:
     ```ts
         // The cards' book (C3 renders it): two columns of card keys, every row a modal.
         peopleHeading: "People",
         workOrder: bookWorkOrder,
         peopleOrder: bookPeopleOrder,
     ```
  4. In `strand`, directly after `strand: {` add:
     ```ts
         // The fourteen cards in Coil order, lead card first. strandTiles still reads
         // the legacy pattern and lists below until C3 swaps the scene.
         order: strandOrder,
     ```
  5. Replace the Task 2 re-export line with:
     ```ts
     export type {
       CardContent, CardGroup, CardKey, CardLink, CardModal, CardModalKind, CardPicture, Cards, CardVisual, DefinitionEntry, ImageRef,
       InlineRegister, LogoRef, Mentor, MentorsList, ModalPhoto, PhotoCrop, PhotoRef, PopEntry, TimelineEntry, TipEntry,
     } from "./content/types";
     ```

- [ ] **Step 7: Run it.** `pnpm vitest run lib/content lib/content.test.ts lib/photoSizes.test.ts && pnpm tsc --noEmit`. Expected: links 12, register 7, cards 14, the legacy content tests and photo sizes PASS; tsc silent. If a verbatim spot check fails, compare the string with this plan character by character; never edit the test to match.

- [ ] **Step 8: Commit**

```bash
git add lib/content/types.ts lib/content/cards.ts lib/content/cards.test.ts lib/content.ts lib/testing/jpegSize.ts lib/photoSizes.test.ts
git commit -m "Content: the fourteen launch cards, the mentors list held empty, and the strand and book orders

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Soundtrack credit fields and the music tip

**Files:** Create `lib/content/tracks.ts`; Modify `lib/content/types.ts`, `lib/content.ts`; Test `lib/content/tracks.test.ts`.

**Interfaces:**
- Consumes: `register`, `registerHas`, `resolveTip` (Task 2).
- Produces: `type TrackLicenseKind = "cc-by-3.0" | "cc-by-4.0" | "licensed" | "adapted"`; `interface InspiredBy { title: string; artist: string; href: string }`; `interface SoundtrackTrack { title: string; artist: string; src: string; credit: string; licenseKind: TrackLicenseKind; licenseUrl: string | null; why: string | null; inspiredBy: InspiredBy | null; spotifyUrl: string | null; cover: string | null }` (still exported from `@/lib/content`, as is `Track`); from `lib/content/tracks.ts`: `liveTracks: readonly SoundtrackTrack[]` (wired as `siteContent.soundtrack.tracks`), `creditProblems(track: SoundtrackTrack): string[]`, `hasAdaptedTrack(tracks: readonly SoundtrackTrack[]): boolean`, `hasFullyLicensedTrack(tracks: readonly SoundtrackTrack[]): boolean`, `tipText(key: string): string | null` (re-exported from `@/lib/content`).

- [ ] **Step 1: Write the failing test** `lib/content/tracks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { siteContent, tipText, type SoundtrackTrack } from "@/lib/content";
import { creditProblems, hasAdaptedTrack, hasFullyLicensedTrack, liveTracks } from "@/lib/content/tracks";

const live: readonly SoundtrackTrack[] = siteContent.soundtrack.tracks;

// music.md's approved track 1; its record and file land together in C7.
const sunsetPier: SoundtrackTrack = {
  title: "Sunset Pier", artist: "Philman (Philip Milman)", src: "/audio/sunset-pier.mp3",
  credit: "\"Sunset Pier\" by Philman (Philip Milman), from Lud and Schlatt Crossing, funded by Ludwig and Jschlatt. Licensed CC BY 3.0. Compressed for web.",
  licenseKind: "cc-by-3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  why: "Ludwig and Jschlatt funded 20 minutes of music any creator can use for free. I needed music I could use, and that was the first place I looked. I like Ludwig for this kind of thing.",
  inspiredBy: null, spotifyUrl: null, cover: null,
};

// A neutral fixture: an adapted track is credited to its original's author, never to Aaron.
const adapted = (credit: string): SoundtrackTrack => ({
  title: "Night Drive", artist: "Example Artist", src: "/audio/night-drive.mp3", credit,
  licenseKind: "adapted", licenseUrl: null, why: null, inspiredBy: null, spotifyUrl: null, cover: null,
});

describe("soundtrack credits", () => {
  it("credit the three live tracks in full", () => {
    expect(live).toBe(liveTracks);
    expect(live.map((track) => track.credit)).toEqual([
      "\"Small Steps\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
      "\"Waves of Sleep\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
      "\"Slow Lights\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
    ]);
    for (const track of live) {
      expect([track.licenseKind, track.why, track.inspiredBy]).toEqual(["cc-by-4.0", null, null]);
      expect(creditProblems(track)).toEqual([]);
    }
  });

  it("accept the approved Sunset Pier credit as written", () => {
    expect(creditProblems(sunsetPier)).toEqual([]);
  });

  it("name the CC BY deed the credit claims", () => {
    expect(creditProblems({ ...sunsetPier, licenseUrl: "https://creativecommons.org/licenses/by/4.0/" })).toContain("licenseUrl must be the CC BY deed");
    expect(creditProblems({ ...sunsetPier, credit: "\"Sunset Pier\" by Philman (Philip Milman). Compressed for web." })).toContain("credit must say Licensed CC BY 3.0.");
  });

  it("never credit an adapted track as licensed", () => {
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran. Licensed for this site."))).toContain("an adapted track is never credited as licensed");
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist."))).toContain("an adapted track says it is adapted");
    expect(creditProblems(adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran."))).toEqual([]);
  });

  it("keep at least one fully licensed track in the set", () => {
    expect(hasFullyLicensedTrack(live)).toBe(true);
    expect(hasFullyLicensedTrack([adapted("\"Night Drive\" by Example Artist, adapted by Aaron Sulbaran.")])).toBe(false);
    expect(hasAdaptedTrack(live)).toBe(false);
  });

  it("tip the music note without the adapting clause while no adapted track plays", () => {
    expect(tipText("music-note")).toBe("I'm not playing my usual playlist (a lot of Tyler, the Creator, Childish Gambino and Steve Lacy) because I don't own it, and I picked music that's easy to read to. The credits are in the corner.");
    expect(tipText("aango")).toBe("yes, the chameleon from that one kid's movie");
    expect(tipText("constructor")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it.** `pnpm vitest run lib/content/tracks.test.ts`. Expected: FAIL, `Failed to resolve import "@/lib/content/tracks"`.

- [ ] **Step 3: Append the track types** to `lib/content/types.ts`:

```ts

// The soundtrack (docs/content/music.md). An adapted track is credited as adapted, never as
// licensed for this site.
export type TrackLicenseKind = "cc-by-3.0" | "cc-by-4.0" | "licensed" | "adapted";

// Shown as a link, never played or embedded.
export interface InspiredBy { title: string; artist: string; href: string }

export interface SoundtrackTrack {
  title: string;
  // Whom the license says to credit: the original's author, never me for a track I only adapted.
  artist: string;
  src: string;
  // Author, title, collection, named funders, license, and "Compressed for web." for a re-encode.
  credit: string;
  licenseKind: TrackLicenseKind;
  licenseUrl: string | null;
  // Two sentences in Aaron's voice; null until he writes them.
  why: string | null;
  inspiredBy: InspiredBy | null;
  spotifyUrl: string | null;
  // A tile designed for the site; the music license never covers album art.
  cover: string | null;
}
```

- [ ] **Step 4: Write the live tracks, the credit rules and `tipText`** in `lib/content/tracks.ts` (the three credit lines are built from `public/audio/LICENSES.md`, in the approved Sunset Pier format):

```ts
import { register, registerHas, resolveTip } from "./register";
import type { SoundtrackTrack } from "./types";

// The tracks the player ships today (public/audio/LICENSES.md): Lee Rosevere,
// CC BY 4.0, re-encoded to 160 kbps for the web.
export const liveTracks: readonly SoundtrackTrack[] = [
  {
    title: "Small Steps", artist: "Lee Rosevere", src: "/audio/track-01.mp3",
    credit: "\"Small Steps\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
    licenseKind: "cc-by-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", why: null, inspiredBy: null, spotifyUrl: null, cover: null,
  },
  {
    title: "Waves of Sleep", artist: "Lee Rosevere", src: "/audio/track-02.mp3",
    credit: "\"Waves of Sleep\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
    licenseKind: "cc-by-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", why: null, inspiredBy: null, spotifyUrl: null, cover: null,
  },
  {
    title: "Slow Lights", artist: "Lee Rosevere", src: "/audio/track-03.mp3",
    credit: "\"Slow Lights\" by Lee Rosevere, from Music For Podcasts - Ambient. Licensed CC BY 4.0. Compressed for web.",
    licenseKind: "cc-by-4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", why: null, inspiredBy: null, spotifyUrl: null, cover: null,
  },
];

const CC_BY = /^cc-by-(\d)\.0$/;

// Why a track's credit would mislead or fall short of its license; empty means it may ship.
export function creditProblems(track: SoundtrackTrack): string[] {
  const problems: string[] = [];
  if (!track.credit.includes(`"${track.title}"`)) problems.push("credit must quote the title");
  if (!track.credit.includes(track.artist)) problems.push("credit must name the artist");
  const ccBy = CC_BY.exec(track.licenseKind);
  if (ccBy) {
    const version = `${ccBy[1]}.0`;
    if (!track.credit.includes(`Licensed CC BY ${version}.`)) problems.push(`credit must say Licensed CC BY ${version}.`);
    if (track.licenseUrl !== `https://creativecommons.org/licenses/by/${version}/`) problems.push("licenseUrl must be the CC BY deed");
  }
  if (track.licenseKind === "adapted") {
    if (/\blicensed\b/i.test(track.credit)) problems.push("an adapted track is never credited as licensed");
    if (!/\badapted\b/i.test(track.credit)) problems.push("an adapted track says it is adapted");
  }
  return problems;
}

export function hasAdaptedTrack(tracks: readonly SoundtrackTrack[]): boolean {
  return tracks.some((track) => track.licenseKind === "adapted");
}

// Removing any other track on request must leave the band one it may play.
export function hasFullyLicensedTrack(tracks: readonly SoundtrackTrack[]): boolean {
  return tracks.some((track) => track.licenseKind !== "adapted");
}

// A tip's words as a visitor should read them now: the music note's adapting
// clause shows only while an adapted track is in the player.
export function tipText(key: string): string | null {
  if (!registerHas("tip", key)) return null;
  return resolveTip(register.tip[key], hasAdaptedTrack(liveTracks));
}
```

- [ ] **Step 5: Move the type and wire the tracks** in `lib/content.ts` (it gets shorter):
  1. Delete the seven-line `export interface SoundtrackTrack { ... }` block at the top and put in its place:
     ```ts
     import type { SoundtrackTrack } from "./content/types";
     import { liveTracks } from "./content/tracks";
     ```
  2. In `soundtrack`, replace the whole `tracks: [ ... ] satisfies SoundtrackTrack[],` array (three objects) with `tracks: liveTracks,`. Leave every other soundtrack string (`creditLead` and the rest) unchanged.
  3. Add `InspiredBy, SoundtrackTrack, TrackLicenseKind` to the `export type { ... } from "./content/types";` list, and under it add `export { tipText } from "./content/tracks";`. Leave `export type Track = SoundtrackTrack;` where it is.

- [ ] **Step 6: Run it.** `pnpm vitest run lib/content lib/waveform/copy.test.ts && pnpm tsc --noEmit`. Expected: tracks 6 and every earlier content test PASS, the band's credit test unchanged; tsc silent (`lib/audio.ts` reads only `src` and `title`).

- [ ] **Step 7: Commit**

```bash
git add lib/content/types.ts lib/content/tracks.ts lib/content/tracks.test.ts lib/content.ts
git commit -m "Content: the live tracks move to lib/content/tracks.ts with credit, license, why and inspired-by fields, and a music tip that stays true

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The whole-content sweep

**Files:** Create `lib/testing/walk.ts`; Test `lib/testing/walk.test.ts`, `lib/content/sweep.test.ts`.

**Interfaces:**
- Consumes: `siteContent` (Tasks 2 to 4), `parseInlineLinks`, `plainText` (Task 1), `registerHas` (Task 2).
- Produces: `interface Leaf { path: string; text: string }`; `walkStrings(value: unknown, path?: string): Leaf[]` (test helper only).

- [ ] **Step 1: Write the failing walker test** `lib/testing/walk.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { walkStrings } from "@/lib/testing/walk";

describe("walkStrings", () => {
  it("collects every string with its path, skipping functions, numbers and nulls", () => {
    expect(walkStrings({ a: "x", b: ["y", { c: "z" }], f: () => "never", n: null, d: 3 })).toEqual([{ path: "a", text: "x" }, { path: "b[0]", text: "y" }, { path: "b[1].c", text: "z" }]);
  });

  it("reads a bare string as a leaf at the root", () => {
    expect(walkStrings("solo")).toEqual([{ path: "", text: "solo" }]);
  });
});
```

- [ ] **Step 2: Run it.** `pnpm vitest run lib/testing/walk.test.ts`. Expected: FAIL, `Failed to resolve import "@/lib/testing/walk"`.

- [ ] **Step 3: Implement** `lib/testing/walk.ts`, then run Step 2 again (expected: 2 PASS):

```ts
export interface Leaf { path: string; text: string }

// Every string inside a value, with a readable path; functions are skipped.
export function walkStrings(value: unknown, path = ""): Leaf[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => walkStrings(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => walkStrings(item, path ? `${path}.${key}` : key));
  }
  return [];
}
```

- [ ] **Step 4: Write the sweep** `lib/content/sweep.test.ts`. It characterizes content the earlier tasks already pinned, so it passes on arrival; its failing-first check is the walker above.

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { siteContent } from "@/lib/content";
import { parseInlineLinks, plainText } from "@/lib/content/links";
import { registerHas } from "@/lib/content/register";
import { walkStrings } from "@/lib/testing/walk";

// Every string siteContent holds, old shapes and new.
const leaves = walkStrings(siteContent);

describe("every string in siteContent", () => {
  it("never uses an em dash", () => {
    expect(leaves.filter((leaf) => leaf.text.includes("\u2014")).map((leaf) => leaf.path)).toEqual([]);
  });

  it("points every inline link at the register or an https page", () => {
    expect(leaves.flatMap((leaf) => parseInlineLinks(leaf.text, registerHas).unknown.map((link) => `${leaf.path}: [${link.text}](${link.target})`))).toEqual([]);
  });

  it("leaves no half-written link behind", () => {
    expect(leaves.filter((leaf) => /[[\]]/.test(plainText(leaf.text))).map((leaf) => leaf.path)).toEqual([]);
  });

  it("points every local file reference at a file in public", () => {
    const files = leaves.filter((leaf) => /(?:^|\.)(?:src|srcDark|logo|cover)$/.test(leaf.path) && leaf.text.startsWith("/"));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((leaf) => !existsSync(join(process.cwd(), "public", leaf.text))).map((leaf) => `${leaf.path}: ${leaf.text}`)).toEqual([]);
  });

  it("never describes me in the third person in an alt", () => {
    const alts = leaves.filter((leaf) => /(?:^|\.)alt$/.test(leaf.path));
    expect(alts.length).toBeGreaterThan(0);
    for (const leaf of alts) expect(leaf.text, leaf.path).not.toMatch(/\bAaron\b/);
  });
});
```

- [ ] **Step 5: Run it.** `pnpm vitest run lib/content/sweep.test.ts lib/testing`. Expected: 5 sweep and 2 walker tests PASS. A sweep failure names a path and is a real finding: report it; change only strings this plan quotes.

- [ ] **Step 6: Commit**

```bash
git add lib/testing/walk.ts lib/testing/walk.test.ts lib/content/sweep.test.ts
git commit -m "Content: one sweep over every string for em dashes, broken links, missing files and third-person alts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verify the slice and open the PR

- [ ] **Step 1: Static checks and unit tests.** `pnpm tsc --noEmit && pnpm lint && pnpm test`. Expected: tsc silent; lint without errors (existing react-hooks warnings may remain); `Test Files  79 passed (79)`, `Tests  669 passed (669)` (baseline 73 and 623 plus links 12, register 7, cards 14, tracks 6, walk 2, sweep 5).

- [ ] **Step 2: Full-mode production build.** `NEXT_PUBLIC_SITE_MODE=full pnpm build`. Expected: completes with no new warnings. No server is started.

- [ ] **Step 3: End to end on this slice's ports.** `lsof -nP -iTCP:3190 -iTCP:3191 -sTCP:LISTEN` must print nothing (if a port is taken, stop and report). Then `CI=1 E2E_FULL_PORT=3190 E2E_HOLDING_PORT=3191 pnpm test:e2e`. Expected: every spec passes as on `main`; nothing a visitor sees changed. Only if a reviewer asks to look: `pnpm exec next start -p 3340 & echo "preview pid $!"`; record the number in your report and stop it with `kill <that number>`, never by name, pattern or port.

- [ ] **Step 4: Push and open the PR into `main`** (no mentor URLs in the body; do not merge):

```bash
git push -u origin c1-content-model
gh pr create --base main --head c1-content-model --title "C1: the content model (cards, register, link parser, track credits)" --body "$(cat <<'BODY'
The content pass's model, with no visible change.

- `lib/content/links.ts`: a pure parser for `[words](def|tip|pop:key)` and `[words](https://...)`; unknown keys and non-https targets are reported and kept as plain words; it never throws.
- `lib/content/register.ts`: the approved definitions, tips and photo pops (pop files land with C4).
- `lib/content/cards.ts`: the fourteen launch cards verbatim, the mentors list's shape (held empty until each mentor agrees to be named), `strand.order` (Mentorship first) and the book's two column orders.
- The live tracks move to `lib/content/tracks.ts`; `SoundtrackTrack` gains `credit`, `licenseKind`, `licenseUrl`, `why`, `inspiredBy`; an adapted track can never be credited as licensed; the music tip drops its adapting clause while no adapted track plays.
- Tests for each, plus a sweep over every string in `siteContent` (em dashes, broken links, missing files, third-person alts).

The legacy `WorkItem`, `Photo`, `HomeTile`, `strandTiles` and book rows are untouched; C3 swaps the Coil and the book.

Checks: `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` (79 files, 669 tests), a full-mode build, and the e2e suite on 3190 and 3191.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

---

## What C1 hands the later slices

- **C2 (inline links):** `parseInlineLinks(text, registerHas)` for segments; `register.def/tip/pop` for words, alts, captions, and `href` for a pop whose anchor is also a link; `tipText(key)` for a tip as it should read now. `**bold**` and `*italic*` stay in text segments for the renderer; `plainText` is for labels, `visibleText` for comparing against rendered text.
- **C3 (card system):** `siteContent.cards`, `strand.order`, `book.workOrder`/`peopleOrder`/`peopleHeading`. Once the scene and book read the cards, delete `strand.pattern`/`photos`/`work`, `strandTiles`, `homeTiles`, `book.workRows`/`photoRows`/`photosHeading`. Honor `flipX`; min/Max's `visual.subtitle` is ready for its animation; `cards.mentorship.mentors` is ready for either way the list opens and fills as mentors agree.
- **C4 (assets):** fill each `null` picture, logo (with its width and height), timeline `logo` and pop `file`, the card pictures' captions and the modal `photos` with their `block` indexes (`docs/content/photos.md` and `cards.md`, once Aaron approves), then shrink the awaiting list in `cards.test.ts`. A crop is a box inside the exported file, never on the original.
- **C7 (soundtrack data):** add Sunset Pier to `liveTracks` with its file, from the fixture in `tracks.test.ts`, keeping `hasFullyLicensedTrack` true.
