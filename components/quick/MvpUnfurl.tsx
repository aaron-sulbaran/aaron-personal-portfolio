import { quickCopy } from "@/lib/content/quick";

// "MVP" that becomes "Minimum Viable Portfolio" by a fade, in place: the short
// word gives way and the full name comes in over it from the same left edge, so
// no letter travels and nothing reflows. Pure CSS: the trigger is the element's
// [data-mvp-link] ancestor under a fine pointer that can hover (a hover, or
// keyboard focus), and globals.css, "The MVP unfurl", holds the fade and the
// numbers to tune it by. A touch screen never unfurls: the short word is all it
// draws. Under reduced motion the words switch at once. The words are drawn
// only; the link around them carries the name.
//
// The short word stays in the line and holds its width; the full name is drawn
// over it, reaching past the line's box, so nothing around it reflows (page 1's
// sentence glides to stay centred instead, components/quick/useMvpCentre, and
// the Menu's line keeps its size). The two share their first letter, so the
// short word's capital is its own span: it stays drawn under the full name's until
// the full name is in, and the one letter that is in both never dims mid-fade.
// fill gives the full name the site's link fill (from the centre, in the
// accent), where the element has no fill of its own.
export function MvpUnfurl({ fill = false }: { fill?: boolean }) {
  const { title, titleShort } = quickCopy;
  return (
    <span className="mvp-unfurl">
      <span className="mvp-short">
        <span className="mvp-short-cap">{titleShort.slice(0, 1)}</span>
        <span className="mvp-short-rest">{titleShort.slice(1)}</span>
      </span>
      <span aria-hidden="true" className="mvp-full">
        <span className={fill ? "mvp-full-fill" : undefined}>{title}</span>
      </span>
    </span>
  );
}
