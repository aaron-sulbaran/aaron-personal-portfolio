import type { GalleryEmbed } from "@/lib/gallery/card";

// A post embedded in a card's modal, in Aaron's own embed code (cards.jobs.modal.embed): the same frame, same src, native 504 by 1258,
// frameborder 0, fullscreen allowed, titled in his words. It mounts with the modal's body, so it exists only while the
// modal is open, and loads lazily, so a row below the fold costs nothing until it is near. The frame around it (StillPhoto)
// takes the photos' radius and a hairline border. Width fills the column and never exceeds it, so on a phone it fits
// with no sideways overflow; its height stays the post's native one, and the stage that holds it scrolls (PagerPage).
export function LinkedInEmbed({ embed }: { embed: Pick<GalleryEmbed, "src" | "width" | "height" | "title"> }) {
  return (
    <iframe
      src={embed.src}
      width={embed.width}
      height={embed.height}
      title={embed.title}
      loading="lazy"
      frameBorder="0"
      allowFullScreen
      className="block h-[1258px] w-full max-w-full border-0 bg-background"
      data-embed=""
    />
  );
}
