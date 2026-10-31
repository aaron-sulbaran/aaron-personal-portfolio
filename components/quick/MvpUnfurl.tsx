import type { CSSProperties } from "react";
import { quickCopy } from "@/lib/content/quick";

// "MVP" that unfurls to "Minimum Viable Portfolio", the move of the MVP page's
// own title (MvpTitle): each word's rest slides out from its capital, left to
// right, and the capitals travel right as the room opens. Pure CSS, so a Fill's
// two copies of it (components/fx/Fill) stay in step: the trigger is the
// element's [data-mvp-link] ancestor under a fine pointer that can hover
// (a hover, or keyboard focus), and globals.css, "The MVP unfurl", holds the
// motion. A touch screen never unfurls: the short word is all it draws. Under
// reduced motion the words switch at once. The words are drawn only; the link
// around them carries the name.
//
// Two ways to give the unfurled words their room. In flow (the Menu chip, whose
// own box is the one that grows and is anchored by its right edge): the slots
// are in the line. Overlay (page 1's centred line): the short word stays in the
// line and holds its width, and the unfurled words are drawn over it from the
// same left edge, reaching past the line's box, so nothing around it reflows
// and the line stays centred. fill gives the overlay's words the site's link
// fill (from the centre, in the accent), where the element has no fill of its own.
export function MvpUnfurl({ overlay = false, fill = false }: { overlay?: boolean; fill?: boolean }) {
  const { titleParts, titleShort } = quickCopy;
  const words = titleParts.map(({ capital, rest }, i) => (
    <span key={capital}>
      {capital}
      <span className="mvp-slot" style={{ "--i": i } as CSSProperties}>
        {rest}
        {i < titleParts.length - 1 ? " " : ""}
      </span>
    </span>
  ));
  if (!overlay) return <span className="mvp-unfurl">{words}</span>;
  return (
    <span className="mvp-unfurl" data-mvp-overlay="">
      <span className="mvp-short">{titleShort}</span>
      <span aria-hidden="true" className={`mvp-fan ${fill ? "mvp-fan--fill" : ""}`}>
        {words}
      </span>
    </span>
  );
}
