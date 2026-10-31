// How far page 1's MVP line glides while its "MVP" fades to the full name, so
// the whole sentence ends centred where the short one stood: half the width the
// full name adds, to the left (globals.css "The MVP unfurl", --mvp-shift). The
// widths are the short word's and the full name's as laid out. Nothing glides
// where the full name is not drawn (a touch screen gives it no width) or is not
// measured yet.
export function mvpCentreShift(shortWidth: number, fullWidth: number): number {
  if (!(shortWidth > 0) || !(fullWidth > shortWidth)) return 0;
  return -(fullWidth - shortWidth) / 2;
}
