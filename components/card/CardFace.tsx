import Image from "next/image";
import type { LogoRef, StrandFace } from "@/lib/content";
import { cardDims, cardPhotoInset, circlesLayout, containBox, faceGround, logoBox, needsGround } from "@/lib/coil/cardFace";
import { COIL } from "@/lib/coil/constants";
import { AsMark } from "@/components/menu/BrandMark";

// The Coil card's face as markup, for the modal header's tile when no flown card
// lands there: the same pane tokens, fits, plate rule and photo inset as
// lib/coil/textures.ts, so a tapped card's modal shows the card the Coil draws.
// Every size and corner here is read from COIL.face and lib/coil/cardFace (the
// painter's own dims and photo inset), never copied as a literal, so a retune
// reaches the tile and the Coil together. A photo card's face shows only in the
// phone header (components/card/CardHeader).

const DIMS = cardDims(COIL.lab.textureSize);
const INSET = cardPhotoInset(COIL.lab.textureSize);
const pct = (fraction: number) => `${fraction * 100}%`;
// A corner radius given in card widths on a box `width` by `height` card widths:
// a percent radius is relative to the box's own width across and height down, so
// this draws the painter's pixel radius exactly at any tile size.
const corners = (radius: number, width: number, height: number) => `${pct(radius / width)} / ${pct(radius / height)}`;

// The rim's hairline is an inset shadow, not a border: a border would shrink the
// box every percent inside the pane resolves against, so a logo would no longer
// be its share of the whole tile as the painter draws it (Talos's mark on its
// 51px phone tile would fall to 19.6px, under its kit's 20px).
const PANE = "absolute inset-0 overflow-hidden";
const PANE_STYLE = { borderRadius: `${pct(DIMS.radius / DIMS.w)} / ${pct(DIMS.radius / DIMS.h)}`, boxShadow: "inset 0 0 0 1px var(--card-hair)" };
const WORK = "bg-[color:var(--card-work-pane)]";
const CENTRED = "absolute left-1/2 top-1/2 h-auto -translate-x-1/2 -translate-y-1/2";

export function CardFace({ face }: { face: StrandFace }) {
  if (face.kind === "photo") return <PhotoFace src={face.src} />;
  if (face.kind === "mark") {
    return (
      <div className={`${PANE} ${WORK} flex items-center justify-center`} style={PANE_STYLE} data-face="mark">
        <div style={{ width: pct(COIL.face.markWidth) }}>
          <AsMark fit="tight" className="block h-auto w-full text-accent" />
        </div>
      </div>
    );
  }
  if (face.kind === "circles") return <Circles logos={face.logos} />;
  return <Logo logo={face.logo} tile={face.tile} />;
}

function Logo({ logo, tile }: { logo: LogoRef; tile: "plain" | "anvil" }) {
  const pane = tile === "anvil" ? "bg-[color:var(--card-anvil)]" : WORK;
  const aspect = logo.width / logo.height;
  const size = { width: Math.round(logo.width), height: Math.round(logo.height) };
  if (logo.opaque) {
    // The painter's opaque square: contained in the photo inset's width, with the inset's corners.
    const box = containBox(aspect, 1 - 2 * INSET.x);
    const ground = faceGround(logo);
    return (
      <div className={`${PANE} ${pane} flex items-center justify-center`} style={ground ? { ...PANE_STYLE, background: ground } : PANE_STYLE} data-face="logo">
        <div
          className="relative overflow-hidden"
          style={{ width: pct(box.w), aspectRatio: `${logo.width} / ${logo.height}`, borderRadius: corners(INSET.radius, box.w, box.h) }}
        >
          <Image src={logo.src} alt="" fill sizes="80px" className="object-contain" />
        </div>
      </div>
    );
  }
  const box = logoBox(aspect, 1, COIL.face);
  const pad = COIL.face.plateInset;
  const plate = { w: box.w + 2 * pad, h: box.h + 2 * pad };
  return (
    <div className={`${PANE} ${pane}`} style={PANE_STYLE} data-face="logo">
      {needsGround(logo, tile, true) && (
        <span
          aria-hidden="true"
          className={`${CENTRED} hidden bg-[color:var(--card-logo-ground)] dark:block`}
          style={{ width: pct(plate.w), height: pct(plate.h * COIL.cardAspect), borderRadius: corners(INSET.radius, plate.w, plate.h) }}
          data-plate=""
        />
      )}
      <Image src={logo.src} alt="" {...size} className={`${CENTRED} ${logo.srcDark ? "dark:hidden" : ""}`} style={{ width: pct(box.w) }} />
      {logo.srcDark && <Image src={logo.srcDark} alt="" {...size} className={`${CENTRED} hidden dark:block`} style={{ width: pct(box.w) }} />}
    </div>
  );
}

// The card picture inset in its pane, cropped as the paint crops it.
const insetBox = {
  left: `${INSET.x * 100}%`,
  right: `${INSET.x * 100}%`,
  top: `${INSET.y * 100}%`,
  bottom: `${INSET.y * 100}%`,
  borderRadius: `${(INSET.radius / (1 - 2 * INSET.x)) * 100}% / ${((INSET.radius * COIL.cardAspect) / (1 - 2 * INSET.y)) * 100}%`,
};

function PhotoFace({ src }: { src: string }) {
  return (
    <div className={`${PANE} bg-[color:var(--card-pane)]`} style={PANE_STYLE} data-face="photo">
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
    <div className={`${PANE} ${WORK}`} style={PANE_STYLE} data-face="circles">
      {circlesLayout(logos.length, COIL.cardAspect, COIL.face.circles).map((c, i) => (
        <span
          key={logos[i].src}
          className="absolute flex items-center justify-center rounded-full border border-[color:var(--card-hair)] bg-[color:var(--card-logo-ground)]"
          style={{ left: `${(c.x - c.r) * 100}%`, top: `${((c.y - c.r) / height) * 100}%`, width: `${c.r * 200}%`, height: `${((c.r * 2) / height) * 100}%` }}
          data-disc={i}
        >
          <Image
            src={logos[i].src}
            alt=""
            width={Math.round(logos[i].width)}
            height={Math.round(logos[i].height)}
            className="h-auto w-auto"
            style={{ maxWidth: pct(COIL.face.circles.logo), maxHeight: pct(COIL.face.circles.logo) }}
          />
        </span>
      ))}
    </div>
  );
}
