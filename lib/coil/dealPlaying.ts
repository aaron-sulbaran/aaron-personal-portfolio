// "The deal is playing": html[data-deal] is dealing or unfurled. The title
// fill pool (components/coil/fill/pool.ts) and the flight overlay's warm-up
// (components/coil/scene/flight.ts) both stay out of the cutscene's frames by it.
const PLAYING = new Set(["dealing", "unfurled"]);

export const isDealPlaying = (state: string | undefined) => PLAYING.has(state ?? "");

export const dealPlaying = () => isDealPlaying(document.documentElement.dataset.deal);
