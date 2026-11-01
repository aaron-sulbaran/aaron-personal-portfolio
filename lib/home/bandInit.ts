// The soundtrack band for a visitor who has answered it, decided before the first
// paint (the same family as the ribbon slot's, the deal's and the loader's head
// scripts, lib/home/slotInit.ts).
//
// The band asks its question on every visit, and the play choice beside it reads by the
// stored answer (lib/soundtrack.ts writes "on" for a yes, "off" for a Not now): Resume
// after a yes, Play it after a Not now, Play it on a first visit. The server cannot read
// that, and the component reads it in an effect, after hydration. Until then a returning
// visitor was drawn Play it, and the word was swapped a moment later (on a yes, Play it
// flashed before Resume). This script puts the answer on <html> as data-band-answer="on" |
// "off" before anything is painted, and app/globals.css draws the band as it will rest, with
// the label the answer lands on already showing, and for a stored Not now with Not now already
// drawn as the chosen option (app/globals.css, "Not now, once chosen"). It chooses the labels
// and the chosen look, never whether the question shows. A first visit has no attribute and is drawn as it always was; so does a
// visitor whose storage is blocked.
export const SOUNDTRACK_STORAGE_KEY = "aaron-soundtrack";
export const BAND_ANSWER_ATTRIBUTE = "data-band-answer";

export function bandInitScript(): string {
  return (
    `(function(){try{` +
    `var v=localStorage.getItem(${JSON.stringify(SOUNDTRACK_STORAGE_KEY)});` +
    `if(v==="on"||v==="off")document.documentElement.setAttribute(${JSON.stringify(BAND_ANSWER_ATTRIBUTE)},v);` +
    `}catch(x){}})();`
  );
}
