import type { Gallery } from "@/lib/gallery/card";
import { CardHeader } from "./CardHeader";
import { CardLinks } from "./CardLinks";
import { CloseHint } from "./CloseHint";
import { talosAfter } from "./talosParts";
import { TalosTeam } from "./TalosTeam";
import { Words } from "./Words";

// A phone modal for a card with no photos (min/Max, Talos, This site, the
// family business): the header, every paragraph, the links and the close
// hint, a short modal that scrolls with the backdrop. Talos puts its sting and its
// Discord channel among the paragraphs and its team after them.
export function CardWords({ gallery, renderMedia, flying }: { gallery: Gallery; renderMedia: boolean; flying: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <CardHeader cardKey={gallery.key} renderMedia={renderMedia} compact />
      <div className="flex flex-col gap-4">
        {gallery.words.map((_, unit) => [
          <Words key={unit} gallery={gallery} unit={unit} compact />,
          gallery.key === "talos" ? talosAfter(unit, flying) : null,
        ])}
        {gallery.key === "talos" && <TalosTeam compact />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <CardLinks cardKey={gallery.key} />
        <CloseHint />
      </div>
    </div>
  );
}
