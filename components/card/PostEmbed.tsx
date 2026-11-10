import { ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { siteContent } from "@/lib/content";
import type { GalleryEmbed } from "@/lib/gallery/card";
import { EMBED_BORDER } from "@/lib/gallery/jobs";
import { partId } from "@/lib/gallery/timing";
import { inlineLinkElement } from "@/lib/inline/attrs";

// The LinkedIn post as LinkedIn's own short embed, the way Jolie Zhou's site draws hers (Aaron, 2026-11-09): the collapsed embed
// (its text stops at one line and "...more"), in a short frame with the photos' radius and a hairline that scrolls inside itself, then
// View on LinkedIn under it, a card link to the post in a new tab. The frame loads lazily and exists only while the modal is open.
// Over the frame the site's cursor hands off to the native one (data-cursor-native, components/CustomCursor): the page gets no
// pointer events inside a frame, so its dot would freeze at the edge. fill: on a phone's page the frame takes what its figure's height
// leaves under the link (PagerPage); on a desktop row it is embed.height tall.
export function PostEmbed({ embed, index, fill = false }: { embed: GalleryEmbed; index: number; fill?: boolean }) {
  const link = inlineLinkElement({ kind: "external", text: embed.cta, href: embed.href, strong: false, em: false });
  const frame: CSSProperties = { borderWidth: EMBED_BORDER, ...(fill ? {} : { height: embed.height + 2 * EMBED_BORDER }) };
  return (
    <>
      <div
        data-mask={partId.photo(index)}
        data-mask-kind="photo"
        data-post-frame=""
        data-cursor-native=""
        className={`overflow-hidden rounded-xl border border-border bg-background ${fill ? "min-h-0 flex-1" : "shrink-0"}`}
        style={frame}
      >
        <div data-mask-media="" className="h-full">
          <iframe src={embed.src} title={embed.title} loading="lazy" allowFullScreen className="block h-full w-full border-0" />
        </div>
      </div>
      {link && (
        <p data-mask={partId.caption(index)} data-mask-kind="text" className="m-0 shrink-0 font-label text-label-lg text-accent">
          <a {...link.props} className={`${link.props.className} card-link`} data-post-link="">
            {embed.cta}
            <ArrowUpRight aria-hidden="true" className="ml-1 inline-block h-[0.9em] w-[0.9em] align-[-0.05em]" />
            <span className="sr-only">, {siteContent.columns.externalLabel}</span>
          </a>
        </p>
      )}
    </>
  );
}
