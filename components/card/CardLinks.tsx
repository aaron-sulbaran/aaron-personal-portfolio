import { siteContent, type CardKey } from "@/lib/content";
import { inlineLinkElement } from "@/lib/inline/attrs";
import { partId } from "@/lib/gallery/timing";

// A card's links: external, a new tab, the label face in the accent (set on the item,
// because .inline-link inherits its font and colour), drawn as every inline link is (one line under the words, filled from the centre on
// hover and for good once followed; app/globals.css, components/inline).
// skip: the address of a link drawn elsewhere on the page (the jobs card's post, as a card), so it is not drawn twice.
export function CardLinks({ cardKey, skip }: { cardKey: CardKey; skip?: string }) {
  const links = siteContent.cards[cardKey].modal.links.filter((link) => link.href !== skip);
  if (!links.length) return null;
  return (
    <ul data-mask={partId.links} data-mask-kind="text" className="flex flex-wrap gap-x-6 gap-y-2">
      {links.map((link) => {
        const element = inlineLinkElement({ kind: "external", text: link.label, href: link.href, strong: false, em: false });
        if (!element) return null;
        return (
          <li key={link.href} className="min-w-0 max-w-full font-label text-label-lg text-accent">
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
