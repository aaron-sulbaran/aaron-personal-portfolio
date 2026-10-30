import { ArrowUpRight } from "lucide-react";
import { BrandIcon } from "@/components/BrandIcons";
import { siteContent, type PostCardRef } from "@/lib/content";
import { TAG_BAND } from "./JobTag";

// The LinkedIn post as a link card, where a phone's pager has no room for the post's own frame (504 by 1258 would scroll inside the page,
// inside the pager, inside the modal): the name tags' language, flat, with a hairline and the photos' radius and the page's own tokens.
// A mark across the top, who wrote it, the post's hook line, and one way out, the whole card being the link (a new tab). Words: lib/content
// (cards.jobs.modal.postCard).
export function PostCard({ card }: { card: PostCardRef }) {
  return (
    <a
      href={card.href}
      target="_blank"
      rel="noopener noreferrer"
      data-post-card=""
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground transition-colors duration-200 hover:border-accent"
    >
      <span className="flex h-[4.25rem] items-center justify-center border-b border-border px-5 text-foreground" style={TAG_BAND}>
        <BrandIcon name="linkedin" className="h-8 w-8" />
      </span>
      <span className="flex flex-col gap-2 px-5 pb-4 pt-4">
        <span className="font-display text-[1.5rem] leading-none text-foreground" data-post-card-name="">{card.byline}</span>
        <span className="text-[0.9375rem] leading-snug text-foreground" data-post-card-hook="">{card.hook}</span>
      </span>
      <span className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 font-label text-label-lg text-accent" data-post-card-link="">
        <span>
          {card.cta}
          <span className="sr-only">, {siteContent.columns.externalLabel}</span>
        </span>
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </a>
  );
}
