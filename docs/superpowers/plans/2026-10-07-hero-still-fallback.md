# Hero Still Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When no scene can run (no WebGL 2 API, a context that never starts, a failed chunk, a caught render error, a second lost context, or reduced motion), the hero shows a real still of the scene at rest instead of the empty field and a big DOM h1. In that path the loader's resting lockup hands over to the still in one frame, and a quiet notice the visitor can dismiss says why the page is still.

**Architecture:**
- A new debug token, `?coildebug=still`, holds the scene at rest. `scripts/render-posters.mjs` captures it at DPR 2 in three cuts per theme (wide, square, narrow), each as AVIF and WebP.
- `data-scene` gains a third value, `"still"`. A static, server-rendered `<picture>` built with Next's `getImageProps` art direction pattern shows the still under `group-data-[scene=still]/hero`. It loads lazily, so visitors who get the scene never fetch it.
- CoilStage decodes the chosen still through a memoized, detached copy of the same picture and marks `[data-hero-still]` with `data-still-ready`. The h1 goes sr-only on that mark, so a greeting is always visible whenever the still is not painted.
- The loader's end is a pure decision (`loaderEnd`, lib/loader/still.ts). In the still path the still fades in under the resting DOM lockup over `LOADER.stillFadeMs`, and the lockup then leaves in one frame. If the decode fails or does not finish within 1500ms, the loader takes the plain fade and the h1 carries the hero.
- The notice is a small client component rendered by CoilStage, backed by a pure localStorage store.

**Tech Stack:** Next 16.2 (Turbopack), React 19.2, TypeScript strict, Tailwind 3.4.19 (`group-has-*` available), GSAP 3.15, vanilla three, vitest (node, `lib/**/*.test.ts`), Playwright 1.63 (chromium channel), and the sharp 0.34.5 that ships with next.

## Decisions taken in this plan

1. **Task order.** The stills are rendered in Task 2, right after the token. The h1 gate (`data-still-ready`) and the loader's dissolve both need stills that really decode, so every later e2e runs against real files.
2. **Scene state callback.** `onSceneChange: (drawn: boolean)` becomes `onSceneChange: (scene: HeroScene) => void`, with `HeroScene = "on" | "off" | "still"`. HomeController holds `heroScene` and passes it to Loader as `scene`. CoilStage gets a `scene` prop only in Task 5, where the notice reads it.
3. **Hand-off (ruled by Fable).** The two lockups never crossfade. The still fades in under the resting DOM lockup over `LOADER.stillFadeMs` (400ms, linear). When that fade ends, the loader goes `gone` in one frame. If the pane showed (a slow load), the pane and its ground first fade off the resting lockup over the same 400ms, and then the still fades in under the lockup.
   - The test measures the name box's luminance spread (letters against the field, the existing `luminanceSpread` helper). The absolute luminance of that box moves as the cards come in behind it, so the spread is the measure.
   - The spread must never drop below its resting value during the fade or after the removal.
4. **Images (ruled by Fable).** Next's art direction pattern: `getImageProps` (unoptimized, since the stills are pre-encoded) feeds `<picture><source media type srcSet><img>`. The img is the wide WebP fallback. No lint waiver is needed: the img's parent is `<picture>`, and the Layer 1 next/image rule holds.
5. **Cuts (ruled by Fable).** Three cuts per theme at DPR 2, each in AVIF plus WebP:
   - wide 1440x900 (aspect >= 1.2)
   - square 1000x1000 (0.8 <= aspect < 1.2)
   - narrow 390x844 (aspect < 0.8)

   The media queries use `not all and (min-aspect-ratio: r)`, which is exactly a strict less-than (it matches `isNarrow`) and works in Safari before 16.4. File names follow `hero-{light,dark}-{wide,square,narrow}.{avif,webp}`.
6. **Decode.** `decodeHeroStill()` builds a detached `<picture>` with the same sources, so the browser makes the same choice of cut and format, and returns `img.decode()`. The promise is memoized per theme. CoilStage calls it in the effect that runs when no scene can run, so the decode is already in flight when the loader asks. The visible picture then reads the same URL from cache.
7. **Provider timing.** HomeController's layout effect calls `setLoaderMode`, which forces a synchronous re-render. React flushes the first commit's passive effects before it processes that re-render, so CoilStage's provide effect has run before Loader's layout effect calls `runLoader`. In the case where no context can be created, the provider is registered before `settleHomeLoad`. The `"wait"` outcome is only a safety net, and only on the fast path.
8. **Notice cause.**
   - `"noWebgl"` only when the API is missing or `canCreateWebGL2()` returned false.
   - `"unavailable"` for a failed chunk, a render error, or a second lost context.
   - `"reducedMotion"` takes precedence over both.

   This is a pure `stillCause()` in lib/coil/heroStill.ts.
9. **Reduced-motion h1.** Under reduced motion, one CSS rule holds the h1 at opacity 0 until `data-still-ready`, for at most `LOADER.handoffGiveUpMs`. Reduced visitors never see the big h1 flash before the still, and a still that never loads still frees the h1. The loader's reduced branch is untouched.
10. **Notice timing.** The notice renders when `scene === "still"` and `phase === "ready"`. A loader CSS rule keeps `[data-still-notice]` at `visibility:hidden` until the loader is gone, which also takes it out of the tab order.
11. **How the e2e tests disable WebGL.** e2e/support/webgl.ts exports `noWebgl2Api` (deletes `WebGL2RenderingContext`) and `noWebglContext` (getContext returns null for /webgl/i, the path Chrome takes with graphics acceleration off). The loader tests run in a `describe` with `--disable-gpu` added to `MUTED_ARGS`. They warm the cache with one load before the measured reload.
12. **Screenshots.** The render script hides everything except the canvas and the field poster img with an injected `visibility` rule, then shoots the canvas. The fixed header and the cursor overlap the stage's clip, so they must be hidden.

## Global Constraints

- No em dashes anywhere: code, comments, copy, commit messages, PR body.
- Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One branch, `hero-still`, one PR, base `main`.
- Never run `pnpm dev` and `pnpm build` in one checkout.
- A server's PID lives only in the shell variable that started it (`SERVER=$!`, `kill $SERVER`). Never use pkill. Check a port with `lsof -nP -iTCP:<port> -sTCP:LISTEN` first.
- Components:
  - no hex (tokens only)
  - no copy strings (siteContent only)
  - files around 200 lines at most
  - nothing inside a `Fill` may hold a ref, id, effect, live region or autofocus
- The builder edits code comments, never `.md` files.
- Targeted e2e recipe (one shell invocation, port 3160, one build):
  ```bash
  lsof -nP -iTCP:3160 -sTCP:LISTEN && { echo "3160 busy"; exit 1; }
  NEXT_PUBLIC_SITE_MODE=full GITHUB_CONTRIB_TOKEN= pnpm build && (
    pnpm exec next start -p 3160 & SERVER=$!
    curl -sf --retry 60 --retry-connrefused --retry-delay 1 http://localhost:3160 >/dev/null
    E2E_BASE_URL=http://localhost:3160 pnpm test:e2e <specs> --project=chromium; STATUS=$?
    kill $SERVER; exit $STATUS )
  ```

## Review Focus

- **Selectors in loaderMarkup.ts.** The still sits at opacity 0 exactly while the resting lockup is up and not dissolving. It shows at once on the reduced path and on deep reloads.
- **`loaderEnd`.** Every existing path keeps its outcome. `"wait"` happens on the fast path only.
- **Double ink during the fade.** The resting lockup is drawn at the composite's ink (`opacity: calc(var(--name-ink) * gain)`), not opaque. During the 400ms fade the name carries the DOM ink over the still's baked ink, then steps back to the baked ink when the lockup leaves. The test bounds the floor; Fable judges the step from a screen recording of both themes.
- **Hydration.** Poster is static, `data-still-ready` comes from an effect, and StillNotice mounts after an effect.
- **No still fetch with a scene.** Visitors with a scene never request `/coil/hero-*`.
- **Notice contrast.** `text-muted` against both stills is probed. If the probe fails, the fix is the `text-foreground` token, never a hex value.
- **Focus.** After "Got it", focus falls to body. This is accepted no-trap behaviour, and a test asserts it.

---

### Task 0: Worktree

**Files:** none

- [ ] Create the worktree and install:
  ```bash
  git -C "/Users/asulbaran21/Personal Projects/aaron-portfolio-website" worktree add -b hero-still "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-hero-still" main
  cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-hero-still" && pnpm install --frozen-lockfile
  ```
- [ ] Baseline: `pnpm test` passes and `pnpm tsc --noEmit` is clean. All later paths are relative to this worktree.

---

### Task 1: The `still` debug token

**Files:**
- Create: `lib/coil/debugFlags.ts`, `lib/coil/debugFlags.test.ts`
- Modify: `components/coil/scene/debug.ts`, `field.ts`, `entrance.ts`, `input.ts`, `nameSurface.ts`

**Interfaces:**
- `parseDebugFlags(search: string): DebugFlags`, which adds `stillMode` and `pinned`
- `heldFieldS(flags, elapsedS): number`
- debug.ts keeps `readDebugFlags()` and re-exports `DebugFlags`

- [ ] **Failing test.** Create `lib/coil/debugFlags.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { heldFieldS, parseDebugFlags } from "@/lib/coil/debugFlags";

  describe("scene debug flags", () => {
    it("reads nothing without the query", () => {
      expect(parseDebugFlags("")).toMatchObject({ debugMode: null, posterMode: false, stillMode: false, pinned: false, heldAt: null });
    });
    it("poster: the empty field, pinned", () => {
      expect(parseDebugFlags("?coildebug=poster")).toMatchObject({ posterMode: true, stillMode: false, pinned: true });
    });
    it("still: the scene at rest with its cards and name, pinned like the poster", () => {
      expect(parseDebugFlags("?coildebug=still")).toMatchObject({
        debugMode: "still", posterMode: false, stillMode: true, pinned: true, hideCards: false, hideName: false,
      });
      expect(parseDebugFlags("?coildebug=handoff, still").stillMode).toBe(true);
      expect(parseDebugFlags("?coildebug=stillness").stillMode).toBe(false);
    });
    it("keeps the other tokens", () => {
      expect(parseDebugFlags("?coildebug=at=3,ink=150,entrance=-200,nocards&drift=calm")).toMatchObject({
        heldAt: 3, inkOverride: 1, forcedEntranceMs: -200, hideCards: true, driftParam: "calm",
      });
    });
    it("holds the field clock at 0 for the poster and the still, else at= or the live clock", () => {
      expect(heldFieldS(parseDebugFlags("?coildebug=still"), 7)).toBe(0);
      expect(heldFieldS(parseDebugFlags("?coildebug=poster"), 7)).toBe(0);
      expect(heldFieldS(parseDebugFlags("?coildebug=at=3"), 7)).toBe(3);
      expect(heldFieldS(parseDebugFlags(""), 7)).toBe(7);
    });
  });
  ```
