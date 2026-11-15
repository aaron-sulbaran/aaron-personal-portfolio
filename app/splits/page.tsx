import type { Metadata } from "next";
import { splitsCopy } from "@/lib/content/splits";
import { OPEN_GRAPH_BASE, TWITTER_BASE } from "@/lib/pageShare";

const { title, description, image } = splitsCopy;
const card = { url: image.url, width: image.width, height: image.height, alt: image.alt };

// What X's crawler reads (next.config.mjs sends everyone else to /speedrun).
// The root layout's file-based card is not attached here, so the page carries
// exactly one og:image and one twitter:image.
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  robots: { index: false, follow: false },
  openGraph: { ...OPEN_GRAPH_BASE, title, description, url: splitsCopy.path, images: [card] },
  twitter: { ...TWITTER_BASE, title, description, images: [{ url: image.url, alt: image.alt }] },
};

export default function SplitsPage() {
  const { body } = splitsCopy;
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 pb-32 pt-32 md:pt-40">
      <p>
        {body.before}
        <a href={body.href} className="underline underline-offset-4">
          {body.link}
        </a>
        {body.after}
      </p>
    </main>
  );
}
