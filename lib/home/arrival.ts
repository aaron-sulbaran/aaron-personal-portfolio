// A quiet arrival: the home is reached from the Express lane through the
// transition (components/transition/TransitionLayer.tsx), so it lands at rest
// under the mask with no loader and no entrance, as a deep reload does. Set
// just before the route changes and cleared when the transition ends, so a
// strict-mode remount of the HomeController reads the same answer twice.
// Module memory: it never outlives the page's own JavaScript.

let quiet = false;

export function markQuietArrival() {
  quiet = true;
}

export function clearQuietArrival() {
  quiet = false;
}

export function isQuietArrival(): boolean {
  return quiet;
}
