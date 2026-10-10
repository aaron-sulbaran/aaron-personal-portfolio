import { siteContent, type CardKey } from "@/lib/content";
import { partId } from "@/lib/gallery/timing";

// A card's links: external, a new tab, the label face in the accent.
export function CardLinks({ cardKey }: { cardKey: CardKey }) {
  const { links } = siteContent.cards[cardKey].modal;
  if (!links.length) return null;
  return (
    <ul data-mask={partId.links} data-mask-kind="text" className="flex flex-wrap gap-x-6 gap-y-2">
      {links.map((link) => (
        <li key={link.href}>
          <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-label text-label-lg text-accent underline-offset-4 transition-colors duration-200 hover:text-accent-hover hover:underline">
            {link.label}
            <span className="sr-only">, {siteContent.book.externalLabel}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
