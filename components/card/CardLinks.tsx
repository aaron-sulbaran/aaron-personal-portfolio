import { siteContent, type CardKey } from "@/lib/content";
import { inlineLinkElement } from "@/lib/inline/attrs";
import { partId } from "@/lib/gallery/timing";

// A card's links: external, a new tab, the label face in the accent (set on the item,
// because .inline-link inherits its font and colour), drawn as every inline link is (one line under the words, filled from the centre on
// hover and for good once followed; app/globals.css, components/inline), except that a label too long for its column wraps
// and then every line has its own line under it (.card-link there); the item balances the lines.
// skip: the address of a link drawn elsewhere on the page (the jobs card's post), so it is not drawn twice. paragraph: draw the links
// that belong to that paragraph (modal.paragraphLinks, by its index in blocks) instead of the card's own, under it.
export function CardLinks({ cardKey, skip, paragraph }: { cardKey: CardKey; skip?: string; paragraph?: number }) {
  const { modal } = siteContent.cards[cardKey];
  const links = (paragraph === undefined ? modal.links : (modal.paragraphLinks?.[paragraph] ?? [])).filter((link) => link.href !== skip);
  if (!links.length) return null;
  return (
    <ul data-mask={paragraph === undefined ? partId.links : partId.paragraphLinks(paragraph)} data-mask-kind="text" data-paragraph-links={paragraph} className="flex flex-wrap gap-x-6 gap-y-2">
      {links.map((link) => {
        const element = inlineLinkElement({ kind: "external", text: link.label, href: link.href, strong: false, em: false });
        if (!element) return null;
        return (
          <li key={link.href} className="min-w-0 max-w-full text-balance font-label text-label-lg text-accent">
            <a {...element.props} className={`${element.props.className} card-link`}>
              {link.label}
              <span className="sr-only">, {siteContent.columns.externalLabel}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
