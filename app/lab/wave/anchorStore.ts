import type { Anchors } from "./spines";

// The page measurements the path engine takes on layout, shared with React so
// the generator can check its candidates against the real page. Published
// only when something moved by a pixel or more.

export interface PageMeasure {
  anchors: Anchors;
  viewport: number;
}

let current: PageMeasure | null = null;
const listeners = new Set<() => void>();

const same = (a: PageMeasure, b: PageMeasure) => {
  if (Math.abs(a.viewport - b.viewport) >= 1 || Math.abs(a.anchors.width - b.anchors.width) >= 1) return false;
  for (const key of Object.keys(a.anchors.words) as (keyof Anchors["words"])[]) {
    const wa = a.anchors.words[key];
    const wb = b.anchors.words[key];
    const ba = a.anchors.box[key];
    const bb = b.anchors.box[key];
    if (Math.abs(wa.top - wb.top) >= 1 || Math.abs(wa.bottom - wb.bottom) >= 1) return false;
    if (Math.abs(ba.top - bb.top) >= 1 || Math.abs(ba.bottom - bb.bottom) >= 1) return false;
  }
  return true;
};

export function publishMeasure(next: PageMeasure) {
  if (current && same(current, next)) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export const getMeasure = () => current;
export const getServerMeasure = () => null;
export function subscribeMeasure(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
