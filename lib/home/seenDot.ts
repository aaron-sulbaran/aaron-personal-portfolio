// Where the seen dot sits on its title's last line (components/cards/CardTitle.tsx,
// app/globals.css .seen-dot).
//
// The dot is an 8px box glued after the last word. Its centre goes on the middle of
// the word's bulk: the x-height middle after a word with lowercase letters (half
// the font's ex above the baseline), and the middle of the capitals after a word
// with none (IEEE; half Profa's cap height, 700 of 1100 units per em,
// app/fonts/ProfaTrial-Black.ttf). A vertical-align length raises the empty
// box's bottom edge, so the length is that height less the dot's own half height.
//
// Chrome paints the baseline and the dot each on whole pixels, rounding their own
// fractional layout places, so a centre set at a fractional height lands up to a
// pixel off the ink depending on where the line falls. The height is therefore
// rounded to a whole pixel in CSS (round(), with the unrounded value for a browser
// that lacks it): the dot then sits a whole number of pixels from the baseline
// whatever the line's fraction, and is off the true middle by the rounding alone,
// half a pixel at most.
export const PROFA_CAP_HEIGHT_EM = 700 / 1100;
export const PROFA_X_HEIGHT_EM = 535 / 1100;
export const SEEN_DOT_HALF_REM = 0.25;

const LOWERCASE = /\p{Ll}/u;

export function hasLowercase(word: string): boolean {
  return LOWERCASE.test(word);
}

// The classes the dot carries (the rules are in app/globals.css): the x-height
// middle, and, after a word with no lowercase, the capitals' middle.
export function seenDotClass(word: string): string {
  return hasLowercase(word) ? "seen-dot" : "seen-dot seen-dot--caps";
}
