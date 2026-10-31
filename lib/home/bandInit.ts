// The soundtrack band for a visitor who has answered it, decided before the first
// paint (the same family as the ribbon slot's, the deal's and the loader's head
// scripts, lib/home/slotInit.ts).
//
// The band's question and its answer are stored on the first visit (lib/soundtrack.ts
// writes "on" for a yes, "off" for a Not now), but the server cannot read that, and the
// component reads it in an effect, after hydration. Until then a returning visitor was
// drawn the question beside Play it and Not now, and it was taken away a moment later:
// the question flashed, "Not now" flashed, and on a phone, where the question and the
// buttons stack, the band became 27px shorter and everything under it moved up. This
// script puts the answer on <html> as data-band-answer="on" | "off" before anything is
// painted, and app/globals.css draws the band as it will rest: no question, and the
// control the stored answer lands on already showing. A first visit has no attribute
// and is drawn as it always was; so does a visitor whose storage is blocked.
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
