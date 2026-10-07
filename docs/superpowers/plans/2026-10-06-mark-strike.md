# Mark strike: implementation plan

> **For agentic workers:** this plan is meant to be executed with superpowers:subagent-driven-development. Run the tasks in order, one implementer at a time, inside the worktree. Every task writes its failing test first. Opus 5.5 implements Tasks 7 to 9 (motion); Sonnet can take the transcription tasks.

**Goal:** Holding the top-left AS mark for 650ms (pointer, touch, or Enter/Space on the focused mark) fills it two-tone, then discharges into Aaron's cel strike and opens a small card about the mark. A normal click still scrolls to the top. The cursor's ring shows the hold.

**Architecture:**
- **The clock.** `lib/mark/hold.ts` is a pure state machine: no timers, no DOM, time passed in. It owns press, fill, taste, drain, discharge, completion and the swallowed click. `MarkTrigger` ticks it once per frame. Each frame it paints the mark's accent clip and publishes `{ fill, spent, closed, hidden }` as `markHold` on the hover store (`lib/cursor/hover.ts`). `CustomCursor` renders `MarkRing`, which paints the 16 percent tint and the 4px arc from that same value. One clock, two painters.
- **The strike.** `lib/mark/cel.ts` is lifted from the lab and is pure: a seed produces a frame list. `lib/mark/timeline.ts` steps that list on a GSAP clock.
- **The card.** `MarkCard` uses the house modal shell: Portal, `useBodyScrollLock`, `useEscapeKey`, `useFocusTrap`, and the shared blur and tint variants. Framer owns the backdrop and the exit. GSAP owns the strike, the surface forming and the words rising. The two never animate the same element.
- **The settled frame.** The resting mark is always the real `AsMark`. Its paths move into `lib/mark/geometry.ts` so there is one copy in code, and a test checks them against `public/brand/as-mark-ink.svg`.

**Tech Stack:** Next 16.2, React 19.2, TypeScript strict, Tailwind 3.4, GSAP 3.15 (CustomEase), Framer Motion 12, vitest, Playwright (Chromium, muted).

**Spec path:**
- `docs/lab-log-2026-10-05.md`, section "Mark lab": Aaron's picks of 2026-10-06, round 3's ring indicator, and the rollout cautions.
- Master plan: `docs/superpowers/plans/2026-10-06-first-public-edition.md`, section 6 item 5 (the keyboard route). That file is untracked in the main checkout, so read it from there.
- Lab source: `/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-lab/app/lab/mark/`.

**Global Constraints (verbatim):**

From AGENTS.md Layer 1:
- "**No em dashes anywhere.** Body copy, comments, docs, commit messages. Use commas, semicolons, or separate sentences."
- "**No hardcoded hex values in component files.** Tokens only."
- "**All site copy lives in `lib/content.ts`.** Components import `siteContent` (and the typed exports `WorkItem`, `Photo`, `HomeTile`, `WorkBodySection`); they never embed strings."
- "**First person voice in all copy.**"
- "**`prefers-reduced-motion` is respected globally.** The Coil, loader, flight and modal scale collapse to fade-only (no scene at all) when set, live, both directions. Never bypass."
- "**Modal primitives.** Use the hand-rolled hooks in `lib/modal.ts` (`useBodyScrollLock`, `useEscapeKey`, `useFocusTrap`). Do not pull in `@radix-ui/react-dialog` or similar without Layer 1 approval."
- "**Component file size.** Aim under 200 lines; scene modules under 400."
- "GSAP owns scroll, three never writes it, Framer never touches the canvas; no two libraries drive one transform."
- "One PR per slice into the integration branch (`coil` during the rebuild, `main` now they are equal), small commits, never squashed. Opus builders credit themselves (`Co-Authored-By: Claude Opus 5.5`)."
- "No agent action may trigger a Vercel production build: production builds only from Aaron's push to `main`; `vercel.json` skips previews; never `vercel deploy`."
- "`pnpm dev` and `pnpm build` share `.next`; never both in one checkout."

From the master plan, section 4:
- "Builders stop only the processes they started, never `pkill`, `killall` or a pattern match, never a port they did not open."

From the brief: fixed overlays Portal to body; one ref-counted scroll lock; z scale: modals 50, cursor 100; the mark is the top-left nav button that scrolls to the top.

**Decisions this plan takes (flag to Aaron):**
1. **Only the cel strike ships.** Aaron's JSON also carries round-one values: stepped 220ms power2.in, 110ms pause, ring splash 640ms expo.out, shockwave wipe 620ms power2.out, and the 0.06 flash with 60ms rise and 440ms decay. The lab's cel path (`strike.ts`, `buildCel`) never reads any of them. They are recorded in a comment in `lib/mark/constants.ts` and not built.
2. **CustomEase is registered in `lib/gsap.ts`; DrawSVG is not.** The brief asked for both, but the cel strike draws no strokes, and registering DrawSVG would add an unused plugin to every page.
3. **Phones stack the card.** Mark left and text right holds from `sm` up. Below `sm`, a 168px mark leaves about 110px for text, so the mark sits above the text.
4. **The ring snaps onto the mark.** The lab's 200ms glide is not ported. The cursor's position is written inside the input handler with no transition so it has zero lag, and a transition on it would lag the dot everywhere.
5. **The drain scales with the fill.** It runs 260ms times max(0.3, fill), as in the lab, so a full hold drains in 260ms.
6. **`touch-none` on the mark.** A pan can never cancel a hold that starts on the 26px or 32px mark.

**Copy placeholders for Aaron to replace.** These are the shortest true lines; each is marked `PLACEHOLDER` in `lib/content.ts`:
- dialog label "The mark"
- eyebrow "The mark"
- title "My initials, A and S"
- line "The bolt's tail is also the A's right leg."
- call to action "Say hi", linking to `#connect`

**Review Focus: five failure modes no test covers**
1. **The swallowed click leaking.** A touch long press may never fire a click (Android after a prevented contextmenu, iOS after a held touch). The pending swallow is cleared only by the next `press`. Confirm that a keyboard hold never sets it (`source === "key"`), and that a screen-reader activation (a click with no pointerdown) after a pointer hold whose click never arrived is eaten at most once.
2. **Who owns the nav mark's transform.** The tuck (`-translate-y-[90px]`, `focus-visible:translate-y-0`) lives on the button. The 10px growth lives on the inner span. Moving the scale onto the button breaks the headroom tuck. It also breaks `CustomCursor`'s ring geometry, which assumes an unscaled button box plus `MARK.growPx`.
3. **Real touch hardware.** Check the iOS callout, magnifier and selection; `pointercancel`; Android's `contextmenu` at about 500ms, before the 650ms completion; and whether a click follows a long press. Chromium desktop end-to-end covers none of this. Check on Aaron's phone at 390px on port 3310.
4. **Closing or holding again mid-strike.** AnimatePresence keeps the dialog mounted for its 200ms exit with the GSAP context still live. A new hold during the exit re-enters the same key. Check that the scroll-lock count returns to 0, that the night layer never lingers after unmount, and that `markHold.hidden` is reset on close.
5. **A stale ring.** The ring caches the mark's rect when the pointer enters. A resize or a headroom tuck while the pointer rests on the mark leaves the ring at the old place until the next mousemove. A keyboard hold also shows the ring if the pointer happens to sit over the mark. Decide whether either needs a guard.

---

### Task 0: Worktree and baseline

**Files:** none.

**Interfaces:** Consumes `main` after the tier 2 merges. Produces the branch `mark-strike`.

- [ ] Create the worktree:
  ```bash
  git -C "/Users/asulbaran21/Personal Projects/aaron-portfolio-website" worktree add "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-mark-strike" -b mark-strike main
  cd "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-mark-strike" && pnpm install --frozen-lockfile
  ```
- [ ] Run `pnpm test && pnpm tsc --noEmit && pnpm lint`. Expect everything to be green. Every later command runs from the worktree root.

### Task 1: One copy of the mark's geometry

**Files:** create `lib/mark/geometry.ts` and `lib/mark/geometry.test.ts`; modify `components/menu/BrandMark.tsx`.

**Interfaces:** Produces `VIEW_BOX: string`, `BOLT_D`, `LEG_D`, `BAR_D: string`, `type Point = readonly [number, number]`, `BOLT_PTS`, `LEG_PTS`, `BAR_PTS: readonly Point[]`, `IMPACT: Point`, `GROUND_Y: number`, `BOLT_SPINE: readonly Point[]`, and `FILL_TOP = 22`, `FILL_BOTTOM = 234`.

- [ ] Write the failing test, `lib/mark/geometry.test.ts`:
  ```ts
  import { readFileSync } from "node:fs";
  import { describe, expect, it } from "vitest";
  import { BAR_D, BAR_PTS, BOLT_D, BOLT_PTS, LEG_D, LEG_PTS, VIEW_BOX, type Point } from "@/lib/mark/geometry";

  const asPath = (points: readonly Point[]) => `M${points.map(([x, y]) => `${x} ${y}`).join("L")}Z`;

  describe("the mark's geometry", () => {
    it("is the brand file's three paths and viewBox, character for character", () => {
      const svg = readFileSync("public/brand/as-mark-ink.svg", "utf8");
      expect(svg).toContain(`viewBox="${VIEW_BOX}"`);
      for (const d of [BOLT_D, LEG_D, BAR_D]) expect(svg).toContain(`d="${d}"`);
    });

    it("lists the same points the paths draw", () => {
      expect([asPath(BOLT_PTS), asPath(LEG_PTS), asPath(BAR_PTS)]).toEqual([BOLT_D, LEG_D, BAR_D]);
    });
  });
  ```
