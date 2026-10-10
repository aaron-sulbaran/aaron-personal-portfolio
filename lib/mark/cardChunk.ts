// Where the mark card's lazy chunk comes from. Turbopack builds an import()
// against the chunk group of the module that holds it. MarkTrigger sits in the
// root layout (SiteNav), whose group has no GSAP, so an import() made from
// there shipped the card with its own copy of GSAP and the modal kit, fetched
// again on `/` where the page already has them. The home page provides its own
// import() (MarkCardSource), built against the page's group; a route without
// one (the 404) falls back to the layout's, GSAP included.
type CardModule = { MarkCard: typeof import("@/components/mark/MarkCard").MarkCard };
type LoadCard = () => Promise<CardModule>;

let provided: LoadCard | null = null;

export function provideCardChunk(load: LoadCard) {
  provided = load;
  return () => {
    if (provided === load) provided = null;
  };
}

export function loadCard() {
  return provided ? provided() : import("@/components/mark/MarkCardAnyRoute");
}
