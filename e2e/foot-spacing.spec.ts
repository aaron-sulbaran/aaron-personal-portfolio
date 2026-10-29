import type { Page } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { openHome } from "./support/coil";
import { COIL } from "@/lib/coil/constants";
import { siteContent } from "@/lib/content";

// Page 1's foot never lets the ribbon cover words or the button (design review,
// 2026-10-29). The ribbon is drawn by the Coil's canvas, which rides the page
// until it sticks; the words and the button are DOM. Every frame here compares
// the cards' projected rectangles (the ?coildebug visibleQuads hook, as
// deal-jank reads them) with the rectangles of the story blocks' lines and of
// "Deal me in" with the line under it:
//   - by hand, from the slot far below the fold to a little past the stick, in
//     10 px steps: the ribbon tracks its slot exactly (no lead), the button goes
//     with the stuck ribbon (it is pinned under it, whole), and nothing visible
//     overlaps it;
//   - on the click, every frame of the deal's own clock: the ribbon's lead (the
//     knee that keeps the stick from being a stop) stays inside the room above
//     the slot, so even the click never overlaps block 4.
// Something faded out (opacity under SEEN) is not there to be covered; a test
// that let a faded block count would pass by hiding it, so the lead tests also
// hold the geometry to the blocks while the row is still a row.

const { teaser } = siteContent.intro;
const SEEN = 0.05;
const STEP_PX = 10;
// The review's measurements, at rest: 7rem above the slot and 2.5rem to the
// button on a desktop or a tablet, 4.5rem and 2rem on a phone.
const ROOM = { desktop: { above: 112, below: 40 }, phone: { above: 72, below: 32 } };

type Rect = { left: number; top: number; right: number; bottom: number };
type Seen = Rect & { opacity: number };
type Sample = {
  cards: Rect[];
  lines: Seen[];
  cta: Seen | null;
  slot: Rect;
  railTop: number;
  clock: number | null;
};
type Hit = { what: string; depth: number };
type FootProbe = {
  read: () => Sample;
  hits: (s: Sample, ignoreOpacity: boolean) => Hit[];
};
type FootWindow = Window &
  typeof globalThis & {
    __foot: FootProbe;
    __footLog: Sample[];
    __footStop: () => void;
    __coil: { visibleQuads: () => { x: number; y: number }[][]; entrance: () => { elapsedMs: number | null } };
  };

// The page's own measurements, installed once the home is up.
async function installProbe(page: Page) {
  await page.evaluate(() => {
    const w = window as FootWindow;
    const box = (r: DOMRect | DOMRectReadOnly): Rect => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    // How much of an element is in view: its own opacity times every ancestor's.
    const opacityOf = (el: Element | null) => {
      let o = 1;
      for (let node = el; node; node = node.parentElement) o *= Number(getComputedStyle(node).opacity);
      return o;
    };
    const read = (): Sample => {
      const cards = w.__coil.visibleQuads().map((quad) => {
        const xs = quad.map((p) => p.x);
        const ys = quad.map((p) => p.y);
        return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
      });
      const lines: Seen[] = [];
      document.querySelectorAll("[data-block-text]").forEach((p) => {
        const range = document.createRange();
        range.selectNodeContents(p);
        const opacity = opacityOf(p);
        for (const r of Array.from(range.getClientRects())) if (r.width > 1 && r.height > 1) lines.push({ ...box(r), opacity });
      });
      const ctaEl = document.querySelector("[data-intro-cta]");
      const cta = ctaEl ? { ...box(ctaEl.getBoundingClientRect()), opacity: opacityOf(ctaEl) } : null;
      const entrance = w.__coil.entrance();
      return {
        cards,
        lines,
        cta,
        slot: box(document.querySelector("[data-coil-ribbon]")!.getBoundingClientRect()),
        railTop: document.querySelector("[data-coil-rail]")!.getBoundingClientRect().top,
        clock: entrance.elapsedMs,
      };
    };
    const hits = (s: Sample, ignoreOpacity: boolean): Hit[] => {
      const out: Hit[] = [];
      const EPS = 0.5; // rounding, not overlap
      const SEEN_AT = 0.05; // under this a thing is not there to be covered
      // How far one rect sits inside the other, the lesser of the two axes (0: they do not overlap),
      // on the screen: what is above or below it is not seen.
      const depth = (a: Rect, b: Rect) => {
        const across = Math.min(a.right, b.right, window.innerWidth) - Math.max(a.left, b.left, 0);
        const down = Math.min(a.bottom, b.bottom, window.innerHeight) - Math.max(a.top, b.top, 0);
        return across > EPS && down > EPS ? Math.min(across, down) : 0;
      };
      s.cards.forEach((card, i) => {
        s.lines.forEach((line) => {
          if (!ignoreOpacity && line.opacity < SEEN_AT) return;
          const d = depth(card, line);
          if (d > 0) out.push({ what: `card ${i} over a line of text`, depth: d });
        });
        if (s.cta && (ignoreOpacity || s.cta.opacity >= SEEN_AT)) {
          const d = depth(card, s.cta);
          if (d > 0) out.push({ what: `card ${i} over Deal me in`, depth: d });
        }
      });
      return out;
    };
    w.__foot = { read, hits };
  });
}

