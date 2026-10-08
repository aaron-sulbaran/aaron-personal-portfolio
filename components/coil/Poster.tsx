import Image from "next/image";
import { bakedLockupRect, mediaStillCut, type BakedLockup, type StillCut, type StillTheme } from "@/lib/coil/heroStill";
import { stillPicture } from "@/lib/coil/stillPicture";
import type { StillView } from "@/lib/home/stillReadiness";

// The stage's posters, under the canvas, one per theme. The field at
// fieldTime(0) (?coildebug=poster, 1440x900) carries the hero while a scene
// is on its way, and the entrance flies in from it. The hero still (the scene
// at rest, ?coildebug=still through scripts/render-posters.mjs, three cuts at
// 2x in AVIF and WebP) covers it in data-scene="still": no scene can run. Its
// images load lazily, so a scene visitor never fetches them; once a still has
// shown (warm) both themes' load eagerly, so a theme toggle finds the other
// one in. data-still-ready marks the current theme's still decoded
// (useHeroStill.ts): the h1 hides only then (HeroText.tsx), and the still
// waits at opacity 0 until then, so the two never show together. While the
// loader's resting lockup holds, its stylesheet keeps the still at opacity 0
// until the lockup hands to it (loaderMarkup.ts). data-still-late: a still
// arriving after the h1 lockup took the name dissolves in under it by CSS
// (loaderMarkup.ts), the h1 hidden only once that ends.
export function Poster({ still }: { still: StillView }) {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <Image src="/coil/field-light.avif" alt="" fill unoptimized sizes="100vw" className="object-cover dark:hidden" />
      <Image src="/coil/field-dark.avif" alt="" fill unoptimized sizes="100vw" className="hidden object-cover dark:block" />
      <div
        data-hero-still
        data-still-ready={still.ready ? "" : undefined}
        data-still-late={still.late ? "" : undefined}
        className="absolute inset-0 hidden group-data-[scene=still]/hero:block [&:not([data-still-ready])]:opacity-0"
      >
        <StillPicture theme="light" warm={still.warm} className="dark:hidden" />
        <StillPicture theme="dark" warm={still.warm} className="hidden dark:block" />
      </div>
    </div>
  );
}

// Next's art direction: one picture, a source per cut and format, the img
// the wide WebP.
function StillPicture({ theme, warm, className }: { theme: StillTheme; warm: boolean; className: string }) {
  const { sources, img } = stillPicture(theme);
  return (
    <picture className={`absolute inset-0 ${className}`}>
      {sources.map((source) => (
        <source key={source.srcSet} media={source.media} type={source.type} srcSet={source.srcSet} />
      ))}
      <img {...img} loading={warm ? "eager" : img.loading} alt="" className="h-full w-full object-cover" />
    </picture>
  );
}

// The still the theme's picture will show, fetched and decoded: a detached
// copy of the same picture (stillPicture's URLs, so the same file; the
// visible one, display:none in the other theme, reads it from cache). It
// resolves only with pixels (a natural width). Not memoized: the readiness
// store (lib/home/stillReadiness.ts) keeps the one in flight and asks again
// after a failure.
export function decodeHeroStill(theme: StillTheme): Promise<void> {
  const { sources, img: fallback } = stillPicture(theme);
  const picture = document.createElement("picture");
  for (const s of sources) {
    const source = document.createElement("source");
    if (s.media) source.media = s.media;
    source.type = s.type;
    source.srcset = s.srcSet;
    picture.append(source);
  }
  const img = document.createElement("img");
  img.loading = "eager";
  picture.append(img);
  img.src = fallback.src;
  return img.decode().then(() => {
    if (!img.complete || !img.naturalWidth) throw new Error(`The ${theme} hero still has no pixels.`);
  });
}

// The lockup the visible still bakes, where it shows: the cut the picture
// chose (its img's file; its media queries should the file not say) through
// object-fit cover in the still's own box, then into viewport px. null while
// the box does not show (no still mode yet).
export function heroStillTarget(): BakedLockup | null {
  const box = document.querySelector<HTMLElement>("[data-hero-still]");
  if (!box || !box.clientWidth || !box.clientHeight) return null;
  const img = [...box.querySelectorAll("img")].find((el) => el.getClientRects().length > 0);
  const chosen = img?.currentSrc.match(/hero-(?:light|dark)-(wide|square|narrow)\./)?.[1] as StillCut | undefined;
  const cut = chosen ?? mediaStillCut((query) => window.matchMedia(query).matches);
  const b = bakedLockupRect(cut, box.clientWidth, box.clientHeight);
  const { left: x, top: y } = box.getBoundingClientRect();
  return {
    ...b,
    left: b.left + x,
    baseline: b.baseline + y,
    greeting: { ...b.greeting, left: b.greeting.left + x, baseline: b.greeting.baseline + y },
    gradient: { ...b.gradient, top: b.gradient.top + y },
  };
}
