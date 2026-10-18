import Image from "next/image";
import { siteContent } from "@/lib/content";
import { GALLERY } from "@/lib/gallery/constants";
import { partId } from "@/lib/gallery/timing";

// Where Talos is headed, the last section of its modal: the specialists it is
// growing into and the eight reactions it answers with, drawn from the brand
// kit's own files exactly as they are (no outline, halo, border or tint; the
// smoke disc is quiet on dark by design). 48px or larger so the figure reads;
// two columns, an icon over its words on a phone and beside them from 640px.
// The specialists' crop is a rounded square at a third of its size, as the kit's.
// Paragraphs sit a paragraph apart; the two grids take a little more room before them.

const ICON = 48;
const LIST = "grid grid-cols-2 gap-x-5 gap-y-5";
const CELL = "flex flex-col gap-2.5 sm:flex-row sm:items-start sm:gap-3";

export function TalosTeam({ compact = false }: { compact?: boolean }) {
  const team = siteContent.cards.talos.team;
  const prose = `text-foreground ${compact ? "text-base leading-relaxed" : "text-lg leading-[1.55]"}`;
  return (
    <section data-mask={partId.talos} data-mask-kind="text" data-talos-team="" className={`flex flex-col ${compact ? "gap-4" : "gap-5"}`} style={{ maxWidth: GALLERY.proseMaxWidth }}>
      <p className={prose}>{team.next}</p>
      <ul aria-label={team.specialistsLabel} className={`${LIST} ${compact ? "mt-2" : "mt-3"}`} data-talos-specialists="">
        {team.specialists.map((specialist) => (
          <li key={specialist.src} className={CELL}>
            <Image src={specialist.src} alt={specialist.alt} width={ICON} height={ICON} className="shrink-0" style={{ borderRadius: ICON / 3 }} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-label text-label text-foreground">{specialist.name}</span>
              <span className="text-base leading-snug text-muted">{specialist.job}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className={prose}>{team.reactions}</p>
      <ul aria-label={team.statesLabel} className={`${LIST} ${compact ? "mt-2" : "mt-3"}`} data-talos-states="">
        {team.states.map((state) => (
          <li key={state.src} className={CELL}>
            <Image src={state.src} alt="" width={ICON} height={ICON} className="shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-label text-label text-foreground">{state.name}</span>
              <span className="text-base leading-snug text-muted">{state.meaning}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
