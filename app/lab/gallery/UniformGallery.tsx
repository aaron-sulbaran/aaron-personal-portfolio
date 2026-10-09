"use client";

import type { LabCard } from "./cards";
import { boxFor, uniformBoxes, type Plan, type Slide } from "./plan";
import { CloseHint, Header, Links, MaskedPhoto, Note, TextBlock } from "./parts";
import { RotatingPhoto } from "./RotatingPhoto";
import type { Settings } from "./settings";

// Round four on desktop, Capital One everywhere: the header at the top left
// (the logo tile on a logo card, the title, the meta line), the opening
// blocks, then every photo its own row with its words beside it, the sides
// alternating, then the closing blocks, the links and the close hint. Every
// vertical photo is drawn in one box and every horizontal one in another,
// so photos of one orientation are always the same size. Round five: a row
// whose photos take turns draws them in one frame beside its words, and no
// row shows a placeholder.

type Props = { card: LabCard; plan: Plan; aspects: number[]; s: Settings; theme: "light" | "dark"; slot: number; reduced: boolean; runKey: string };

const JUSTIFY = {
  text: { left: "justify-end", right: "justify-start" },
  edge: { left: "justify-start", right: "justify-end" },
  center: { left: "justify-center", right: "justify-center" },
} as const;

export function UniformGallery({ card, plan, aspects, s, theme, slot, reduced, runKey }: Props) {
  const boxes = uniformBoxes(s.verticalWidth, s.horizontalWidth, s.horizontalShape);
  const prose = (b: number) => <TextBlock key={`block-${b}`} card={card} block={b} compact={false} className="max-w-[62ch]" />;

  const row = (slide: Slide, i: number) => {
    const side = i % 2 === 0 ? "left" : "right";
    const box = boxFor(aspects[slide.photo], boxes, s.wideFrom);
    const turns = slide.photos && slide.photos.length > 1 ? slide.photos : null;
    const words = (b: number) => <TextBlock key={`block-${b}`} card={card} block={b} compact={false} />;
    return (
      <div
        key={`photo-${slide.photo}`}
        data-turns={turns ? turns.length : undefined}
        className={`flex ${side === "right" ? "flex-row-reverse" : "flex-row"} ${s.textAlign === "center" ? "items-center" : "items-start"}`}
        style={{ columnGap: s.columnGap }}
        data-row="photo"
        data-side={side}
      >
        <div className={`flex shrink-0 ${JUSTIFY[s.photoAlign][side]}`} style={{ width: slot }}>
          {turns ? (
            // A replay or a new start delay starts the turns over from the first photo, which the masks bring in.
            <RotatingPhoto key={`${runKey}|${s.rotateDelayMs}`} card={card} photos={turns} boxes={turns.map((p) => boxFor(aspects[p], boxes, s.wideFrom))} s={s} reduced={reduced} />
          ) : (
            <MaskedPhoto photo={card.photos[slide.photo]} index={slide.photo} box={box} aspect={box.width / box.height} flown={slide.photo === card.flownPhoto} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4" style={{ maxWidth: s.textWidth }} data-text-column="">
          {slide.before.map(words)}
          {slide.own !== undefined ? words(slide.own) : !slide.photos && <Note photo={card.photos[slide.photo]} index={slide.photo} compact={false} />}
          {slide.after.map(words)}
        </div>
      </div>
    );
  };

  return (
    <>
      <Header card={card} theme={theme} compact={false} />
      <div className="flex flex-col" style={{ rowGap: s.rowGap }}>
        {plan.intro.map(prose)}
        {plan.slides.map(row)}
        {plan.closing.map(prose)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <Links card={card} />
        <CloseHint />
      </div>
    </>
  );
}
