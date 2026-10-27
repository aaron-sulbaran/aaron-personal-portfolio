// A link into the home's sections lands instantly (the restore's own rule, lib/home/recovery.ts).
//
// globals.css sets html { scroll-behavior: smooth }, so the browser's own jump to a URL's
// fragment on load is animated. It starts from the top before the page's script runs and aims
// at where the section was in that first layout; when the restore landed on the section
// before that animation was over, the animation went on to its stale target, and the page
// came to rest 14 to 36 px off the section in about half of the loads measured. This head
// script marks such a load before the first paint (<html data-landing="instant">, which
// globals.css reads as scroll-behavior: auto), so the browser's jump is instant too, and the
// restore's landing is the last word. HomeController takes the mark off once the page has
// loaded and its fonts have settled (releaseInstantLanding), and the stylesheet owns the
// root's scroll behaviour again. "#main" is the skip link's target, the top: not a section.
export function landingInitScript(): string {
  return `(function(){try{if(location.pathname!=="/")return;var h=location.hash;if(h.length>1&&h!=="#main")document.documentElement.setAttribute("data-landing","instant");}catch(x){}})();`;
}