- [ ] Run `pnpm test lib/coil/debugFlags.test.ts`. Expected: FAIL, because `@/lib/coil/debugFlags` cannot be resolved.
- [ ] **Implement.** Create `lib/coil/debugFlags.ts`:
  ```ts
  // The scene's ?coildebug and ?drift flags, parsed from a query string. Pure,
  // so the token rules are tested; components/coil/scene/debug.ts reads the
  // page's own search. Token list and meanings: scene/debug.ts.
  export type DebugFlags = {
    debugMode: string | null;
    // ?coildebug=poster: the field's first frame, no cards, no name.
    posterMode: boolean;
    // ?coildebug=still: the scene at rest for the hero stills
    // (scripts/render-posters.mjs): cards and name drawn, nothing moving.
    stillMode: boolean;
    // The poster and the still hold one moment: the field clock at 0 (the
    // posters' fieldClocks(0), lib/coil/drift.ts), the entrance finished, the
    // conveyor idle at its start, the name's surface clock and wake still.
    pinned: boolean;
    hideCards: boolean;
    hideName: boolean;
    heldAt: number | null;
    forcedEntranceMs: number | null;
    inkOverride: number | null;
    driftParam: string | null;
  };

  export function parseDebugFlags(search: string): DebugFlags {
    const params = new URLSearchParams(search);
    const debugMode = params.get("coildebug");
    const tokens = new Set(debugMode ? debugMode.split(",").map((token) => token.trim()) : []);
    const match = (pattern: RegExp) => [...tokens].map((token) => token.match(pattern)).find(Boolean);
    const heldAt = match(/^at=(\d+(?:\.\d+)?)$/);
    const ink = match(/^ink=(\d+(?:\.\d+)?)$/);
    const forced = match(/^entrance=(-?\d+(?:\.\d+)?)$/);
    const posterMode = debugMode === "poster";
    const stillMode = tokens.has("still");
    return {
      debugMode,
      posterMode,
      stillMode,
      pinned: posterMode || stillMode,
      hideCards: tokens.has("nocards"),
      hideName: tokens.has("noname"),
      heldAt: heldAt ? Number(heldAt[1]) : null,
      inkOverride: ink ? Math.min(1, Number(ink[1]) / 100) : null,
      forcedEntranceMs: forced ? Number(forced[1]) : null,
      driftParam: params.get("drift"),
    };
  }

  // The field's clock (seconds) this frame: 0 when pinned, else the at= hold, else the live clock.
  export function heldFieldS(flags: Pick<DebugFlags, "pinned" | "heldAt">, elapsedS: number): number {
    return flags.pinned ? 0 : (flags.heldAt ?? elapsedS);
  }
  ```
- [ ] **debug.ts.** Delete the `DebugFlags` type (lines 44 to 60) and the body of `readDebugFlags` (lines 62 to 82), and replace them with:
  ```ts
  import { parseDebugFlags, type DebugFlags } from "@/lib/coil/debugFlags";
  export type { DebugFlags };

  export function readDebugFlags(): DebugFlags {
    return parseDebugFlags(window.location.search);
  }
  ```
  In the header comment (lines 31 to 37), after `poster (the field's first frame, no cards, no name),`, add: `still (the scene at rest for the hero stills: cards and name drawn, the field at its first frame, the entrance done, the conveyor idle; scripts/render-posters.mjs),`.