- [ ] Run `pnpm test lib/mark/geometry.test.ts`. Expect FAIL: cannot resolve `@/lib/mark/geometry`.
- [ ] Create `lib/mark/geometry.ts`:
  ```ts
  // The mark's geometry: the three paths of public/brand/as-mark-ink.svg, the
  // only copy in code (AsMark renders these), plus the guides the cel strike
  // draws around them, in the mark's own viewBox units.
  export const VIEW_BOX = "2.49 6.34 243.32 243.32";
  export const BOLT_D = "M90.29 83.58L162.35 23.12L134.45 92.18L196.11 105.28L131.2 229.2L160.4 129.67L78.69 112.3Z";
  export const LEG_D = "M151.62 133.45L52.19 232.88L65.2 232.88L132.65 165.43L122.98 198.37L123.53 229.2Z";
  export const BAR_D = "M102.4 189.17L135.27 189.17L132.57 198.37L93.2 198.37Z";

  export type Point = readonly [number, number];

  export const BOLT_PTS: readonly Point[] = [[90.29, 83.58], [162.35, 23.12], [134.45, 92.18], [196.11, 105.28], [131.2, 229.2], [160.4, 129.67], [78.69, 112.3]];
  export const LEG_PTS: readonly Point[] = [[151.62, 133.45], [52.19, 232.88], [65.2, 232.88], [132.65, 165.43], [122.98, 198.37], [123.53, 229.2]];
  export const BAR_PTS: readonly Point[] = [[102.4, 189.17], [135.27, 189.17], [132.57, 198.37], [93.2, 198.37]];

  // The bolt lands on its own point; the A's left foot sits 3.7 units lower,
  // which is the ground the shards and the pool travel along.
  export const IMPACT: Point = [131.2, 229.2];
  export const GROUND_Y = 232.88;

  // The strike's spine: tip, left elbow, right elbow, point, all inside the ink.
  export const BOLT_SPINE: readonly Point[] = [[160.4, 26.6], [94, 100], [176, 115.5], [132.4, 221.2]];

  // The hold fill rises through the ink, which spans y 22 to 234.
  export const FILL_TOP = 22;
  export const FILL_BOTTOM = 234;
  ```
- [ ] In `components/menu/BrandMark.tsx`, keep the header comment and replace the body with:
  ```tsx
  import { BAR_D, BOLT_D, LEG_D, VIEW_BOX } from "@/lib/mark/geometry";

  const VIEW_BOXES = {
    square: VIEW_BOX,
    tight: "51.69 22.62 144.92 210.76",
  } as const;

  export function AsMark({ className, fit = "square" }: { className?: string; fit?: keyof typeof VIEW_BOXES }) {
    return (
      <svg viewBox={VIEW_BOXES[fit]} aria-hidden="true" focusable="false" className={className}>
        <path d={BOLT_D} fill="currentColor" />
        <path d={LEG_D} fill="currentColor" />
        <path d={BAR_D} fill="currentColor" />
      </svg>
    );
  }
  ```
- [ ] Run `pnpm test lib/mark/geometry.test.ts && pnpm tsc --noEmit`. Expect PASS.
- [ ] Commit:
  ```bash
  git add lib/mark/geometry.ts lib/mark/geometry.test.ts components/menu/BrandMark.tsx
  git commit -m "Mark: one copy of the mark's paths, checked against the brand file" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 2: Lift the cel strike and Aaron's numbers

**Files:** create `lib/mark/cel.ts` (copied from the lab), `lib/mark/constants.ts` and `lib/mark/cel.test.ts`.

**Interfaces:**
- Consumes the geometry from Task 1.
- Produces from `lib/mark/cel.ts`: `type CelSettings`, `seeded(seed: number): () => number`, `celSchedule(s: CelSettings)`, `celPlan(s: CelSettings): CelPlan`, `celMarkup(plan: CelPlan, index: number, ids: { glow: string; wide: string; pool: string; bloom: string }, s: CelSettings): string`, and `celBeats(s: CelSettings): { impact: number; aStart: number; framesEnd: number; settle: number }` (all in seconds).
- Produces from `lib/mark/constants.ts`: `HoldConfig`, `HOLD`, `CEL_PICK`, `MARK`, `RING`, `CARD`.

- [ ] Write the failing test, `lib/mark/cel.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { celBeats, celMarkup, celPlan } from "@/lib/mark/cel";
  import { CEL_PICK } from "@/lib/mark/constants";
  import { BAR_D, BOLT_D, LEG_D } from "@/lib/mark/geometry";

  const ids = { glow: "g", wide: "w", pool: "p", bloom: "b" };

  describe("the cel strike", () => {
    it("is the same take every time from seed 7, and another take from seed 8", () => {
      expect(celPlan(CEL_PICK)).toEqual(celPlan(CEL_PICK));
      expect(celPlan({ ...CEL_PICK, celSeed: 8 }).frames[6]).not.toEqual(celPlan(CEL_PICK).frames[6]);
    });

    it("strobes three poses on twos with blank frames, impacts on frame 6, the A on frame 7", () => {
      const plan = celPlan(CEL_PICK);
      expect(plan.frames).toHaveLength(19);
      expect([plan.impactFrame, plan.aFrame]).toEqual([6, 7]);
      expect([plan.frames[2].fx.length, plan.frames[5].fx.length]).toEqual([0, 0]);
      expect(plan.frames[6]).toMatchObject({ bolt: true, a: false, bloom: 0.14 });
      expect(plan.frames[7].a).toBe(true);
      expect(plan.fullFlash).toBe(0.14);
    });

    it("lands at 350ms and settles at 1192ms", () => {
      const beats = celBeats(CEL_PICK);
      expect(Math.round(beats.impact * 1000)).toBe(350);
      expect(Math.round(beats.settle * 1000)).toBe(1192);
    });

    it("ends on the three paths alone, so the swap to AsMark is invisible", () => {
      expect(celMarkup(celPlan(CEL_PICK), 18, ids, CEL_PICK)).toBe(
        `<g style="fill:var(--cel-core)"><path d="${BOLT_D}"/><path d="${LEG_D}"/><path d="${BAR_D}"/></g>`,
      );
    });
  });
  ```
- [ ] Run `pnpm test lib/mark/cel.test.ts`. Expect FAIL: modules not found.
- [ ] Copy the lab module and rename its settings type:
  ```bash
  cp "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-lab/app/lab/mark/cel.ts" lib/mark/cel.ts
  sed -i '' 's/StrikeSettings/CelSettings/g' lib/mark/cel.ts
  ```
- [ ] Replace lines 1 and 2 of `lib/mark/cel.ts` (the two imports) with:
  ```ts
  import { BAR_D, BAR_PTS, BOLT_D, BOLT_PTS, BOLT_SPINE, GROUND_Y, IMPACT, LEG_D, LEG_PTS, type Point } from "@/lib/mark/geometry";
  ```
- [ ] In the header comment, replace `a seed is a take, and "reseed" draws a new take.` with `a seed is a take, and the site ships seed 7.`
- [ ] After `export type CelA = "flash" | "sparks";`, insert:
  ```ts
  export type CelSettings = {
    celFps: number;
    celFpp: number;
    celPoses: number;
    celBlanks: boolean;
    celBoil: number;
    celArcs: boolean;
    celGlowRadius: number;
    celGlow: number;
    celPoolSize: number;
    celPool: number;
    celImpact: CelImpact;
    celShards: number;
    celDrift: number;
    celFlash: number;
    celReach: number;
    celAfterglowMs: number;
    celTone: CelTone;
    celA: CelA;
    celSeed: number;
  };
  ```
- [ ] Append to `lib/mark/cel.ts`:
  ```ts
  // The strike's beats in seconds: the frames run after the night dip's lead,
  // and the mark is settled once the dip has lifted.
  export function celBeats(s: CelSettings) {
    const c = celSchedule(s);
    const framesEnd = c.lead + c.count / c.fps;
    return { impact: c.lead + c.impactFrame / c.fps, aStart: c.lead + c.aFrame / c.fps, framesEnd, settle: framesEnd + c.lift };
  }
  ```
- [ ] Create `lib/mark/constants.ts`:
  ```ts
  import type { CelSettings } from "@/lib/mark/cel";

  // Aaron's pick from the mark lab (docs/lab-log-2026-10-05.md, "Mark lab",
  // 2026-10-06), the only place these numbers live. His JSON's round-one values
  // (stepped 220ms, ring splash, shockwave wipe, the 0.06 flash) drive the
  // geometric strikes the cel strike replaced; the lab's cel path never reads
  // them, so they are not here.
  export type HoldConfig = { holdMs: number; drainMs: number; minFill: number; tasteMs: number; tasteRiseMs: number; dischargeMs: number };

  export const HOLD: HoldConfig = { holdMs: 650, drainMs: 260, minFill: 0.3, tasteMs: 200, tasteRiseMs: 90, dischargeMs: 140 };

  export const CEL_PICK: CelSettings = {
    celFps: 24,
    celFpp: 2,
    celPoses: 3,
    celBlanks: true,
    celBoil: 0.6,
    celArcs: true,
    celGlowRadius: 5,
    celGlow: 0.9,
    celPoolSize: 1,
    celPool: 0.8,
    celImpact: "crown",
    celShards: 16,
    celDrift: 1,
    celFlash: 0.14,
    celReach: 1,
    celAfterglowMs: 420,
    celTone: "night",
    celA: "flash",
    celSeed: 7,
  };

  export const MARK = { growPx: 10, growMs: 280, ease: "cubic-bezier(0.22, 1, 0.36, 1)", cardMarkPx: 168 } as const;

  export const RING = { padPx: 14, baseStrokePx: 1.5, arcStrokePx: 4, arcDegrees: 75, tint: 0.16 } as const;

  // Strike first: the bolt lands 40ms after the open, the surface forms 120ms
  // before the mark settles, the words rise 100ms after it.
  export const CARD = { strikeLeadS: 0.04, formEarlyS: 0.12, formS: 0.42, textDelayS: 0.1, textStaggerS: 0.05 } as const;
  ```
- [ ] Run `pnpm test lib/mark/cel.test.ts && pnpm tsc --noEmit`. Expect PASS.
- [ ] Parity check: `diff "/Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-lab/app/lab/mark/cel.ts" lib/mark/cel.ts`. The only expected hunks are the import line, the one comment line, the inserted `CelSettings` type, `StrikeSettings` renamed to `CelSettings` in three signatures, and the appended `celBeats`. Any other hunk means the copy drifted; redo the copy.
- [ ] Commit:
  ```bash
  git add lib/mark/cel.ts lib/mark/cel.test.ts lib/mark/constants.ts
  git commit -m "Mark: the cel strike lifted from the lab, seed 7, tested for one take" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 3: The hold as pure time arithmetic

