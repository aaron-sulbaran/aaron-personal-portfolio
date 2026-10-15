import type { LogoRef, StrandFace } from "@/lib/content";
import { needsGround } from "@/lib/coil/cardFace";
import { CardFace } from "@/components/card/CardFace";

// Every tile face is the same portrait, so a year reads as one size of card.
// A logo is an img fitted inside that portrait (object-contain): a wordmark
// letterboxes, a mark fills it, and neither changes the card's shape.

const PORTRAIT =
  "relative block aspect-[3/4] w-[92px] shrink-0 overflow-hidden rounded-xl [box-shadow:inset_0_0_0_1px_var(--card-hair)] sm:w-[112px]";

export function LaneThumb({ face }: { face: StrandFace | undefined }) {
  if (face?.kind === "logo") return <LogoThumb logo={face.logo} tile={face.tile} />;
  return (
    <span data-quick-thumb="" aria-hidden="true" className={PORTRAIT}>
      <span data-quick-media="" className="absolute inset-0 block">
        {face && <CardFace face={face} />}
      </span>
    </span>
  );
}

function LogoThumb({ logo, tile }: { logo: LogoRef; tile: "plain" | "anvil" }) {
  const pane = tile === "anvil" ? "bg-[color:var(--card-anvil)]" : "bg-[color:var(--card-work-pane)]";
  const ground = needsGround(logo, tile, true) ? "dark:bg-[color:var(--card-logo-ground)]" : "";
  return (
    <span data-quick-thumb="" aria-hidden="true" className={`${PORTRAIT} ${pane} ${ground}`}>
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