const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
const frames = (page: Page, n: number) =>
  page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
    n,
  );

// Where the stage is stuck, in scroll position, and how far the sticky range runs.
const railFacts = (page: Page) =>
  page.evaluate(() => {
    const rail = document.querySelector("[data-coil-rail]")!.getBoundingClientRect();
    const stage = document.querySelector("[data-coil-sticky]")!.getBoundingClientRect();
    const slot = document.querySelector("[data-coil-ribbon]")!.getBoundingClientRect();
    return { stickY: rail.top + window.scrollY, range: rail.height - stage.height, slotTopDoc: slot.top + window.scrollY, slotHeight: slot.height };
  });

for (const size of [
  { name: "1280x800", viewport: { width: 1280, height: 800 }, room: ROOM.desktop },
  { name: "390x844", viewport: { width: 390, height: 844 }, room: ROOM.phone, phone: true },
]) {
  test.describe(`page 1's foot at ${size.name}`, () => {
    test.use({ viewport: size.viewport, hasTouch: !!size.phone, isMobile: !!size.phone });

    test("room: the ribbon has its beat above it and the button its distance below, the paragraph gaps are the stagger's", async ({ page }) => {
      await openHome(page, { at: "top" });
      const m = await page.evaluate(() => {
        const rect = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const late = rect("[data-intro-late]");
        const slot = rect("[data-coil-ribbon]");
        const cta = rect("[data-intro-cta]");
        const lastLine = (() => {
          const range = document.createRange();
          range.selectNodeContents(document.querySelector("#story-from [data-block-text]")!);
          return Math.max(...Array.from(range.getClientRects()).map((r) => r.bottom));
        })();
        return { fromLastLine: lastLine, lateBottom: late.bottom, slotTop: slot.top, slotBottom: slot.bottom, ctaTop: cta.top };
      });
      // Above the slot: from block 4's last line (the late grid ends there).
      expect(m.slotTop - m.lateBottom).toBeCloseTo(size.room.above, 0);
      expect(m.slotTop - m.fromLastLine).toBeGreaterThanOrEqual(size.room.above - 1);
      // Slot to button.
      expect(m.ctaTop - m.slotBottom).toBeCloseTo(size.room.below, 0);
      // The stagger's gaps between paragraphs stay as they were: 3rem on a desktop.
      if (!size.phone) {
        const between = await page.evaluate(() => {
          const bottom = (s: string) => document.querySelector(s)!.getBoundingClientRect().bottom;
          const top = (s: string) => document.querySelector(s)!.getBoundingClientRect().top;
          return top("#story-from") - bottom("#story-outside");
        });
        expect(between).toBeGreaterThanOrEqual(0);
        expect(between).toBeLessThanOrEqual(48 + 2);
      }
    });

    test("by hand: the ribbon tracks its slot, and from the slot far below the fold to a little past the stick nothing visible overlaps it", async ({ page }) => {
      await openHome(page, { debug: "flight", at: "top" });
      await installProbe(page);
      const facts = await railFacts(page);
      // 700 px below the top of the screen, down to the stick and 0.12 of the range past it
      // (the reader's scroll starts the deal at 0.18 of it, which is its own test).
      const startY = facts.slotTopDoc - 700;
      const endY = facts.stickY + facts.range * (COIL.deal.trigger.enterAtProgress - 0.06);
      const steps = Math.ceil((endY - startY) / STEP_PX);
      let worstDrift = 0;
      let worstDriftAt = 0;
      let checked = 0;
      let closest = Number.POSITIVE_INFINITY;
      let ctaLeastSeen = 1;
      let ctaLeastClear = Number.POSITIVE_INFINITY;
      const ctaTops: number[] = [];
      const failures: string[] = [];
      for (let i = 0; i <= steps; i++) {
        const y = Math.min(endY, startY + i * STEP_PX);
        await scrollTo(page, y);
        await frames(page, 3);
        const s = await page.evaluate(() => {
          const w = window as FootWindow;
          const sample = w.__foot.read();
          return { sample, hits: w.__foot.hits(sample, false) };
        });
        const { sample, hits } = s;
        expect(sample.cards.length, `cards drawn at scroll ${y}`).toBeGreaterThan(2);
        for (const h of hits) failures.push(`slot at ${Math.round(sample.slot.top)} px: ${h.what}, ${h.depth.toFixed(1)} px`);
        // No lead while the stage rides the page: the row's middle is the slot's middle.
        if (sample.railTop > 0) {
          const slotMiddle = (sample.slot.top + sample.slot.bottom) / 2;
          const rowMiddle = sample.cards.map((c) => (c.top + c.bottom) / 2).reduce((a, b) => a + b, 0) / sample.cards.length;
          const drift = Math.abs(rowMiddle - slotMiddle);
          if (drift > worstDrift) {
            worstDrift = drift;
            worstDriftAt = sample.slot.top;
          }
        }
        // The nearest a card comes to a line above it (positive: clear), seen or not: the lead's absence is the room.
        const visibleLines = sample.lines.filter((l) => l.opacity >= SEEN && l.bottom <= sample.slot.top + 1);
        const nearestAbove = visibleLines.length ? sample.cards.reduce((m, c) => Math.min(m, ...visibleLines.map((l) => c.top - l.bottom)), Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
        if (nearestAbove < closest) closest = nearestAbove;
        // The button goes with the ribbon: whole at every step, and its distance below the cards' foot is the page's gap, stuck or not.
        if (sample.cta) {
          ctaLeastSeen = Math.min(ctaLeastSeen, sample.cta.opacity);
          ctaLeastClear = Math.min(ctaLeastClear, sample.cta.top - Math.max(...sample.cards.map((c) => c.bottom)));
          if (sample.railTop <= 0) ctaTops.push(sample.cta.top);
        }
        checked++;
      }
      expect(failures, failures.slice(0, 6).join("\n")).toEqual([]);
      // Exactly its slot's: a rounding's worth, never a lead.
      expect(worstDrift, `the row's middle drifted ${worstDrift.toFixed(1)} px from its slot's at a slot ${worstDriftAt.toFixed(0)} px down`).toBeLessThanOrEqual(1.5);
      // The button goes with the ribbon's room: whole at every step (nothing is taken from it to keep it
      // off the ribbon), its distance below the cards the page's gap at every step, and pinned where it
      // was as the stage stuck for as long as the stage is.
      expect(ctaLeastSeen, "the button's least opacity through the sweep").toBeGreaterThan(0.99);
      expect(ctaLeastClear, "the least distance from the button to the cards above it").toBeGreaterThanOrEqual(size.room.below - 1.5);
      expect(ctaTops.length, "steps with the stage stuck").toBeGreaterThan(3);
      expect(Math.max(...ctaTops) - Math.min(...ctaTops), "how far the button moved on the screen once the stage stuck").toBeLessThanOrEqual(1.5);
      // Room: the nearest a card comes to a line above is the room above, less nothing.
      expect(closest).toBeGreaterThanOrEqual(size.room.above - 2);
      test.info().annotations.push({
        type: "sweep",
        description: `${checked} steps; the row's middle within ${worstDrift.toFixed(2)} px of its slot's; nearest a card comes to text above ${closest.toFixed(1)} px; the button never nearer the cards than ${ctaLeastClear.toFixed(1)} px, and moved ${(Math.max(...ctaTops) - Math.min(...ctaTops)).toFixed(2)} px over ${ctaTops.length} stuck steps`,
      });
      expect(await page.evaluate(() => document.documentElement.dataset.deal), "the sweep stays short of where a scroll deals").toBe("closed");
    });

    test("on the click: every frame of the deal's clock, the lead stays inside the room above and nothing visible overlaps the ribbon", async ({ page }) => {
      await openHome(page, { debug: "flight", at: "top" });
      await installProbe(page);
      const facts = await railFacts(page);
      // Where the knee leads most: a third of its length before the stick.
      const knee = COIL.deal.wheel.pinKneePx;
      await scrollTo(page, facts.stickY - knee / 3);
      await frames(page, 4);
      await page.evaluate(() => {
        const w = window as FootWindow;
        w.__footLog = [];
        let running = true;
        w.__footStop = () => {
          running = false;
        };
        const tick = () => {
          if (!running) return;
          w.__footLog.push(w.__foot.read());
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await page.getByRole("link", { name: teaser.deal }).click();
      // The page's scroll joins after the condense and the cards are on their way
      // to the stick within a second after it: three seconds hold the whole path.
      await page.waitForTimeout(3000);
      const log = await page.evaluate(() => {
        const w = window as FootWindow;
        w.__footStop();
        return w.__footLog.map((s) => ({ s, seen: w.__foot.hits(s, false), geometry: w.__foot.hits(s, true) }));
      });
      expect(log.length, "frames sampled").toBeGreaterThan(60);
      const dealt = log.filter(({ s }) => s.clock !== null && Number.isFinite(s.clock));
      expect(dealt.length, "frames on the deal's clock").toBeGreaterThan(30);
      const failures: string[] = [];
      let leadMost = 0;
      let leadAt = 0;
      let rowFrames = 0;
      for (const { s, seen, geometry } of log) {
        for (const h of seen) failures.push(`clock ${s.clock === null ? "pre" : Math.round(s.clock)} ms: ${h.what}, ${h.depth.toFixed(1)} px`);
        // While the row is still a row (before the curl, the clock's zero), geometry alone: faded or not, it clears the text and the button.
        if (s.clock !== null && s.clock < 0) {
          rowFrames++;
          for (const h of geometry) failures.push(`clock ${Math.round(s.clock)} ms, row: ${h.what}, ${h.depth.toFixed(1)} px (faded or not)`);
          if (s.cards.length) {
            const top = Math.min(...s.cards.map((c) => c.top));
            const lead = s.slot.top - top;
            if (lead > leadMost) {
              leadMost = lead;
              leadAt = s.clock;
            }
          }
        }
      }
      expect(rowFrames, "frames of the condense").toBeGreaterThan(15);
      expect(failures, failures.slice(0, 6).join("\n")).toEqual([]);
      // The lead is less than the room above the slot (and leaves a breath).
      expect(leadMost, `the cards led their slot by ${leadMost.toFixed(1)} px at ${leadAt.toFixed(0)} ms`).toBeLessThan(size.room.above - 8);
      test.info().annotations.push({
        type: "click",
        description: `${log.length} frames, ${dealt.length} on the deal's clock, ${rowFrames} of the row; the most the cards led their slot ${leadMost.toFixed(1)} px (room above ${size.room.above} px)`,
      });
    });
  });
}