**Files:** create `lib/mark/hold.ts` and `lib/mark/hold.test.ts`.

**Interfaces:**
- Consumes `HOLD` and `HoldConfig`.
- Produces `type HoldPhase`, `type HoldSource = "pointer" | "key"`, `type HoldState`, `HOLD_IDLE`, and:
  - `advance(s, now, c?): HoldState`
  - `sample(s, now, c?): { fill: number; spent: number }`
  - `press(s, now, source, c?)`, `release(s, now, c?)`, `cancel(s, now, c?)`, each returning `HoldState`
  - `settle(s): HoldState`
  - `click(s): { state: HoldState; swallow: boolean }`

- [ ] Write the failing test, `lib/mark/hold.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { HOLD } from "@/lib/mark/constants";
  import { HOLD_IDLE, advance, cancel, click, press, release, sample, settle } from "@/lib/mark/hold";

  const held = press(HOLD_IDLE, 0, "pointer");

  describe("the mark's hold", () => {
    it("carries Aaron's numbers", () => {
      expect(HOLD).toMatchObject({ holdMs: 650, drainMs: 260, minFill: 0.3, tasteMs: 200 });
    });

    it("fills linearly over 650ms, discharges for 140ms, then fires", () => {
      expect(sample(held, 325).fill).toBeCloseTo(0.5, 5);
      expect(advance(held, 650).phase).toBe("discharging");
      expect(sample(held, 650)).toEqual({ fill: 1, spent: 0 });
      expect(sample(held, 720).spent).toBeCloseTo(0.125, 5);
      expect(advance(held, 790).phase).toBe("fired");
      expect(sample(held, 790)).toEqual({ fill: 0, spent: 0 });
    });

    it("gives a quick tap a taste: 0.3 within 90ms, held 200ms, then drained", () => {
      const tap = release(held, 10);
      expect(sample(tap, 100).fill).toBeCloseTo(0.3, 5);
      expect(sample(tap, 299).fill).toBeCloseTo(0.3, 5);
      expect(advance(tap, 300).phase).toBe("draining");
      expect(sample(tap, 339).fill).toBeCloseTo(0.2625, 4);
      expect(advance(tap, 378).phase).toBe("idle");
    });

    it("keeps a longer release's own fill for the taste and drains it in proportion", () => {
      const fill = 300 / 650;
      const late = release(held, 300);
      expect(sample(late, 450).fill).toBeCloseTo(fill, 5);
      expect(advance(late, 500).phase).toBe("draining");
      expect(advance(late, 500 + 260 * fill).phase).toBe("idle");
    });

    it("cancels into a drain with no taste, and ignores release, cancel and press once it has completed", () => {
      const left = cancel(held, 200);
      expect(left.phase).toBe("draining");
      expect(sample(left, 200).fill).toBeCloseTo(200 / 650, 5);
      expect(release(held, 700).phase).toBe("discharging");
      expect(cancel(held, 700).phase).toBe("discharging");
      expect(press(held, 700, "pointer").phase).toBe("discharging");
    });

    it("resumes a press from the fill it finds", () => {
      const tasting = release(held, 10);
      const again = press(tasting, 50, "pointer");
      expect(again.from).toBeCloseTo(sample(tasting, 50).fill, 5);
      expect(sample(again, 375).fill).toBeCloseTo(again.from + 0.5, 5);
    });

    it("swallows one click after a completed pointer hold, none after a keyboard hold, and a new press clears it", () => {
      const fired = settle(advance(held, 800));
      const first = click(fired);
      expect(first.swallow).toBe(true);
      expect(click(first.state).swallow).toBe(false);
      expect(press(fired, 900, "pointer").swallowClick).toBe(false);
      expect(click(settle(advance(press(HOLD_IDLE, 0, "key"), 800))).swallow).toBe(false);
    });
  });
  ```
- [ ] Run `pnpm test lib/mark/hold.test.ts`. Expect FAIL: module not found.
- [ ] Create `lib/mark/hold.ts`:
  ```ts
  import { HOLD, type HoldConfig } from "@/lib/mark/constants";

  // The mark's press and hold as pure time arithmetic: no timers, no DOM. The
  // caller passes performance.now(); fill and spent are functions of the state
  // and the clock, so the mark and the cursor's ring read one value. fill
  // rises 0 to 1 (linear, as the loader's name fills); spent rises 0 to 1 as
  // the charge leaves through the top in the discharge.
  export type HoldPhase = "idle" | "filling" | "taste" | "draining" | "discharging" | "fired";
  export type HoldSource = "pointer" | "key";
  export type HoldState = { phase: HoldPhase; at: number; from: number; to: number; source: HoldSource; swallowClick: boolean };

  export const HOLD_IDLE: HoldState = { phase: "idle", at: 0, from: 0, to: 0, source: "pointer", swallowClick: false };

  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
  const cubicIn = (t: number) => t * t * t;
  const cubicOut = (t: number) => 1 - cubicIn(1 - t);
  const drainMs = (from: number, c: HoldConfig) => c.drainMs * Math.max(0.3, from);
  const riseMs = (s: HoldState, c: HoldConfig) => (s.to > s.from ? c.tasteRiseMs : 0);

  function phaseEnd(s: HoldState, c: HoldConfig): number | null {
    if (s.phase === "filling") return s.at + (1 - s.from) * c.holdMs;
    if (s.phase === "discharging") return s.at + c.dischargeMs;
    if (s.phase === "taste") return s.at + riseMs(s, c) + c.tasteMs;
    if (s.phase === "draining") return s.at + drainMs(s.from, c);
    return null;
  }

  // Only a pointer hold ends in a click to swallow; a keyboard hold's keys are
  // prevented, so it never produces one.
  function nextPhase(s: HoldState, at: number): HoldState {
    if (s.phase === "filling") return { ...s, phase: "discharging", at, from: 1, swallowClick: s.source === "pointer" };
    if (s.phase === "discharging") return { ...s, phase: "fired", at, from: 0 };
    if (s.phase === "taste") return { ...s, phase: "draining", at, from: s.to };
    return { ...s, phase: "idle", at, from: 0, to: 0 };
  }

  export function advance(state: HoldState, now: number, c: HoldConfig = HOLD): HoldState {
    let s = state;
    for (let end = phaseEnd(s, c); end !== null && now >= end; end = phaseEnd(s, c)) s = nextPhase(s, end);
    return s;
  }

  export function sample(state: HoldState, now: number, c: HoldConfig = HOLD): { fill: number; spent: number } {
    const s = advance(state, now, c);
    const t = Math.max(0, now - s.at);
    if (s.phase === "filling") return { fill: Math.min(1, s.from + t / c.holdMs), spent: 0 };
    if (s.phase === "discharging") return { fill: 1, spent: cubicIn(clamp01(t / c.dischargeMs)) };
    if (s.phase === "taste") {
      const rise = riseMs(s, c);
      return { fill: s.from + (s.to - s.from) * (rise ? cubicOut(clamp01(t / rise)) : 1), spent: 0 };
    }
    if (s.phase === "draining") return { fill: s.from * (1 - cubicIn(clamp01(t / drainMs(s.from, c)))), spent: 0 };
    return { fill: 0, spent: 0 };
  }

  export function press(state: HoldState, now: number, source: HoldSource, c: HoldConfig = HOLD): HoldState {
    const s = advance(state, now, c);
    if (s.phase === "discharging" || s.phase === "fired") return s;
    return { phase: "filling", at: now, from: sample(s, now, c).fill, to: 0, source, swallowClick: false };
  }

  // An early release: the taste guarantees at least minFill for tasteMs.
  export function release(state: HoldState, now: number, c: HoldConfig = HOLD): HoldState {
    const s = advance(state, now, c);
    if (s.phase !== "filling") return s;
    const from = sample(s, now, c).fill;
    return { ...s, phase: "taste", at: now, from, to: Math.max(from, c.minFill) };
  }

  // The pointer left, the browser cancelled, or Escape: drain with no taste.
  export function cancel(state: HoldState, now: number, c: HoldConfig = HOLD): HoldState {
    const s = advance(state, now, c);
    if (s.phase !== "filling") return s;
    return { ...s, phase: "draining", at: now, from: sample(s, now, c).fill, to: 0 };
  }

  // Once the card opens: back to rest, keeping the click still to swallow.
  export function settle(state: HoldState): HoldState {
    return { ...HOLD_IDLE, swallowClick: state.swallowClick };
  }

  export function click(state: HoldState): { state: HoldState; swallow: boolean } {
    return { state: { ...state, swallowClick: false }, swallow: state.swallowClick };
  }
  ```
