import { siteContent } from "@/lib/content";
import { GALLERY } from "@/lib/gallery/constants";
import { partId } from "@/lib/gallery/timing";

// Where Talos is headed, the last words of its modal, under the Discord channel:
// the specialists it is growing into, then what its reactions say. Paragraphs a
// paragraph apart, as the paragraphs above.
export function TalosTeam({ compact = false }: { compact?: boolean }) {
  const team = siteContent.cards.talos.team;
  const prose = `text-foreground ${compact ? "text-base leading-relaxed" : "text-lg leading-[1.55]"}`;
  return (
    <section data-mask={partId.talos} data-mask-kind="text" data-talos-team="" className={`flex flex-col ${compact ? "gap-4" : "gap-5"}`} style={{ maxWidth: GALLERY.proseMaxWidth }}>
      <p className={prose}>{team.next}</p>
      <p className={prose}>{team.reactions}</p>
    </section>
  );
}