- [ ] **field.ts.**
  - Line 22 becomes `const { pinned } = flags;`, plus `import { heldFieldS } from "@/lib/coil/debugFlags";`.
  - Line 139 becomes `if (!pinned) fieldElapsed += dt;`.
  - Line 140's comment becomes `// The posters and the stills are the live field's first frame, so the scene picks up where they leave off.`
  - Line 142 becomes `const clocks = fieldClocks(heldFieldS(flags, fieldElapsed), false, driftPreset);`.
- [ ] **entrance.ts.**
  - Line 20 becomes `const { pinned, forcedEntranceMs } = flags;`.
  - Line 49 becomes `const realElapsedMs = pinned ? Number.POSITIVE_INFINITY : entranceElapsedMs(now);`.
- [ ] **input.ts.**
  - Line 38 becomes `const { pinned } = flags;`.
  - Line 296 becomes `if (!pinned) {`.
- [ ] **nameSurface.ts.**
  - Line 37 becomes `const { posterMode, pinned, heldAt } = flags;`.
  - Line 137 becomes `clock = heldAt ?? (reduced || pinned ? clock : clock + dt);`.
  - Line 145 becomes `const stirring = live && !reduced && !pinned;`.
  - Line 172 keeps `posterMode`, because the still renders its surface.
  - cards.ts and name.ts do not change: they read `posterMode`, which is false under `still`.
- [ ] Run `pnpm test lib/coil/debugFlags.test.ts && pnpm tsc --noEmit && pnpm lint`. Expected: PASS and clean.
- [ ] Commit: `feat(coil): ?coildebug=still holds the scene at rest for the hero stills`.

---

### Task 2: The still files (module, render script, twelve images)

**Files:**
- Create: `lib/coil/heroStill.ts`, `lib/coil/heroStill.test.ts`, `lib/coil/heroStill.files.test.ts`, `scripts/render-posters.mjs`
- Create (binary): `public/coil/hero-{light,dark}-{wide,square,narrow}.{avif,webp}`

**Interfaces:**
- Types: `HeroScene`, `StillTheme`, `StillCut`, `StillFormat`
- Constants: `HERO_STILL_DPR`, `HERO_STILL_SIZE`, `STILL_MEDIA`
- Functions: `stillCut(aspect)`, `heroStillSrc(theme, cut, format)`, `stillSources(theme)`, `stillFallback(theme)`

- [ ] **Failing test.** Create `lib/coil/heroStill.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { STILL_MEDIA, heroStillSrc, stillCut, stillFallback, stillSources } from "@/lib/coil/heroStill";

  describe("hero still", () => {
    it("cuts on the narrow composition's strict line and at 1.2", () => {
      expect(stillCut(390 / 844)).toBe("narrow");
      expect(stillCut(0.7999)).toBe("narrow");
      expect(stillCut(0.8)).toBe("square");
      expect(stillCut(1)).toBe("square");
      expect(stillCut(1.1999)).toBe("square");
      expect(stillCut(1.2)).toBe("wide");
      expect(stillCut(1440 / 900)).toBe("wide");
    });
    it("writes each line as a strict less-than old Safari understands", () => {
      expect(STILL_MEDIA.narrow).toBe("not all and (min-aspect-ratio: 800/1000)");
      expect(STILL_MEDIA.square).toBe("not all and (min-aspect-ratio: 1200/1000)");
    });
    it("names the files and orders the sources AVIF before WebP, narrow to wide", () => {
      expect(heroStillSrc("dark", "square", "webp")).toBe("/coil/hero-dark-square.webp");
      expect(stillSources("light").map((s) => [s.media ?? "", s.type, s.src])).toEqual([
        [STILL_MEDIA.narrow, "image/avif", "/coil/hero-light-narrow.avif"],
        [STILL_MEDIA.narrow, "image/webp", "/coil/hero-light-narrow.webp"],
        [STILL_MEDIA.square, "image/avif", "/coil/hero-light-square.avif"],
        [STILL_MEDIA.square, "image/webp", "/coil/hero-light-square.webp"],
        ["", "image/avif", "/coil/hero-light-wide.avif"],
      ]);
      expect(stillFallback("dark")).toBe("/coil/hero-dark-wide.webp");
    });
  });
  ```
  Create `lib/coil/heroStill.files.test.ts`:
  ```ts
  import { createRequire } from "node:module";
  import { join } from "node:path";
  import { fileURLToPath } from "node:url";
  import { describe, expect, it } from "vitest";
  import { HERO_STILL_DPR, HERO_STILL_SIZE, heroStillSrc } from "@/lib/coil/heroStill";

  type Meta = { width?: number; height?: number; format?: string; compression?: string };
  type Sharp = (input: string) => { metadata: () => Promise<Meta> };

  // The sharp next ships (it is not a direct dependency).
  function loadSharp(): Sharp | null {
    try {
      const require = createRequire(import.meta.url);
      return createRequire(require.resolve("next/package.json"))("sharp") as Sharp;
    } catch {
      return null;
    }
  }

  const sharp = loadSharp();
  if (!sharp) console.warn("heroStill.files.test: sharp is not resolvable through next; the hero still size checks are skipped.");
  const publicDir = fileURLToPath(new URL("../../public", import.meta.url));

  describe.skipIf(!sharp)("hero still files", () => {
    for (const theme of ["light", "dark"] as const) {
      for (const cut of ["wide", "square", "narrow"] as const) {
        const width = HERO_STILL_SIZE[cut].width * HERO_STILL_DPR;
        const height = HERO_STILL_SIZE[cut].height * HERO_STILL_DPR;
        it(`${theme} ${cut} is ${width}x${height} in AVIF and WebP`, async () => {
          const avif = await sharp!(join(publicDir, heroStillSrc(theme, cut, "avif"))).metadata();
          const webp = await sharp!(join(publicDir, heroStillSrc(theme, cut, "webp"))).metadata();
          expect({ compression: avif.compression, width: avif.width, height: avif.height }).toEqual({ compression: "av1", width, height });
          expect({ format: webp.format, width: webp.width, height: webp.height }).toEqual({ format: "webp", width, height });
        });
      }
    }
  });
  ```
- [ ] Run `pnpm test lib/coil/heroStill`. Expected: FAIL, because the module and the files are missing.
- [ ] **Implement.** Create `lib/coil/heroStill.ts`:
  ```ts
  import { COIL } from "./constants";

  // The hero still: the scene at rest (?coildebug=still, scripts/render-posters.mjs),
  // shown when no scene can run. data-scene on the hero: "on" the scene draws,
  // "off" one is on its way (the field poster), "still" none can run.
  export type HeroScene = "on" | "off" | "still";
  export type StillTheme = "light" | "dark";
  export type StillCut = "wide" | "square" | "narrow";
  export type StillFormat = "avif" | "webp";

  // Three cuts, each rendered at HERO_STILL_DPR: narrow under the scene's
  // narrow line (isNarrow, strict), square under SQUARE_BELOW, wide above.
  // The render script keeps a copy of the sizes.
  export const HERO_STILL_DPR = 2;
  export const HERO_STILL_SIZE: Readonly<Record<StillCut, { width: number; height: number }>> = {
    wide: { width: 1440, height: 900 },
    square: { width: 1000, height: 1000 },
    narrow: { width: 390, height: 844 },
  };
  // A still cut's line, not a scene value: where a square still beats the wide one.
  const SQUARE_BELOW = 1.2;

  export function stillCut(aspect: number): StillCut {
    if (aspect < COIL.narrow.aspectBelow) return "narrow";
    return aspect < SQUARE_BELOW ? "square" : "wide";
  }

  // "Aspect below r" in Level 3 syntax (Safari before 16.4 has no range
  // syntax): not all and (min-aspect-ratio: r) is exactly a strict less-than.
  const below = (ratio: number) => `not all and (min-aspect-ratio: ${Math.round(ratio * 1000)}/1000)`;
  export const STILL_MEDIA: Readonly<Record<Exclude<StillCut, "wide">, string>> = {
    narrow: below(COIL.narrow.aspectBelow),
    square: below(SQUARE_BELOW),
  };

  export function heroStillSrc(theme: StillTheme, cut: StillCut, format: StillFormat): string {
    return `/coil/hero-${theme}-${cut}.${format}`;
  }

  export type StillSource = { media?: string; type: string; src: string; cut: StillCut };

  // The picture's sources in the order the browser tries them, AVIF before
  // WebP in each cut (Safari before 16 has no AVIF); the img is the wide WebP.
  export function stillSources(theme: StillTheme): StillSource[] {
    const sources: StillSource[] = [];
    for (const cut of ["narrow", "square", "wide"] as const) {
      const media = cut === "wide" ? undefined : STILL_MEDIA[cut];
      sources.push({ media, type: "image/avif", src: heroStillSrc(theme, cut, "avif"), cut });
      if (cut !== "wide") sources.push({ media, type: "image/webp", src: heroStillSrc(theme, cut, "webp"), cut });
    }
    return sources;
  }

  export function stillFallback(theme: StillTheme): string {
    return heroStillSrc(theme, "wide", "webp");
  }
  ```
- [ ] Run `pnpm test lib/coil/heroStill.test.ts`. Expected: PASS. The files test still fails.
- [ ] **Render script.** Create `scripts/render-posters.mjs`:
  ```js
  #!/usr/bin/env node
  // Renders the hero stills (public/coil/hero-{light,dark}-{wide,square,narrow}.{avif,webp})
  // from a local production build of the full site: the scene at rest
  // (?coildebug=still: cards and name, the field at fieldClocks(0), the entrance
  // done, the conveyor idle), no hover, no seen rings (a fresh profile), each
  // theme through lib/theme.ts's storage key, at DPR 2. Only the canvas and the
  // field poster stay visible for the shot (the fixed header and the cursor
  // overlap the stage). Encoded with the sharp next ships: AVIF q60 4:4:4 (the
  // commit 49ee8ba recipe) and WebP q82. Each encoded buffer is written as is
  // and its error is measured on that same buffer.
  // Usage: node scripts/render-posters.mjs http://localhost:3002

  import { createRequire } from "node:module";
  import { writeFileSync } from "node:fs";
  import { dirname, join } from "node:path";
  import { fileURLToPath } from "node:url";
  import { chromium } from "@playwright/test";

  const require = createRequire(import.meta.url);
  const sharp = createRequire(require.resolve("next/package.json"))("sharp");

  const base = process.argv[2];
  if (!base || !/^http:\/\/localhost:\d+\/?$/.test(base)) {
    console.error("Usage: node scripts/render-posters.mjs http://localhost:<port> (a full-mode production build)");
    process.exit(1);
  }
  const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "coil");
  const THEME_KEY = "aaron-theme"; // lib/theme.ts THEME_STORAGE_KEY
  const DPR = 2; // lib/coil/heroStill.ts HERO_STILL_DPR
  const CUTS = { wide: { width: 1440, height: 900 }, square: { width: 1000, height: 1000 }, narrow: { width: 390, height: 844 } };
  const SETTLE_MS = 1500; // after the loader has gone: the name's surface growing in (900ms), the cards' last repaints
  const ONLY_STAGE = 'body *{visibility:hidden!important}section[data-scene] :is(canvas,img[src*="/coil/field-"]){visibility:visible!important}';
  const ENCODE = {
    avif: (input) => sharp(input).avif({ quality: 60, chromaSubsampling: "4:4:4" }).toBuffer(),
    webp: (input) => sharp(input).webp({ quality: 82, smartSubsample: true, effort: 6 }).toBuffer(),
  };

  async function encodeError(png, encoded) {
    const [a, b] = await Promise.all([png, encoded].map((input) => sharp(input).removeAlpha().raw().toBuffer()));
    let sum = 0;
    let max = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(a[i] - b[i]);
      sum += d;
      if (d > max) max = d;
    }
    return { mean: sum / a.length, max };
  }

  const browser = await chromium.launch({ channel: "chromium", args: ["--mute-audio"] });
  try {
    for (const theme of ["light", "dark"]) {
      for (const [cut, viewport] of Object.entries(CUTS)) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: DPR, colorScheme: theme, reducedMotion: "no-preference" });
        await context.addInitScript(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, theme]);
        const page = await context.newPage();
        await page.goto(new URL("/?coildebug=still", base).href);
        await page.waitForFunction(
          (want) =>
            document.querySelector("section[data-scene]")?.dataset.scene === "on" &&
            document.documentElement.dataset.home === "ready" &&
            document.documentElement.dataset.theme === want &&
            document.querySelector(".coil-loader")?.dataset.state === "gone",
          theme,
          { timeout: 60_000 },
        );
        await page.waitForLoadState("networkidle");
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(SETTLE_MS);
        await page.evaluate(async () => {
          window.__coil.api.freeze(true);
          await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        });
        await page.addStyleTag({ content: ONLY_STAGE });
        const png = await page.locator("section[data-scene] canvas").screenshot();
        const { width, height } = await sharp(png).metadata();
        if (width !== viewport.width * DPR || height !== viewport.height * DPR) throw new Error(`${theme} ${cut}: shot is ${width}x${height}`);
        for (const [format, encode] of Object.entries(ENCODE)) {
          const buffer = await encode(png);
          const file = `hero-${theme}-${cut}.${format}`;
          writeFileSync(join(OUT, file), buffer);
          const error = await encodeError(png, buffer);
          console.log(`${file}: ${width}x${height}, ${buffer.length} bytes, error mean ${error.mean.toFixed(2)} max ${error.max} of 255`);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  ```
- [ ] **Render.** Run this in one shell invocation, on port 3002, with nothing else running in this checkout:
  ```bash
  lsof -nP -iTCP:3002 -sTCP:LISTEN && { echo "3002 busy"; exit 1; }
  NEXT_PUBLIC_SITE_MODE=full GITHUB_CONTRIB_TOKEN= pnpm build && (
    pnpm exec next start -p 3002 & SERVER=$!
    curl -sf --retry 60 --retry-connrefused --retry-delay 1 http://localhost:3002 >/dev/null
    node scripts/render-posters.mjs http://localhost:3002; STATUS=$?
    kill $SERVER; exit $STATUS )
  ```
  Expected: twelve lines. Each AVIF should have an error mean of 4/255 or less. Open all twelve files and check: helix plus "Hi, I'm / Aaron"; no header, no cursor, no hint, no rings.
  The scene caps its DPR (1.75 on desktop), so the 2x shots are slightly soft. That matches what a 2x visitor's canvas shows.
- [ ] Run `pnpm test lib/coil/heroStill`. Expected: PASS (6 file tests and the module tests).
- [ ] Commit: `feat(coil): the hero stills, three cuts at 2x in AVIF and WebP, rendered from the scene at rest`.

---

### Task 3: The still state

**Files:**
- Create: `components/coil/Poster.tsx`, `e2e/support/webgl.ts`, `e2e/support/heroSamples.ts`
- Modify: `components/coil/CoilStage.tsx`, `components/home/HomeController.tsx`, `components/home/HeroText.tsx`, `components/loader/Loader.tsx`, `components/loader/loaderMarkup.ts`, `e2e/support/fallback.ts`, `e2e/no-webgl.spec.ts`, `e2e/fallbacks.spec.ts`

**Interfaces:**
- CoilStage `onSceneChange: (scene: HeroScene) => void`
- Loader prop `scene: HeroScene` (replaces `sceneOn`)
- `Poster({ stillReady })`
- `decodeHeroStill(): Promise<void>` (memoized per theme)
- `[data-hero-still][data-still-ready]`

- [ ] **e2e helpers.** Create `e2e/support/webgl.ts`:
  ```ts
  // The two ways a visitor's browser lacks WebGL 2, as init scripts: no API at
  // all, or an API whose contexts never start (Chrome with graphics acceleration off).
  export function noWebgl2Api() {
    Reflect.deleteProperty(window, "WebGL2RenderingContext");
  }
  export function noWebglContext() {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) {
      if (/webgl/i.test(kind)) return null;
      return (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
    } as typeof original;
  }
  ```
  Create `e2e/support/heroSamples.ts`:
  ```ts
  import type { Page } from "@playwright/test";

  // The hero sampled every frame from the first one until the loader has gone
  // and the hero has decided (data-scene not "off"), at most 2000 frames.
  export type HeroSample = {
    t: number; scene: string | null; state: string | null; dissolve: boolean;
    h1: boolean; rest: boolean; still: number; stillReady: boolean;
  };

  export async function sampleHero(page: Page) {
    await page.addInitScript(() => {
      const samples: unknown[] = [];
      (window as unknown as { __heroSamples: unknown[] }).__heroSamples = samples;
      const shows = (el: Element | null) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
      };
      const sample = () => {
        const hero = document.querySelector<HTMLElement>("section[data-scene]");
        const loader = document.querySelector<HTMLElement>(".coil-loader");
        const still = document.querySelector<HTMLElement>("[data-hero-still]");
        const img = [...(still?.querySelectorAll("img") ?? [])].find((el) => el.getClientRects().length > 0);
        const state = loader ? (loader.dataset.state ?? "armed") : null;
        const scene = hero?.dataset.scene ?? null;
        samples.push({
          t: performance.now(), scene, state,
          dissolve: !!loader?.hasAttribute("data-dissolve"),
          h1: shows(document.getElementById("hero-heading")),
          rest: shows(document.querySelector(".coil-loader__rest-greet")) && shows(document.querySelector(".coil-loader__rest-name")),
          still: still && still.getClientRects().length ? Number(getComputedStyle(still).opacity) : 0,
          stillReady: !!img && img.complete && img.naturalWidth > 0,
        });
        if ((state !== "gone" || scene === "off") && samples.length < 2000) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }

  export async function heroSamples(page: Page): Promise<HeroSample[]> {
    return page.evaluate(() => (window as unknown as { __heroSamples: HeroSample[] }).__heroSamples);
  }
  ```
- [ ] **Failing e2e.** In `e2e/support/fallback.ts`, replace `expectPosterHeroAndUsableBook` with the following. `settled` stays as it is.
  ```ts
  import { siteContent } from "@/lib/content";

  // Hydration errors on a page (React reports them on the console).
  export function watchHydration(page: Page) {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
    });
    return errors;
  }

  // What the hero looks like when no scene can run: the hero still (the scene
  // at rest, decoded), the h1 kept for assistive tech but visually hidden, and
  // a book that still opens its photos.
  export async function expectStillHeroAndUsableBook(page: Page) {
    const hero = page.locator("section[data-scene]");
    await expect(hero).toHaveAttribute("data-scene", "still");
    await expect(hero.locator("canvas")).toHaveCount(0);
    await expect(hero.locator("[data-hero-still]")).toHaveAttribute("data-still-ready", "");
    const still = hero.locator("[data-hero-still] img").filter({ visible: true });
    await expect(still).toHaveCount(1);
    await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const h1 = page.getByRole("heading", { level: 1, name: siteContent.hero.heading });
    await expect(h1).toBeAttached();
    expect(await h1.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
    // ...the existing "Drum major" book block, unchanged...
  }
  ```
  `e2e/no-webgl.spec.ts`:
  - Use `page.addInitScript(noWebgl2Api)` and `page.addInitScript(noWebglContext)` in place of the inline scripts.
  - Call `const hydration = watchHydration(page)` before `goto`.
  - Call `expectStillHeroAndUsableBook` and `expect(hydration).toEqual([])`.
  - Change the header comment to "The hero still, the hidden h1 and the book carry the page".
  - Add:
  ```ts
  test("stills that never load: the h1 carries the hero", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/coil/hero-*", (route) => route.abort());
    await page.addInitScript(noWebglContext);
    await page.goto("/?coildebug=1");
    await settled(page);
    await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
    await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
    expect(await page.locator("[data-hero-still]").getAttribute("data-still-ready")).toBeNull();
    const h1 = page.getByRole("heading", { level: 1, name: siteContent.hero.heading });
    await expect.poll(() => h1.evaluate((el) => el.getBoundingClientRect().width > 1 && el.checkVisibility({ opacityProperty: true }))).toBe(true);
    expect(errors).toEqual([]);
  });

  for (const [width, height, cut] of [[390, 844, "narrow"], [800, 1000, "square"], [1000, 1000, "square"], [1440, 900, "wide"]] as const) {
    test(`the still's cut at ${width}x${height} is ${cut}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.addInitScript(noWebgl2Api);
      await page.goto("/");
      await settled(page);
      const img = page.locator("[data-hero-still] img").filter({ visible: true });
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc)).toMatch(new RegExp(`-${cut}\\.avif$`));
    });
  }
  ```
  `e2e/fallbacks.spec.ts`:
  - The reduced and `throw=render` tests call the new helper, with `watchHydration` and `expect(hydration).toEqual([])`.
  - The reduced test also gets `await sampleHero(page)` before `goto`, then `expect((await heroSamples(page)).filter((s) => s.h1), "frames showing the h1").toEqual([]);`.
  - The control test becomes:
  ```ts
  test("control: a normal load fetches the scene chunk, never the hero still, and never reports still", async ({ page }) => {
    const scripts = watchScripts(page);
    const stills: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/coil/hero-")) stills.push(request.url());
    });
    await sampleHero(page);
    await openHome(page);
    expect(await scripts.sceneChunks()).toHaveLength(1);
    expect(stills, "hero still requests with a scene").toEqual([]);
    expect((await heroSamples(page)).filter((s) => s.scene === "still"), "frames reporting still").toEqual([]);
  });
  ```
- [ ] Run the targeted recipe with `e2e/fallbacks.spec.ts e2e/no-webgl.spec.ts`. Expected: FAIL, because `data-scene` is "off".
- [ ] **Implement.** Create `components/coil/Poster.tsx`:
  ```tsx
  import Image, { getImageProps } from "next/image";
  import { HERO_STILL_SIZE, stillFallback, stillSources, type StillCut, type StillTheme } from "@/lib/coil/heroStill";

  // The stage's posters, under the canvas, one per theme. The field at
  // fieldTime(0) (?coildebug=poster, 1440x900) carries the hero while a scene
  // is on its way, and the entrance flies in from it. The hero still (the scene
  // at rest, ?coildebug=still through scripts/render-posters.mjs, three cuts at
  // 2x in AVIF and WebP) covers it in data-scene="still": no scene can run. Its
  // images load lazily, so a scene visitor never fetches them. data-still-ready
  // marks a decoded still: the h1 hides only then (HeroText.tsx), and while the
  // loader's resting lockup holds, its stylesheet keeps the still at opacity 0
  // until the lockup hands to it (loaderMarkup.ts).
  export function Poster({ stillReady }: { stillReady: boolean }) {
    return (
      <div aria-hidden="true" className="absolute inset-0">
        <Image src="/coil/field-light.avif" alt="" fill unoptimized sizes="100vw" className="object-cover dark:hidden" />
        <Image src="/coil/field-dark.avif" alt="" fill unoptimized sizes="100vw" className="hidden object-cover dark:block" />
        <div data-hero-still data-still-ready={stillReady ? "" : undefined} className="absolute inset-0 hidden group-data-[scene=still]/hero:block">
          <StillPicture theme="light" className="dark:hidden" />
          <StillPicture theme="dark" className="hidden dark:block" />
        </div>
      </div>
    );
  }

  // Next's art direction: getImageProps per source (unoptimized: the render
  // script encodes the stills), one picture, the img the wide WebP.
  const stillProps = (src: string, cut: StillCut) => getImageProps({ src, alt: "", ...HERO_STILL_SIZE[cut], unoptimized: true }).props;

  function StillPicture({ theme, className }: { theme: StillTheme; className: string }) {
    const img = stillProps(stillFallback(theme), "wide");
    return (
      <picture className={`absolute inset-0 ${className}`}>
        {stillSources(theme).map((source) => {
          const props = stillProps(source.src, source.cut);
          return <source key={source.src} media={source.media} type={source.type} srcSet={props.srcSet ?? props.src} />;
        })}
        <img {...img} alt="" className="h-full w-full object-cover" />
      </picture>
    );
  }

  const decoding = new Map<StillTheme, Promise<void>>();

  // The still this visitor's picture will show, fetched and decoded: a detached
  // copy of the same picture (the same sources, so the same cut and format),
  // memoized per theme, so the loader's decoded() returns the in-flight promise
  // and the visible picture reads the file from cache.
  export function decodeHeroStill(): Promise<void> {
    const theme: StillTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    let promise = decoding.get(theme);
    if (!promise) {
      const picture = document.createElement("picture");
      for (const s of stillSources(theme)) {
        const source = document.createElement("source");
        if (s.media) source.media = s.media;
        source.type = s.type;
        source.srcset = s.src;
        picture.append(source);
      }
      const img = document.createElement("img");
      img.loading = "eager";
      picture.append(img);
      img.src = stillFallback(theme);
      promise = img.decode();
      decoding.set(theme, promise);
    }
    return promise;
  }
  ```
- [ ] **CoilStage.tsx.**
  - Remove `import Image` and the old `Poster` (lines 194 to 204). Add `import { Poster, decodeHeroStill } from "./Poster";` and `import type { HeroScene } from "@/lib/coil/heroStill";`.
  - The `onSceneChange` prop type becomes `(scene: HeroScene) => void`, with the comment `// "on" once the scene has drawn, "off" while one is on its way, "still" once none can run.`
  - Add `const [stillDecoded, setStillDecoded] = useState(false);`.
  - The effect at lines 85 to 90 becomes:
  ```ts
  useEffect(() => {
    if (eligible) return;
    // No scene will draw: the still decodes now (the h1 hides only once it
    // has), nothing left to wait for, nothing left to play.
    let live = true;
    decodeHeroStill().then(
      () => {
        if (live) setStillDecoded(true);
      },
      () => undefined,
    );
    settleHomeLoad(SCENE_ITEMS.filter((item) => item !== "fonts"));
    completeEntrance?.();
    return () => {
      live = false;
    };
  }, [eligible, completeEntrance]);
  ```
  - Lines 127 to 129 become:
  ```ts
  useEffect(() => {
    if (!mounted) onSceneChange(eligible ? "off" : "still");
  }, [mounted, eligible, onSceneChange]);
  ```
  - `handleFirstFrame` calls `onSceneChange("on")`.
  - `handleError` and `handleContextLost` call `onSceneChange("off")`. The effect above turns a failure into "still".
  - Render `<Poster stillReady={!eligible && stillDecoded} />`.
  - Header comment (lines 17 to 27):
  ```ts
  // The Coil hero's stage: a layer filling the 100svh hero with the posters
  // (Poster.tsx), the WebGL scene over them, and the DOM overlay. The canvas is
  // sized from this container, never the viewport.
  //
  // The scene chunk (three and all) is imported only after first paint and only
  // when it can run: not under reduced motion, not in holding mode, and with a
  // WebGL 2 context this browser can actually create. Until its first frame the
  // field poster waits with it (data-scene="off"); once it cannot run at all
  // (no context, a failed chunk, the boundary, a second lost context, reduced
  // motion) the hero is "still": the hero still once decoded, the h1 visually
  // hidden only then, and the notice. A first lost context shows the field
  // poster and remounts once.
  // Reduced motion is live: turning it on tears the scene down, off rebuilds it.
  ```
- [ ] **HomeController.tsx.**
  - Add `import type { HeroScene } from "@/lib/coil/heroStill";`.
  - Lines 170 to 172 become:
  ```ts
  // data-scene: "on" once the scene has drawn (the canvas name replaces the DOM
  // h1, which stays for assistive tech), "off" while one is on its way, "still"
  // once none can run (the hero still).
  const [heroScene, setHeroScene] = useState<HeroScene>("off");
  ```
  - Line 382 becomes `<Loader mode={loaderMode} onReveal={revealHero} scene={heroScene} />`.
  - Line 385 becomes `data-scene={heroScene}`.
  - CoilStage gets `onSceneChange={setHeroScene}`.
- [ ] **Loader.tsx.**
  - The prop becomes `scene: HeroScene`, with the comment `// The hero's scene state: the DOM lockup hands to the canvas only once it is "on".`
  - Rename `sceneOnRef` to `sceneRef`.
  - Pass `sceneShown: () => sceneRef.current === "on"`.
- [ ] **HeroText.tsx.** The className becomes `"text-balance text-center font-display text-display text-foreground group-data-[scene=on]/hero:sr-only group-has-[[data-still-ready]]/hero:sr-only"`. The comment at lines 3 to 9 becomes:
  ```ts
  // The hero's accessible greeting, server-rendered so view-source carries it.
  // It shows whenever nothing else greets: no canvas name, no decoded still,
  // no resting lockup (whose stylesheet holds this h1 at opacity 0,
  // loaderMarkup.ts). Once the canvas draws the name (data-scene="on") or a
  // decoded hero still shows it (data-still-ready) it is visually hidden,
  // staying the page's one top-level heading for assistive tech.
  ```
- [ ] **loaderMarkup.ts.** Add this as the first line of the `@media (prefers-reduced-motion: reduce)` block (lines 96 to 100). Put a JS comment above the `LOADER_CSS` const that reads `// Reduced motion never runs a scene: the h1 waits for the decoded still, at most a hand-off's give-up.`
  ```css
    html:not(:has([data-still-ready])) #${HERO_HEADING_ID}{animation:coil-loader-h1 ${LOADER.handoffGiveUpMs}ms linear}
  ```
- [ ] **Comments.**
  - `lib/coil/drivers.ts:8-9`: "Reduced motion renders no scene at all: the hero still, the visually hidden h1, and the book."
  - `components/coil/HeroOverlay.tsx:28-29`: "without a scene the hero still (or, while one is on its way or the still has not decoded, the h1) carries the greeting."
  - `lib/coil/drift.ts:41-47`: "Nothing on the site draws it today: the field posters and the hero stills (?coildebug=poster and still, scripts/render-posters.mjs) render fieldClocks(0) with the default drift preset, the live field's first frame, so the poster-to-scene swap is seamless (components/coil/Poster.tsx). A ?drift= other than the default starts from a slightly different first frame; that swap is QA only."
- [ ] Run `pnpm test && pnpm tsc --noEmit && pnpm lint`, then the targeted recipe with `e2e/fallbacks.spec.ts e2e/no-webgl.spec.ts e2e/hero.spec.ts e2e/loader.spec.ts`. Expected: PASS.
- [ ] Commit: `feat(home): data-scene "still" shows the hero still; the h1 hides only once it has decoded`.

---

### Task 4: The loader's still path

**Files:**
- Create: `lib/loader/still.ts`, `lib/loader/still.test.ts`
- Modify: `lib/loader/progress.ts`, `components/loader/runLoader.ts`, `components/loader/Loader.tsx`, `components/loader/loaderMarkup.ts`, `components/coil/CoilStage.tsx`, `components/home/HomeController.tsx`, `e2e/loader.spec.ts`, `e2e/no-webgl.spec.ts`, `e2e/fallbacks.spec.ts`

**Interfaces:**
- `LOADER.stillFadeMs = 400`
- `StillPoster = { decoded: () => Promise<void> }`
- `provideStillPoster(p): () => void` and `stillPoster(): StillPoster | null`
- `loaderEnd(input): LoaderEnd`
- `LoaderMode` loses `scene`; `LoaderOptions` loses `resting`

- [ ] **Failing test.** Create `lib/loader/still.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { LOADER } from "@/lib/loader/progress";
  import { loaderEnd, provideStillPoster, stillPoster, type LoaderEndInput } from "@/lib/loader/still";

  const at = (over: Partial<LoaderEndInput>): LoaderEndInput => ({
    reduced: false, paneShown: false, target: "none", still: false, waitedMs: 0, ...over,
  });

  describe("the loader's end", () => {
    it("keeps reduced motion's branch: a skip inside the guard, else the fade", () => {
      expect(loaderEnd(at({ reduced: true, still: true }))).toBe("skip");
      expect(loaderEnd(at({ reduced: true, paneShown: true, target: "landable" }))).toBe("fade");
    });
    it("hands to a scene: the resting hold inside the guard, the continuity past it", () => {
      expect(loaderEnd(at({ target: "landable" }))).toBe("rest");
      expect(loaderEnd(at({ target: "away" }))).toBe("rest");
      expect(loaderEnd(at({ paneShown: true, target: "landable" }))).toBe("continuity");
      expect(loaderEnd(at({ paneShown: true, target: "away" }))).toBe("fade");
    });
    it("hands to the still when no scene can run, pane or not", () => {
      expect(loaderEnd(at({ still: true }))).toBe("dissolve");
      expect(loaderEnd(at({ paneShown: true, still: true }))).toBe("dissolve");
    });
    it("past the guard with nobody to take the lockup, fades at once", () => {
      expect(loaderEnd(at({ paneShown: true, waitedMs: 0 }))).toBe("fade");
      // The scene path's 6s give-up with no scene drawn: no extra hold on the pane.
      expect(loaderEnd(at({ paneShown: true, target: "none", still: false, waitedMs: 0 }))).toBe("fade");
    });
    it("waits on the fast path only, a hand-off's give-up at most, for the still to be known", () => {
      expect(loaderEnd(at({ waitedMs: LOADER.handoffGiveUpMs - 1 }))).toBe("wait");
      expect(loaderEnd(at({ waitedMs: LOADER.handoffGiveUpMs }))).toBe("skip");
    });
    it("has one still provider, released only by its own owner", () => {
      const a = { decoded: () => Promise.resolve() };
      const b = { decoded: () => Promise.resolve() };
      const releaseA = provideStillPoster(a);
      const releaseB = provideStillPoster(b);
      releaseA();
      expect(stillPoster()).toBe(b);
      releaseB();
      expect(stillPoster()).toBeNull();
    });
  });
  ```
- [ ] Run `pnpm test lib/loader/still.test.ts`. Expected: FAIL, because the module is missing.
- [ ] **progress.ts.** Add to `LOADER`, after `handoffGiveUpMs`:
  ```ts
    // No scene can run: the hero still fades in under the resting lockup over
    // this (linear), then the lockup leaves in one frame.
    stillFadeMs: 400,
  ```
- [ ] **Implement.** Create `lib/loader/still.ts`:
  ```ts
  import { LOADER } from "./progress";

  // The loader's end, decided once the tally is done (and each frame while it
  // waits), and the hero still it hands to when no scene can run. CoilStage
  // provides the still before it settles the tally; the first commit's passive
  // effects flush before the loader starts, so the provider is normally there
  // already and "wait" is only a safety net on the fast path.

  export type StillPoster = { decoded: () => Promise<void> };

  let provider: StillPoster | null = null;

  export function provideStillPoster(poster: StillPoster): () => void {
    provider = poster;
    return () => {
      if (provider === poster) provider = null;
    };
  }

  export function stillPoster(): StillPoster | null {
    return provider;
  }

  // The scene's lockup: none drawn, on screen to land on, or off screen.
  export type LoaderTarget = "none" | "landable" | "away";
  export type LoaderEnd = "rest" | "continuity" | "dissolve" | "fade" | "skip" | "wait";
  export type LoaderEndInput = {
    reduced: boolean;
    paneShown: boolean; // the load outlived the guard
    target: LoaderTarget;
    still: boolean; // a still is provided: no scene can run
    waitedMs: number; // since the tally completed
  };

  export function loaderEnd({ reduced, paneShown, target, still, waitedMs }: LoaderEndInput): LoaderEnd {
    if (reduced) return paneShown ? "fade" : "skip";
    if (target !== "none") return !paneShown ? "rest" : target === "landable" ? "continuity" : "fade";
    if (still) return "dissolve";
    if (!paneShown && waitedMs < LOADER.handoffGiveUpMs) return "wait";
    return paneShown ? "fade" : "skip";
  }
  ```
- [ ] Run `pnpm test lib/loader/still.test.ts`. Expected: PASS.
- [ ] **Failing e2e.** In `e2e/loader.spec.ts`, add imports for `MUTED_ARGS`, `noWebglContext`, `sampleHero` and `heroSamples`, then add:
  ```ts
  // No WebGL (the Chrome setting: the API is there, no context starts): the
  // resting lockup is up from the first frames, the h1 never shows, the still
  // fades in under the lockup, and the lockup leaves in one frame.
  test.describe("no WebGL", () => {
    test.use({ launchOptions: { args: [...MUTED_ARGS, "--disable-gpu"] } });
    const goneLoader = () => document.querySelector<HTMLElement>(".coil-loader")?.dataset.state === "gone";

    test("loader: a warm load holds the resting lockup and hands it to the hero still", async ({ page }) => {
      await page.addInitScript(noWebglContext);
      await sampleHero(page);
      await page.goto("/?coildebug=1");
      await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
      await page.reload();
      await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
      await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");

      const samples = (await heroSamples(page)).filter((s) => s.state !== null);
      expect(samples.length, "frames sampled").toBeGreaterThan(2);
      expect(samples.slice(0, 3).every((s) => s.state !== "gone" && s.rest), "the resting lockup in the first frames").toBe(true);
      const h1Shown = samples.filter((s) => s.h1);
      expect(h1Shown.length, `frames showing the h1 (first at ${h1Shown[0]?.t.toFixed(0)}ms)`).toBe(0);
      const leaked = samples.filter((s) => s.rest && !s.dissolve && s.state !== "gone" && s.still !== 0);
      expect(leaked.length, "frames with the still showing before the hand-off").toBe(0);
      expect(samples.at(-1)!.state).toBe("gone");
      const lastHeld = samples.filter((s) => s.dissolve && s.state !== "gone" && s.rest).at(-1);
      expect(lastHeld, "a hand-off frame with the lockup up").toBeDefined();
      expect(lastHeld!.still, "the still under the lockup's last frames").toBeGreaterThan(0.5);
      expect(lastHeld!.stillReady, "the still had decoded under the lockup").toBe(true);
      const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
      expect(events).toContain("dissolve");
      expect(events, "the pane never armed").not.toContain("100");
    });

    test("loader: the still fades in under the resting lockup and the name never weakens", async ({ page }) => {
      await page.addInitScript(noWebglContext);
      await page.goto("/?coildebug=1");
      await page.waitForFunction(goneLoader, null, { timeout: 30_000 });
      // handoff: the hand-off waits on __coilLoader.finish() once the still has decoded, then again before the lockup leaves.
      await page.goto("/?coildebug=handoff");
      await page.waitForFunction(() => (window as HookWindow).__coilLoader?.events.some((e) => e.event === "still-held"), null, { timeout: 30_000 });
      const box = await page.evaluate(() => {
        const r = document.querySelector(".coil-loader__rest-name")!.getBoundingClientRect();
        return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
      });
      const rest = luminanceSpread(await shoot(page, box));
      await page.evaluate(() => {
        (window as HookWindow).__coilLoader!.finish!();
        const fadeIn = document.querySelector("[data-hero-still]")!.getAnimations()[0];
        fadeIn.pause();
        (window as unknown as { __stillFade: Animation }).__stillFade = fadeIn;
      });
      for (const ms of [0, 100, 200, 300, LOADER.stillFadeMs - 1]) {
        await page.evaluate((t) => {
          (window as unknown as { __stillFade: Animation }).__stillFade.currentTime = t;
        }, ms);
        expect(luminanceSpread(await shoot(page, box)), `name box spread at ${ms}ms of the fade`).toBeGreaterThanOrEqual(rest - 2);
      }
      await page.evaluate(() => {
        (window as unknown as { __stillFade: Animation }).__stillFade.finish();
        (window as HookWindow).__coilLoader!.finish!();
      });
      await expect(page.locator(".coil-loader")).toHaveAttribute("data-state", "gone");
      expect(luminanceSpread(await shoot(page, box)), "name box spread after the lockup left").toBeGreaterThanOrEqual(rest - 3);
    });
  });
  ```
  In `e2e/no-webgl.spec.ts`, extend "stills that never load" with:
  ```ts
    const events = await page.evaluate(() => (window as HookWindow).__coilLoader!.events.map((e) => e.event));
    expect(events).toContain("still-failed");
    expect(events).not.toContain("dissolve");
  ```
  Add a deep reload test:
  ```ts
  test("a deep reload with no WebGL 2 shows the still at full opacity", async ({ page }) => {
    await page.addInitScript(noWebgl2Api);
    // lib/scroll.ts's saved position, past half a viewport: the fast start.
    await page.addInitScript(() => sessionStorage.setItem("aps:home-scroll-y", String(window.innerHeight * 2)));
    await page.goto("/");
    await settled(page);
    const still = page.locator("[data-hero-still]");
    await expect(still).toHaveAttribute("data-still-ready", "");
    await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });
  ```
  In `e2e/fallbacks.spec.ts`'s reduced test, add:
  ```ts
    const still = page.locator("[data-hero-still]");
    await expect(still).toHaveAttribute("data-still-ready", "");
    await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  ```
- [ ] Run the targeted recipe with `e2e/loader.spec.ts -g "no WebGL"` and `e2e/no-webgl.spec.ts`. Expected: FAIL, because there are no `dissolve` or `still-failed` events yet.
- [ ] **runLoader.ts.**
  - Import `{ loaderEnd, stillPoster, type StillPoster } from "@/lib/loader/still"`.
  - `LoaderOptions` drops `resting`, and the destructuring becomes `{ reduced, sceneShown }`.
  - Add the state `let paneShown = false; let endBegan = 0; let stillTimer = 0;`, and change the run note to `note("run", { reduced, items: ... })`.
  - Replace the done block (lines 160 to 175) with the following. Everything from `const numberTime` onwards is unchanged.
  ```ts
      if (done && !finishing) {
        finishing = true;
        paneShown = guardPassed();
        if (!paneShown) {
          // Everything was ready inside the guard: no pane. The resting lockup
          // holds (the pane can no longer arm) while end() picks who takes it.
          if (!reduced) root.setAttribute("data-state", "rest");
          end();
          return;
        }
  ```
  Replace `exit()` (lines 189 to 208) with:
  ```ts
    function exit() {
      if (disposed) return;
      root.setAttribute("data-state", "live");
      end();
    }

    // Who takes the lockup (lib/loader/still.ts): the scene (the resting hold or
    // the continuity), the hero still, or nobody (a fade, a skip). A canvas
    // lockup off screen is no landing: it would fly out of view.
    function end() {
      raf = 0;
      if (disposed) return;
      const now = performance.now();
      endBegan ||= now;
      const found = reduced ? null : nameTarget();
      const target = !found ? "none" : found.baseline > 0 && found.baseline - found.fontPx < window.innerHeight ? "landable" : "away";
      const poster = stillPoster();
      const choice = loaderEnd({ reduced, paneShown, target, still: poster !== null, waitedMs: now - endBegan });
      if (choice === "wait") {
        raf = requestAnimationFrame(end);
        return;
      }
      note("end", { choice });
      if (choice === "rest") rest();
      else if (choice === "skip") skip();
      else if (choice === "dissolve") dissolve(poster!);
      else if (choice === "continuity") continuity(found!);
      else fade();
    }

    function skip() {
      root.setAttribute("data-rest", "off");
      gone();
      note("skipped");
      reveal(performance.now(), false);
    }

    // A plain fade. The pane covered the resting lockup, so it leaves with
    // the pane; without a pane the resting lockup fades with the root and the
    // h1 shows at gone.
    function fade() {
      if (paneShown) root.setAttribute("data-rest", "off");
      note("fade");
      reveal(performance.now() + LOADER.reducedFadeMs, false);
      timeline = gsap.timeline({ onComplete: gone });
      timeline.to(root, { opacity: 0, duration: LOADER.reducedFadeMs / 1000, ease: "none" });
    }

    // No scene can run. Once the still has decoded, the pane (if it showed)
    // fades off the resting lockup; then the still fades in UNDER the resting
    // lockup over stillFadeMs (loaderMarkup.ts lifts its hold on
    // data-dissolve) and the lockup leaves in one frame when that fade ends.
    // A still that fails to decode, or not within handoffGiveUpMs: the plain
    // fade, and the h1 carries the hero.
    function dissolve(poster: StillPoster) {
      note("still");
      let decided = false;
      const giveUp = () => {
        if (decided || disposed) return;
        decided = true;
        window.clearTimeout(stillTimer);
        note("still-failed");
        fade();
      };
      const handTo = () => {
        if (disposed) return;
        gone();
        note("still-handoff");
      };
      const under = () => {
        if (disposed) return;
        root.setAttribute("data-state", "rest");
        root.setAttribute("data-dissolve", "");
        note("dissolve");
        reveal(performance.now() + LOADER.stillFadeMs, false);
        if (holdHandoff) exposeFinish(handTo);
        else stillTimer = window.setTimeout(handTo, LOADER.stillFadeMs);
      };
      const begin = () => {
        if (!paneShown) return under();
        timeline = gsap.timeline({ onComplete: under });
        timeline.to([parts.bg, parts.pane], { opacity: 0, duration: LOADER.stillFadeMs / 1000, ease: "none" });
      };
      const decodedNow = () => {
        if (decided || disposed) return;
        decided = true;
        window.clearTimeout(stillTimer);
        if (!holdHandoff) return begin();
        note("still-held");
        exposeFinish(begin);
      };
      stillTimer = window.setTimeout(giveUp, LOADER.handoffGiveUpMs);
      poster.decoded().then(decodedNow, giveUp);
    }
  ```
  - At the top of `continuity(target)`, add `root.setAttribute("data-rest", "off"); // The pane covered the resting lockup; the exit lands the pane's own.`
  - The teardown adds `window.clearTimeout(stillTimer);`.
  - In the header comment, say the exit is "the continuity landing on the canvas lockup, the hand-off to the hero still, or a plain fade".
- [ ] **Loader.tsx.**
  - `export type LoaderMode = { kind: "pending" } | { kind: "off" } | { kind: "on"; reducedMotion: boolean };`.
  - Lines 108 to 110 become:
  ```ts
      const resting = !mode.reducedMotion;
      // Reduced motion: no resting lockup, the h1 or the still from this paint.
      if (!resting) root.setAttribute("data-rest", "off");
  ```
  - The runLoader options become `{ reduced: mode.reducedMotion, sceneShown: () => sceneRef.current === "on" }`.
  - In the header table (lines 24 to 34), replace the reduced row with:
  ```
  //   on, no scene can run (the still): the resting lockup holds from first
  //         paint as above; the pane only past the guard, fading off the
  //         lockup at the end; the still fades in under the lockup over 400ms
  //         once decoded and the lockup leaves in one frame; a still that
  //         never decodes gets the plain fade and the h1
  //   on + reduced motion: no resting lockup, the name in accent, the number
  //         counts, a 300ms fade
  ```
- [ ] **HomeController.tsx** line 205: `setLoaderMode(recovery.deep ? { kind: "off" } : { kind: "on", reducedMotion: reduced });`.
- [ ] **CoilStage.tsx.**
  - Import `provideStillPoster` from `@/lib/loader/still`.
  - In the no-scene effect, right after the `decodeHeroStill().then(...)` call (which starts the decode at provide time), add `const releaseStill = provideStillPoster({ decoded: decodeHeroStill });`.
  - The cleanup becomes `return () => { live = false; releaseStill(); };`.
  - The comment gains: "the loader hands its lockup to the still (provided before the tally settles)".
- [ ] **loaderMarkup.ts.** Inside the `no-preference` block, after the h1 rule, add the following. Add the header comment line "With no scene the hero still waits at opacity 0 under the resting lockup and fades in under it (data-dissolve); the lockup then leaves in one frame."
  ```css
    html:not([data-coil-loader=skip]):has(.coil-loader:not([data-state=gone]):not([data-rest=off]):not([data-dissolve])) [data-hero-still]{opacity:0}
    [data-hero-still]{transition:opacity ${LOADER.stillFadeMs}ms linear}
  ```
- [ ] Run `pnpm test && pnpm tsc --noEmit && pnpm lint`, then the targeted recipe with `e2e/loader.spec.ts e2e/fallbacks.spec.ts e2e/no-webgl.spec.ts`. Expected: PASS, including every existing loader test.
- [ ] Commit: `feat(loader): with no scene the hero still fades in under the resting lockup, which then leaves in one frame`.

---

### Task 5: The notice

**Files:**
- Create: `lib/home/stillNotice.ts`, `lib/home/stillNotice.test.ts`, `components/coil/StillNotice.tsx`, `e2e/still-notice.spec.ts`
- Modify: `lib/coil/heroStill.ts`, `lib/coil/heroStill.test.ts`, `lib/content.ts`, `components/coil/CoilStage.tsx`, `components/home/HomeController.tsx`, `components/loader/loaderMarkup.ts`, `e2e/a11y.spec.ts`

**Interfaces:**
- `StillCause = "noWebgl" | "unavailable" | "reducedMotion"`, `StillFailure = "noWebgl" | "unavailable"`, `stillCause({ reducedMotion, hasApi, failure })`
- `STILL_NOTICE_KEY = "aaron-still-notice"`, `createStillNoticeStore(storage)`, `stillNoticeStore()`
- `<StillNotice cause />`
- CoilStage prop `scene: HeroScene`
- `siteContent.hero.still`

- [ ] **Failing tests.** Add to `lib/coil/heroStill.test.ts`:
  ```ts
  import { stillCause } from "@/lib/coil/heroStill";

  describe("still cause", () => {
    it("names reduced motion first, then a missing context, else a scene that failed", () => {
      expect(stillCause({ reducedMotion: true, hasApi: false, failure: "unavailable" })).toBe("reducedMotion");
      expect(stillCause({ reducedMotion: false, hasApi: false, failure: null })).toBe("noWebgl");
      expect(stillCause({ reducedMotion: false, hasApi: true, failure: "noWebgl" })).toBe("noWebgl");
      expect(stillCause({ reducedMotion: false, hasApi: true, failure: "unavailable" })).toBe("unavailable");
    });
  });
  ```
  Create `lib/home/stillNotice.test.ts`:
  ```ts
  import { describe, expect, it, vi } from "vitest";
  import { STILL_NOTICE_KEY, createStillNoticeStore } from "@/lib/home/stillNotice";

  function memoryStorage() {
    const map = new Map<string, string>();
    return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) };
  }
  const blockedStorage = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };

  describe("still notice store", () => {
    it("is not dismissed by default", () => {
      expect(createStillNoticeStore(memoryStorage()).dismissed()).toBe(false);
    });
    it("remembers a dismissal across visits and notifies once", () => {
      const storage = memoryStorage();
      const store = createStillNoticeStore(storage);
      const listener = vi.fn();
      store.subscribe(listener);
      store.dismiss();
      store.dismiss();
      expect(store.dismissed()).toBe(true);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(storage.getItem(STILL_NOTICE_KEY)).toBe("1");
      expect(createStillNoticeStore(storage).dismissed()).toBe(true);
    });
    it("works in memory when storage is missing or throws", () => {
      for (const storage of [null, blockedStorage]) {
        const store = createStillNoticeStore(storage);
        expect(store.dismissed()).toBe(false);
        expect(() => store.dismiss()).not.toThrow();
        expect(store.dismissed()).toBe(true);
      }
    });
  });
  ```
- [ ] Run `pnpm test lib/coil/heroStill.test.ts lib/home/stillNotice.test.ts`. Expected: FAIL, because of missing exports and a missing module.
- [ ] **Implement.** Add to `lib/coil/heroStill.ts`:
  ```ts
  // Why the hero is still, for the notice (components/coil/StillNotice.tsx).
  export type StillCause = "noWebgl" | "unavailable" | "reducedMotion";
  // Why a scene that could have run did not: no context could start
  // ("noWebgl"), or it started and failed (a chunk, a render error, a second
  // lost context).
  export type StillFailure = "noWebgl" | "unavailable";

  export function stillCause({ reducedMotion, hasApi, failure }: { reducedMotion: boolean; hasApi: boolean; failure: StillFailure | null }): StillCause {
    if (reducedMotion) return "reducedMotion";
    if (!hasApi) return "noWebgl";
    return failure ?? "unavailable";
  }
  ```
  Create `lib/home/stillNotice.ts`:
  ```ts
  // The still page's notice (components/coil/StillNotice.tsx): dismissed once,
  // gone on every later visit. Kept in localStorage; a blocked or missing
  // storage keeps the dismissal in memory for the visit and never throws (as
  // createHintStore, lib/cursor/hover.ts).
  export const STILL_NOTICE_KEY = "aaron-still-notice";

  type NoticeStorage = Pick<Storage, "getItem" | "setItem">;

  export type StillNoticeStore = {
    dismissed: () => boolean;
    dismiss: () => void;
    subscribe: (listener: () => void) => () => void;
  };

  export function createStillNoticeStore(storage: NoticeStorage | null): StillNoticeStore {
    let memory = false;
    const listeners = new Set<() => void>();
    const stored = () => {
      try {
        return storage?.getItem(STILL_NOTICE_KEY) === "1";
      } catch {
        return false;
      }
    };
    return {
      dismissed: () => memory || stored(),
      dismiss() {
        if (memory) return;
        memory = true;
        try {
          storage?.setItem(STILL_NOTICE_KEY, "1");
        } catch {
          // Blocked storage: the memory copy carries this visit.
        }
        listeners.forEach((listener) => listener());
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
  }

  function browserStorage(): NoticeStorage | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage;
    } catch {
      return null;
    }
  }

  let shared: StillNoticeStore | null = null;
  // The page's one store, made on first use in the browser.
  export function stillNoticeStore(): StillNoticeStore {
    shared ??= createStillNoticeStore(browserStorage());
    return shared;
  }
  ```
- [ ] Run `pnpm test lib/coil/heroStill.test.ts lib/home/stillNotice.test.ts`. Expected: PASS.
- [ ] **Content.** In `lib/content.ts`, add inside `hero`, after `nameReadout`:
  ```ts
    // The still page's notice (no scene can run): why the page is still, by
    // cause, and its dismiss. Placeholders; Aaron rewrites them.
    still: {
      noWebgl: "This page is built around a moving scene. Your browser has graphics acceleration off, so this is the still version.",
      unavailable: "This page is built around a moving scene your browser could not start, so this is the still version.",
      reducedMotion: "This page is built around a moving scene. Your system asks for less motion, so this is the still version.",
      dismiss: "Got it",
    },
  ```
  Run `pnpm test lib/content.test.ts`. Expected: PASS (its em dash check walks `Object.values(siteContent.hero)`).
- [ ] **Failing e2e.** Create `e2e/still-notice.spec.ts`:
  ```ts
  import type { Page } from "@playwright/test";
  import { siteContent } from "@/lib/content";
  import { STILL_NOTICE_KEY } from "@/lib/home/stillNotice";
  import { test, expect } from "./support/fixtures";
  import { openHome } from "./support/coil";
  import { settled, watchHydration } from "./support/fallback";
  import { shoot } from "./support/pixels";
  import { noWebgl2Api, noWebglContext } from "./support/webgl";

  // The still page's notice: one quiet line at the foot of the hero saying why
  // the page is still, a status (never a dialog), dismissed for good by "Got it".

  const copy = siteContent.hero.still;
  const notice = (page: Page) => page.locator("[data-still-notice]");
  const dismiss = (page: Page) => notice(page).getByRole("button", { name: copy.dismiss });

  async function expectNotice(page: Page, text: string) {
    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toHaveAttribute("role", "status");
    await expect(notice(page)).toContainText(text);
    await expect(dismiss(page)).toBeVisible();
  }

  test("no WebGL 2: the notice says why, and Got it dismisses it for good", async ({ page }) => {
    const hydration = watchHydration(page);
    await page.addInitScript(noWebgl2Api);
    await page.goto("/");
    await settled(page);
    await expectNotice(page, copy.noWebgl);
    await dismiss(page).click();
    await expect(notice(page)).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), STILL_NOTICE_KEY)).toBe("1");
    await page.reload();
    await settled(page);
    await expect(page.locator("section[data-scene]")).toHaveAttribute("data-scene", "still");
    await expect(notice(page)).toHaveCount(0);
    expect(hydration).toEqual([]);
  });

  test("a context that cannot be created: the same notice, dismissed from the keyboard, focus to body", async ({ page }) => {
    await page.addInitScript(noWebglContext);
    await page.goto("/");
    await settled(page);
    await expectNotice(page, copy.noWebgl);
    await dismiss(page).focus();
    await page.keyboard.press("Enter");
    await expect(notice(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  });

  test("a scene that throws: the notice says it could not start", async ({ page }) => {
    await page.goto("/?coildebug=throw=render");
    await settled(page);
    await expectNotice(page, copy.unavailable);
  });

  test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });
    test("the notice names the motion setting", async ({ page }) => {
      await page.goto("/");
      await settled(page);
      await expectNotice(page, copy.reducedMotion);
    });
  });

  test("the scene on: no notice", async ({ page }) => {
    await openHome(page);
    await expect(notice(page)).toHaveCount(0);
  });

  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the notice reads at 4.5:1 over the still in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.addInitScript(noWebgl2Api);
      await page.goto("/");
      await settled(page);
      const still = page.locator("[data-hero-still]");
      await expect(still).toHaveAttribute("data-still-ready", "");
      await expect.poll(() => still.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
      const text = notice(page).locator("p");
      await expect(text).toBeVisible();
      const { box, color } = await text.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { box: { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) }, color: getComputedStyle(el).color };
      });
      await notice(page).evaluate((el) => (el.style.visibility = "hidden"));
      const behind = await shoot(page, box);
      const mean = [0, 0, 0];
      for (let i = 0; i < behind.rgba.length; i += 4) for (let c = 0; c < 3; c++) mean[c] += behind.rgba[i + c];
      const pixels = behind.rgba.length / 4;
      const bg = mean.map((v) => v / pixels);
      const fg = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
      expect((hi + 0.05) / (lo + 0.05), `notice text ${color} over the still`).toBeGreaterThanOrEqual(4.5);
    });
  }
  ```
  In `e2e/a11y.spec.ts`:
  - Extract test 1's loop into `async function tabStops(page: Page): Promise<Stop[]>`, and test 2's `page.evaluate` into `async function focusReport(page: Page)`. The existing tests call them with unchanged assertions.
  - Import `noWebgl2Api` and `settled`, then add:
  ```ts
  test("a11y (no WebGL 2): the notice's Got it is a named tab stop between the Menu pill and the book, nothing focusable hides", async ({ page }) => {
    await page.addInitScript(noWebgl2Api);
    await page.goto("/");
    await settled(page);
    await expect(page.locator("[data-still-notice]")).toBeVisible();
    const stops = await tabStops(page);
    const pill = stops.findIndex((stop) => stop.name === "Open menu");
    const gotIt = stops.findIndex((stop) => stop.name.startsWith(siteContent.hero.still.dismiss));
    const book = stops.findIndex((stop) => stop.inBook);
    expect(gotIt, `tab stops: ${JSON.stringify(stops.map((s) => s.name))}`).toBeGreaterThan(pill);
    expect(book).toBeGreaterThan(gotIt);
    const report = await focusReport(page);
    expect(report.hidden, "focusable elements inside aria-hidden").toEqual([]);
    expect(report.unnamed, "focusable elements with no accessible name").toEqual([]);
  });
  ```
- [ ] Run the targeted recipe with `e2e/still-notice.spec.ts e2e/a11y.spec.ts`. Expected: FAIL, because there is no `[data-still-notice]`.
- [ ] **Implement.** Create `components/coil/StillNotice.tsx`:
  ```tsx
  "use client";

  import { useSyncExternalStore } from "react";
  import { Fill } from "@/components/fx/Fill";
  import { siteContent } from "@/lib/content";
  import { FILL_PICK } from "@/lib/fx/fill";
  import type { StillCause } from "@/lib/coil/heroStill";
  import { stillNoticeStore } from "@/lib/home/stillNotice";

  // The still page's one quiet line at the foot of the hero: why the page is
  // still, and "Got it", which dismisses it for good. CoilStage renders it only
  // in data-scene="still" once the hero is ready; the loader's stylesheet keeps
  // it hidden until the loader has gone. A status, never a dialog: no focus
  // trap, no autofocus, nothing blocked. Not in HeroOverlay, whose root stays
  // invisible without a scene.
  const subscribe = (listener: () => void) => stillNoticeStore().subscribe(listener);
  const dismissed = () => stillNoticeStore().dismissed();
  const dismissedOnServer = () => true;

  export function StillNotice({ cause }: { cause: StillCause }) {
    const hidden = useSyncExternalStore(subscribe, dismissed, dismissedOnServer);
    if (hidden) return null;
    const copy = siteContent.hero.still;
    return (
      <div
        role="status"
        data-still-notice
        className="pointer-events-auto absolute bottom-[max(32px,7svh)] left-1/2 flex w-full max-w-[36rem] -translate-x-1/2 flex-col items-center gap-1 text-balance px-6 text-center font-label text-label-sm text-muted"
      >
        <p>{copy[cause]}</p>
        <Fill
          {...FILL_PICK.nav}
          shape="rect"
          onClick={() => stillNoticeStore().dismiss()}
          data-cursor-hover
          className="-mx-2 inline-flex items-center px-2 py-1 font-label text-label-sm text-accent"
          overClassName="flex items-center px-2 py-1"
        >
          {copy.dismiss}
        </Fill>
      </div>
    );
  }
  ```
- [ ] **CoilStage.tsx.**
  - Add the prop `scene: HeroScene;` with the comment `// The hero's scene state, as the controller holds it (data-scene).`
  - Import `StillNotice`, plus `stillCause` and `type StillFailure` from `@/lib/coil/heroStill`.
  - Replace `const [failed, setFailed] = useState(false);` with `const [failure, setFailure] = useState<StillFailure | null>(null);`.
  - `eligible` becomes `!reducedMotion && !HOLDING_MODE && !failure && hasWebGL2()`.
  - The probe's `setFailed(true)` becomes `setFailure("noWebgl")`.
  - The import rejection, `handleError` and the second context loss become `setFailure("unavailable")`.
  - Add `const ready = controller?.phase === "ready";`.
  - After `<HeroOverlay ... />`, render:
  ```tsx
      {scene === "still" && ready ? (
        <StillNotice cause={stillCause({ reducedMotion, hasApi: hasWebGL2(), failure })} />
      ) : null}
  ```
  - Check `wc -l components/coil/CoilStage.tsx`. It should be around 200.
- [ ] **HomeController.tsx.** CoilStage gets `scene={heroScene}`.
- [ ] **loaderMarkup.ts.** After the `.coil-loader[data-state=gone]` rule, add the following, with the comment `// The still notice waits for the loader to go (and leaves the tab order meanwhile).`
  ```css
  html:not([data-coil-loader=skip]):has(.coil-loader:not([data-state=gone])) [data-still-notice]{visibility:hidden}
  ```
- [ ] Run `pnpm test && pnpm tsc --noEmit && pnpm lint`, then the targeted recipe with `e2e/still-notice.spec.ts e2e/a11y.spec.ts e2e/fallbacks.spec.ts e2e/no-webgl.spec.ts`. Expected: PASS. If a contrast probe fails, change the notice's text token to `text-foreground` (a token, never hex), rerun, and note the change in the PR.
- [ ] Commit: `feat(home): a quiet notice explains the still page by cause, dismissed for good`.

---

### Task 6: Full verification and the PR

**Files:** none new

- [ ] `pnpm test`. Expected: all pass. Record the counts.
- [ ] `pnpm tsc --noEmit`. Expected: clean.
- [ ] `pnpm lint`. Expected: no errors, and no new warnings in touched files.
- [ ] Confirm both ports are free: `lsof -nP -iTCP:3160 -sTCP:LISTEN; lsof -nP -iTCP:3161 -sTCP:LISTEN` should print nothing. Then run `E2E_FULL_PORT=3160 E2E_HOLDING_PORT=3161 CI=1 pnpm test:e2e`. Expected: all pass; note any retries. Record the pass count.
- [ ] Check the diff for em dashes: `git diff main --unified=0 | grep -n $'\xe2\x80\x94'`. Expected: no output.
- [ ] Push and open the PR (not a draft):
  ```bash
  git push -u origin hero-still
  gh pr create --base main --title "Hero still: the scene at rest when no scene can run" --body "$(cat <<'EOF'
  ## What
  - `?coildebug=still`: the scene held at rest (cards and name, field at fieldClocks(0), entrance done, conveyor idle). `poster` unchanged.
  - Stills: three cuts per theme at 2x (wide, square, narrow on the scene's strict narrow line), AVIF with a WebP fallback, through Next's getImageProps art direction, lazy so scene visitors never fetch them.
  - `data-scene` gains "still" (no context, failed chunk, boundary, second context loss, reduced motion). The h1 hides only once the still has decoded.
  - Loader: with no scene the resting lockup holds from first paint, the still fades in under it over 400ms, and the lockup leaves in one frame. A still that never decodes gets the plain fade and the h1. Reduced motion's branch is unchanged; deep reloads stay off.
  - A quiet notice by cause (no WebGL, could not start, reduced motion), "Got it" dismisses it for good (`aaron-still-notice`).
  - `scripts/render-posters.mjs` renders the twelve files (AVIF q60 4:4:4, the 49ee8ba recipe; WebP q82), written as encoded.

  ## Evidence
  - vitest: <counts>; tsc and lint clean.
  - Playwright (3160/3161, CI=1): <counts>.
  - Encode error per file (mean / max of 255): <the script's twelve lines>.
  - File sizes: <ls -l public/coil/hero-*>.
  - Name box luminance spread through the hand-off: <rest value and the five samples>.
  - Scene visitors never request `/coil/hero-*` (fallbacks control test).

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  EOF
  )"
  ```
- [ ] Report the PR URL.

---

## For Fable (docs the builder does not touch)

These lines still describe the old fallback (the poster plus the DOM h1 when there is no scene). Each should now describe the hero still, the h1 that hides once the still has decoded, the one-frame hand-off and the notice:

- docs/coil-build-scaffold.md:11
- docs/coil-build-scaffold.md:128 (Reduced motion: "poster, DOM h1, book")
- docs/coil-build-scaffold.md:131 (Failure: "poster and DOM h1 on failure")
- docs/coil-build-log-2026-09-29.md:86 (the loader fast path entry that names the fallback heading)
- AGENTS.md Layer 1: the "One object, two drivers" sentence (reduced motion renders the poster, the h1 and the book), and the Aesthetic guardrails line that names the static field poster as the fallback. Aaron edits Layer 1 himself.
- Add a ledger entry for this PR, with a note that `scripts/render-posters.mjs` must be rerun whenever the scene's look at rest changes.

### Critical Files for Implementation
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/coil/CoilStage.tsx
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/loader/runLoader.ts
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/loader/loaderMarkup.ts
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/home/HomeController.tsx
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/coil/scene/debug.ts