- [ ] Run `pnpm test lib/mark/hold.test.ts`. Expect PASS, 7 tests.
- [ ] Commit:
  ```bash
  git add lib/mark/hold.ts lib/mark/hold.test.ts
  git commit -m "Mark: the hold as pure time arithmetic, tap taste, drain and swallowed click" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 4: The hold on the hover store, and the ring's paint

**Files:** modify `lib/cursor/hover.ts` and `lib/cursor/hover.test.ts`; create `lib/mark/ring.ts` and `lib/mark/ring.test.ts`.

**Interfaces:**
- Produces `type MarkHold = { fill: number; spent: number; closed: boolean; hidden: boolean }`, `MARK_HOLD_IDLE`, `getMarkHold(): MarkHold`, `setMarkHold(next: MarkHold): void`, and `subscribeMarkHold(listener: () => void): () => void`.
- Produces `ringPaint(hold: MarkHold, arcWidth: number, arcRadius: number): RingFrame`, where `RingFrame = { washTop: number; washHeight: number; arcDegrees: number; arcVisible: boolean; dashArray: string; dashOffset: string }`.

- [ ] Write the failing tests. Append to `lib/cursor/hover.test.ts`, and add `MARK_HOLD_IDLE, getMarkHold, setMarkHold, subscribeMarkHold` to its import from `@/lib/cursor/hover`:
  ```ts
  describe("the mark's hold", () => {
    it("publishes the hold and notifies only on a change", () => {
      const listener = vi.fn();
      const unsubscribe = subscribeMarkHold(listener);
      setMarkHold({ fill: 0.5, spent: 0, closed: false, hidden: false });
      setMarkHold({ fill: 0.5, spent: 0, closed: false, hidden: false });
      expect(getMarkHold().fill).toBe(0.5);
      setMarkHold(MARK_HOLD_IDLE);
      expect(listener).toHaveBeenCalledTimes(2);
      unsubscribe();
    });
  });
  ```
- [ ] Create `lib/mark/ring.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";
  import { MARK_HOLD_IDLE } from "@/lib/cursor/hover";
  import { ringPaint } from "@/lib/mark/ring";

  const width = 4 * (100 / 56);
  const radius = 50 - width / 2;
  const at = (fill: number, spent = 0, closed = false) => ringPaint({ fill, spent, closed, hidden: false }, width, radius);

  describe("the ring's hold indicator", () => {
    it("rests empty", () => {
      expect(ringPaint(MARK_HOLD_IDLE, width, radius)).toMatchObject({ washTop: 100, washHeight: 0, arcDegrees: 0, arcVisible: false });
    });

    it("rises with the fill: half a hold is half the wash and 37.5 degrees", () => {
      expect(at(0.5)).toMatchObject({ washTop: 50, washHeight: 50, arcDegrees: 37.5, arcVisible: true });
    });

    it("reaches 75 degrees at full, closes the circle on the discharge, and the wash leaves from the bottom", () => {
      expect(at(1).arcDegrees).toBe(75);
      expect(at(1, 0.5, true)).toMatchObject({ arcDegrees: 360, dashArray: "360 0", washTop: 0, washHeight: 50 });
    });
  });
  ```
- [ ] Run `pnpm test lib/cursor lib/mark/ring.test.ts`. Expect FAIL: the missing exports and the missing module.
- [ ] Append to `lib/cursor/hover.ts`:
  ```ts
  // ---- mark-strike: the mark's hold for the cursor's ring ----
  // MarkTrigger publishes its hold each frame it changes; CustomCursor's ring
  // paints from it, so the mark and the ring read one clock. closed is the
  // discharge (the arc becomes a full circle); hidden is the card being open.
  export type MarkHold = { fill: number; spent: number; closed: boolean; hidden: boolean };
  export const MARK_HOLD_IDLE: MarkHold = { fill: 0, spent: 0, closed: false, hidden: false };

  let markHold: MarkHold = MARK_HOLD_IDLE;
  const markHoldListeners = new Set<() => void>();

  export function getMarkHold(): MarkHold {
    return markHold;
  }

  export function setMarkHold(next: MarkHold) {
    const same = next.fill === markHold.fill && next.spent === markHold.spent && next.closed === markHold.closed && next.hidden === markHold.hidden;
    if (same) return;
    markHold = next;
    markHoldListeners.forEach((listener) => listener());
  }

  export function subscribeMarkHold(listener: () => void): () => void {
    markHoldListeners.add(listener);
    return () => {
      markHoldListeners.delete(listener);
    };
  }
  // ---- end mark-strike ----
  ```
- [ ] Create `lib/mark/ring.ts`:
  ```ts
  import type { MarkHold } from "@/lib/cursor/hover";
  import { RING } from "@/lib/mark/constants";

  // The cursor ring's hold indicator, in the ring's 0 to 100 box: a wash rising
  // through the interior in step with the mark, and an arc clockwise from 12
  // o'clock to 75 degrees at full hold, no ease, closed to a full circle on
  // the first frame of the discharge.
  export type RingFrame = { washTop: number; washHeight: number; arcDegrees: number; arcVisible: boolean; dashArray: string; dashOffset: string };

  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  export function ringPaint(hold: MarkHold, arcWidth: number, arcRadius: number): RingFrame {
    const fill = clamp01(hold.fill);
    const washTop = 100 * (1 - fill);
    const washHeight = Math.max(0, 100 * (1 - clamp01(hold.spent)) - washTop);
    const arcDegrees = hold.closed ? 360 : RING.arcDegrees * fill;
    // Round caps overhang each end by half the stroke; pull the dash in by that
    // much (in the circle's 360 path units) so 12 o'clock is the true start.
    const cap = arcDegrees >= 360 ? 0 : (arcWidth / 2 / (2 * Math.PI * arcRadius)) * 360;
    const dash = Math.max(0.001, arcDegrees - 2 * cap);
    return { washTop, washHeight, arcDegrees, arcVisible: arcDegrees >= 0.5, dashArray: `${dash} ${360 - dash}`, dashOffset: String(-cap) };
  }
  ```
- [ ] Run `pnpm test lib/cursor lib/mark`. Expect PASS.
- [ ] Commit:
  ```bash
  git add lib/cursor/hover.ts lib/cursor/hover.test.ts lib/mark/ring.ts lib/mark/ring.test.ts
  git commit -m "Mark: the hold on the hover store and the ring's paint from it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 5: The card's words

**Files:** modify `lib/content.ts` and `lib/content.test.ts`.

**Interfaces:** Produces `siteContent.mark: { dialogLabel; eyebrow; title; lines: readonly string[]; cta: { label; href } }`.

- [ ] Write the failing test. Append to `lib/content.test.ts`:
  ```ts
  describe("the mark card", () => {
    it("is short, sentence case, and never uses an em dash", () => {
      const { mark } = siteContent;
      const strings = [mark.dialogLabel, mark.eyebrow, mark.title, ...mark.lines, mark.cta.label];
      for (const text of strings) {
        expect(text).not.toMatch(/—/);
        expect(text[0]).toBe(text[0].toUpperCase());
      }
      expect(mark.lines.length).toBeLessThanOrEqual(3);
      expect(mark.cta.href).toBe("#connect");
    });
  });
  ```
- [ ] Run `pnpm test lib/content.test.ts`. Expect FAIL: `mark` is undefined.
- [ ] In `lib/content.ts`, insert the block as the last key of `siteContent`, directly before `} as const;`:
  ```ts
    // The mark's card (components/mark/MarkCard.tsx), opened by holding the
    // top-left mark. PLACEHOLDER: every line below is the shortest true line,
    // for Aaron to replace with his own words about the name and the gamertag.
    mark: {
      dialogLabel: "The mark",
      eyebrow: "The mark",
      title: "My initials, A and S",
      lines: ["The bolt's tail is also the A's right leg."],
      cta: { label: "Say hi", href: "#connect" },
    },
  ```
