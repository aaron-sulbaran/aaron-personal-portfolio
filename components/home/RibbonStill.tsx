import { CardFace } from "@/components/card/CardFace";
import { strandCards } from "@/lib/content";

// The ribbon where no scene draws it (JavaScript off, reduced motion, no WebGL
// 2): the fourteen cards' faces as plain DOM in one still row, centered, its
// edges fading out. app/globals.css shows it only then ([data-ribbon-still]);
// a scene that is drawing, or on its way, leaves it display none (so its lazy
// images are never fetched). The faces are the Coil's own (CardFace), so it
// reads as the same cards. A Server Component.
export function RibbonStill() {
  return (
    <div aria-hidden="true" data-ribbon-still="" className="ribbon-still">
      {strandCards.map((card) => (
        <div key={card.key} className="ribbon-still__card">
          <CardFace face={card.face} />
        </div>
      ))}
    </div>
  );
}
