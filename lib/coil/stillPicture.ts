import { getImageProps } from "next/image";
import { HERO_STILL_SIZE, stillFallback, stillSources, type StillCut, type StillTheme } from "./heroStill";

// The hero still's picture with its final URLs, as Next writes them
// (unoptimized: the render script encodes the stills; a deployment id adds
// ?dpl=). The visible picture (Poster.tsx) and the decode's detached copy both
// read this, so they ask for the same files by construction.
export type StillPictureSource = { media?: string; type: string; srcSet: string };

const stillProps = (src: string, cut: StillCut) => getImageProps({ src, alt: "", ...HERO_STILL_SIZE[cut], unoptimized: true }).props;

export function stillPicture(theme: StillTheme) {
  const sources: StillPictureSource[] = stillSources(theme).map((source) => {
    const props = stillProps(source.src, source.cut);
    return { media: source.media, type: source.type, srcSet: props.srcSet ?? props.src };
  });
  return { sources, img: stillProps(stillFallback(theme), "wide") };
}
