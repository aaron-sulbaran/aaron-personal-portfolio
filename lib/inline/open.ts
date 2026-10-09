export const OPEN_ATTRIBUTE = "data-inline-open";

// Marks the link whose tip, pop or definition is open or pinned, so its
// underline stays filled (app/globals.css, "inline links") without a hover.
// Returns the undo; a link that is gone or null makes both a no-op.
export function markOpen(link: Pick<Element, "setAttribute" | "removeAttribute"> | null): () => void {
  if (!link) return () => {};
  link.setAttribute(OPEN_ATTRIBUTE, "");
  return () => link.removeAttribute(OPEN_ATTRIBUTE);
}
