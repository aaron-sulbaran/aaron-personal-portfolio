// The one width the band's player card needs, from the md boundary (768px) up:
// page 1's late grid leaves the card its room at every desktop width (the
// columns right of paragraph 2, app/globals.css --player-room), so the card
// opens in the band there and covers no words. Until 2026-10-30 this was 1024px
// and a tablet docked the player at the isle instead, where its open card sat
// over the paragraph under the band. Narrower than this is a phone, whose band
// holds the card in the flow (client only; the functions read the window when
// called, and the server snapshot says roomy).
export const ROOMY_QUERY = "(min-width: 768px)";

export const subscribeRoomy = (onChange: () => void) => {
  const query = window.matchMedia(ROOMY_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

export const isRoomy = () => window.matchMedia(ROOMY_QUERY).matches;