- [ ] Run `pnpm test lib/content.test.ts && pnpm tsc --noEmit`. Expect PASS.
- [ ] Commit:
  ```bash
  git add lib/content.ts lib/content.test.ts
  git commit -m "Mark: the card's placeholder words in content, marked for Aaron" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 6: The end-to-end spec, failing

**Files:** create `e2e/mark.spec.ts`.

**Interfaces:**
- Consumes `openHome`, `scrollToY` (`e2e/support/coil.ts`) and `settled` (`e2e/support/fallback.ts`).
- Consumes the DOM contract the later tasks produce:
  - `[data-mark-trigger]`, carrying `data-hold-progress="0.000"`
  - its first `span`, which carries the inline `scale()`
  - `[data-mark-ring]`, carrying `data-ring-arc`
  - a dialog named "The mark", containing `[data-mark-strike][data-mode]`, `[data-card="surface"]`, `[data-part="cel"]`, `[data-cel-night]` and `[data-cel-flash]`

- [ ] Write the failing test, `e2e/mark.spec.ts`:
  ```ts
  import type { Page } from "@playwright/test";
  import { test, expect } from "./support/fixtures";
  import { openHome, scrollToY } from "./support/coil";
  import { settled } from "./support/fallback";

  // The top-left mark (components/mark): a click still scrolls to the top; a
  // 650ms hold strikes and opens the card and swallows the click it ends with;
  // an early release tastes the fill and drains; Enter or Space held does the
  // same from the keyboard; reduced motion opens the card on the static mark.
  // The cursor's ring paints the same fill as the mark.

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const Y = 600;
  const mark = (page: Page) => page.locator("[data-mark-trigger]");
  const card = (page: Page) => page.getByRole("dialog", { name: "The mark" });
  const progress = async (page: Page) => Number(await mark(page).getAttribute("data-hold-progress"));
  const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

  async function pointAtMark(page: Page) {
    const box = await mark(page).boundingBox();
    if (!box) throw new Error("the mark is not on screen");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }

  async function holdMark(page: Page, ms: number) {
    await pointAtMark(page);
    await page.mouse.down();
    await sleep(ms);
    await page.mouse.up();
  }

  test("mark: hover grows it 10px from its corner, and a click still scrolls to the top with no card", async ({ page }) => {
    await openHome(page);
    await scrollToY(page, Y);
    await pointAtMark(page);
    await expect(mark(page).locator("span").first()).toHaveAttribute("style", /scale\(1\.3125\)/);
    await mark(page).click();
    await expect.poll(() => scrollY(page)).toBeLessThan(2);
    await sleep(1000);
    await expect(card(page)).toHaveCount(0);
  });

  test("mark: a 700ms hold strikes and opens the card, and swallows the click it ends with", async ({ page }) => {
    await openHome(page);
    await scrollToY(page, Y);
    await holdMark(page, 700);
    const dialog = card(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-mark-strike]")).toHaveAttribute("data-mode", "cel");
    await expect.poll(() => dialog.locator('[data-card="surface"]').evaluate((el) => getComputedStyle(el).opacity), { timeout: 4000 }).toBe("1");
    expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
    await expect.poll(() => page.evaluate(() => document.querySelector<SVGElement>("[data-mark-ring]")?.style.opacity ?? "0")).toBe("0");
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
    expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
    await mark(page).click();
    await expect.poll(() => scrollY(page)).toBeLessThan(2);
  });

  test("mark: letting go at 300ms opens nothing and the fill drains @ring", async ({ page }) => {
    await openHome(page);
    await scrollToY(page, Y);
    await pointAtMark(page);
    await page.mouse.down();
    await sleep(300);
    const mid = await page.evaluate(() => ({
      fill: Number(document.querySelector<HTMLElement>("[data-mark-trigger]")!.dataset.holdProgress),
      arc: Number(document.querySelector<SVGElement>("[data-mark-ring]")!.dataset.ringArc),
    }));
    await page.mouse.up();
    expect(mid.fill).toBeGreaterThan(0.3);
    expect(mid.fill).toBeLessThan(0.75);
    expect(Math.abs(mid.arc / 75 - mid.fill)).toBeLessThan(0.002);
    await expect.poll(() => progress(page)).toBe(0);
    await sleep(600);
    await expect(card(page)).toHaveCount(0);
  });

  test("mark: a quick tap shows at least 0.3 of the fill for 200ms, then drains", async ({ page }) => {
    await openHome(page);
    await pointAtMark(page);
    await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>("[data-mark-trigger]")!;
      const rec = { samples: [] as [number, number][], releasedAt: 0 };
      Object.assign(window, { __tap: rec });
      window.addEventListener("pointerup", () => (rec.releasedAt = performance.now()), { once: true });
      const start = performance.now();
      const tick = () => {
        rec.samples.push([performance.now(), Number(el.dataset.holdProgress)]);
        if (performance.now() - start < 1500) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.mouse.down();
    await page.mouse.up();
    await sleep(1600);
    const { samples, releasedAt } = await page.evaluate(() => (window as unknown as { __tap: { samples: [number, number][]; releasedAt: number } }).__tap);
    const tasted = samples.filter(([t]) => t - releasedAt >= 110 && t - releasedAt <= 270).map(([, fill]) => fill);
    expect(tasted.length).toBeGreaterThan(5);
    expect(Math.min(...tasted)).toBeGreaterThanOrEqual(0.299);
    expect(samples.at(-1)?.[1]).toBe(0);
  });

  test("mark: Enter held opens the card, its repeat cannot close it, Escape does and focus returns to the mark", async ({ page }) => {
    await openHome(page);
    await mark(page).focus();
    await page.keyboard.down("Enter");
    await expect(card(page)).toBeVisible();
    await expect(page.locator("[data-mark-ring]")).toHaveCount(0);
    await expect(card(page).getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    await sleep(300);
    await expect(card(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(card(page)).toHaveCount(0);
    await expect(mark(page)).toBeFocused();
  });

  test("mark: Escape cancels a keyboard hold, and Space held opens the card without its release pressing Close", async ({ page }) => {
    await openHome(page);
    await scrollToY(page, Y);
    await mark(page).focus();
    await page.keyboard.down("Enter");
    await sleep(300);
    await page.keyboard.press("Escape");
    await sleep(500);
    await page.keyboard.up("Enter");
    await sleep(400);
    await expect(card(page)).toHaveCount(0);
    expect(Math.abs((await scrollY(page)) - Y)).toBeLessThan(1);
    await page.keyboard.down("Space");
    await expect(card(page)).toBeVisible();
    await expect(card(page).getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.up("Space");
    await sleep(300);
    await expect(card(page)).toBeVisible();
  });

  test.describe("reduced motion", () => {
    test.use({ contextOptions: { reducedMotion: "reduce" } });

    test("mark: the hold opens the card on the static mark, with no strike", async ({ page }) => {
      await page.goto("/");
      await settled(page);
      await holdMark(page, 700);
      const dialog = card(page);
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("[data-mark-strike]")).toHaveAttribute("data-mode", "static");
      await expect(dialog.locator('[data-part="cel"], [data-cel-night], [data-cel-flash]')).toHaveCount(0);
      await expect(dialog.locator('[data-card="surface"]')).toHaveCSS("opacity", "1");
    });
  });
  ```
- [ ] Run `pnpm test:e2e e2e/mark.spec.ts`. This builds the site itself; do not run it while a dev server is up in this checkout. Expect all 7 tests to FAIL: no `[data-mark-trigger]`, no dialog.
- [ ] Commit:
  ```bash
  git add e2e/mark.spec.ts
  git commit -m "Mark: end to end spec for the hold, the card, the keyboard and reduced motion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 7: The strike timeline, the strike mark and the card

**Files:** modify `lib/gsap.ts`; create `lib/mark/timeline.ts`, `components/mark/MarkStrike.tsx` and `components/mark/MarkCard.tsx`.

**Interfaces:**
- Consumes `CEL_PICK`, `CARD`, `MARK`, `celPlan`, `celSchedule`, `celMarkup`, `celBeats`, `siteContent.mark`, `useCloseHint`, `Portal`, and the `lib/modal` hooks and variants.
- Produces:
  - `CustomEase` exported from `@/lib/gsap`, and the ease `"site"`
  - `buildCardOpen(scope: Element): gsap.core.Timeline` (paused)
  - `MarkStrike({ sizePx: number; reduced: boolean })`
  - `MarkCard({ open: boolean; onClose: () => void })`

- [ ] Failing test: the Task 6 spec still fails. There is no route to the card until Task 8.
- [ ] In `lib/gsap.ts`:
  - Add `import { CustomEase } from "gsap/CustomEase";`.
  - Inside the window guard, change the registration to `gsap.registerPlugin(useGSAP, ScrollTrigger, Observer, CustomEase);` and add `if (!CustomEase.get("site")) CustomEase.create("site", "0.22,1,0.36,1");`.
  - Change the export to `export { gsap, ScrollTrigger, Observer, CustomEase, useGSAP };`.
  - Append this sentence to the header comment: `CustomEase names the site's ease "site" for the mark card's GSAP open.`
- [ ] Create `lib/mark/timeline.ts`:
  ```ts
  import { gsap } from "@/lib/gsap";
  import { celBeats, celMarkup, celPlan, celSchedule } from "@/lib/mark/cel";
  import { CARD, CEL_PICK } from "@/lib/mark/constants";

  // The cel strike as one timeline (the lab's strike.ts, buildCel): a linear
  // tween of a frame counter whose onUpdate redraws the layer only when the
  // whole frame changes, so the clock steps like film. The page dips to the
  // loader's dark tokens for the strike and the one flash frame covers the
  // whole surface; AsMark fades in over the hot copy as the dip lifts.
  function buildCelStrike(root: Element, night: Element | null, flash: Element | null) {
    const tl = gsap.timeline({ paused: true });
    const layer = root.querySelector<SVGGElement>('[data-part="cel"]');
    const rest = root.querySelector<HTMLElement>('[data-part="rest"]');
    if (!layer || !rest) return tl;
    const plan = celPlan(CEL_PICK);
    const sch = celSchedule(CEL_PICK);
    const ids = { glow: layer.dataset.glow ?? "", wide: layer.dataset.wide ?? "", pool: layer.dataset.pool ?? "", bloom: layer.dataset.bloom ?? "" };
    const count = plan.frames.length;
    const framesEnd = sch.lead + count / sch.fps;
    let shown = -2;
    const draw = (index: number) => {
      if (index === shown) return;
      shown = index;
      layer.innerHTML = index < 0 ? "" : celMarkup(plan, index, ids, CEL_PICK);
    };
    gsap.set(rest, { autoAlpha: 0 });
    draw(-1);
    const clock = { f: -sch.lead * sch.fps };
    tl.to(clock, { f: count, duration: framesEnd, ease: "none", onUpdate: () => draw(Math.min(count - 1, Math.floor(clock.f + 1e-6))) }, 0);
    if (flash) {
      const at = sch.lead + plan.impactFrame / sch.fps;
      tl.set(flash, { opacity: plan.fullFlash }, at).set(flash, { opacity: 0 }, at + 1 / sch.fps);
    }
    if (night) {
      tl.to(night, { opacity: 1, duration: sch.lead, ease: "power1.out" }, 0);
      tl.to(night, { opacity: 0, duration: sch.lift, ease: "power2.inOut" }, framesEnd);
    }
    tl.to(rest, { autoAlpha: 1, duration: sch.lift, ease: "power2.inOut" }, framesEnd);
    tl.set(layer, { autoAlpha: 0 }, framesEnd + sch.lift);
    return tl;
  }

  // Strike first: the bolt lands on the dipped page, then the surface forms
  // around the settled mark and the words rise. The mark never moves.
  export function buildCardOpen(scope: Element) {
    const tl = gsap.timeline({ paused: true });
    const root = scope.querySelector("[data-mark-strike]");
    if (!root) return tl;
    const strike = buildCelStrike(root, scope.querySelector("[data-cel-night]"), scope.querySelector("[data-cel-flash]"));
    tl.add(strike.paused(false), CARD.strikeLeadS);
    const formAt = CARD.strikeLeadS + celBeats(CEL_PICK).settle - CARD.formEarlyS;
    tl.fromTo('[data-card="surface"]', { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: CARD.formS, ease: "site" }, formAt);
    tl.fromTo('[data-card="text"]', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: CARD.formS, ease: "site", stagger: CARD.textStaggerS }, formAt + CARD.textDelayS);
    return tl;
  }
  ```
  The selector strings resolve inside the `gsap.context` scope that `MarkCard` creates.
- [ ] Create `components/mark/MarkStrike.tsx`:
  ```tsx
  "use client";

  import { useId } from "react";
  import { AsMark } from "@/components/menu/BrandMark";
  import { CEL_PICK } from "@/lib/mark/constants";
  import { VIEW_BOX } from "@/lib/mark/geometry";

  // The card's mark: an empty cel layer the strike timeline redraws frame by
  // frame, the blurs it references, and the real AsMark on top, which is the
  // settled frame. The core and glow are the loader's always-dark tokens.
  // Reduced motion renders AsMark alone.
  const REGION = { filterUnits: "userSpaceOnUse" as const, x: -160, y: -160, width: 580, height: 580 };

  export function MarkStrike({ sizePx, reduced }: { sizePx: number; reduced: boolean }) {
    const id = useId().replace(/:/g, "");
    return (
      <div data-mark-strike="" data-mode={reduced ? "static" : "cel"} className="relative shrink-0" style={{ width: sizePx, height: sizePx }}>
        {!reduced && (
          <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <filter id={`${id}-glow`} {...REGION}>
                <feGaussianBlur stdDeviation={CEL_PICK.celGlowRadius} />
              </filter>
              <filter id={`${id}-wide`} {...REGION}>
                <feGaussianBlur stdDeviation={CEL_PICK.celGlowRadius * 2.8} />
              </filter>
              <filter id={`${id}-pool`} {...REGION}>
                <feGaussianBlur stdDeviation="9 2.2" />
              </filter>
              <filter id={`${id}-bloom`} {...REGION}>
                <feGaussianBlur stdDeviation="26" />
              </filter>
            </defs>
            <g
              data-part="cel"
              data-glow={`${id}-glow`}
              data-wide={`${id}-wide`}
              data-pool={`${id}-pool`}
              data-bloom={`${id}-bloom`}
              className="[--cel-core:var(--loader-name)] [--cel-glow:var(--loader-fill)]"
            />
          </svg>
        )}
        <div data-part="rest" className="absolute inset-0 text-foreground">
          <AsMark className="block h-full w-full" />
        </div>
      </div>
    );
  }
  ```
- [ ] Create `components/mark/MarkCard.tsx`:
  ```tsx
  "use client";

  import { useLayoutEffect, useRef } from "react";
  import { X } from "lucide-react";
  import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
  import { MarkStrike } from "@/components/mark/MarkStrike";
  import { useCloseHint } from "@/components/PhotoModal";
  import { Portal } from "@/components/Portal";
  import { siteContent } from "@/lib/content";
  import { gsap } from "@/lib/gsap";
  import { MARK } from "@/lib/mark/constants";
  import { buildCardOpen } from "@/lib/mark/timeline";
  import { modalBackdropBlurVariants, modalBackdropTintVariants, useBodyScrollLock, useEscapeKey, useFocusTrap } from "@/lib/modal";
  import { navigateToSection } from "@/lib/scroll";

  // The mark's card in the site's modal shell (Portal, scroll lock, Escape,
  // focus trap, the shared blur and tint). Framer owns the backdrop and the
  // exit; GSAP (lib/mark/timeline) owns the strike, the surface and the words;
  // they never animate one element. The surface is opaque bg-background, since
  // bg-background/NN emits nothing with var() colors. Reduced motion: the
  // static mark, the panel fades in over 180ms.
  const COPY = siteContent.mark;

  export function MarkCard({ open, onClose }: { open: boolean; onClose: () => void }) {
    const reduced = !!useReducedMotion();
    const pending = useRef<string | null>(null);
    return (
      <Portal>
        <AnimatePresence
          onExitComplete={() => {
            if (pending.current) navigateToSection(pending.current, reduced);
            pending.current = null;
          }}
        >
          {open && (
            <MarkDialog
              key="mark-card"
              reduced={reduced}
              onClose={onClose}
              onCta={() => {
                pending.current = COPY.cta.href;
                onClose();
              }}
            />
          )}
        </AnimatePresence>
      </Portal>
    );
  }

  function MarkDialog({ reduced, onClose, onCta }: { reduced: boolean; onClose: () => void; onCta: () => void }) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeHint = useCloseHint();
    useBodyScrollLock(true);
    useEscapeKey(true, onClose);
    useFocusTrap(dialogRef, true);

    useLayoutEffect(() => {
      const scope = dialogRef.current;
      if (!scope || reduced) return;
      const ctx = gsap.context(() => {
        buildCardOpen(scope).play(0);
      }, scope);
      return () => ctx.revert();
    }, [reduced]);

    const panel = reduced
      ? { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.18, ease: "linear" as const } }, exit: { opacity: 0, transition: { duration: 0.12 } } }
      : { hidden: { opacity: 1 }, visible: { opacity: 1 }, exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" as const } } };

    return (
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={COPY.dialogLabel}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={modalBackdropBlurVariants(0)}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain px-4 py-6 md:px-10 md:py-14"
      >
        <motion.div aria-hidden="true" variants={modalBackdropTintVariants(0)} className="pointer-events-none fixed inset-0">
          <div className="absolute inset-0 bg-background opacity-70" />
        </motion.div>
        {!reduced && (
          <>
            <div data-cel-night="" aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[var(--loader-bg)] opacity-0" />
            <div data-cel-flash="" aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[var(--loader-name)] opacity-0" />
          </>
        )}
        <motion.div variants={panel} className="relative my-auto w-full max-w-xl" onMouseDown={(e) => e.stopPropagation()}>
          <div data-card="surface" className="absolute inset-0 rounded-2xl border border-border bg-background shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)]" />
          <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:gap-7 md:p-10">
            <button
              type="button"
              data-card="text"
              onClick={onClose}
              aria-label={siteContent.modals.closeAriaLabel}
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors duration-200 hover:text-accent"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
            <MarkStrike sizePx={MARK.cardMarkPx} reduced={reduced} />
            <div className="flex min-w-0 flex-col gap-3 sm:pr-6">
              <span data-card="text" className="text-sm text-muted">{COPY.eyebrow}</span>
              <h2 data-card="text" className="font-display text-3xl leading-tight text-foreground">{COPY.title}</h2>
              {COPY.lines.map((line) => (
                <p key={line} data-card="text" className="text-base leading-relaxed text-foreground">{line}</p>
              ))}
              {/* Swap for the controls slice's circle fill once it merges (Task 10). */}
              <span data-card="text" className="w-fit">
                <a
                  href={COPY.cta.href}
                  onClick={(e) => {
                    e.preventDefault();
                    onCta();
                  }}
                  className="text-base font-medium text-accent underline underline-offset-4 transition-colors duration-200 hover:text-accent-hover"
                >
                  {COPY.cta.label}
                </a>
              </span>
              <span data-card="text" className="pt-1 text-sm text-muted">{closeHint}</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }
  ```
- [ ] Run `pnpm tsc --noEmit && pnpm lint && pnpm test`. Expect clean, with no new lint errors.
- [ ] Commit:
  ```bash
  git add lib/gsap.ts lib/mark/timeline.ts components/mark/MarkStrike.tsx components/mark/MarkCard.tsx
  git commit -m "Mark: the cel strike timeline and the card in the modal shell, strike first" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 8: The trigger on the nav mark

**Files:** create `components/mark/MarkTrigger.tsx`; modify `components/SiteNav.tsx`.

**Interfaces:**
- Consumes the hold machine, `setMarkHold`, `MARK_HOLD_IDLE`, `MarkCard`, `AsMark` and the geometry.
- Produces `MarkTrigger({ ariaLabel: string; className: string; onActivate: () => void })`, which renders `button[data-mark-trigger][data-hold-progress]` and an inner `span` that carries the scale.

- [ ] Failing test: `pnpm test:e2e e2e/mark.spec.ts --grep-invert @ring` fails (from Task 6).
- [ ] Create `components/mark/MarkTrigger.tsx`:
  ```tsx
  "use client";

  import { useEffect, useId, useRef, useState } from "react";
  import { useReducedMotion } from "framer-motion";
  import { MarkCard } from "@/components/mark/MarkCard";
  import { AsMark } from "@/components/menu/BrandMark";
  import { MARK_HOLD_IDLE, setMarkHold } from "@/lib/cursor/hover";
  import { MARK } from "@/lib/mark/constants";
  import { BAR_D, BOLT_D, FILL_BOTTOM, FILL_TOP, LEG_D, VIEW_BOX } from "@/lib/mark/geometry";
  import { HOLD_IDLE, advance, cancel, click, press, release, sample, settle, type HoldSource } from "@/lib/mark/hold";

  // The top-left mark. A click scrolls to the top as it always has. A press
  // fills it two-tone from the bottom like the loader's name; a 650ms hold
  // discharges and opens the card, and the click that ends it is swallowed.
  // One clock (lib/mark/hold) paints the mark here and publishes the same fill
  // for the cursor's ring. Keyboard: Enter or Space held; Escape cancels.
  // Touch: no pan, no callout, no context menu on the mark.
  const HOLD_KEYS = new Set(["Enter", " "]);

  // After a keyboard hold opens the card, focus lands on Close while the key
  // may still be down; its repeats and its release must not press Close.
  function swallowHeldKey(key: string) {
    const swallow = (event: KeyboardEvent) => {
      if (event.key !== key) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.type !== "keyup") return;
      window.removeEventListener("keydown", swallow, true);
      window.removeEventListener("keyup", swallow, true);
    };
    window.addEventListener("keydown", swallow, true);
    window.addEventListener("keyup", swallow, true);
  }

  type Props = { ariaLabel: string; className: string; onActivate: () => void };

  export function MarkTrigger({ ariaLabel, className, onActivate }: Props) {
    const clipId = `${useId().replace(/:/g, "")}-rise`;
    const reduced = !!useReducedMotion();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const riseRef = useRef<SVGRectElement>(null);
    const hold = useRef(HOLD_IDLE);
    const heldKey = useRef<string | null>(null);
    const openRef = useRef(false);
    const kick = useRef<() => void>(() => {});
    const [open, setOpen] = useState(false);
    const [scale, setScale] = useState(1);

    useEffect(() => {
      let frame = 0;
      const tick = () => {
        const now = performance.now();
        let state = advance(hold.current, now);
        if (state.phase === "fired") {
          state = settle(state);
          openRef.current = true;
          setOpen(true);
          if (heldKey.current) swallowHeldKey(heldKey.current);
          heldKey.current = null;
        }
        hold.current = state;
        const { fill, spent } = sample(state, now);
        const span = FILL_BOTTOM - FILL_TOP;
        riseRef.current?.setAttribute("y", String(FILL_BOTTOM - span * fill));
        riseRef.current?.setAttribute("height", String(Math.max(0, span * (fill - spent))));
        buttonRef.current?.setAttribute("data-hold-progress", fill.toFixed(3));
        setMarkHold({ fill, spent, closed: state.phase === "discharging", hidden: openRef.current });
        frame = state.phase === "idle" ? 0 : requestAnimationFrame(tick);
      };
      kick.current = () => {
        if (!frame) frame = requestAnimationFrame(tick);
      };
      return () => {
        cancelAnimationFrame(frame);
        setMarkHold(MARK_HOLD_IDLE);
      };
    }, []);

    const now = () => performance.now();
    const begin = (source: HoldSource) => {
      if (openRef.current) return;
      hold.current = press(hold.current, now(), source);
      kick.current();
    };
    const stop = () => {
      hold.current = cancel(hold.current, now());
      kick.current();
    };
    const grow = () => {
      const size = buttonRef.current?.offsetWidth ?? 32;
      setScale((size + MARK.growPx) / size);
    };
    const close = () => {
      openRef.current = false;
      setOpen(false);
      setMarkHold(MARK_HOLD_IDLE);
    };

    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          aria-label={ariaLabel}
          data-cursor-hover
          data-mark-trigger=""
          data-hold-progress="0.000"
          className={`${className} touch-none select-none [-webkit-touch-callout:none]`}
          onPointerDown={(e) => {
            if (e.button === 0) begin("pointer");
          }}
          onPointerUp={() => {
            hold.current = release(hold.current, now());
            kick.current();
          }}
          onPointerCancel={stop}
          onPointerEnter={grow}
          onPointerLeave={() => {
            setScale(1);
            stop();
          }}
          onFocus={(e) => {
            if (e.currentTarget.matches(":focus-visible")) grow();
          }}
          onBlur={() => setScale(1)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            const result = click(hold.current);
            hold.current = result.state;
            if (result.swallow) e.preventDefault();
            else onActivate();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") return stop();
            if (!HOLD_KEYS.has(e.key)) return;
            e.preventDefault();
            if (e.repeat) return;
            heldKey.current = e.key;
            begin("key");
          }}
          onKeyUp={(e) => {
            if (!HOLD_KEYS.has(e.key)) return;
            e.preventDefault();
            heldKey.current = null;
            const at = now();
            const wasFilling = advance(hold.current, at).phase === "filling";
            hold.current = release(hold.current, at);
            kick.current();
            if (wasFilling) onActivate();
          }}
        >
          <span
            className="relative block h-full w-full"
            style={{ transform: `scale(${scale})`, transformOrigin: "0 0", transition: reduced ? "none" : `transform ${MARK.growMs}ms ${MARK.ease}` }}
          >
            <AsMark className="block h-full w-full" />
            <svg viewBox={VIEW_BOX} aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full fill-accent">
              <defs>
                <clipPath id={clipId}>
                  <rect ref={riseRef} x="0" y={FILL_BOTTOM} width="260" height="0" />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId})`}>
                <path d={BOLT_D} />
                <path d={LEG_D} />
                <path d={BAR_D} />
              </g>
            </svg>
          </span>
        </button>
        <MarkCard open={open} onClose={close} />
      </>
    );
  }
  ```
- [ ] In `components/SiteNav.tsx`:
  - Replace `import { AsMark } from "@/components/menu/BrandMark";` with `import { MarkTrigger } from "@/components/mark/MarkTrigger";`.
  - Replace the whole mark `<button>...</button>` with:
  ```tsx
      <MarkTrigger
        ariaLabel={siteContent.menu.markAriaLabel}
        onActivate={() => goTo("#main")}
        className={`fixed left-4 top-[18px] z-40 block h-[26px] w-[26px] text-foreground transition-transform duration-[450ms] ${EASE_CLASS} focus-visible:translate-y-0 sm:left-6 sm:top-5 sm:h-8 sm:w-8 ${
          tucked ? "-translate-y-[90px]" : ""
        }`}
      />
  ```
  - Add this sentence to the header comment: `The mark is MarkTrigger: a click scrolls to the top, a 650ms hold opens the mark's card.`
- [ ] Run `pnpm tsc --noEmit && pnpm lint && pnpm test:e2e e2e/mark.spec.ts --grep-invert @ring`. Expect PASS, 6 tests.
- [ ] Commit:
  ```bash
  git add components/mark/MarkTrigger.tsx components/SiteNav.tsx
  git commit -m "Mark: hold the nav mark for the strike, a click still goes to the top" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 9: The cursor rings the mark

**Files:** create `components/mark/MarkRing.tsx`; modify `components/CustomCursor.tsx`.

**Interfaces:**
- Consumes `getMarkHold`, `subscribeMarkHold`, `MARK_HOLD_IDLE`, `ringPaint`, `RING` and `MARK`.
- Produces `MarkRing({ diameter: number; reduced: boolean })`, rendering `svg[data-mark-ring][data-ring-arc]`.

- [ ] Failing test: `pnpm test:e2e e2e/mark.spec.ts --grep @ring` fails because `[data-mark-ring]` is missing.
- [ ] Create `components/mark/MarkRing.tsx`:
  ```tsx
  "use client";

  import { useEffect, useId, useRef } from "react";
  import { MARK_HOLD_IDLE, getMarkHold, subscribeMarkHold } from "@/lib/cursor/hover";
  import { RING } from "@/lib/mark/constants";
  import { ringPaint } from "@/lib/mark/ring";

  // The cursor over the mark: a ring around the grown mark that shows the
  // hold, painted from the hover store's markHold (the fill MarkTrigger
  // publishes), so the ring and the mark never disagree. Reduced motion: the
  // plain ring. Hidden while the card is open.
  export function MarkRing({ diameter, reduced }: { diameter: number; reduced: boolean }) {
    const clipId = `${useId().replace(/:/g, "")}-wash`;
    const rootRef = useRef<SVGSVGElement>(null);
    const washRef = useRef<SVGRectElement>(null);
    const arcRef = useRef<SVGCircleElement>(null);
    const unit = 100 / diameter;
    const base = RING.baseStrokePx * unit;
    const arcWidth = RING.arcStrokePx * unit;
    const arcRadius = 50 - arcWidth / 2;

    useEffect(() => {
      const paint = () => {
        const root = rootRef.current;
        const wash = washRef.current;
        const arc = arcRef.current;
        if (!root || !wash || !arc) return;
        const hold = getMarkHold();
        const frame = ringPaint(reduced ? MARK_HOLD_IDLE : hold, arcWidth, arcRadius);
        root.style.opacity = hold.hidden ? "0" : "1";
        root.dataset.ringArc = frame.arcDegrees.toFixed(1);
        wash.setAttribute("y", String(frame.washTop));
        wash.setAttribute("height", String(frame.washHeight));
        arc.style.visibility = frame.arcVisible ? "visible" : "hidden";
        arc.style.strokeDasharray = frame.dashArray;
        arc.style.strokeDashoffset = frame.dashOffset;
      };
      paint();
      return subscribeMarkHold(paint);
    }, [reduced, arcWidth, arcRadius]);

    return (
      <svg
        ref={rootRef}
        data-mark-ring=""
        viewBox="0 0 100 100"
        overflow="visible"
        className={`absolute left-0 top-0 block -translate-x-1/2 -translate-y-1/2 text-accent ${reduced ? "" : "transition-[width,height] duration-200 ease-out"}`}
        style={{ width: diameter, height: diameter }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect ref={washRef} x="0" y="100" width="100" height="0" />
          </clipPath>
        </defs>
        <circle cx="50" cy="50" r={50 - base} clipPath={`url(#${clipId})`} className="fill-accent" fillOpacity={RING.tint} />
        <circle cx="50" cy="50" r={50 - base / 2} fill="none" stroke="currentColor" strokeWidth={base} />
        <circle
          ref={arcRef}
          cx="50"
          cy="50"
          r={arcRadius}
          fill="none"
          stroke="currentColor"
          strokeWidth={arcWidth}
          strokeLinecap="round"
          pathLength={360}
          transform="rotate(-90 50 50)"
          style={{ visibility: "hidden", strokeDasharray: "0 360" }}
        />
      </svg>
    );
  }
  ```
- [ ] Modify `components/CustomCursor.tsx`:
  1. Add the imports: `import { useReducedMotion } from "framer-motion";`, `import { MarkRing } from "@/components/mark/MarkRing";` and `import { MARK, RING } from "@/lib/mark/constants";`.
  2. Inside the component, after `hoverRef`, add:
     ```tsx
     // ---- mark-strike: the cursor rings the mark ----
     // Over the nav mark the cursor centres a ring on the grown mark (its box
     // plus MARK.growPx, plus RING.padPx) and paints the hold from the hover
     // store. The box is read once on entry; it snaps there with no glide, so
     // the transform stays a direct write.
     const reduced = !!useReducedMotion();
     const markRef = useRef<Element | null>(null);
     const ringAt = useRef<{ x: number; y: number } | null>(null);
     const [ringDiameter, setRingDiameter] = useState(0);
     // ---- end mark-strike ----
     ```
  3. In `handleMove`, before the `const el = dotRef.current;` block, insert:
     ```tsx
     const target = event.target as Element | null;
     const mark = target?.closest("[data-mark-trigger]") ?? null;
     if (mark !== markRef.current) {
       markRef.current = mark;
       const box = mark?.getBoundingClientRect();
       const grown = box ? box.width + MARK.growPx : 0;
       ringAt.current = box ? { x: box.left + grown / 2, y: box.top + grown / 2 } : null;
       setRingDiameter(box ? grown + RING.padPx : 0);
     }
     ```
  4. Change the transform write to `el.style.transform = ringAt.current ? \`translate3d(${ringAt.current.x}px, ${ringAt.current.y}px, 0)\` : \`translate3d(${event.clientX}px, ${event.clientY}px, 0)\`;`.
  5. Delete the later duplicate `const target = event.target as Element | null;` line, which now sits under `setVisible(true)`.
  6. Before `return (`, add `const ringing = ringDiameter > 0;`. Change `const grown = (hovering || sceneHover) && !pill;` to `const grown = (hovering || sceneHover) && !pill && !ringing;`.
  7. Add `opacity: ringing ? 0 : 1` to the size span's `style`. After that span's closing tag, add `{ringing && <MarkRing diameter={ringDiameter} reduced={reduced} />}`.
- [ ] Run `pnpm tsc --noEmit && pnpm lint && pnpm test:e2e e2e/mark.spec.ts`. Expect PASS, all 7 tests.
- [ ] Commit:
  ```bash
  git add components/mark/MarkRing.tsx components/CustomCursor.tsx
  git commit -m "Mark: the cursor rings the mark and draws the hold's tint and arc from one clock" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

### Task 10: The call to action takes the controls fill

**Files:** modify `components/mark/MarkCard.tsx`.

**Interfaces:** Consumes the `controls` slice's circle call-to-action fill, expected as `FillLink` from `@/components/controls/FillLink` with props `{ href: string; variant: "circle"; onClick?: React.MouseEventHandler<HTMLAnchorElement>; children: React.ReactNode }`. Confirm the real name and props in `docs/superpowers/plans/2026-10-06-controls.md` and on `main`.

- [ ] Check whether it has merged: `git log main --oneline | grep -i controls` and `git grep -n "circle" -- components/controls`.
- [ ] **If merged:**
  - Write the failing assertion. In `e2e/mark.spec.ts`, inside the 700ms hold test after the surface poll, add `await expect(dialog.getByRole("link", { name: "Say hi" })).toHaveAttribute("data-fill", "circle");`. If the controls primitive exposes a different marker attribute, use that one.
  - Run `pnpm test:e2e e2e/mark.spec.ts`. Expect FAIL.
  - Replace the comment and the inner `<a>` with:
    ```tsx
    <FillLink href={COPY.cta.href} variant="circle" onClick={(e) => { e.preventDefault(); onCta(); }}>{COPY.cta.label}</FillLink>
    ```
    and add `import { FillLink } from "@/components/controls/FillLink";`.
  - Run the spec again. Expect PASS.
  - Commit:
    ```bash
    git commit -am "Mark: the card's call to action takes the controls circle fill" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
    ```
- [ ] **If not merged:** leave the accent link and its one-line comment in place, and put this line in the PR body: "The card's call to action is a plain accent link; swap to the controls circle fill once `controls` merges (plan Task 10)."

### Task 11: Whole-branch verification and the PR

**Files:** none new.

- [ ] Run `pnpm test && pnpm tsc --noEmit && pnpm lint`. Expect all green.
- [ ] Run `pnpm test:e2e e2e/mark.spec.ts e2e/chrome.spec.ts e2e/a11y.spec.ts e2e/modal.spec.ts`. Expect all PASS. The a11y spec still finds "Back to top" before "Open menu", and nothing focusable sits inside aria-hidden.
- [ ] Run `grep -rn "—" lib/mark components/mark e2e/mark.spec.ts lib/cursor/hover.ts` and `grep -rnE "#[0-9A-Fa-f]{3,8}\b" lib/mark components/mark`. Expect no output from either.
- [ ] Preview on port 3310: master plan section 4 numbers slice previews from 3250 upward in steps of 10 in slice order, and mark-strike is the seventh. Run `NEXT_PUBLIC_SITE_MODE=full pnpm build && pnpm start -p 3310` in the background, and stop only that process afterwards. Check in both themes at 1440, 1024 and 390:
  - the 10px growth from the corner;
  - the fill rising in light mode;
  - the ring's tint and arc in step with the mark, closing at the discharge and leaving as the card opens;
  - the night dip and strike, then the opaque card forming around the settled mark with no jump at the swap;
  - the stacked layout at 390;
  - "Say hi" closing the card and then scrolling to Connect.
- [ ] Push and open the PR. The merge is Aaron's call.
  ```bash
  git push -u origin mark-strike
  gh pr create --base main --head mark-strike --title "Mark strike: hold the mark, the cel strike, the card" --body "$(printf 'Hold the top-left mark for 650ms (pointer, touch, or Enter or Space) to strike Aaron'"'"'s cel pick and open the mark card; a click still scrolls to the top. The cursor rings the mark and draws the hold from the same clock. Placeholder words are marked in lib/content.ts for Aaron.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)')"
  ```

### Critical Files for Implementation
- /Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-lab/app/lab/mark/cel.ts
- /Users/asulbaran21/Personal Projects/.worktrees/aaron-portfolio-website-lab/app/lab/mark/strike.ts
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/SiteNav.tsx
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/components/CustomCursor.tsx
- /Users/asulbaran21/Personal Projects/aaron-portfolio-website/lib/modal.ts
