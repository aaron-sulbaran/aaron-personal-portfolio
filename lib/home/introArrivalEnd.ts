// Ends page 1's arrival at once: every item at its place, nothing left to
// transition. The deal calls it as it starts (a click, or the reader's scroll
// into the cards), so no word is still arriving when the page begins to move.
// A no-op when nothing is arriving.
export function finishIntroArrival(): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (html.hasAttribute("data-intro-words")) html.removeAttribute("data-intro-words");
}
