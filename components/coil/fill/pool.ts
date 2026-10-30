import { FILL_POOL, distanceToViewport, planPool } from "@/lib/coil/fillPool";

// The DOM half of the title contexts' pool (lib/coil/fillPool.ts): every
// heading that wears the fill (page 1's name and each numbered page's title)
// joins it, and the pool says which hold a WebGL context now. Two
// IntersectionObservers, a viewport and two viewports out, wake it when a
// title crosses either edge; a member wakes it when its own gate moves (page
// 2's deal). It reads the members' rects only then, never on scroll. While the
// deal plays (html[data-deal] "dealing" or "unfurled") it makes and drops
// nothing, so no context is made or lost in the deal's frames; it weighs
// everything again once the deal is done. No three
// here: this ships in the page's own bundle; the canvases come from the
// Coil's chunk.

export type FillMember = {
  id: string;
  el: Element;
  // May it hold a context now (motion allowed, a context to be had, its gate).
  eligible: () => boolean;
  acquire: () => void;
  release: () => void;
};

type Entry = FillMember & { alive: boolean };

const members = new Map<string, Entry>();
let observers: IntersectionObserver[] = [];
let dealWatch: MutationObserver | null = null;
let queued = 0;

const dealPlaying = () => ["dealing", "unfurled"].includes(document.documentElement.dataset.deal ?? "");

function evaluate() {
  queued = 0;
  if (dealPlaying()) return;
  const viewportH = window.innerHeight || 1;
  const entries = [...members.values()].map((m) => {
    // A heading with no box (display: none, page 2's other breakpoint) is nowhere near.
    const shown = m.el.getClientRects().length > 0;
    return { id: m.id, alive: m.alive, eligible: shown && m.eligible(), distance: shown ? distanceToViewport(m.el.getBoundingClientRect(), viewportH) : Number.POSITIVE_INFINITY };
  });
  const plan = planPool(entries, viewportH);
  for (const id of plan.release) {
    const m = members.get(id);
    if (!m) continue;
    m.alive = false;
    m.release();
  }
  for (const id of plan.acquire) {
    const m = members.get(id);
    if (!m) continue;
    m.alive = true;
    m.acquire();
  }
}

function schedule() {
  if (!queued) queued = requestAnimationFrame(evaluate);
}

function observe(el: Element) {
  if (!observers.length) {
    observers = [FILL_POOL.nearViewports, FILL_POOL.farViewports].map((reach) => new IntersectionObserver(schedule, { rootMargin: `${reach * 100}% 0px` }));
    dealWatch = new MutationObserver(schedule);
    dealWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-deal"] });
  }
  observers.forEach((observer) => observer.observe(el));
}

export function joinFillPool(member: FillMember) {
  const entry: Entry = { ...member, alive: false };
  members.set(member.id, entry);
  observe(member.el);
  schedule();
  return {
    // Its gate moved: weigh it again.
    update: schedule,
    // Holds a context now.
    alive: () => entry.alive,
    // It failed or unmounted: it holds nothing and is weighed no more.
    leave() {
      if (members.get(member.id) !== entry) return;
      members.delete(member.id);
      observers.forEach((observer) => observer.unobserve(member.el));
      if (entry.alive) {
        entry.alive = false;
        entry.release();
      }
      if (!members.size) {
        observers.forEach((observer) => observer.disconnect());
        observers = [];
        dealWatch?.disconnect();
        dealWatch = null;
        if (queued) cancelAnimationFrame(queued);
        queued = 0;
      } else {
        schedule();
      }
    },
  };
}
