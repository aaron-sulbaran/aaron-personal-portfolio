import Image, { getImageProps } from "next/image";
import { HERO_STILL_SIZE, stillFallback, stillSources, type StillCut, type StillTheme } from "@/lib/coil/heroStill";

// The stage's posters, under the canvas, one per theme. The field at
// fieldTime(0) (?coildebug=poster, 1440x900) carries the hero while a scene
// is on its way, and the entrance flies in from it. The hero still (the scene
// at rest, ?coildebug=still through scripts/render-posters.mjs, three cuts at
// 2x in AVIF and WebP) covers it in data-scene="still": no scene can run. Its
// images load lazily, so a scene visitor never fetches them. data-still-ready
// marks a decoded still: the h1 hides only then (HeroText.tsx), and while the
// loader's resting lockup holds, its stylesheet keeps the still at opacity 0
// until the lockup hands to it (loaderMarkup.ts).
export function Poster({ stillReady }: { stillReady: boolean }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <Image src="/coil/field-light.avif" alt="" fill unoptimized sizes="100vw" className="object-cover dark:hidden" />
      <Image src="/coil/field-dark.avif" alt="" fill unoptimized sizes="100vw" className="hidden object-cover dark:block" />
      <div data-hero-still data-still-ready={stillReady ? "" : undefined} className="absolute inset-0 hidden group-data-[scene=still]/hero:block">
        <StillPicture theme="light" className="dark:hidden" />
        <StillPicture theme="dark" className="hidden dark:block" />
      </div>
    </div>
  );
}

// Next's art direction: getImageProps per source (unoptimized: the render
// script encodes the stills), one picture, the img the wide WebP.
const stillProps = (src: string, cut: StillCut) => getImageProps({ src, alt: "", ...HERO_STILL_SIZE[cut], unoptimized: true }).props;

function StillPicture({ theme, className }: { theme: StillTheme; className: string }) {
  const img = stillProps(stillFallback(theme), "wide");
  return (
    <picture className={`absolute inset-0 ${className}`}>
      {stillSources(theme).map((source) => {
        const props = stillProps(source.src, source.cut);
        return <source key={source.src} media={source.media} type={source.type} srcSet={props.srcSet ?? props.src} />;
      })}
      <img {...img} alt="" className="h-full w-full object-cover" />
    </picture>
  );
}

const decoding = new Map<StillTheme, Promise<void>>();

// The still this visitor's picture will show, fetched and decoded: a detached
// copy of the same picture (the same sources, so the same cut and format),
// memoized per theme, so the loader's decoded() returns the in-flight promise
// and the visible picture reads the file from cache.
export function decodeHeroStill(): Promise<void> {
  const theme: StillTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  let promise = decoding.get(theme);
  if (!promise) {
    const picture = document.createElement("picture");
    for (const s of stillSources(theme)) {
      const source = document.createElement("source");
      if (s.media) source.media = s.media;
      source.type = s.type;
      source.srcset = s.src;
      picture.append(source);
    }
    const img = document.createElement("img");
    img.loading = "eager";
    picture.append(img);
    img.src = stillFallback(theme);
    promise = img.decode();
    decoding.set(theme, promise);
  }
  return promise;
}
