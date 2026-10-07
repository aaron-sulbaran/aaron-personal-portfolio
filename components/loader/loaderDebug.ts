// QA behind ?coildebug: every loader event with its time, plus each time the
// body scroll lock engages or releases, on window.__coilLoader.
type LoaderEvent = { t: number; event: string; data?: unknown };
export function debugLog(root: HTMLElement): (event: string, data?: unknown) => void {
  if (!new URLSearchParams(window.location.search).has("coildebug")) return () => {};
  const events: LoaderEvent[] = [];
  const host = window as unknown as { __coilLoader?: { events: LoaderEvent[]; locks: LoaderEvent[] } };
  const locks: LoaderEvent[] = [];
  let locked = document.body.style.overflow === "hidden";
  locks.push({ t: performance.now(), event: locked ? "locked" : "unlocked" });
  new MutationObserver(() => {
    const now = document.body.style.overflow === "hidden";
    if (now === locked) return;
    locked = now;
    locks.push({ t: performance.now(), event: now ? "locked" : "unlocked" });
  }).observe(document.body, { attributes: true, attributeFilter: ["style"] });
  host.__coilLoader = { events, locks };
  const inAnimation = root
    .getAnimations?.({ subtree: true })
    .find((a) => (a as CSSAnimation).animationName === "coil-loader-in");
  events.push({ t: performance.now(), event: "armed", data: { animationTime: inAnimation?.currentTime ?? null } });
  return (event, data) => events.push({ t: performance.now(), event, data });
}
