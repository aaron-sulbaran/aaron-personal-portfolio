import { siteContent } from "@/lib/content";
import type { Box } from "./boxes";
import { columnsFor } from "./boxes";
import type { GalleryPhoto } from "./card";
import { GALLERY } from "./constants";
import type { Plan, Slide } from "./plan";

// The jobs modal's media and rows. It has more media than paragraphs, so a row's media column holds a cluster of two
// pieces side by side, all in view at once (a name tag is a tip a reader must be able to read, so nothing takes turns):
// each job is a name tag (components/card/JobTag), and its photos sit beside it. The rows still alternate sides as every
// card's do, so no cluster sits under another, and each row's words are a paragraph beside its cluster.
//
// Newest first, paired with the four paragraphs (Aaron, 2026-10-29):
//   paragraph 1  Aritzia's tag and its poster
//   paragraph 2  Apple's tag and its badge
//   paragraph 3  the tags of the next two jobs, UT Austin's and MOD's
//   (no words)   MOD's two photos, side by side
//   paragraph 4  the LinkedIn post, with Popeyes' tag in the words column beside it (Popeyes is the last job, so it lands there)
// Every photo and tag appears exactly once (lib/gallery/jobs.test.ts).

export const EMBED_BORDER = 1;

export interface JobsGallery { photos: GalleryPhoto[]; boxes: Box[]; plan: Plan; slot: number; panel: number }

export function jobsGallery(columns: Parameters<typeof columnsFor>[1]): JobsGallery {
  const { modal, timeline } = siteContent.cards.jobs;
  const embed = modal.embed!;
  const { itemWidth, gap, tagHeight } = GALLERY.cluster;
  const photoBox: Box = { width: itemWidth, height: (itemWidth * 4) / 3 };
  const tagBox: Box = { width: itemWidth, height: tagHeight };
  // The frame draws its border outside the post's own width, so the post keeps its native pixels.
  const embedBox: Box = { width: embed.width + 2 * EMBED_BORDER, height: embed.height + 2 * EMBED_BORDER };

  const tagAt = (job: number) => modal.photos.length + job;
  const embedAt = modal.photos.length + timeline.length;
  const photosOf = (job: number) => modal.photos.flatMap((photo, i) => (photo.timeline === job ? [i] : []));

  const photos: GalleryPhoto[] = [
    ...modal.photos.map((photo) => ({ src: photo.src, width: photo.width, height: photo.height, alt: photo.alt, caption: photo.caption, captionShort: photo.captionShort ?? null })),
    ...timeline.map((entry, job): GalleryPhoto => ({
      src: entry.logo?.src ?? "", width: tagBox.width, height: tagBox.height, alt: siteContent.cards.jobs.tag.label(entry.employer), caption: null, captionShort: null, tag: job,
    })),
    { src: embed.src, width: embedBox.width, height: embedBox.height, alt: embed.title, caption: null, captionShort: null, embed: { src: embed.src, width: embed.width, height: embed.height, title: embed.title } },
  ];
  const boxes: Box[] = [...modal.photos.map(() => photoBox), ...timeline.map(() => tagBox), embedBox];

  const row = (own: number | undefined, together: number[], aside: number[] = []): Slide => ({
    photo: together[0], photos: together, own, before: [], after: [], together: true, ...(aside.length ? { aside } : {}),
  });
  const slides: Slide[] = [
    row(0, [tagAt(0), ...photosOf(0)]),
    row(1, [tagAt(1), ...photosOf(1)]),
    row(2, [tagAt(2), tagAt(3)]),
    row(undefined, photosOf(3)),
    row(embed.beside, [embedAt], [tagAt(4)]),
  ];

  // A row's media column is as wide as its cluster; the card's is the widest, so the words keep one place on each side.
  const clusterWidth = (slide: Slide) => slide.photos.reduce((sum, photo, i) => sum + boxes[photo].width + (i > 0 ? gap : 0), 0);
  const { slot, panel } = columnsFor(Math.max(...slides.map(clusterWidth)), columns);
  return { photos, boxes, plan: { intro: [], slides, closing: [] }, slot, panel };
}
