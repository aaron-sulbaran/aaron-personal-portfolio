import Image from "next/image";
import type { LogoRef, StrandFace } from "@/lib/content";
import { cardPhotoInset, circlesLayout, logoBox, needsGround } from "@/lib/coil/cardFace";
import { COIL } from "@/lib/coil/constants";
import { AsMark } from "@/components/menu/BrandMark";

// The Coil card's face as markup, for the modal header's tile when no flown card
// lands there: the same pane tokens, fits, plate rule and photo inset as
// lib/coil/textures.ts, so a tapped card's modal shows the card the Coil draws.
// A photo card's face shows only in the phone header (components/card/CardHeader).

const PANE = "absolute inset-0 overflow-hidden rounded-[5%/3.75%] border border-[color:var(--card-hair)]";
const WORK = "bg-[color:var(--card-work-pane)]";
const CENTRED = "absolute left-1/2 top-1/2 h-auto -translate-x-1/2 -translate-y-1/2";

export function CardFace({ face }: { face: StrandFace }) {
  if (face.kind === "photo") return <PhotoFace src={face.src} />;
  if (face.kind === "mark") {
    return (
      <div className={`${PANE} ${WORK} flex items-center justify-center`} data-face="mark">
        <AsMark fit="tight" className="h-auto w-[36%] text-accent" />
      </div>
    );
  }
  if (face.kind === "circles") return <Circles logos={face.logos} />;
  return <Logo logo={face.logo} tile={face.tile} />;
}

function Logo({ logo, tile }: { logo: LogoRef; tile: "plain" | "anvil" }) {
  const pane = tile === "anvil" ? "bg-[color:var(--card-anvil)]" : WORK;
  const size = { width: Math.round(logo.width), height: Math.round(logo.height) };
  if (logo.opaque) {
    return (
      <div className={`${PANE} ${pane} flex items-center justify-center`} data-face="logo">
        <div className="relative aspect-square w-[93%] overflow-hidden rounded-[6%]">
          <Image src={logo.src} alt="" fill sizes="80px" className="object-contain" />
        </div>
      </div>
    );
  }
  const box = logoBox(logo.width / logo.height, 100, COIL.face);
  const pad = COIL.face.plateInset * 100;
  return (
    <div className={`${PANE} ${pane}`} data-face="logo">
      {needsGround(logo, tile, true) && (
        <span
          aria-hidden="true"
          className={`${CENTRED} hidden rounded-[4px] bg-[color:var(--card-logo-ground)] dark:block`}
          style={{ width: `${box.w + 2 * pad}%`, height: `${(box.h + 2 * pad) * COIL.cardAspect}%` }}
          data-plate=""
        />
      )}
      <Image src={logo.src} alt="" {...size} className={`${CENTRED} ${logo.srcDark ? "dark:hidden" : ""}`} style={{ width: `${box.w}%` }} />
      {logo.srcDark && <Image src={logo.srcDark} alt="" {...size} className={`${CENTRED} hidden dark:block`} style={{ width: `${box.w}%` }} />}
    </div>
  );
}

// The card picture inset in its pane, cropped as the paint crops it.
const INSET = cardPhotoInset(COIL.lab.textureSize);
const insetBox = {
  left: `${INSET.x * 100}%`,
  right: `${INSET.x * 100}%`,
  top: `${INSET.y * 100}%`,
  bottom: `${INSET.y * 100}%`,
  borderRadius: `${(INSET.radius / (1 - 2 * INSET.x)) * 100}% / ${((INSET.radius * COIL.cardAspect) / (1 - 2 * INSET.y)) * 100}%`,
};

function PhotoFace({ src }: { src: string }) {
  return (
    <div className={`${PANE} bg-[color:var(--card-pane)]`} data-face="photo">
      <div className="absolute overflow-hidden" style={insetBox}>
        <Image src={src} alt="" fill sizes="80px" className="object-cover" style={{ objectPosition: INSET.objectPosition }} />
      </div>
    </div>
  );
}

// The light logo file in every disc, in both themes: the disc is its ground.
function Circles({ logos }: { logos: readonly LogoRef[] }) {
  const height = 1 / COIL.cardAspect;
  return (
    <div className={`${PANE} ${WORK}`} data-face="circles">
      {circlesLayout(logos.length, COIL.cardAspect, COIL.face.circles).map((c, i) => (
        <span
          key={logos[i].src}
          className="absolute flex items-center justify-center rounded-full border border-[color:var(--card-hair)] bg-[color:var(--card-logo-ground)]"
          style={{ left: `${(c.x - c.r) * 100}%`, top: `${((c.y - c.r) / height) * 100}%`, width: `${c.r * 200}%`, height: `${((c.r * 2) / height) * 100}%` }}
          data-disc={i}
        >
          <Image src={logos[i].src} alt="" width={Math.round(logos[i].width)} height={Math.round(logos[i].height)} className="h-auto max-h-[62%] w-auto max-w-[62%]" />
        </span>
      ))}
    </div>
  );
}
