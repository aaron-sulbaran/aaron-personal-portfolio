import Image from "next/image";
import type { LogoRef, StrandFace } from "@/lib/content";
import { faceGround, needsGround } from "@/lib/coil/cardFace";
import { COIL } from "@/lib/coil/constants";
import { AsMark } from "@/components/menu/BrandMark";
import { CardFace } from "@/components/card/CardFace";

// Every tile face is the same 3:4 portrait in one rounded frame with one
// hairline, so a year reads as one size of card. A photo fills the frame edge to
// edge. A logo is an img fitted inside it (object-contain): a wordmark
// letterboxes, a mark fills it, and neither changes the card's shape; an opaque
// logo (the IEEE square) gives the whole frame its own ground, so the tile reads
// as one card. The hairline is drawn over the picture, not under it. The Coil card's inset face is not used here: it nests a second
// pane and a second hairline in the frame.

const PORTRAIT =
  "relative block aspect-[3/4] w-[92px] shrink-0 overflow-hidden rounded-xl after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:content-[''] after:[box-shadow:inset_0_0_0_1px_var(--card-hair)] sm:w-[112px]";

// The portrait's drawn width: 92px, and 112px from sm (640px).
const THUMB_SIZES = "(min-width: 640px) 112px, 92px";

export function LaneThumb({ face }: { face: StrandFace | undefined }) {
  if (face?.kind === "logo") return <LogoThumb logo={face.logo} tile={face.tile} />;
  return (
    <span data-quick-thumb="" aria-hidden="true" className={`${PORTRAIT} ${face?.kind === "photo" ? "bg-[color:var(--card-pane)]" : "bg-[color:var(--card-work-pane)]"}`}>
      <span data-quick-media="" className="absolute inset-0 block">
        {face?.kind === "photo" && <Image src={face.src} alt="" fill sizes={THUMB_SIZES} quality={90} className="object-cover" />}
        {face?.kind === "mark" && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span style={{ width: `${COIL.face.markWidth * 100}%` }}>
              <AsMark fit="tight" className="block h-auto w-full text-accent" />
            </span>
          </span>
        )}
        {face?.kind === "circles" && <CardFace face={face} />}
      </span>
    </span>
  );
}

function LogoThumb({ logo, tile }: { logo: LogoRef; tile: "plain" | "anvil" }) {
  const ground = faceGround(logo);
  const pane = tile === "anvil" ? "bg-[color:var(--card-anvil)]" : "bg-[color:var(--card-work-pane)]";
  const plate = needsGround(logo, tile, true) ? "dark:bg-[color:var(--card-logo-ground)]" : "";
  return (
    <span data-quick-thumb="" aria-hidden="true" className={`${PORTRAIT} ${ground ? "" : `${pane} ${plate}`}`} style={ground ? { background: ground } : undefined}>
      <span data-quick-media="" className="absolute inset-0 flex items-center justify-center p-2.5">
        <LogoImage logo={logo} />
      </span>
    </span>
  );
}

function LogoImage({ logo }: { logo: LogoRef }) {
  const frame = "max-h-full max-w-full object-contain";
  return (
    <>
      <img src={logo.src} alt="" className={`${frame} ${logo.srcDark ? "dark:hidden" : ""}`} />
      {logo.srcDark && <img src={logo.srcDark} alt="" className={`${frame} hidden dark:block`} />}
    </>
  );
}
