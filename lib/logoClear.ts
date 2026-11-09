// The logo steps aside while page 2's words are under it (components/SiteLogo.tsx).
// Page 2's list sits in the left gutter, where the fixed logo is, so a reader who
// stops partway through the page would read the logo over a title. Each part of
// the list carries data-logo-clear; on scroll the logo asks whether any of their
// boxes meets its own, padded a little so it is gone before the words touch it.
// A box with no area (display: none, the other layout's copy) never counts.

export type Box = { top: number; right: number; bottom: number; left: number };

export const LOGO_CLEAR_PAD_PX = 4;

export function wordsUnderLogo(logo: Box, words: readonly Box[], pad = LOGO_CLEAR_PAD_PX): boolean {
  return words.some(
    (word) =>
      word.right > word.left &&
      word.bottom > word.top &&
      word.left < logo.right + pad &&
      word.right > logo.left - pad &&
      word.top < logo.bottom + pad &&
      word.bottom > logo.top - pad,
  );
}
