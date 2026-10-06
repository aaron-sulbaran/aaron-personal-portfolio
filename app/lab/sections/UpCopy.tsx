import { siteContent } from "@/lib/content";
import { Kicker, StickyCol } from "./Kicker";
import type { Arrival, KickerFace, UpLayout } from "./settings";

// A static copy of components/UpToNow.tsx and UpToNowList.tsx, in two
// layouts. "today" keeps the heading row over the two offset columns (no
// parallax: the lag replaces it). "beside" puts the kicker and heading in a
// left column that can hold (sticky) while the items pass in one column on
// the right, each arriving in turn.
const AVOID_PAD = 80;

interface Props {
  face: KickerFace;
  sticky: boolean;
  layout: UpLayout;
  arrival: Arrival;
}

function Heading({ text }: { text: string }) {
  return (
    <h2 data-sl-block="heading" data-wave-avoid className="font-display text-section md:max-w-[12ch]">
      <span data-sl-inner className="block">
        {text}
      </span>
    </h2>
  );
}

function Item({ text, index, hair, offset }: { text: string; index: number; hair: boolean; offset: boolean }) {
  return (
    <li data-sl-block="item" data-sl-index={index} className={offset ? "md:translate-y-12" : ""}>
      {hair && <div data-sl-hair aria-hidden="true" className="mb-5 h-px w-full bg-border md:mb-6" />}
      <p data-sl-text className="text-lg leading-[1.55] text-foreground md:text-xl">
        {text}
      </p>
    </li>
  );
}

export function UpCopy({ face, sticky, layout, arrival }: Props) {
  const { label, heading, items } = siteContent.upToNow;
  const hair = arrival === "hairline";
  return (
    <section
      id="up-to-now"
      aria-label={label}
      data-sl-section="up"
      className="relative w-full scroll-mt-24 border-t border-border px-6 py-24 md:px-10 md:py-40"
    >
      {layout === "today" ? (
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 flex flex-col gap-6 md:mb-20 md:flex-row md:items-end md:justify-between">
            <Kicker label={label} face={face} />
            <Heading text={heading} />
          </div>
          <ol data-wave-avoid data-wave-avoid-pad={AVOID_PAD} className="grid gap-10 md:grid-cols-2 md:gap-x-16 md:gap-y-16">
            {items.map((item, i) => (
              <Item key={i} text={item} index={i} hair={hair} offset={i % 2 === 1} />
            ))}
          </ol>
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-12 md:gap-16">
          <StickyCol on={sticky} className="sl-col md:col-span-5">
            <div className="flex flex-col gap-6">
              <Kicker label={label} face={face} />
              <Heading text={heading} />
            </div>
          </StickyCol>
          <ol data-wave-avoid className="flex flex-col gap-12 md:col-span-7 md:gap-16">
            {items.map((item, i) => (
              <Item key={i} text={item} index={i} hair={hair} offset={false} />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
