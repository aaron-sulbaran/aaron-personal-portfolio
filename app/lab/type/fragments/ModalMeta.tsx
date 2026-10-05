import type { CSSProperties } from "react";
import Image from "next/image";
import { ArrowRight, X } from "lucide-react";
import { siteContent } from "@/lib/content";
import { useShown } from "../context";
import { RoleLineText } from "../pairs";
import { role } from "../Specimen";

// components/WorkModal.tsx and PhotoModal.tsx, the panels only (no backdrop,
// no portal, no focus trap), with the logo and photo drawn in their slots as a
// book-row open draws them. The site's bg-background/85 and /80 emit nothing
// under Tailwind 3 (a known issue), so the panels are clear there as here.
const item = siteContent.workItems[0];
const photo = siteContent.photos.find((p) => p.src === "/photos/yosemite-hiking.jpeg") ?? siteContent.photos[0];

const workTintStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 18%, transparent) 0%, color-mix(in srgb, var(--color-glass) 50%, transparent) 48%, color-mix(in srgb, var(--color-accent) 40%, transparent) 100%)",
};

function Close() {
  return (
    <span
      aria-hidden="true"
      className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground"
    >
      <X aria-hidden="true" className="h-4 w-4" />
    </span>
  );
}

export function ModalMeta() {
  const hint = siteContent.modals.closeHintKeyboard;
  const line = useShown().roleLineModal;
  const roleLine = <RoleLineText line={line} text={`${item.role}, ${item.year}`} />;
  const cta = role("controls", 18, true);
  return (
    <div className="flex flex-col gap-12">
      <div className="relative flex w-full max-w-xl flex-col gap-6 overflow-hidden rounded-2xl border border-border bg-background/85 p-6 shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl md:p-10">
        <Close />
        <div className="flex items-center gap-5 pr-12">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
            <span aria-hidden="true" className="absolute inset-0" style={workTintStyle} />
            <div className="absolute inset-0 flex items-center justify-center p-2.5">
              <Image src={item.logo} alt={`${item.title} logo`} width={120} height={120} className="h-auto w-[86%] object-contain opacity-90" />
            </div>
          </div>
          <div className="flex flex-col" style={{ gap: line.gap }}>
            {line.placement === "above" && roleLine}
            <h2 className="font-display text-3xl leading-tight text-foreground md:text-4xl">{item.title}</h2>
            {line.placement === "below" && roleLine}
          </div>
        </div>
        <p className="text-base leading-relaxed text-foreground md:text-lg md:leading-[1.55]">{item.teaser}</p>
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <a
            href="#modal"
            className="group inline-flex items-center gap-2 text-lg font-medium text-accent transition-colors duration-200 hover:text-accent-hover"
            {...cta}
            style={{ ...cta.style, gap: "var(--lab-icon-gap, 8px)" }}
          >
            {siteContent.work.cta}
            <ArrowRight aria-hidden="true" className="lab-icon lab-arrow h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <span className="text-sm text-muted" {...role("meta", 14, false, "hint")}>
            {hint}
          </span>
        </div>
      </div>

      <div className="relative flex w-full max-w-4xl flex-col gap-6 overflow-hidden rounded-2xl border border-border bg-background/85 p-5 shadow-[0_40px_80px_-20px_rgba(10,10,10,0.45)] backdrop-blur-xl md:flex-row md:gap-10 md:p-8">
        <Close />
        <div className="relative mt-12 aspect-[3/4] w-full shrink-0 overflow-hidden rounded-xl md:mt-0 md:w-[46%]">
          <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 768px) 380px, 100vw" className="object-cover" />
        </div>
        <div className="flex flex-1 flex-col justify-center pt-2 md:pt-0">
          <p className="text-2xl leading-[1.25] text-foreground md:text-3xl md:leading-[1.2]">{photo.caption}</p>
          <p className="mt-5 text-sm text-muted" {...role("meta", 14, false, "hint")}>
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}
