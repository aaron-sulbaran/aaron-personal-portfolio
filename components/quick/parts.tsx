import Image from "next/image";
import { AsMark } from "@/components/menu/BrandMark";
import { quickRange, type QuickEntry, type QuickSign } from "@/lib/content/quick";
import type { LogoRef } from "@/lib/content/types";

// The pieces every variant shares: an entry's words, its card picture or logo,
// a dated sign. The words are always in the markup and never move; only a
// data-quick-thumb's clip is ever touched (useCheckpointTrack).

export const PHOTO_THUMB = { width: 96, height: 128, sizes: "96px" } as const;

export function EntryText({ entry, as: Heading = "h3" }: { entry: QuickEntry; as?: "h2" | "h3" }) {
  return (
    <div className="min-w-0">
      <p className="font-label text-label text-accent">{quickRange(entry)}</p>
      <Heading className="mt-1 font-display text-[1.75rem] leading-[1.1] text-foreground">{entry.org}</Heading>
      <p className="mt-1 font-label text-label text-muted">{entry.role}</p>
      <p className="mt-3 max-w-prose text-foreground">{entry.line}</p>
      <ul className="mt-2 flex max-w-prose flex-col gap-1 text-muted">
        {entry.outcomes.map((outcome) => (
          <li key={outcome} className="pl-4 [text-indent:-1rem] before:mr-2 before:text-accent before:content-['+']">
            {outcome}
          </li>
        ))}
      </ul>
    </div>
  );
}

// The card picture, 3:4, as a thumbnail that masks in when its checkpoint is reached.
export function PhotoThumb({ entry }: { entry: QuickEntry }) {
  if (!entry.photo) return null;
  return (
    <div data-quick-thumb="" className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl bg-border">
      <Image
        data-quick-media=""
        src={entry.photo.src}
        alt={entry.photo.alt}
        width={entry.photo.width}
        height={entry.photo.height}
        sizes={PHOTO_THUMB.sizes}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

// A logo in both themes' files; one shows at a time. The IEEE square is its own ground and fills the box.
export function LogoImage({ logo, sizes, className = "" }: { logo: LogoRef; sizes: string; className?: string }) {
  const fit = logo.opaque ? "h-full w-full object-cover" : "h-full w-full object-contain";
  return (
    <>
      <Image src={logo.src} alt="" width={logo.width} height={logo.height} sizes={sizes} className={`${fit} ${logo.srcDark ? "dark:hidden" : ""} ${className}`} />
      {logo.srcDark && <Image src={logo.srcDark} alt="" width={logo.width} height={logo.height} sizes={sizes} className={`${fit} hidden dark:block ${className}`} />}
    </>
  );
}

// The entry's mark for a tile (its logo) or a small round node (its square mark), the
// site's own mark for this site, or nothing.
export function EntryMark({ entry, sizes, node = false }: { entry: QuickEntry; sizes: string; node?: boolean }) {
  const logo = node ? entry.mark : entry.logo;
  if (logo) return <LogoImage logo={logo} sizes={sizes} />;
  if (entry.id === "this-site") return <AsMark fit="tight" className="h-full w-full text-foreground" />;
  return null;
}

export const hasMark = (entry: QuickEntry) => Boolean(entry.logo) || entry.id === "this-site";

// A logo tile beside the words, for the variants whose nodes are not logos; a wordmark gets a wider tile.
export function LogoThumb({ entry }: { entry: QuickEntry }) {
  if (!hasMark(entry)) return null;
  const inset = entry.logo?.opaque ? "" : "p-3";
  const wide = entry.logo ? entry.logo.width / entry.logo.height > 2 : false;
  return (
    <div data-quick-thumb="" aria-hidden="true" className={`relative flex h-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background ring-1 ring-inset ring-border ${wide ? "w-32" : "w-20"} ${inset}`}>
      <EntryMark entry={entry} sizes={wide ? "128px" : "80px"} />
    </div>
  );
}

export function SignText({ sign }: { sign: QuickSign }) {
  return (
    <p className="font-label text-label text-foreground">
      <span className="mr-2 text-accent">{sign.at.slice(0, 4)}</span>
      {sign.text}
    </p>
  );
}
